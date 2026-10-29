/* =============================================================================
   Hana HRM — File 03: report views
   -----------------------------------------------------------------------------
   One view per report of the SRS. The views are the only objects an ordinary
   user reads, which keeps the payroll restriction (NFR-8) in one place and
   lets the reports run without recomputing the rules.
   ============================================================================= */

SET NOCOUNT ON;
GO

/* --------------------------------------------------------------- EIR / EST -- */

/* EIR-1 … EIR-5 — employee information. The salary and bank columns are only
   populated when the session holds the payroll permission (NFR-8). */
CREATE OR ALTER VIEW hr.vw_employee_information
AS
SELECT
    e.employee_id,
    e.employee_code,
    e.full_name,
    c.company_name,
    d.department_name,
    s.section_name,
    g.designation_name,
    w.work_group_name,
    w.group_type,
    t.type_name                                        AS employee_type_name,
    t.is_permanent,
    e.joining_date,
    e.separation_date,
    e.separation_type,
    e.is_active,
    hr.fn_TenureText(e.joining_date, ISNULL(e.separation_date, CAST(SYSUTCDATETIME() AS DATE))) AS tenure,
    hr.fn_TenureParts(e.joining_date, ISNULL(e.separation_date, CAST(SYSUTCDATETIME() AS DATE)))    AS tenure_years,
    CASE WHEN app.fnc_HasPayrollAccess() = 1 THEN e.bank_account_no END AS bank_account_no,
    CASE WHEN app.fnc_HasPayrollAccess() = 1 THEN e.joining_salary  END AS joining_salary,
    CASE WHEN app.fnc_HasPayrollAccess() = 1 THEN e.present_salary  END AS present_salary
FROM hr.employee e
JOIN hr.company       c ON c.company_id = e.company_id
JOIN hr.employee_type t ON t.employee_type_id = e.employee_type_id
JOIN hr.department    d ON d.department_id = e.department_id
JOIN hr.section       s ON s.section_id = e.section_id
JOIN hr.designation   g ON g.designation_id = e.designation_id
JOIN hr.work_group    w ON w.work_group_id = e.work_group_id;
GO

/* EST-2 … EST-5 — headcount by company, work group and permanent / temporary.
   Only active employees are counted. */
CREATE OR ALTER VIEW hr.vw_employee_statement
AS
SELECT
    c.company_id,
    c.company_name,
    w.work_group_id,
    w.work_group_name,
    t.employee_type_id,
    t.type_name                                        AS employee_type_name,
    t.is_permanent,
    COUNT(e.employee_id)                               AS headcount
FROM hr.employee e
JOIN hr.company       c ON c.company_id = e.company_id
JOIN hr.work_group    w ON w.work_group_id = e.work_group_id
JOIN hr.employee_type t ON t.employee_type_id = e.employee_type_id
WHERE e.is_active = 1
GROUP BY c.company_id, c.company_name, w.work_group_id, w.work_group_name,
         t.employee_type_id, t.type_name, t.is_permanent;
GO

/* ------------------------------------------------------------- attendance -- */

/* EDR-4 — the employee daily report. */
CREATE OR ALTER VIEW hr.vw_daily_attendance
AS
SELECT
    a.attendance_date,
    e.employee_id,
    e.employee_code,
    e.full_name,
    g.designation_name,
    d.department_name,
    s.section_name,
    w.work_group_name,
    w.group_type,
    sp.start_time,
    sp.end_time,
    a.day_type,
    a.status,
    a.in_time,
    a.out_time,
    a.punch_count,
    a.delay_minutes,
    a.counted_ot_minutes,
    a.shift_minutes,
    a.net_minutes,
    a.has_manual_entry,
    a.is_incomplete,
    a.remark
FROM hr.attendance_daily a
JOIN hr.employee      e  ON e.employee_id = a.employee_id
JOIN hr.designation   g  ON g.designation_id = e.designation_id
JOIN hr.department    d  ON d.department_id = e.department_id
JOIN hr.section       s  ON s.section_id = e.section_id
JOIN hr.work_group    w  ON w.work_group_id = e.work_group_id
LEFT JOIN hr.shift_policy sp ON sp.shift_policy_id = a.shift_policy_id;
GO

/* DAR-4 — manpower, present count and present ratio per work group and day. */
CREATE OR ALTER VIEW hr.vw_work_group_manpower
AS
SELECT
    a.attendance_date,
    w.work_group_id,
    w.work_group_name,
    COUNT(*)                                                   AS total_manpower,
    SUM(CASE WHEN a.status = 'Present'   THEN 1 ELSE 0 END)    AS present_count,
    SUM(CASE WHEN a.status = 'Absent'    THEN 1 ELSE 0 END)    AS absent_count,
    SUM(CASE WHEN a.status = 'On Leave'  THEN 1 ELSE 0 END)    AS leave_count,
    SUM(CASE WHEN a.status = 'Incomplete' THEN 1 ELSE 0 END)   AS incomplete_count,
    CAST(ROUND(100.0 * SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)
               / NULLIF(COUNT(*), 0), 1) AS DECIMAL(5,1))       AS present_ratio
FROM hr.attendance_daily a
JOIN hr.employee   e ON e.employee_id = a.employee_id
JOIN hr.work_group w ON w.work_group_id = e.work_group_id
GROUP BY a.attendance_date, w.work_group_id, w.work_group_name;
GO

/* DPC-2 — the daily punch count report. */
CREATE OR ALTER VIEW hr.vw_punch_count
AS
SELECT
    p.punch_date,
    e.employee_id,
    e.employee_code,
    e.full_name,
    w.work_group_name,
    s.section_name,
    MIN(p.punch_time)                                     AS in_time,
    MAX(p.punch_time)                                     AS out_time,
    COUNT(*)                                              AS punch_count,
    CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END              AS is_incomplete,
    MAX(CASE WHEN p.source <> 'Device' THEN 1 ELSE 0 END)  AS has_manual_entry
FROM hr.attendance_punch p
JOIN hr.employee e ON e.employee_id = p.employee_id
JOIN hr.work_group w ON w.work_group_id = e.work_group_id
JOIN hr.section  s ON s.section_id = e.section_id
GROUP BY p.punch_date, e.employee_id, e.employee_code, e.full_name, w.work_group_name, s.section_name;
GO

/* DLR-3 / DLR-4 — the delay ratio report. */
CREATE OR ALTER VIEW hr.vw_delay_ratio
AS
SELECT
    e.employee_id,
    e.employee_code,
    e.full_name,
    w.work_group_name,
    SUM(CASE WHEN a.day_type = 'Workday' THEN 1 ELSE 0 END)                    AS total_working_days,
    SUM(CASE WHEN a.day_type = 'Workday' AND a.delay_minutes > 0 THEN 1 ELSE 0 END) AS delay_days,
    SUM(CASE WHEN a.day_type = 'Workday' THEN a.delay_minutes ELSE 0 END)       AS total_delay_minutes,
    CAST(ROUND(100.0 * SUM(CASE WHEN a.day_type = 'Workday' AND a.delay_minutes > 0 THEN 1 ELSE 0 END)
               / NULLIF(SUM(CASE WHEN a.day_type = 'Workday' THEN 1 ELSE 0 END), 0), 1) AS DECIMAL(5,1))
                                                                                AS delay_percentage
FROM hr.attendance_daily a
JOIN hr.employee e ON e.employee_id = a.employee_id
JOIN hr.work_group w ON w.work_group_id = e.work_group_id
GROUP BY e.employee_id, e.employee_code, e.full_name, w.work_group_name;
GO

/* JOB-2 — the job card rows. */
CREATE OR ALTER VIEW hr.vw_job_card
AS
SELECT
    a.attendance_date,
    DATENAME(WEEKDAY, a.attendance_date)                         AS weekday_name,
    a.day_type,
    a.status,
    a.in_time,
    a.out_time,
    a.delay_minutes,
    a.regular_minutes,
    a.total_work_minutes,
    a.shift_minutes,
    w.work_group_name,
    a.remark,
    a.break_minutes,
    a.net_minutes,
    a.counted_ot_minutes,
    a.less_minutes,
    a.has_manual_entry
FROM hr.attendance_daily a
JOIN hr.employee e ON e.employee_id = a.employee_id
JOIN hr.work_group w ON w.work_group_id = e.work_group_id;
GO

/* ------------------------------------------------------------------ leave -- */

/* The leave balance of an employee for a leave type and a year. */
CREATE OR ALTER VIEW hr.vw_leave_balance
AS
SELECT
    e.employee_id,
    e.employee_code,
    e.full_name,
    lt.leave_type_id,
    lt.leave_type_code,
    lt.leave_type_name,
    lt.is_calculated,
    lt.carry_forward_days,
    YEAR(e.joining_date)                                       AS joining_year,
    hr.fn_LeaveBalance(e.employee_id, lt.leave_type_id, YEAR(SYSUTCDATETIME())) AS balance_current_year
FROM hr.employee e
JOIN hr.employee_leave_type elt ON elt.employee_id = e.employee_id
JOIN hr.leave_type lt            ON lt.leave_type_id = elt.leave_type_id
WHERE lt.is_active = 1;
GO

/* LRP-2 / LRP-3 — one row per employee, one column per month. */
CREATE OR ALTER VIEW hr.vw_leave_report
AS
SELECT
    e.employee_id,
    e.employee_code,
    e.full_name,
    c.company_name,
    d.department_name,
    w.work_group_name,
    s.section_name,
    YEAR(l.from_date)                                            AS leave_year,
    SUM(CASE WHEN MONTH(l.from_date) =  1 THEN l.days ELSE 0 END) AS jan_days,
    SUM(CASE WHEN MONTH(l.from_date) =  2 THEN l.days ELSE 0 END) AS feb_days,
    SUM(CASE WHEN MONTH(l.from_date) =  3 THEN l.days ELSE 0 END) AS mar_days,
    SUM(CASE WHEN MONTH(l.from_date) =  4 THEN l.days ELSE 0 END) AS apr_days,
    SUM(CASE WHEN MONTH(l.from_date) =  5 THEN l.days ELSE 0 END) AS may_days,
    SUM(CASE WHEN MONTH(l.from_date) =  6 THEN l.days ELSE 0 END) AS jun_days,
    SUM(CASE WHEN MONTH(l.from_date) =  7 THEN l.days ELSE 0 END) AS jul_days,
    SUM(CASE WHEN MONTH(l.from_date) =  8 THEN l.days ELSE 0 END) AS aug_days,
    SUM(CASE WHEN MONTH(l.from_date) =  9 THEN l.days ELSE 0 END) AS sep_days,
    SUM(CASE WHEN MONTH(l.from_date) = 10 THEN l.days ELSE 0 END) AS oct_days,
    SUM(CASE WHEN MONTH(l.from_date) = 11 THEN l.days ELSE 0 END) AS nov_days,
    SUM(CASE WHEN MONTH(l.from_date) = 12 THEN l.days ELSE 0 END) AS dec_days,
    SUM(l.days)                                                  AS total_days
FROM hr.leave_application l
JOIN hr.employee e ON e.employee_id = l.employee_id
JOIN hr.company   c ON c.company_id = e.company_id
JOIN hr.department d ON d.department_id = e.department_id
JOIN hr.work_group w ON w.work_group_id = e.work_group_id
JOIN hr.section  s ON s.section_id = e.section_id
WHERE l.status IN ('Approved', 'Settled')
GROUP BY e.employee_id, e.employee_code, e.full_name, c.company_name,
         d.department_name, w.work_group_name, s.section_name, YEAR(l.from_date);
GO

/* ELD-2 — the earned leave detail report. */
CREATE OR ALTER VIEW hr.vw_el_detail
AS
SELECT
    e.employee_id,
    e.employee_code,
    e.full_name,
    w.work_group_name,
    w.group_type,
    hr.fn_WorkDaysInYear(e.employee_id, YEAR(SYSUTCDATETIME()), CAST(SYSUTCDATETIME() AS DATE)) AS work_days,
    (SELECT ISNULL(SUM(l.days), 0) FROM hr.leave_ledger l
      WHERE l.employee_id = e.employee_id AND l.entry_type = 'Availed'
        AND l.leave_type_id = (SELECT lt2.leave_type_id FROM hr.leave_type lt2 WHERE lt2.leave_type_code = 'EL')) AS el_taken,
    (SELECT ISNULL(SUM(p.days), 0) FROM hr.earned_leave_payoff p
      WHERE p.employee_id = e.employee_id AND p.leave_year = YEAR(SYSUTCDATETIME())) AS el_paid,
    (SELECT ISNULL(SUM(l.days), 0) FROM hr.leave_ledger l
      WHERE l.employee_id = e.employee_id AND l.entry_type = 'CarryForward'
        AND l.leave_type_id = (SELECT lt2.leave_type_id FROM hr.leave_type lt2 WHERE lt2.leave_type_code = 'EL')) AS el_carried_forward
FROM hr.employee e
JOIN hr.work_group w ON w.work_group_id = e.work_group_id
WHERE e.is_active = 1;
GO
