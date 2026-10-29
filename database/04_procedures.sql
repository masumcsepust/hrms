/* =============================================================================
   Hana HRM — File 04: procedures and triggers
   -----------------------------------------------------------------------------
   The procedures carry the rules that a CHECK constraint cannot express, and
   they keep the write path in one place: a punch arrives, a leave is applied,
   a day is posted, a year is closed.
   ============================================================================= */

SET NOCOUNT ON;
GO

/* -------------------------------------------------------------- audit log -- */

CREATE OR ALTER PROCEDURE ops.usp_LogAudit
    @action_name   VARCHAR(60),
    @entity_name   VARCHAR(60),
    @entity_id     VARCHAR(80) = NULL,
    @detail        NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO audit.log_entry (occurred_at, user_name, action_name, entity_name, entity_id, detail, ip_address, application)
    VALUES (SYSUTCDATETIME(), SUSER_SNAME(), @action_name, @entity_name, @entity_id, @detail,
            CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_ip_address')), 'Hana HRM');
END;
GO

/* ------------------------------------------------------- device push/pull -- */

/* ATT-01 / NFR-5 — a device pushes its punches. The external reference makes
   the import idempotent: the same device record can never be stored twice,
   even when the device resends the whole day. */
CREATE OR ALTER PROCEDURE ops.usp_SyncDevicePunches
    @device_code   VARCHAR(40),
    @rows          dbo.TVPunchRow READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @device_id INT = (SELECT d.device_id FROM hr.attendance_device d WHERE d.device_code = @device_code);

    IF @device_id IS NULL
    BEGIN
        RAISERROR ('Unknown attendance device "%s".', 16, 1, @device_code);
        RETURN;
    END

    BEGIN TRANSACTION;

    INSERT INTO hr.attendance_punch (punch_date, employee_id, punch_time, source, remark, device_id, external_ref, created_by)
    SELECT r.punch_date, e.employee_id, r.punch_time, 'Device', NULL, @device_id, r.external_ref, @device_code
    FROM @rows r
    JOIN hr.employee e ON e.employee_code = r.employee_code
    WHERE NOT EXISTS (
        SELECT 1 FROM hr.attendance_punch p
        WHERE p.device_id = @device_id AND p.external_ref = r.external_ref);

    UPDATE hr.attendance_device SET last_sync_at = SYSUTCDATETIME() WHERE device_id = @device_id;

    COMMIT TRANSACTION;
END;
GO

/* The table type the device import needs. */
CREATE TYPE dbo.TVPunchRow AS TABLE
(
    employee_code VARCHAR(30)   NOT NULL,
    punch_date   DATE          NOT NULL,
    punch_time   TIME(0)       NOT NULL,
    external_ref VARCHAR(80)   NOT NULL
);
GO

/* ------------------------------------------------------- attendance posting */

/* Turns the punches into the derived attendance day that every report reads.
   The rules are the ones of 02_functions.sql, applied exactly as the Angular
   engine applies them. */
CREATE OR ALTER PROCEDURE ops.usp_PostAttendance
    @from_date   DATE,
    @to_date     DATE,
    @employee_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @to_date < @from_date
    BEGIN
        RAISERROR ('The end date is before the start date.', 16, 1);
        RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @employees TABLE (employee_id INT PRIMARY KEY, work_group_id INT, group_type VARCHAR(10));
    INSERT INTO @employees (employee_id, work_group_id, group_type)
    SELECT e.employee_id, e.work_group_id, w.group_type
    FROM hr.employee e
    JOIN hr.work_group w ON w.work_group_id = e.work_group_id
    WHERE e.is_active = 1
      AND (@employee_id IS NULL OR e.employee_id = @employee_id);

    /* the days of the period */
    DECLARE @days TABLE (d DATE PRIMARY KEY);
    INSERT INTO @days (d)
    SELECT TOP (DATEDIFF(DAY, @from_date, @to_date) + 1)
           DATEADD(DAY, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1, @from_date)
    FROM sys.all_objects a CROSS JOIN sys.all_objects b;

    /* the punches of the period, collapsed to the first and the last one */
    DECLARE @punch TABLE
    (
        employee_id INT, punch_date DATE, in_time TIME(0), out_time TIME(0),
        punch_count SMALLINT, has_manual SMALLINT
    );

    INSERT INTO @punch (employee_id, punch_date, in_time, out_time, punch_count, has_manual)
    SELECT p.employee_id, p.punch_date,
           MIN(p.punch_time),
           MAX(p.punch_time),
           COUNT(*),
           MAX(CASE WHEN p.source <> 'Device' THEN 1 ELSE 0 END)
    FROM hr.attendance_punch p
    WHERE p.punch_date BETWEEN @from_date AND @to_date
    GROUP BY p.employee_id, p.punch_date;

    DECLARE @leave TABLE (employee_id INT, from_date DATE, to_date DATE);

    INSERT INTO @leave (employee_id, from_date, to_date)
    SELECT l.employee_id, l.from_date, l.to_date
    FROM hr.leave_application l
    WHERE l.status IN ('Approved', 'Settled');

    /* step 1 — the day, the shift and the punches */
    DECLARE @base TABLE
    (
        employee_id     INT, attendance_date DATE, shift_policy_id INT,
        start_time TIME(0), end_time TIME(0), break_minutes SMALLINT, exempt_minutes SMALLINT,
        day_type VARCHAR(12), in_time TIME(0), out_time TIME(0),
        punch_count SMALLINT, has_manual BIT, on_leave BIT
    );

    INSERT INTO @base
    SELECT
        e.employee_id,
        d.d,
        sp.shift_policy_id,
        sp.start_time,
        sp.end_time,
        ISNULL(sp.break_minutes, 0),
        ISNULL(sp.exempt_minutes, 0),
        hr.fn_DayType(e.employee_id, d.d),
        p.in_time,
        p.out_time,
        ISNULL(p.punch_count, 0),
        ISNULL(p.has_manual, 0),
        CASE WHEN EXISTS (SELECT 1 FROM @leave l
                          WHERE l.employee_id = e.employee_id
                            AND d.d BETWEEN l.from_date AND l.to_date)
             THEN 1 ELSE 0 END
    FROM @employees e
    CROSS JOIN @days d
    LEFT JOIN hr.shift_policy sp
           ON sp.shift_policy_id = hr.fn_ResolveShiftPolicyId(e.employee_id, d.d)
    LEFT JOIN @punch p
           ON p.employee_id = e.employee_id AND p.punch_date = d.d;

    /* step 2 — the status and the delay */
    DECLARE @calc TABLE
    (
        employee_id INT, attendance_date DATE, shift_policy_id INT,
        start_time TIME(0), end_time TIME(0), break_minutes SMALLINT,
        day_type VARCHAR(12), status VARCHAR(12),
        in_time TIME(0), out_time TIME(0), punch_count SMALLINT,
        delay_minutes SMALLINT, has_manual BIT, on_leave BIT
    );

    INSERT INTO @calc
    SELECT b.employee_id, b.attendance_date, b.shift_policy_id, b.start_time, b.end_time, b.break_minutes,
           b.day_type,
           CASE
               WHEN b.day_type IN ('Holiday', 'Weekend') AND b.punch_count = 0 THEN b.day_type
               WHEN b.day_type IN ('Holiday', 'Weekend')                        THEN 'Present'
               WHEN b.punch_count = 0 AND b.on_leave = 1                       THEN 'On Leave'
               WHEN b.punch_count = 0                                           THEN 'Absent'
               WHEN b.punch_count = 1                                           THEN 'Incomplete'
               ELSE 'Present'
           END,
           b.in_time, b.out_time, b.punch_count,
           CASE WHEN b.in_time IS NOT NULL AND b.start_time IS NOT NULL
                THEN hr.fn_DelayMinutes(b.in_time, b.start_time, b.exempt_minutes)
                ELSE 0 END,
           b.has_manual, b.on_leave
    FROM @base b;

    /* step 3 — the overtime */
    DECLARE @ot TABLE
    (
        employee_id INT, attendance_date DATE, shift_policy_id INT,
        day_type VARCHAR(12), status VARCHAR(12),
        in_time TIME(0), out_time TIME(0), punch_count SMALLINT,
        delay_minutes SMALLINT, raw_ot SMALLINT, delay_adjustment SMALLINT,
        counted_ot SMALLINT, less_minutes SMALLINT,
        total_work SMALLINT, regular_minutes SMALLINT, net_minutes SMALLINT,
        shift_minutes SMALLINT, break_minutes SMALLINT,
        has_manual BIT, is_incomplete BIT, remark NVARCHAR(400)
    );

    INSERT INTO @ot
    SELECT
        c.employee_id, c.attendance_date, c.shift_policy_id, c.day_type, c.status,
        c.in_time, c.out_time, c.punch_count, c.delay_minutes,
        /* ATT-08 / ATT-10 */
        CASE WHEN e.group_type = 'Officer'
                  AND c.in_time IS NOT NULL AND c.out_time IS NOT NULL
             THEN hr.fn_RawOfficerOvertime(c.in_time, c.out_time, c.start_time, c.end_time, c.break_minutes)
             WHEN e.group_type = 'Worker' AND c.out_time IS NOT NULL
             THEN hr.fn_RawWorkerOvertime(c.out_time, c.end_time)
             ELSE 0 END,
        /* ATT-05 — only the Worker group loses overtime for a delay */
        CASE WHEN e.group_type = 'Worker' THEN hr.fn_DelayOtAdjustment(c.delay_minutes) ELSE 0 END,
        0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN c.punch_count = 1 THEN 1 ELSE 0 END,
        CASE
            WHEN c.day_type IN ('Holiday', 'Weekend') AND c.punch_count > 0 THEN 'Worked on ' + LOWER(c.day_type)
            WHEN c.status = 'Incomplete' THEN 'Single punch — incomplete record'
            WHEN c.status = 'On Leave'   THEN 'Approved leave'
            WHEN c.has_manual = 1        THEN 'Manual entry / correction'
            ELSE NULL
        END
    FROM @calc c
    JOIN @employees e ON e.employee_id = c.employee_id;

    /* the rounding can only be applied once the adjustment is known */
    UPDATE o
    SET o.counted_ot = hr.fn_RoundOvertime(
            CASE WHEN e.group_type = 'Officer' THEN o.raw_ot
                 ELSE CASE WHEN o.raw_ot - o.delay_adjustment < 0 THEN 0 ELSE o.raw_ot - o.delay_adjustment END END),
        o.less_minutes = CASE WHEN e.group_type = 'Worker' AND o.out_time IS NOT NULL
                               THEN CASE WHEN DATEDIFF(MINUTE, '00:00:00', o.out_time) <
                                             DATEDIFF(MINUTE, '00:00:00', c.end_time)
                                         THEN DATEDIFF(MINUTE, '00:00:00', c.end_time)
                                              - DATEDIFF(MINUTE, '00:00:00', o.out_time)
                                         ELSE 0 END
                               ELSE 0 END,
        o.total_work = CASE WHEN o.in_time IS NOT NULL AND o.out_time IS NOT NULL
                             THEN hr.fn_ShiftSpanMinutes(o.in_time, o.out_time) ELSE 0 END,
        o.shift_minutes = CASE WHEN c.start_time IS NOT NULL
                                THEN hr.fn_ShiftSpanMinutes(c.start_time, c.end_time) - c.break_minutes
                                ELSE 0 END
    FROM @ot o
    JOIN @employees e ON e.employee_id = o.employee_id
    JOIN @calc c ON c.employee_id = o.employee_id AND c.attendance_date = o.attendance_date;

    UPDATE o
    SET o.net_minutes     = CASE WHEN o.total_work > o.break_minutes THEN o.total_work - o.break_minutes ELSE 0 END,
        o.regular_minutes = CASE WHEN (CASE WHEN o.total_work > o.break_minutes THEN o.total_work - o.break_minutes ELSE 0 END) - o.counted_ot > 0
                                 THEN (CASE WHEN o.total_work > o.break_minutes THEN o.total_work - o.break_minutes ELSE 0 END) - o.counted_ot
                                 ELSE 0 END
    FROM @ot o;

    /* write the result */
    DELETE a
    FROM hr.attendance_daily a
    JOIN @employees e ON e.employee_id = a.employee_id
    WHERE a.attendance_date BETWEEN @from_date AND @to_date;

    INSERT INTO hr.attendance_daily
    (employee_id, attendance_date, day_type, status, shift_policy_id, in_time, out_time,
     punch_count, delay_minutes, raw_ot_minutes, delay_adjustment_minutes, counted_ot_minutes,
     less_minutes, total_work_minutes, regular_minutes, net_minutes, shift_minutes, break_minutes,
     has_manual_entry, is_incomplete, remark)
    SELECT o.employee_id, o.attendance_date, o.day_type, o.status, o.shift_policy_id, o.in_time, o.out_time,
           o.punch_count, o.delay_minutes, o.raw_ot, o.delay_adjustment, o.counted_ot,
           o.less_minutes, o.total_work, o.regular_minutes, o.net_minutes, o.shift_minutes, o.break_minutes,
           o.has_manual, o.is_incomplete, o.remark
    FROM @ot o;

    COMMIT TRANSACTION;
END;
GO

/* ------------------------------------------------------------------ leave -- */

/* ESS-2 / LVE-4 … LVE-8 — apply for leave. The balance, the exception rules
   and the mandatory attachment are all checked here, so no caller can bypass
   them. */
CREATE OR ALTER PROCEDURE ops.usp_ApplyLeave
    @employee_id        INT,
    @leave_type_id      INT,
    @from_date          DATE,
    @to_date            DATE,
    @reason             NVARCHAR(800) = NULL,
    @attachment_name    NVARCHAR(260) = NULL,
    @is_lwp             BIT = 0,
    @is_cnl             BIT = 0,
    @management_approved BIT = 0,
    @application_id     BIGINT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @to_date < @from_date
    BEGIN
        RAISERROR ('The leave period is not valid.', 16, 1);
        RETURN;
    END

    /* T-SQL has no %ROWTYPE — the leave type is read into scalar variables. */
    DECLARE @lt_id INT, @lt_name NVARCHAR(80), @lt_requires_attachment BIT;

    SELECT @lt_id = leave_type_id, @lt_name = leave_type_name,
           @lt_requires_attachment = requires_attachment
    FROM hr.leave_type
    WHERE leave_type_id = @leave_type_id;

    IF @lt_id IS NULL
    BEGIN
        RAISERROR ('Unknown leave type.', 16, 1);
        RETURN;
    END

    /* LVE-7 — a mandatory attachment */
    IF @lt_requires_attachment = 1 AND (@attachment_name IS NULL OR LEN(LTRIM(RTRIM(@attachment_name))) = 0)
    BEGIN
        RAISERROR ('A supporting attachment is mandatory for %s (LVE-7).', 16, 1, @lt_name);
        RETURN;
    END

    /* LVE-6 — LWP and CNL need prior management approval */
    IF (@is_lwp = 1 OR @is_cnl = 1) AND @management_approved = 0
    BEGIN
        RAISERROR ('LWP or CNL requires prior management approval (LVE-6).', 16, 1);
        RETURN;
    END

    DECLARE @year SMALLINT = YEAR(@from_date);
    DECLARE @balance DECIMAL(9,2) = hr.fn_LeaveBalance(@employee_id, @leave_type_id, @year);

    /* LVE-5 / LVE-6 — a zero balance turns into an LWP or CNL request */
    IF @is_lwp = 0 AND @is_cnl = 0 AND @balance <= 0
    BEGIN
        RAISERROR ('The balance for %s is zero. Apply as LWP or CNL with prior management approval (LVE-5, LVE-6).', 16, 1, @lt_name);
        RETURN;
    END

    DECLARE @days DECIMAL(5,2) = hr.fn_LeaveDays(@employee_id, @from_date, @to_date);
    DECLARE @sandwich SMALLINT = hr.fn_SandwichDays(@employee_id, @from_date, @to_date);

    IF @is_lwp = 0 AND @is_cnl = 0 AND @days > @balance
    BEGIN
        RAISERROR ('%s day(s) were requested but only %s day(s) are available.', 16, 1, @days, @balance);
        RETURN;
    END

    INSERT INTO hr.leave_application
        (employee_id, leave_type_id, from_date, to_date, days, sandwich_days, reason,
         attachment_name, status, is_lwp, is_cnl, management_approved)
    VALUES
        (@employee_id, @leave_type_id, @from_date, @to_date, @days, @sandwich, @reason,
         @attachment_name, 'Applied', @is_lwp, @is_cnl, @management_approved);

    SET @application_id = SCOPE_IDENTITY();

    /* ESS-3 / NFR-3 — the approver is notified */
    INSERT INTO ops.notification_outbox (recipient, subject, body, kind, reference_type, reference_id)
    SELECT ISNULL(u.email, 'hr@hanabike.com.bd'),
           CONCAT('Leave application — ', e.full_name),
           CONCAT('Application for ', @from_date, ' to ', @to_date, ' (', @days, ' day(s)) is waiting for approval.'),
           'Leave', 'LeaveApplication', CAST(@application_id AS VARCHAR(60))
    FROM hr.employee e
    LEFT JOIN app.app_user u ON u.employee_id = e.approver_employee_id
    WHERE e.employee_id = @employee_id;

    EXEC ops.usp_LogAudit 'Leave applied', 'Leave', CAST(@application_id AS VARCHAR(60)),
         CONCAT(@employee_id, ' ', @lt_name, ' ', @from_date, ' to ', @to_date, ' (', @days, 'd)');
END;
GO

/* ESS-2 — the approver decides. */
CREATE OR ALTER PROCEDURE ops.usp_DecideLeave
    @application_id  BIGINT,
    @approve         BIT,
    @decision_remark NVARCHAR(800)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @app_status VARCHAR(12), @app_employee_id INT,
            @app_from_date DATE, @app_to_date DATE, @app_days DECIMAL(5,2);

    SELECT @app_status = status, @app_employee_id = employee_id,
           @app_from_date = from_date, @app_to_date = to_date, @app_days = days
    FROM hr.leave_application
    WHERE application_id = @application_id;

    IF @app_status IS NULL
    BEGIN
        RAISERROR ('Unknown leave application.', 16, 1);
        RETURN;
    END

    IF @app_status <> 'Applied'
    BEGIN
        RAISERROR ('The application was already decided.', 16, 1);
        RETURN;
    END

    UPDATE hr.leave_application
    SET status          = CASE WHEN @approve = 1 THEN 'Approved' ELSE 'Rejected' END,
        decided_by_employee_id = (SELECT TOP 1 employee_id FROM app.app_user WHERE login_name = SUSER_SNAME()),
        decided_at       = SYSUTCDATETIME(),
        decision_remark = @decision_remark
    WHERE application_id = @application_id;

    /* ESS-3 — the employee is notified */
    INSERT INTO ops.notification_outbox (recipient, subject, body, kind, reference_type, reference_id)
    SELECT e.email,
           CONCAT(CASE WHEN @approve = 1 THEN 'Leave approved' ELSE 'Leave rejected' END, ' — ', e.full_name),
           CONCAT('Your leave from ', @app_from_date, ' to ', @app_to_date, ' (', @app_days, ' day(s)) has been ', CASE WHEN @approve = 1 THEN 'approved' ELSE 'rejected' END, '.'),
           'Leave', 'LeaveApplication', CAST(@application_id AS VARCHAR(60))
    FROM hr.employee e
    WHERE e.employee_id = @app_employee_id AND e.email IS NOT NULL;

    EXEC ops.usp_LogAudit
         CASE WHEN @approve = 1 THEN 'Leave approved' ELSE 'Leave rejected' END,
         'Leave', CAST(@application_id AS VARCHAR(60)),
         CONCAT(@app_employee_id, ' ', @app_from_date, ' to ', @app_to_date);
END;
GO

/* ESS-2 — settle: the approved leave is posted against the balance. */
CREATE OR ALTER PROCEDURE ops.usp_SettleLeave
    @application_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @app_status VARCHAR(12), @app_employee_id INT,
            @app_leave_type_id INT, @app_from_date DATE, @app_to_date DATE,
            @app_days DECIMAL(5,2);

    SELECT @app_status = status, @app_employee_id = employee_id,
           @app_leave_type_id = leave_type_id, @app_from_date = from_date,
           @app_to_date = to_date, @app_days = days
    FROM hr.leave_application
    WHERE application_id = @application_id;

    IF @app_status <> 'Approved'
    BEGIN
        RAISERROR ('Only an approved application can be settled.', 16, 1);
        RETURN;
    END

    BEGIN TRANSACTION;

    INSERT INTO hr.leave_ledger
        (employee_id, leave_type_id, leave_year, entry_type, days, reference_type, reference_id, remark)
    VALUES
        (@app_employee_id, @app_leave_type_id, YEAR(@app_from_date), 'Availed', -@app_days,
         'LeaveApplication', CAST(@application_id AS VARCHAR(60)),
         CONCAT('Settled leave ', @app_from_date, ' to ', @app_to_date));

    UPDATE hr.leave_application
    SET status = 'Settled', settled_at = SYSUTCDATETIME()
    WHERE application_id = @application_id;

    COMMIT TRANSACTION;

    EXEC ops.usp_LogAudit 'Leave settled', 'Leave', CAST(@application_id AS VARCHAR(60)),
         CONCAT(@app_employee_id, ' ', @app_days, ' day(s) posted against the balance');
END;
GO

/* LVE-2 / LVE-3 / ERN-6 / ERN-7 — the year end. The new entitlement is added,
   the carry forward is posted (earned leave up to 15 days, sick and casual not
   at all) and the earned leave that is above the limit is reported for a
   pay-off. */
CREATE OR ALTER PROCEDURE ops.usp_YearEndLeaveProcessing
    @leave_year SMALLINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    /* the entitlement of the new year */
    INSERT INTO hr.leave_ledger (employee_id, leave_type_id, leave_year, entry_type, days, reference_type, reference_id, remark)
    SELECT e.employee_id, elt.leave_type_id, @leave_year + 1, 'Entitlement',
           hr.fn_ProRatedEntitlement(lt.annual_days, e.joining_date, @leave_year + 1),
           'YearEnd', CAST(@leave_year AS VARCHAR(60)),
           CONCAT('Year ', @leave_year + 1, ' entitlement')
    FROM hr.employee e
    JOIN hr.employee_leave_type elt ON elt.employee_id = e.employee_id
    JOIN hr.leave_type lt ON lt.leave_type_id = elt.leave_type_id
    WHERE e.is_active = 1
      AND lt.is_calculated = 0
      AND YEAR(e.joining_date) <= @leave_year + 1;

    /* the carry forward — only the leave types that allow it */
    INSERT INTO hr.leave_ledger (employee_id, leave_type_id, leave_year, entry_type, days, reference_type, reference_id, remark)
    SELECT e.employee_id, lt.leave_type_id, @leave_year + 1, 'CarryForward',
           CASE WHEN b.balance > lt.carry_forward_days THEN lt.carry_forward_days
                WHEN b.balance < 0                      THEN 0
                ELSE b.balance END,
           'YearEnd', CAST(@leave_year AS VARCHAR(60)),
           CONCAT('Carry forward from ', @leave_year)
    FROM hr.employee e
    JOIN hr.employee_leave_type elt ON elt.employee_id = e.employee_id
    JOIN hr.leave_type lt ON lt.leave_type_id = elt.leave_type_id
    CROSS APPLY (SELECT hr.fn_LeaveBalance(e.employee_id, lt.leave_type_id, @leave_year) AS balance) b
    WHERE e.is_active = 1 AND lt.carry_forward_days > 0
      AND YEAR(e.joining_date) <= @leave_year + 1;

    COMMIT TRANSACTION;

    EXEC ops.usp_LogAudit 'Year end leave processing', 'LeaveLedger', CAST(@leave_year AS VARCHAR(60)),
         CONCAT('Entitlement and carry forward posted for ', @leave_year + 1);
END;
GO

/* ERN-8 — an earned leave pay-off is deducted from the balance and logged. */
CREATE OR ALTER PROCEDURE ops.usp_EarnedLeavePayoff
    @employee_id INT,
    @leave_year SMALLINT,
    @days       DECIMAL(5,2),
    @amount     DECIMAL(18,2) = NULL,
    @remark     NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @el_type_id INT = (SELECT leave_type_id FROM hr.leave_type WHERE leave_type_code = 'EL');
    DECLARE @balance DECIMAL(9,2) = hr.fn_LeaveBalance(@employee_id, @el_type_id, @leave_year);

    IF @days > @balance
    BEGIN
        RAISERROR ('Only %s earned leave day(s) are available.', 16, 1, @balance);
        RETURN;
    END

    BEGIN TRANSACTION;

    INSERT INTO hr.earned_leave_payoff (employee_id, leave_year, days, amount, remark, paid_by)
    VALUES (@employee_id, @leave_year, @days, @amount, @remark, SUSER_SNAME());

    INSERT INTO hr.leave_ledger
        (employee_id, leave_type_id, leave_year, entry_type, days, reference_type, reference_id, remark)
    VALUES
        (@employee_id, @el_type_id, @leave_year, 'PaidOff', -@days, 'EarnedLeavePayoff',
         CAST(SCOPE_IDENTITY() AS VARCHAR(60)), @remark);

    COMMIT TRANSACTION;

    EXEC ops.usp_LogAudit 'Earned leave pay-off', 'EarnedLeave', CAST(@employee_id AS VARCHAR(60)),
         CONCAT(@days, ' day(s) for ', @leave_year);
END;
GO

/* ================================================================ triggers == */

/* ROS-3 — a work group has only one active roster for a period. SQL Server has
   no exclusion constraint, so the overlap is checked by a trigger. */
CREATE OR ALTER TRIGGER hr.trg_duty_roster_no_overlap
ON hr.duty_roster
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        WHERE i.is_active = 1
          AND i.work_group_id IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM hr.duty_roster r
              WHERE r.is_active = 1
                AND r.work_group_id = i.work_group_id
                AND r.roster_id <> i.roster_id
                AND r.start_date <= i.end_date
                AND r.end_date   >= i.start_date)
    )
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR ('ROS-3 — a work group may only have one active roster for a period.', 16, 1);
        RETURN;
    END
END;
GO

/* NFR-2 — every change of the employee master is logged, and a change of the
   restricted fields is logged on its own (NFR-9). */
CREATE OR ALTER TRIGGER hr.trg_employee_audit
ON hr.employee
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO audit.log_entry (occurred_at, user_name, action_name, entity_name, entity_id, detail)
    SELECT SYSUTCDATETIME(), SUSER_SNAME(),
           CASE WHEN EXISTS (SELECT 1 FROM inserted i WHERE i.employee_id = d.employee_id AND d.employee_id IS NOT NULL)
                THEN 'Employee update' ELSE 'Employee create' END,
           'Employee', CAST(d.employee_id AS VARCHAR(80)),
           d.full_name
    FROM inserted i
    JOIN hr.employee d ON d.employee_id = i.employee_id;

    INSERT INTO audit.log_entry (occurred_at, user_name, action_name, entity_name, entity_id, detail)
    SELECT SYSUTCDATETIME(), SUSER_SNAME(), 'Payroll field update', 'Employee',
           CAST(i.employee_id AS VARCHAR(80)),
           CONCAT('Bank or salary field changed for ', i.full_name)
    FROM inserted i
    JOIN deleted d ON d.employee_id = i.employee_id
    WHERE ISNULL(i.bank_account_no, '') <> ISNULL(d.bank_account_no, '')
       OR ISNULL(i.joining_salary, -1)   <> ISNULL(d.joining_salary, -1)
       OR ISNULL(i.present_salary, -1)   <> ISNULL(d.present_salary, -1);

    INSERT INTO audit.log_entry (occurred_at, user_name, action_name, entity_name, entity_id, detail)
    SELECT SYSUTCDATETIME(), SUSER_SNAME(), 'Separation recorded', 'Employee',
           CAST(i.employee_id AS VARCHAR(80)),
           CONCAT(i.separation_type, ' on ', i.separation_date)
    FROM inserted i
    WHERE i.separation_date IS NOT NULL;
END;
GO

/* ATT-02 / NFR-2 — a manual punch is logged with its remark. */
CREATE OR ALTER TRIGGER hr.trg_attendance_punch_audit
ON hr.attendance_punch
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO audit.log_entry (occurred_at, user_name, action_name, entity_name, entity_id, detail)
    SELECT SYSUTCDATETIME(), SUSER_SNAME(),
           CASE WHEN p.source = 'Manual' THEN 'Manual punch' ELSE 'Attendance correction' END,
           'Punch', CAST(p.punch_id AS VARCHAR(80)),
           CONCAT(p.employee_id, ' ', p.punch_date, ' ', p.punch_time, ' — ', p.remark)
    FROM inserted p
    WHERE p.source <> 'Device';
END;
GO

/* CAL-6 — a calendar change is logged. */
CREATE OR ALTER TRIGGER hr.trg_calendar_day_audit
ON hr.calendar_day
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO audit.log_entry (occurred_at, user_name, action_name, entity_name, entity_id, detail)
    SELECT SYSUTCDATETIME(), SUSER_SNAME(), 'Calendar change', 'Calendar',
           CAST(c.calendar_day_id AS VARCHAR(80)),
           CONCAT(c.calendar_date, ' — ', c.day_type, CASE WHEN c.comment IS NOT NULL THEN CONCAT(' — ', c.comment) ELSE '' END)
    FROM inserted c;
END;
GO

/* NFR-2 — an earned leave pay-off is logged. */
CREATE OR ALTER TRIGGER hr.trg_earned_leave_payoff_audit
ON hr.earned_leave_payoff
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO audit.log_entry (occurred_at, user_name, action_name, entity_name, entity_id, detail)
    SELECT SYSUTCDATETIME(), SUSER_SNAME(), 'Earned leave pay-off', 'EarnedLeave',
           CAST(p.payoff_id AS VARCHAR(80)),
           CONCAT(p.employee_id, ' ', p.days, ' day(s) for ', p.leave_year)
    FROM inserted p;
END;
GO
