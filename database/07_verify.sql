/* =============================================================================
   Hana HRM — File 06: the verification suite
   -----------------------------------------------------------------------------
   The same worked examples that  tools/verify-calc.mjs  checks in the Angular
   application, executed against the database engine. Both engines have to give
   the same answer — that is what makes the database a drop-in replacement for
   the browser side calculation.

   Run it with:
       sqlcmd -S localhost -U sa -P <password> -d HanaHRM -i 07_verify.sql
   or from the test harness:
       sqlcmd -S localhost -U sa -P <password> -d HanaHRM -i 07_verify.sql -b
   ============================================================================= */

SET NOCOUNT ON;
GO

DECLARE @passed INT = 0, @failed INT = 0;
DECLARE @results TABLE (seq INT IDENTITY(1,1), area VARCHAR(40), test_name VARCHAR(120), expected VARCHAR(120), actual VARCHAR(120), ok BIT);

DECLARE @shift_start TIME(0) = '08:00', @shift_end TIME(0) = '16:00', @break SMALLINT = 0, @exempt SMALLINT = 0;

PRINT '--- 3.8.2 delay (ATT-04) ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-04', 'delay 08:00 against an 08:00 start, no exempt', '0',
       CAST(hr.fn_DelayMinutes('08:00', @shift_start, 0) AS VARCHAR(10)),
       CASE WHEN hr.fn_DelayMinutes('08:00', @shift_start, 0) = 0 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-04', 'delay 08:10 against an 08:00 start, no exempt', '10',
       CAST(hr.fn_DelayMinutes('08:10', @shift_start, 0) AS VARCHAR(10)),
       CASE WHEN hr.fn_DelayMinutes('08:10', @shift_start, 0) = 10 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-04', 'delay 08:10 with 10 minutes exempt (grace)', '0',
       CAST(hr.fn_DelayMinutes('08:10', @shift_start, 10) AS VARCHAR(10)),
       CASE WHEN hr.fn_DelayMinutes('08:10', @shift_start, 10) = 0 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-04', 'delay 08:20 with 10 minutes exempt', '10',
       CAST(hr.fn_DelayMinutes('08:20', @shift_start, 10) AS VARCHAR(10)),
       CASE WHEN hr.fn_DelayMinutes('08:20', @shift_start, 10) = 10 THEN 1 ELSE 0 END;

PRINT '--- 3.8.2 delay -> overtime adjustment (ATT-05) ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-05', 'delay 10 minutes deducts 30', '30',
       CAST(hr.fn_DelayOtAdjustment(10) AS VARCHAR(10)),
       CASE WHEN hr.fn_DelayOtAdjustment(10) = 30 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-05', 'delay 30 minutes deducts 30', '30',
       CAST(hr.fn_DelayOtAdjustment(30) AS VARCHAR(10)),
       CASE WHEN hr.fn_DelayOtAdjustment(30) = 30 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-05', 'delay 35 minutes deducts 35', '35',
       CAST(hr.fn_DelayOtAdjustment(35) AS VARCHAR(10)),
       CASE WHEN hr.fn_DelayOtAdjustment(35) = 35 THEN 1 ELSE 0 END;

PRINT '--- 3.8.3 overtime rounding (ATT-09) ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-09', ' 0 minutes of overtime -> 0', '0',
       CAST(hr.fn_RoundOvertime(0) AS VARCHAR(10)),
       CASE WHEN hr.fn_RoundOvertime(0) = 0 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-09', '25 minutes of overtime -> 0', '0',
       CAST(hr.fn_RoundOvertime(25) AS VARCHAR(10)),
       CASE WHEN hr.fn_RoundOvertime(25) = 0 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-09', '26 minutes of overtime -> 30', '30',
       CAST(hr.fn_RoundOvertime(26) AS VARCHAR(10)),
       CASE WHEN hr.fn_RoundOvertime(26) = 30 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-09', '55 minutes of overtime -> 30', '30',
       CAST(hr.fn_RoundOvertime(55) AS VARCHAR(10)),
       CASE WHEN hr.fn_RoundOvertime(55) = 30 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-09', '56 minutes of overtime -> 60', '60',
       CAST(hr.fn_RoundOvertime(56) AS VARCHAR(10)),
       CASE WHEN hr.fn_RoundOvertime(56) = 60 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-09', '85 minutes of overtime -> 60 (1 h + 25 min)', '60',
       CAST(hr.fn_RoundOvertime(85) AS VARCHAR(10)),
       CASE WHEN hr.fn_RoundOvertime(85) = 60 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-09', '86 minutes of overtime -> 90 (1 h + 26 min)', '90',
       CAST(hr.fn_RoundOvertime(86) AS VARCHAR(10)),
       CASE WHEN hr.fn_RoundOvertime(86) = 90 THEN 1 ELSE 0 END;

PRINT '--- 3.8.3 worker overtime (ATT-08) ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-08', 'raw worker overtime 17:10 against a 16:00 end', '70',
       CAST(hr.fn_RawWorkerOvertime('17:10', @shift_end) AS VARCHAR(10)),
       CASE WHEN hr.fn_RawWorkerOvertime('17:10', @shift_end) = 70 THEN 1 ELSE 0 END;

PRINT '--- SHP-3 night shift ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'SHP-3', 'a 22:00 to 06:00 shift spans 8 hours', '480',
       CAST(hr.fn_ShiftSpanMinutes('22:00', '06:00') AS VARCHAR(10)),
       CASE WHEN hr.fn_ShiftSpanMinutes('22:00', '06:00') = 480 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'SHP-3', 'a 08:00 to 16:00 shift spans 8 hours', '480',
       CAST(hr.fn_ShiftSpanMinutes('08:00', '16:00') AS VARCHAR(10)),
       CASE WHEN hr.fn_ShiftSpanMinutes('08:00', '16:00') = 480 THEN 1 ELSE 0 END;

PRINT '--- ATT-10 officer overtime (assumption A2) ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ATT-10', 'officer 09:16 to 18:20 with a 60 minute break', '64',
       CAST(hr.fn_RawOfficerOvertime('09:16', '18:20', '09:00', '17:00', 60) AS VARCHAR(10)),
       CASE WHEN hr.fn_RawOfficerOvertime('09:16', '18:20', '09:00', '17:00', 60) = 64 THEN 1 ELSE 0 END;

PRINT '--- LVE-4 pro-rated entitlement ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'LVE-4', 'joining in February with 10 days gives 9', '9',
       CAST(hr.fn_ProRatedEntitlement(10, '2026-02-10', 2026) AS VARCHAR(10)),
       CASE WHEN hr.fn_ProRatedEntitlement(10, '2026-02-10', 2026) = 9 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'LVE-4', 'joining in an earlier year gives the full entitlement', '10',
       CAST(hr.fn_ProRatedEntitlement(10, '2025-02-10', 2026) AS VARCHAR(10)),
       CASE WHEN hr.fn_ProRatedEntitlement(10, '2025-02-10', 2026) = 10 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'LVE-4', 'joining next year gives nothing', '0',
       CAST(hr.fn_ProRatedEntitlement(10, '2027-01-05', 2026) AS VARCHAR(10)),
       CASE WHEN hr.fn_ProRatedEntitlement(10, '2027-01-05', 2026) = 0 THEN 1 ELSE 0 END;

PRINT '--- 3.17 earned leave (ERN-3 / ERN-4) ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ERN-3', 'worker: 250 work days / 18', '13.9',
       CAST(hr.fn_EarnedLeave('Worker', 250, 0, 0) AS VARCHAR(20)),
       CASE WHEN hr.fn_EarnedLeave('Worker', 250, 0, 0) = 13.9 THEN 1 ELSE 0 END;

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ERN-4', 'officer: 250 work days, 10 sick, 6 casual', '8.1',
       CAST(hr.fn_EarnedLeave('Officer', 250, 10, 6) AS VARCHAR(20)),
       CASE WHEN hr.fn_EarnedLeave('Officer', 250, 10, 6) = 8.1 THEN 1 ELSE 0 END;

PRINT '--- ERN-5 the one-year rule ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'ERN-5', 'joined 2025-10-28, earned leave available from 2026-10-28', '2026-10-28',
       CONVERT(VARCHAR(10), hr.fn_EarnedLeaveAvailableFrom('2025-10-28'), 23),
       CASE WHEN hr.fn_EarnedLeaveAvailableFrom('2025-10-28') = '2026-10-28' THEN 1 ELSE 0 END;

PRINT '--- EIR-4 tenure ---';

INSERT INTO @results (area, test_name, expected, actual, ok)
SELECT 'EIR-4', 'tenure from 2021-09-04 to 2026-09-26', '5y 0m 22d',
       hr.fn_TenureText('2021-09-04', '2026-09-26'),
       CASE WHEN hr.fn_TenureText('2021-09-04', '2026-09-26') = '5y 0m 22d' THEN 1 ELSE 0 END;

/* ------------------------------------------------------------- the report --- */

SELECT
    area,
    test_name,
    expected,
    actual,
    CASE WHEN ok = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM @results
ORDER BY seq;

SELECT @passed = SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END),
       @failed = SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END)
FROM @results;

PRINT CONCAT(@passed, ' passed, ', @failed, ' failed');

IF @failed > 0
    RAISERROR ('The verification suite failed.', 16, 1);
GO

/* ------------------------------------------------ the sandwich leave rule -- */
/* LVE-8 — the example of the SRS: leave on Thursday and on Saturday with the
   Friday in between. Friday is the weekly holiday. */

DECLARE @emp_id INT = (SELECT TOP 1 e.employee_id FROM hr.employee e
                       JOIN hr.work_group w ON w.work_group_id = e.work_group_id
                       WHERE w.group_type = 'Worker' ORDER BY e.employee_id);

IF @emp_id IS NOT NULL
BEGIN
    DECLARE @thursday DATE = DATEFROMPARTS(2026, 10, 1), @saturday DATE = DATEFROMPARTS(2026, 10, 3);
    DECLARE @sandwich SMALLINT = hr.fn_SandwichDays(@emp_id, @thursday, @saturday);
    DECLARE @days DECIMAL(5,2) = hr.fn_LeaveDays(@emp_id, @thursday, @saturday);

    PRINT CONCAT('LVE-8 — sandwich days between Thursday and Saturday: ', @sandwich,
                 ' (leave days for a Worker: ', @days, ')');

    IF @sandwich <> 1
        RAISERROR ('LVE-8 — the intervening Friday was not counted.', 16, 1);
END
GO
