/* =============================================================================
   Hana HRM — File 05: security
   -----------------------------------------------------------------------------
   Three ideas are implemented here:

     1. Roles and users (NFR-1) — the same role model as the Angular
        application: HR, Payroll, Employee, Approver, Management.
     2. Column level security for the restricted fields (NFR-8 / EMP-11) —
        SQL Server has no column masks, so the salary and bank columns are
        denied at table level and granted column by column to the payroll role.
     3. Row level security — an employee may only read their own record
        (NFR-1) and a work group may only read the calendar of its own group.
   ============================================================================= */

SET NOCOUNT ON;
GO

/* ------------------------------------------------------------------- roles -- */

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'hr_app')
    CREATE ROLE hr_app AUTHORIZATION dbo;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'hr_payroll')
    CREATE ROLE hr_payroll AUTHORIZATION dbo;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'hr_auditor')
    CREATE ROLE hr_auditor AUTHORIZATION dbo;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'hr_reader')
    CREATE ROLE hr_reader AUTHORIZATION dbo;
GO

/* The application role is the entry point; the payroll role is added on top
   of it for the people who may see the salary and bank fields. */
ALTER ROLE hr_app ADD MEMBER hr_payroll;
GO
ALTER ROLE hr_app ADD MEMBER hr_auditor;
GO
ALTER ROLE hr_app ADD MEMBER hr_reader;
GO

/* ------------------------------------------------------------------- users -- */
/* Map the database users to the login of the same name. The logins themselves
   are created on the server, not in the database. */

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'hana_app_service' AND type = 'S')
    CREATE USER hana_app_service FOR LOGIN hana_app_service;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'hana_hr_service' AND type = 'S')
    CREATE USER hana_hr_service FOR LOGIN hana_hr_service;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'hana_payroll_service' AND type = 'S')
    CREATE USER hana_payroll_service FOR LOGIN hana_payroll_service;
GO

ALTER ROLE hr_app      ADD MEMBER hana_app_service;
GO
ALTER ROLE hr_app      ADD MEMBER hana_hr_service;
GO
ALTER ROLE hr_payroll  ADD MEMBER hana_payroll_service;
GO

/* --------------------------------------------------------------- grants ----- */

/* The application reads through the views, not through the tables. */
GRANT SELECT ON hr.vw_employee_information TO hr_app;
GRANT SELECT ON hr.vw_employee_statement    TO hr_app;
GRANT SELECT ON hr.vw_daily_attendance      TO hr_app;
GRANT SELECT ON hr.vw_work_group_manpower   TO hr_app;
GRANT SELECT ON hr.vw_punch_count           TO hr_app;
GRANT SELECT ON hr.vw_delay_ratio           TO hr_app;
GRANT SELECT ON hr.vw_job_card              TO hr_app;
GRANT SELECT ON hr.vw_leave_balance         TO hr_app;
GRANT SELECT ON hr.vw_leave_report          TO hr_app;
GRANT SELECT ON hr.vw_el_detail             TO hr_app;
GO

GRANT SELECT ON audit.log_entry            TO hr_auditor;
GRANT SELECT ON ops.notification_outbox     TO hr_app;
GO

/* The engine is executed through the procedures and the functions. */
GRANT EXECUTE ON SCHEMA::ops               TO hr_app;
GRANT EXECUTE ON SCHEMA::hr                TO hr_app;
GO

/* No direct table access for the application role. */
DENY INSERT, UPDATE, DELETE ON hr.employee         TO hr_app;
DENY SELECT, INSERT, UPDATE, DELETE ON hr.leave_application TO hr_app;
DENY SELECT, INSERT, UPDATE, DELETE ON hr.attendance_punch  TO hr_app;
DENY SELECT, INSERT, UPDATE, DELETE ON hr.attendance_daily  TO hr_app;
DENY SELECT, INSERT, UPDATE, DELETE ON hr.leave_ledger      TO hr_app;
DENY SELECT, INSERT, UPDATE, DELETE ON hr.earned_leave_payoff TO hr_app;
GO

/* The read only role may look at the master data but never at the restricted
   columns of the employee master. */
GRANT SELECT ON hr.company       TO hr_reader;
GRANT SELECT ON hr.employee_type TO hr_reader;
GRANT SELECT ON hr.department    TO hr_reader;
GRANT SELECT ON hr.section       TO hr_reader;
GRANT SELECT ON hr.designation   TO hr_reader;
GRANT SELECT ON hr.work_group    TO hr_reader;
GRANT SELECT ON hr.leave_type    TO hr_reader;
GRANT SELECT ON hr.shift_policy  TO hr_reader;
GO

/* ---------------------------------------------- column level security ------- */
/* EMP-11 / NFR-8 — the payroll role may read the bank and salary columns of
   the employee master; nobody else may. The views blank them out as well when
   the session does not hold the payroll permission. */

GRANT SELECT (employee_id, employee_code, full_name, photo_uri, date_of_birth, gender,
              company_id, employee_type_id, department_id, section_id, designation_id,
              work_group_id, joining_date, is_active, separation_type, separation_date,
              separation_comment, degree, institute, phone, emergency_phone, email,
              present_address, permanent_address, marital_status, nid, reference_employee_id,
              reference_remark, approver_employee_id, created_at, updated_at)
    ON hr.employee TO hr_app;
GO

GRANT SELECT (employee_id, employee_code, full_name, photo_uri, date_of_birth, gender,
              company_id, employee_type_id, department_id, section_id, designation_id,
              work_group_id, joining_date, is_active, separation_type, separation_date,
              separation_comment, degree, institute, phone, emergency_phone, email,
              present_address, permanent_address, marital_status, nid, reference_employee_id,
              reference_remark, approver_employee_id, created_at, updated_at,
              bank_account_no, joining_salary, present_salary)
    ON hr.employee TO hr_payroll;
GO

/* ------------------------------------------------------- row level security -- */

/* NFR-1 — an employee may only read their own employee record. The predicate
   uses the session context that the application sets after the login. */
CREATE OR ALTER FUNCTION app.fnc_CurrentEmployeeId()
RETURNS INT
AS
BEGIN
    RETURN TRY_CONVERT(INT, SESSION_CONTEXT(N'[app].[EmployeeId]'));
END;
GO

/* The predicate of a security policy has to be a schema bound inline table
   valued function that returns a single bit column. */
CREATE OR ALTER FUNCTION app.fnc_OwnsEmployeeRow(@employee_id INT)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
(
    SELECT CASE
               WHEN app.fnc_CurrentEmployeeId() IS NULL THEN CAST(1 AS BIT)  -- HR session
               WHEN app.fnc_CurrentEmployeeId() = @employee_id THEN CAST(1 AS BIT)
               ELSE CAST(0 AS BIT)
           END AS [result]
);
GO

-- sqlfluff's T-SQL dialect does not model the row level security statements
ALTER TABLE hr.employee ENABLE ROW LEVEL SECURITY; -- noqa: PRS
GO

CREATE OR ALTER SECURITY POLICY app.sp_employee_rls -- noqa: PRS
    ADD FILTER PREDICATE app.fnc_OwnsEmployeeRow(employee_id) ON hr.employee
    WITH (STATE = ON);
GO

/* ------------------------------------------------- the session context ------ */

/* The application calls this once per connection, after the login. */
CREATE OR ALTER PROCEDURE app.usp_SetSessionContext
    @user_name NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @employee_id INT =
        (SELECT TOP 1 u.employee_id
         FROM app.app_user u
         WHERE u.login_name = @user_name AND u.is_active = 1
         ORDER BY u.user_id);

    DECLARE @payroll BIT =
        CASE WHEN EXISTS (
                SELECT 1
                FROM app.app_user u
                JOIN app.user_role ur ON ur.user_id = u.user_id
                JOIN app.role r        ON r.role_id = ur.role_id
                WHERE u.login_name = @user_name AND r.role_group = 'Payroll' AND r.is_active = 1)
             THEN 1 ELSE 0 END;

    EXEC sp_set_session_context @key = N'app.EmployeeId',     @value = @employee_id;
    EXEC sp_set_session_context @key = N'app.PayrollAccess', @value = @payroll;
    EXEC sp_set_session_context @key = N'app.UserName',      @value = @user_name;
END;
GO

GRANT EXECUTE ON app.usp_SetSessionContext TO hr_app;
GO

/* ------------------------------------------------------- the role model ----- */

INSERT INTO app.role (role_code, role_name, role_group)
VALUES
    ('HR',         'HR / authorised user',      'HR'),
    ('PAYROLL',    'Payroll-authorised user',   'Payroll'),
    ('EMPLOYEE',   'Employee',                  'Employee'),
    ('APPROVER',   'Approver',                  'Approver'),
    ('MANAGEMENT', 'Management',                'Management')
WHERE NOT EXISTS (SELECT 1 FROM app.role r WHERE r.role_code = roles.role_code);
GO

INSERT INTO app.permission (permission_code, permission_name, description)
VALUES
    ('hr.manage',     'Manage master data',      'Setup, employees, calendar, punches, leave processing, reports'),
    ('payroll.view',  'View payroll fields',     'Bank account and salary fields in forms and reports (NFR-8)'),
    ('leave.apply',   'Apply for leave',         'Submit a leave application'),
    ('leave.approve', 'Approve leave',           'Approve or reject a leave application'),
    ('leave.manage',  'Manage leave',            'Entitlement, balance, earned leave pay-off'),
    ('self.view',     'View own record',         'Own profile, own leave, own reports')
WHERE NOT EXISTS (SELECT 1 FROM app.permission p WHERE p.permission_code = permissions.permission_code);
GO
