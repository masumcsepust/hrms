/* =============================================================================
   Hana HRM — File 02: the calculation engine in T-SQL
   -----------------------------------------------------------------------------
   Every function below mirrors a rule of the SRS revision 2 and the matching
   function in the Angular application (src/app/core/calc.ts). The two engines
   are checked against each other by 07_verify.sql.

     ATT-04/05  delay and the delay -> overtime adjustment table
     ATT-06/10  officer delay and overtime (assumption A2, SRS marks it TBD)
     ATT-08/09  worker overtime and the overtime rounding table
     SHP-3      a shift that ends before it starts is a night shift
     ROS-1..4   working days, roster resolution, individual precedence
     CAL-1..5   the work / holiday calendar
     LVE-4      pro-rated entitlement for a mid-year joiner
     LVE-8      sandwich leave
     ERN-3..5   earned leave formulas and the one-year rule
     EIR-4      tenure
   ============================================================================= */

SET NOCOUNT ON;
GO

/* ------------------------------------------------------------ time helpers -- */

CREATE OR ALTER FUNCTION hr.fn_ShiftSpanMinutes (@start_time TIME(0), @end_time TIME(0))
RETURNS SMALLINT
WITH SCHEMABINDING
AS
BEGIN
    /* SHP-3 — when the end time is not after the start time the shift ends on
       the following day (a night shift). */
    DECLARE @s INT = DATEDIFF(MINUTE, '00:00:00', @start_time);
    DECLARE @e INT = DATEDIFF(MINUTE, '00:00:00', @end_time);
    IF @e > @s
        RETURN CAST(@e - @s AS SMALLINT);
    RETURN CAST(1440 - @s + @e AS SMALLINT);
END;
GO

CREATE OR ALTER FUNCTION hr.fn_IsNightShift (@start_time TIME(0), @end_time TIME(0))
RETURNS BIT
WITH SCHEMABINDING
AS
BEGIN
    RETURN CASE WHEN @end_time <= @start_time THEN 1 ELSE 0 END;
END;
GO

/* ------------------------------------------------------------------- delay -- */

/* ATT-04 — the delay is measured from the scheduled shift start, with the
   exempt time added to the start, so the first N minutes are grace. */
CREATE OR ALTER FUNCTION hr.fn_DelayMinutes (@in_time TIME(0), @start_time TIME(0), @exempt_minutes SMALLINT)
RETURNS SMALLINT
WITH SCHEMABINDING
AS
BEGIN
    DECLARE @grace INT = DATEDIFF(MINUTE, '00:00:00', @start_time) + ISNULL(@exempt_minutes, 0);
    DECLARE @actual INT = DATEDIFF(MINUTE, '00:00:00', @in_time);
    DECLARE @delay INT = @actual - @grace;
    RETURN CASE WHEN @delay < 0 THEN 0 ELSE CAST(@delay AS SMALLINT) END;
END;
GO

/* ATT-05 — the delay adjustment table.
     up to 30 minutes      -> deduct 30 minutes
     more than 30 minutes  -> deduct 30 plus every minute beyond 30 */
CREATE OR ALTER FUNCTION hr.fn_DelayOtAdjustment (@delay_minutes SMALLINT)
RETURNS SMALLINT
WITH SCHEMABINDING
AS
BEGIN
    IF @delay_minutes IS NULL OR @delay_minutes <= 0 RETURN 0;
    IF @delay_minutes <= 30 RETURN 30;
    RETURN @delay_minutes;
END;
GO

/* --------------------------------------------------------------- overtime -- */

/* ATT-09 — the overtime rounding table, applied inside every overtime hour:
     0 – 25 minutes  -> 0 minutes
     26 – 55 minutes -> 30 minutes
     56 – 60 minutes -> 60 minutes */
CREATE OR ALTER FUNCTION hr.fn_RoundOvertime (@minutes SMALLINT)
RETURNS SMALLINT
WITH SCHEMABINDING
AS
BEGIN
    IF @minutes IS NULL OR @minutes <= 0 RETURN 0;
    DECLARE @full INT = @minutes / 60;
    DECLARE @rem  INT = @minutes % 60;
    DECLARE @bucket INT = CASE WHEN @rem > 55 THEN 60 WHEN @rem > 25 THEN 30 ELSE 0 END;
    RETURN CAST((@full * 60) + @bucket AS SMALLINT);
END;
GO

/* ATT-08 — the raw worker overtime: the actual check-out minus the scheduled
   shift end. */
CREATE OR ALTER FUNCTION hr.fn_RawWorkerOvertime (@out_time TIME(0), @shift_end TIME(0))
RETURNS SMALLINT
WITH SCHEMABINDING
AS
BEGIN
    DECLARE @o INT = DATEDIFF(MINUTE, '00:00:00', @out_time) - DATEDIFF(MINUTE, '00:00:00', @shift_end);
    RETURN CASE WHEN @o < 0 THEN 0 ELSE CAST(@o AS SMALLINT) END;
END;
GO

/* A2 — the officer overtime: the time actually worked beyond the scheduled
   shift length. The break is removed from both sides. */
CREATE OR ALTER FUNCTION hr.fn_RawOfficerOvertime (@in_time TIME(0), @out_time TIME(0),
                                                  @shift_start TIME(0), @shift_end TIME(0),
                                                  @break_minutes SMALLINT)
RETURNS SMALLINT
WITH SCHEMABINDING
AS
BEGIN
    DECLARE @worked     INT = hr.fn_ShiftSpanMinutes(@in_time, @out_time) - ISNULL(@break_minutes, 0);
    DECLARE @scheduled  INT = hr.fn_ShiftSpanMinutes(@shift_start, @shift_end) - ISNULL(@break_minutes, 0);
    DECLARE @o INT = @worked - @scheduled;
    RETURN CASE WHEN @o < 0 THEN 0 ELSE CAST(@o AS SMALLINT) END;
END;
GO

/* --------------------------------------------- roster and calendar resolution */

/* ROS-4 — an individual roster wins over the work group roster. */
CREATE OR ALTER FUNCTION hr.fn_ResolveShiftPolicyId (@employee_id INT, @on_date DATE)
RETURNS INT
AS
BEGIN
    DECLARE @id INT;

    SELECT TOP (1) @id = r.shift_policy_id
    FROM hr.duty_roster r
    WHERE r.is_active = 1
      AND r.start_date <= @on_date
      AND r.end_date   >= @on_date
      AND (r.employee_id = @employee_id
           OR (r.employee_id IS NULL
               AND r.work_group_id = (SELECT e.work_group_id FROM hr.employee e WHERE e.employee_id = @employee_id)))
    ORDER BY CASE WHEN r.employee_id = @employee_id THEN 0 ELSE 1 END, r.roster_id;

    RETURN @id;
END;
GO

/* ROS-1 — the working days of the roster that covers the date. */
CREATE OR ALTER FUNCTION hr.fn_RosterWeekday (@employee_id INT, @on_date DATE)
RETURNS TINYINT
AS
BEGIN
    DECLARE @weekday TINYINT = DATEPART(WEEKDAY, @on_date) - 1;  -- 0 = Sunday

    IF EXISTS (
        SELECT 1
        FROM hr.duty_roster r
        JOIN hr.duty_roster_weekday d ON d.roster_id = r.roster_id
        WHERE r.is_active = 1
          AND r.start_date <= @on_date
          AND r.end_date   >= @on_date
          AND (r.employee_id = @employee_id
               OR (r.employee_id IS NULL
                   AND r.work_group_id = (SELECT e.work_group_id FROM hr.employee e WHERE e.employee_id = @employee_id)))
          AND d.weekday = @weekday
    )
        RETURN @weekday;

    /* no roster covers the date: everything is a working day */
    RETURN -1;
END;
GO

/* CAL-1 … CAL-5 — the effective day type for an employee on a date. */
CREATE OR ALTER FUNCTION hr.fn_DayType (@employee_id INT, @on_date DATE)
RETURNS VARCHAR(12)
AS
BEGIN
    DECLARE @work_group_id INT = (SELECT e.work_group_id FROM hr.employee e WHERE e.employee_id = @employee_id);
    DECLARE @day_type VARCHAR(12);

    SELECT TOP (1) @day_type = c.day_type
    FROM hr.calendar_day c
    WHERE c.calendar_date = @on_date
      AND (c.work_group_id = @work_group_id OR c.work_group_id IS NULL)
    ORDER BY CASE WHEN c.work_group_id = @work_group_id THEN 0 ELSE 1 END;

    IF @day_type IS NOT NULL
    BEGIN
        IF @day_type = 'WeeklyOff'  RETURN 'Weekend';
        IF @day_type = 'Holiday'    RETURN 'Holiday';
        IF @day_type = 'Adjustment' RETURN 'Workday';
        RETURN 'Workday';
    END;

    /* no calendar entry — fall back to the roster working days */
    IF hr.fn_RosterWeekday(@employee_id, @on_date) = -1
        RETURN 'Workday';

    RETURN 'Weekend';
END;
GO

/* LVE-8 — the weekend days that fall between the requested leave days. A
   weekend day at the very start or the very end of the period is not a
   "between" day. */
CREATE OR ALTER FUNCTION hr.fn_SandwichDays (@employee_id INT, @from_date DATE, @to_date DATE)
RETURNS SMALLINT
AS
BEGIN
    IF DATEDIFF(DAY, @from_date, @to_date) < 2 RETURN 0;

    DECLARE @count SMALLINT = 0;
    DECLARE @d DATE = DATEADD(DAY, 1, @from_date);

    WHILE @d < @to_date
    BEGIN
        IF hr.fn_DayType(@employee_id, @d) = 'Weekend'
            SET @count = @count + 1;
        SET @d = DATEADD(DAY, 1, @d);
    END

    RETURN @count;
END;
GO

/* LVE-8 — the days that are deducted for a leave period. The Worker group also
   pays for the weekend days between the leave days, the Officer group does
   not. */
CREATE OR ALTER FUNCTION hr.fn_LeaveDays (@employee_id INT, @from_date DATE, @to_date DATE)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @group_type VARCHAR(10) = (SELECT w.group_type FROM hr.employee e
                                         JOIN hr.work_group w ON w.work_group_id = e.work_group_id
                                         WHERE e.employee_id = @employee_id);
    DECLARE @working DECIMAL(5,2) = 0;
    DECLARE @d DATE = @from_date;

    WHILE @d <= @to_date
    BEGIN
        IF hr.fn_DayType(@employee_id, @d) <> 'Weekend'
            SET @working = @working + 1;
        SET @d = DATEADD(DAY, 1, @d);
    END

    IF @group_type = 'Worker'
        SET @working = @working + hr.fn_SandwichDays(@employee_id, @from_date, @to_date);

    RETURN @working;
END;
GO

/* ------------------------------------------------------------- entitlement -- */

/* LVE-4 — a mid-year joiner gets a proportional entitlement:
   (total leave / 12) x remaining months, rounded down (assumption A4). */
CREATE OR ALTER FUNCTION hr.fn_ProRatedEntitlement (@total_days DECIMAL(5,2), @joining_date DATE, @leave_year SMALLINT)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @join_year SMALLINT = YEAR(@joining_date);

    IF @join_year < @leave_year RETURN @total_days;   -- joined in an earlier year
    IF @join_year > @leave_year RETURN 0;              -- has not joined yet

    DECLARE @remaining_months SMALLINT = 12 - MONTH(@joining_date) + 1;
    RETURN FLOOR((@total_days / 12) * @remaining_months);
END;
GO

/* ERN-3 / ERN-4 — the earned leave formula.
     Worker : work days / 18
     Officer: work days / (18 + sick days taken + 50 % of casual days taken) */
CREATE OR ALTER FUNCTION hr.fn_EarnedLeave (@group_type VARCHAR(10), @work_days DECIMAL(9,2),
                                            @sick_taken DECIMAL(9,2), @casual_taken DECIMAL(9,2))
RETURNS DECIMAL(9,2)
WITH SCHEMABINDING
AS
BEGIN
    DECLARE @denominator DECIMAL(9,2);

    IF @group_type = 'Officer'
        SET @denominator = 18 + ISNULL(@sick_taken, 0) + (0.5 * ISNULL(@casual_taken, 0));
    ELSE
        SET @denominator = 18;

    IF @denominator = 0 SET @denominator = 18;

    /* A5 — rounded to one decimal place */
    RETURN ROUND(CAST(@work_days AS DECIMAL(18,6)) / @denominator, 1);
END;
GO

/* ERN-5 — earned leave becomes usable one full year after the joining date. */
CREATE OR ALTER FUNCTION hr.fn_EarnedLeaveAvailableFrom (@joining_date DATE)
RETURNS DATE
WITH SCHEMABINDING
AS
BEGIN
    RETURN DATEADD(YEAR, 1, @joining_date);
END;
GO

/* The working days of a year for an employee — the numerator of ERN-3. */
CREATE OR ALTER FUNCTION hr.fn_WorkDaysInYear (@employee_id INT, @leave_year SMALLINT, @until_date DATE)
RETURNS INT
AS
BEGIN
    DECLARE @count INT = 0;
    DECLARE @d DATE = DATEFROMPARTS(@leave_year, 1, 1);
    DECLARE @end DATE = CASE WHEN @until_date IS NULL THEN DATEFROMPARTS(@leave_year, 12, 31)
                             WHEN @until_date < DATEFROMPARTS(@leave_year, 1, 1) THEN DATEFROMPARTS(@leave_year, 1, 1)
                             WHEN @until_date > DATEFROMPARTS(@leave_year, 12, 31) THEN DATEFROMPARTS(@leave_year, 12, 31)
                             ELSE @until_date END;

    WHILE @d <= @end
    BEGIN
        IF hr.fn_DayType(@employee_id, @d) = 'Workday'
            SET @count = @count + 1;
        SET @d = DATEADD(DAY, 1, @d);
    END

    RETURN @count;
END;
GO

/* ----------------------------------------------------------------- tenure --- */

/* EIR-4 — the service length in years, months and days. */
CREATE OR ALTER FUNCTION hr.fn_TenureParts (@from_date DATE, @to_date DATE)
RETURNS TABLE
WITH SCHEMABINDING
AS
BEGIN
    DECLARE @years  INT = 0, @months INT = 0, @days INT = 0;

    IF @from_date IS NOT NULL AND @to_date IS NOT NULL AND @to_date >= @from_date
    BEGIN
        /* the calendar components, exactly as the Angular engine calculates them:
           the year difference, the month difference and the day difference. */
        SET @years  = YEAR(@to_date)  - YEAR(@from_date);
        SET @months = MONTH(@to_date) - MONTH(@from_date);
        SET @days   = DAY(@to_date)   - DAY(@from_date);

        IF @days < 0
        BEGIN
            /* borrow from the month before the end date */
            SET @months = @months - 1;
            SET @days   = @days + DAY(EOMONTH(@to_date, -1));
        END

        IF @months < 0
        BEGIN
            SET @years  = @years - 1;
            SET @months = @months + 12;
        END
    END

    RETURN SELECT @years AS years, @months AS months, @days AS days;
END;
GO

CREATE OR ALTER FUNCTION hr.fn_TenureText (@from_date DATE, @to_date DATE)
RETURNS NVARCHAR(60)
AS
BEGIN
    DECLARE @p TABLE (years INT, months INT, days INT);
    INSERT INTO @p SELECT years, months, days FROM hr.fn_TenureParts(@from_date, @to_date);
    RETURN CONCAT(@p.years, 'y ', @p.months, 'm ', @p.days, 'd');
END;
GO

/* ----------------------------------------------------------- leave balance -- */

/* The balance is the sum of the ledger entries — never a mutable column, so
   the history stays complete (LVE-1 … LVE-3, ERN-8). */
CREATE OR ALTER FUNCTION hr.fn_LeaveBalance (@employee_id INT, @leave_type_id INT, @leave_year SMALLINT)
RETURNS DECIMAL(9,2)
AS
BEGIN
    DECLARE @balance DECIMAL(9,2) =
        (SELECT ISNULL(SUM(l.days), 0)
         FROM hr.leave_ledger l
         WHERE l.employee_id = @employee_id
           AND l.leave_type_id = @leave_type_id
           AND l.leave_year = @leave_year);
    RETURN @balance;
END;
GO

/* ----------------------------------------------------------- NFR-8 session -- */

/* The views read this to decide whether the salary and bank columns may be
   shown in a result set. */
CREATE OR ALTER FUNCTION app.fnc_HasPayrollAccess()
RETURNS BIT
AS
BEGIN
    DECLARE @granted BIT = 0;

    /* a session context set by the application */
    IF TRY_CONVERT(BIT, SESSION_CONTEXT(N'[app].[PayrollAccess]')) = 1
        SET @granted = 1;

    /* or a member of the payroll role */
    IF @granted = 0
       AND EXISTS (SELECT 1 FROM sys.server_principals p
                   JOIN sys.database_role_members m ON m.role_principal_id = p.principal_id
                   JOIN sys.database_principals r ON r.principal_id = m.member_principal_id
                   WHERE p.name = 'hr_payroll'
                     AND r.name = SUSER_SNAME())
        SET @granted = 1;

    RETURN @granted;
END;
GO
