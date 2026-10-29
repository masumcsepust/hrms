/* =============================================================================
   Hana HRM — File 06: master and demo data
   -----------------------------------------------------------------------------
   The seed mirrors the demo dataset of the Angular application so that the
   two can be compared row by row. It is idempotent: running it twice does not
   duplicate anything.
   ============================================================================= */

SET NOCOUNT ON;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* ------------------------------------------------------------- the masters -- */

MERGE hr.company AS t
USING (VALUES ('HBCL', 'Hana Bike Company Ltd.'), ('HAL', 'Hana Apparel Ltd.')) AS s(code, name)
   ON t.company_code = s.code
WHEN MATCHED THEN UPDATE SET company_name = s.name
WHEN NOT MATCHED THEN INSERT (company_code, company_name) VALUES (s.code, s.name);
GO

MERGE hr.employee_type AS t
USING (VALUES ('PERM', 'Permanent', 1), ('PROB', 'Probationary', 0), ('CON', 'Contractual', 0), ('TMP', 'Temporary', 0)) AS s(code, name, perm)
   ON t.type_code = s.code
WHEN MATCHED THEN UPDATE SET type_name = s.name, is_permanent = s.perm
WHEN NOT MATCHED THEN INSERT (type_code, type_name, is_permanent) VALUES (s.code, s.name, s.perm);
GO

MERGE hr.department AS t
USING (VALUES ('Production'), ('HR & Admin'), ('Accounts'), ('Quality Control'), ('Purchase & Store'), ('Export & Marketing'), ('IT')) AS s(name)
   ON t.department_name = s.name
WHEN NOT MATCHED THEN INSERT (department_name) VALUES (s.name);
GO

MERGE hr.section AS t
USING (VALUES ('Cutting'), ('Stitching'), ('Finishing'), ('Quality'), ('Store'), ('Purchase'), ('Export'), ('Accounts')) AS s(name)
   ON t.section_name = s.name
WHEN NOT MATCHED THEN INSERT (section_name) VALUES (s.name);
GO

MERGE hr.designation AS t
USING (VALUES ('General Manager'), ('Deputy Manager'), ('Assistant Manager'), ('Executive Officer'), ('Junior Officer'),
              ('Supervisor'), ('Senior Technician'), ('Technician'), ('Machine Operator'), ('Helper'), ('Accounts Officer')) AS s(name)
   ON t.designation_name = s.name
WHEN NOT MATCHED THEN INSERT (designation_name) VALUES (s.name);
GO

/* WRG-2 — the group type decides every Worker and Officer rule. */
MERGE hr.work_group AS t
USING (VALUES ('HOOFF', 'HO Officer', 'Officer'), ('FACOFF', 'Factory Officer', 'Officer'),
              ('WRK', 'Worker', 'Worker'), ('SKILLED', 'Skilled Worker', 'Worker')) AS s(code, name, gtype)
   ON t.work_group_code = s.code
WHEN MATCHED THEN UPDATE SET work_group_name = s.name, group_type = s.gtype
WHEN NOT MATCHED THEN INSERT (work_group_code, work_group_name, group_type) VALUES (s.code, s.name, s.gtype);
GO

/* LVE-1 / LVE-3 / LVE-7 / ERN-1 */
MERGE hr.leave_type AS t
USING (VALUES ('SL', 'Sick', 14, 0, 0, 1), ('CL', 'Casual', 10, 0, 0, 0),
              ('ML', 'Maternity', 120, 0, 0, 1), ('EL', 'Earned', 0, 15, 1, 0)) AS s(code, name, annual, carry, calc, attach)
   ON t.leave_type_code = s.code
WHEN MATCHED THEN UPDATE SET leave_type_name = s.name, annual_days = s.annual,
                             carry_forward_days = s.carry, is_calculated = s.calc,
                             requires_attachment = s.attach
WHEN NOT MATCHED THEN INSERT (leave_type_code, leave_type_name, annual_days, carry_forward_days, is_calculated, requires_attachment)
     VALUES (s.code, s.name, s.annual, s.carry, s.calc, s.attach);
GO

/* ------------------------------------------------------------ shift policy -- */

MERGE hr.shift_policy AS t
USING (VALUES ('General Shift (8:00 - 16:00)', '08:00', '16:00', 60, 10, 'Day'),
              ('Production Shift (6:00 - 14:00)', '06:00', '14:00', 30, 10, 'Day'),
              ('Night Shift (22:00 - 06:00)', '22:00', '06:00', 45, 15, 'Night'),
              ('Officer Shift (9:00 - 17:00)', '09:00', '17:00', 60, 15, 'Day')) AS s(name, st, et, brk, exm, stype)
   ON t.shift_name = s.name
WHEN MATCHED THEN UPDATE SET start_time = s.st, end_time = s.et, break_minutes = s.brk,
                             exempt_minutes = s.exm, shift_type = s.stype
WHEN NOT MATCHED THEN INSERT (shift_name, start_time, end_time, break_minutes, exempt_minutes, shift_type)
     VALUES (s.name, s.st, s.et, s.brk, s.exm, s.stype);
GO

/* ------------------------------------------------------------- duty roster -- */
/* ROS-2 — a work group is assigned a shift for a period. The standard working
   week is Saturday to Thursday, so Friday is the weekly holiday. */

DECLARE @roster_start DATE = DATEFROMPARTS(YEAR(GETDATE()) - 1, 1, 1);
DECLARE @roster_end   DATE = DATEFROMPARTS(YEAR(GETDATE()) + 1, 12, 31);

DECLARE @roster_plan TABLE (roster_code NVARCHAR(40), work_group_code VARCHAR(20), shift_name NVARCHAR(120));
INSERT INTO @roster_plan VALUES
    ('R-WG1-2026', 'HOOFF', 'Officer Shift (9:00 - 17:00)'),
    ('R-WG2-2026', 'FACOFF', 'General Shift (8:00 - 16:00)'),
    ('R-WG3-2026', 'WRK', 'Production Shift (6:00 - 14:00)'),
    ('R-WG4-2026', 'SKILLED', 'Production Shift (6:00 - 14:00)');

MERGE hr.duty_roster AS t
USING (SELECT p.roster_code, w.work_group_id, sp.shift_policy_id, @roster_start AS start_date, @roster_end AS end_date
       FROM @roster_plan p
       JOIN hr.work_group w ON w.work_group_code = p.work_group_code
       JOIN hr.shift_policy sp ON sp.shift_name = p.shift_name) AS s
   ON t.roster_code = s.roster_code
WHEN NOT MATCHED THEN INSERT (roster_code, work_group_id, shift_policy_id, start_date, end_date)
     VALUES (s.roster_code, s.work_group_id, s.shift_policy_id, s.start_date, s.end_date);
GO

/* ROS-1 — Saturday to Thursday are working days. */
INSERT INTO hr.duty_roster_weekday (roster_id, weekday)
SELECT r.roster_id, d.weekday
FROM hr.duty_roster r
CROSS JOIN (VALUES (6), (0), (1), (2), (3), (4)) AS d(weekday)
WHERE r.roster_code IN ('R-WG1-2026', 'R-WG2-2026', 'R-WG3-2026', 'R-WG4-2026')
  AND NOT EXISTS (SELECT 1 FROM hr.duty_roster_weekday x
                  WHERE x.roster_id = r.roster_id AND x.weekday = d.weekday);
GO

/* ---------------------------------------------------------------- calendar -- */
/* CAL-2 — the declared holidays of the year. */

DECLARE @year SMALLINT = YEAR(GETDATE());

INSERT INTO hr.calendar_day (work_group_id, calendar_date, day_type, comment)
SELECT NULL, DATEFROMPARTS(@year, m, d), 'Holiday', c
FROM (VALUES (1, 1, 'English New Year'), (3, 17, 'Sheikh Mujibur Rahman Day'), (3, 26, 'Independence Day'),
             (5, 1, 'May Day'), (8, 15, 'National Mourning Day'), (12, 16, 'Victory Day'),
             (12, 25, 'Christmas Day'), (3, 21, 'Eid ul-Fitr (declared)'), (3, 22, 'Eid ul-Fitr (declared)'),
             (6, 8, 'Eid ul-Adha (declared)'), (6, 9, 'Eid ul-Adha (declared)')) AS v(m, d, c)
WHERE NOT EXISTS (SELECT 1 FROM hr.calendar_day cd
                  WHERE cd.calendar_date = DATEFROMPARTS(@year, v.m, v.d) AND cd.work_group_id IS NULL);
GO

/* ----------------------------------------------------------- the employees -- */
/* A small but complete workforce: every work group, both employee types, a
   separation and a rejoin. */

DECLARE @emp TABLE
(
    employee_code VARCHAR(30), full_name NVARCHAR(160), dob DATE, gender VARCHAR(10),
    company_code VARCHAR(20), type_code VARCHAR(20), department_name NVARCHAR(120),
    section_name NVARCHAR(120), designation_name NVARCHAR(120), work_group_code VARCHAR(20),
    joining_date DATE, is_active BIT, separation_type VARCHAR(30), separation_date DATE,
    separation_comment NVARCHAR(400), degree NVARCHAR(120), institute NVARCHAR(200),
    phone VARCHAR(30), emergency_phone VARCHAR(30), email NVARCHAR(200),
    present_address NVARCHAR(400), permanent_address NVARCHAR(400), marital_status VARCHAR(20),
    nid VARCHAR(20), bank_account_no VARCHAR(40), joining_salary DECIMAL(18,2), present_salary DECIMAL(18,2)
);

INSERT INTO @emp VALUES
('HB-1001','Ayesha Khan','1996-04-12','Female','HBCL','PERM','Quality Control','Quality','Deputy Manager','HOOFF','2021-09-04',0,'Resigned','2026-09-26','Resigned for personal reasons','Graduation','University of Dhaka','01711223344','01811223344','ayesha.khan@hanabike.com.bd','House 12, Road 4, Dhaka','Village Daudkandi, Dhaka','Married','1990123456','00201020304050',42000,56000),
('HB-1002','Nasrin Sarkar','1998-02-18','Female','HBCL','PERM','Export & Marketing','Export','Deputy Manager','HOOFF','2023-02-01',1,NULL,NULL,NULL,'Masters','Jahangirnagar University','01711223355','01811223355','nasrin.sarkar@hanabike.com.bd','House 22, Road 6, Gazipur','Village Sreemangal, Sylhet','Single','1990123457','00201020304051',38000,47000),
('HB-1003','Md. Billal Roy','1995-07-23','Male','HBCL','PERM','IT','Export','Assistant Manager','HOOFF','2023-06-12',1,NULL,NULL,NULL,'Graduation','BUET','01711223366','01811223366','billal.roy@hanabike.com.bd','House 5, Road 2, Dhaka','Village Barishal','Married','1990123458','00201020304052',45000,58000),
('HB-1004','Rumana Rahman','1997-11-05','Female','HAL','PROB','Export & Marketing','Store','Deputy Manager','HOOFF','2022-03-12',1,NULL,NULL,NULL,'Graduation','BRAC University','01711223377','01811223377','rumana.rahman@hanabike.com.bd','House 9, Road 9, Savar','Village Manikganj','Married','1990123459','00201020304053',36000,44000),
('HB-1007','Md. Nasir Chowdhury','1994-01-30','Male','HAL','PROB','HR & Admin','Purchase','Supervisor','FACOFF','2022-04-04',1,NULL,NULL,NULL,'Higher Secondary','HSC','01711223388','01811223388','nasir.chowdhury@hanabike.com.bd','House 31, Road 3, Narayanganj','Village Faridpur','Married','1990123460','00201020304054',28000,34000),
('HB-1013','Md. Rafiqul Begum','1993-09-09','Male','HAL','PERM','Purchase & Store','Store','Executive Officer','FACOFF','2024-12-26',1,NULL,NULL,NULL,'Graduation','Daffodil International University','01711223399','01811223399','rafiqul.begum@hanabike.com.bd','House 12, Road 8, Savar','Village Faridpur, Barishal','Married','1990123461','00201020304055',30000,39000),
('HB-1015','Md. Jamal Khan','1998-06-02','Male','HBCL','PERM','Production','Stitching','Senior Technician','WRK','2025-10-10',1,NULL,NULL,NULL,'Higher Secondary','HSC','01711223400','01811223400','jamal.khan@hanabike.com.bd','House 3, Road 1, Dhaka','Village Tangail','Married','1990123462','00201020304056',21000,24000),
('HB-1016','Runa Uddin','1999-03-17','Female','HBCL','PERM','Production','Stitching','Helper','WRK','2023-05-27',1,NULL,NULL,NULL,'Higher Secondary','HSC','01711223411','01811223411','runa.uddin@hanabike.com.bd','House 8, Road 5, Gazipur','Village Comilla','Single','1990123463','00201020304057',19000,22000),
('HB-1020','Md. Habib Haque','1995-08-08','Male','HBCL','PERM','Purchase & Store','Stitching','Machine Operator','WRK','2021-12-01',1,NULL,NULL,NULL,'Higher Secondary','HSC','01711223422','01811223422','habib.haque@hanabike.com.bd','House 44, Road 7, Dhaka','Village Comilla','Married','1990123464','00201020304058',22000,26000),
('HB-1024','Md. Rezul Aktar','1996-12-20','Male','HBCL','PERM','Production','Stitching','Supervisor','SKILLED','2020-06-15',1,NULL,NULL,NULL,'Graduation','University of Dhaka','01711223433','01811223433','rezul.aktar@hanabike.com.bd','House 6, Road 2, Savar','Village Rajshahi','Married','1990123465','00201020304059',24000,31000);

MERGE hr.employee AS t
USING (SELECT x.*, c.company_id, et.employee_type_id, d.department_id, s.section_id,
              dg.designation_id, w.work_group_id
       FROM @emp x
       JOIN hr.company c ON c.company_code = x.company_code
       JOIN hr.employee_type et ON et.type_code = x.type_code
       JOIN hr.department d ON d.department_name = x.department_name
       JOIN hr.section s ON s.section_name = x.section_name
       JOIN hr.designation dg ON dg.designation_name = x.designation_name
       JOIN hr.work_group w ON w.work_group_code = x.work_group_code) AS s
   ON t.employee_code = s.employee_code
WHEN MATCHED THEN UPDATE SET full_name = s.full_name, is_active = s.is_active,
                             separation_type = s.separation_type, separation_date = s.separation_date,
                             separation_comment = s.separation_comment
WHEN NOT MATCHED THEN INSERT
    (employee_code, full_name, date_of_birth, gender, company_id, employee_type_id, department_id,
     section_id, designation_id, work_group_id, joining_date, is_active, separation_type,
     separation_date, separation_comment, degree, institute, phone, emergency_phone, email,
     present_address, permanent_address, marital_status, nid, bank_account_no, joining_salary, present_salary)
    VALUES
    (s.employee_code, s.full_name, s.dob, s.gender, s.company_id, s.employee_type_id, s.department_id,
     s.section_id, s.designation_id, s.work_group_id, s.joining_date, s.is_active, s.separation_type,
     s.separation_date, s.separation_comment, s.degree, s.institute, s.phone, s.emergency_phone, s.email,
     s.present_address, s.permanent_address, s.marital_status, s.nid, s.bank_account_no, s.joining_salary, s.present_salary);
GO

/* EMP-3 — every employee gets the four leave types, the temporary ones only
   get sick and casual. */
INSERT INTO hr.employee_leave_type (employee_id, leave_type_id)
SELECT e.employee_id, lt.leave_type_id
FROM hr.employee e
CROSS JOIN hr.leave_type lt
WHERE lt.is_active = 1
  AND NOT EXISTS (SELECT 1 FROM hr.employee_leave_type x
                  WHERE x.employee_id = e.employee_id AND x.leave_type_id = lt.leave_type_id);
GO

/* ------------------------------------------------------------- the approver -- */

UPDATE e
SET approver_employee_id = (SELECT TOP 1 x.employee_id FROM hr.employee x
                             WHERE x.work_group_id = (SELECT work_group_id FROM hr.work_group WHERE work_group_code = 'HOOFF')
                               AND x.is_active = 1
                             ORDER BY x.employee_id)
FROM hr.employee e
WHERE e.approver_employee_id IS NULL;
GO

/* ---------------------------------------------------------------- the users -- */

MERGE app.app_user AS t
USING (VALUES ('ashraful.akand', 'Ashraful Akand', 'ashraful.akand@hanabike.com.bd', 'HR'),
             ('nusrat.jahan', 'Nusrat Jahan', 'nusrat.jahan@hanabike.com.bd', 'PAYROLL'),
             ('shahidul.islam', 'Shahidul Islam', 'shahidul.islam@hanabike.com.bd', 'MANAGEMENT'),
             ('tanvir.hasan', 'Tanvir Hasan', 'tanvir.hasan@hanabike.com.bd', 'APPROVER')) AS s(login, name, mail, role)
   ON t.login_name = s.login
WHEN NOT MATCHED THEN INSERT (login_name, display_name, email) VALUES (s.login, s.name, s.mail);
GO

INSERT INTO app.user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM app.app_user u
JOIN app.role r ON r.role_code = CASE u.login_name
        WHEN 'ashraful.akand' THEN 'HR'
        WHEN 'nusrat.jahan'   THEN 'PAYROLL'
        WHEN 'shahidul.islam' THEN 'MANAGEMENT'
        WHEN 'tanvir.hasan'   THEN 'APPROVER'
    END
WHERE NOT EXISTS (SELECT 1 FROM app.user_role x WHERE x.user_id = u.user_id AND x.role_id = r.role_id);
GO

/* ------------------------------------------------------- the leave ledger -- */
/* LVE-1 — the entitlement of the year for every employee who is entitled. */

INSERT INTO hr.leave_ledger (employee_id, leave_type_id, leave_year, entry_type, days, reference_type, reference_id, remark)
SELECT e.employee_id, lt.leave_type_id, @year, 'Entitlement',
       hr.fn_ProRatedEntitlement(lt.annual_days, e.joining_date, @year),
       'YearEnd', CAST(@year AS VARCHAR(60)), CONCAT('Year ', @year, ' entitlement')
FROM hr.employee e
JOIN hr.employee_leave_type elt ON elt.employee_id = e.employee_id
JOIN hr.leave_type lt ON lt.leave_type_id = elt.leave_type_id
WHERE e.is_active = 1 AND lt.is_calculated = 0
  AND NOT EXISTS (SELECT 1 FROM hr.leave_ledger l
                  WHERE l.employee_id = e.employee_id AND l.leave_type_id = lt.leave_type_id
                    AND l.leave_year = @year AND l.entry_type = 'Entitlement');
GO

COMMIT TRANSACTION;
GO

/* ------------------------------------------------------------- the punches -- */
/* ATT-01 — the device punches of the last few days. */

DECLARE @device_id INT = (SELECT device_id FROM hr.attendance_device WHERE device_code = 'ZK-01');

IF @device_id IS NULL
BEGIN
    INSERT INTO hr.attendance_device (device_code, device_name, ip_address)
    VALUES ('ZK-01', 'ZKTeco terminal, main gate', '10.0.0.11');
    SET @device_id = SCOPE_IDENTITY();
END
GO

DECLARE @d DATE = DATEADD(DAY, -6, CAST(SYSUTCDATETIME() AS DATE));

WHILE @d <= CAST(SYSUTCDATETIME() AS DATE)
BEGIN
    IF DATEPART(WEEKDAY, @d) <> 6   -- not a Friday
    BEGIN
        INSERT INTO hr.attendance_punch (punch_date, employee_id, punch_time, source, device_id, external_ref, created_by)
        SELECT @d, e.employee_id, CAST('08:0' + CAST((ABS(CHECKSUM(e.employee_id, @d)) % 9) AS VARCHAR(2)) AS TIME(0)),
               'Device', @device_id, CONCAT('ZK01-', e.employee_code, '-', FORMAT(@d, 'yyyyMMdd'), '-IN'), 'ZK-01'
        FROM hr.employee e
        WHERE e.is_active = 1
          AND e.joining_date <= @d
          AND (e.separation_date IS NULL OR e.separation_date >= @d)
          AND NOT EXISTS (SELECT 1 FROM hr.attendance_punch p
                          WHERE p.punch_date = @d AND p.employee_id = e.employee_id);

        INSERT INTO hr.attendance_punch (punch_date, employee_id, punch_time, source, device_id, external_ref, created_by)
        SELECT @d, e.employee_id, CAST('16:' + CAST((20 + (ABS(CHECKSUM(e.employee_id, @d, 7)) % 39)) AS VARCHAR(2)) + ':00' AS TIME(0)),
               'Device', @device_id, CONCAT('ZK01-', e.employee_code, '-', FORMAT(@d, 'yyyyMMdd'), '-OUT'), 'ZK-01'
        FROM hr.employee e
        WHERE e.is_active = 1
          AND e.joining_date <= @d
          AND (e.separation_date IS NULL OR e.separation_date >= @d)
          AND NOT EXISTS (SELECT 1 FROM hr.attendance_punch p
                          WHERE p.punch_date = @d AND p.employee_id = e.employee_id);
    END
    SET @d = DATEADD(DAY, 1, @d);
END
GO

/* post the attendance of the seeded days */
DECLARE @from DATE = DATEADD(DAY, -6, CAST(SYSUTCDATETIME() AS DATE));
EXEC ops.usp_PostAttendance @from_date = @from, @to_date = CAST(SYSUTCDATETIME() AS DATE);
GO
