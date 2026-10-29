"""
Cross-check of the Hana HRM calculation engine.

The T-SQL functions of database/02_functions.sql are transliterated one to one
into DuckDB macros and executed against the same worked examples that
tools/verify-calc.mjs checks in the Angular application.  Both engines must
give the same answer for the same input.

  python3 database/verify_with_duckdb.py
"""
import duckdb
import sys

PASS, FAIL = 0, 0
results = []


def check(area, name, expected, actual):
    global PASS, FAIL
    ok = expected == actual
    if ok:
        PASS += 1
    else:
        FAIL += 1
    results.append((area, name, expected, actual, "PASS" if ok else "FAIL"))


con = duckdb.connect()

# --- the transliteration of 02_functions.sql --------------------------------
con.execute(
    """
CREATE MACRO to_min(t) AS
    (CAST(EXTRACT(HOUR FROM t) AS INTEGER) * 60 + CAST(EXTRACT(MINUTE FROM t) AS INTEGER));

-- SHP-3
CREATE MACRO fn_ShiftSpanMinutes(start_time, end_time) AS
    (CASE WHEN to_min(end_time) > to_min(start_time)
          THEN to_min(end_time) - to_min(start_time)
          ELSE 1440 - to_min(start_time) + to_min(end_time) END);

-- ATT-04
CREATE MACRO fn_DelayMinutes(in_time, start_time, exempt_minutes) AS
    (GREATEST(0, to_min(in_time) - (to_min(start_time) + COALESCE(exempt_minutes, 0))));

-- ATT-05
CREATE MACRO fn_DelayOtAdjustment(delay_minutes) AS
    (CASE WHEN delay_minutes IS NULL OR delay_minutes <= 0 THEN 0
          WHEN delay_minutes <= 30 THEN 30
          ELSE delay_minutes END);

-- ATT-09
CREATE MACRO fn_RoundOvertime(minutes) AS
    (CASE WHEN minutes IS NULL OR minutes <= 0 THEN 0
          ELSE (minutes // 60) * 60
               + CASE WHEN (minutes % 60) > 55 THEN 60
                      WHEN (minutes % 60) > 25 THEN 30
                      ELSE 0 END END);

-- ATT-08
CREATE MACRO fn_RawWorkerOvertime(out_time, shift_end) AS
    (GREATEST(0, to_min(out_time) - to_min(shift_end)));

-- A2 — officer overtime
CREATE MACRO fn_RawOfficerOvertime(in_time, out_time, shift_start, shift_end, break_minutes) AS
    (GREATEST(0, (fn_ShiftSpanMinutes(in_time, out_time) - COALESCE(break_minutes, 0))
                 - (fn_ShiftSpanMinutes(shift_start, shift_end) - COALESCE(break_minutes, 0))));

-- LVE-4
CREATE MACRO fn_ProRatedEntitlement(total_days, joining_date, leave_year) AS
    (CASE WHEN YEAR(joining_date) < leave_year THEN total_days
          WHEN YEAR(joining_date) > leave_year THEN 0
          ELSE FLOOR((total_days / 12) * (12 - MONTH(joining_date) + 1)) END);

-- ERN-3 / ERN-4
CREATE MACRO fn_EarnedLeave(group_type, work_days, sick_taken, casual_taken) AS
    (ROUND(work_days / (CASE WHEN group_type = 'Officer'
                             THEN 18 + COALESCE(sick_taken, 0) + 0.5 * COALESCE(casual_taken, 0)
                             ELSE 18 END), 1));

-- ERN-5
CREATE MACRO fn_EarnedLeaveAvailableFrom(joining_date) AS
    (CAST(joining_date + INTERVAL 1 YEAR AS DATE));

-- EIR-4
CREATE MACRO fn_TenureText(from_date, to_date) AS
    (WITH c AS (
        SELECT YEAR(to_date) - YEAR(from_date) AS y,
               MONTH(to_date) - MONTH(from_date) AS m,
               DAY(to_date) - DAY(from_date) AS d,
               CAST(EXTRACT(DAY FROM last_day(to_date - INTERVAL 1 MONTH)) AS INTEGER) AS prev_days
     ),
     b AS (
        SELECT y,
               CASE WHEN d < 0 THEN m - 1 ELSE m END AS m1,
               CASE WHEN d < 0 THEN d + prev_days ELSE d END AS d1
        FROM c
     )
     SELECT CONCAT(CASE WHEN m1 < 0 THEN y - 1 ELSE y END, 'y ',
                   CASE WHEN m1 < 0 THEN m1 + 12 ELSE m1 END, 'm ', d1, 'd')
     FROM b);
"""
)

T = "TIME"
D = "DATE"


def tm(v):
    return f"{T} '{v}'"


# --- ATT-04 delay ------------------------------------------------------------
check("ATT-04", "delay 08:00 vs 08:00 start, no exempt", 0,
      con.execute(f"SELECT fn_DelayMinutes({tm('08:00:00')},{tm('08:00:00')},0)").fetchone()[0])
check("ATT-04", "delay 08:10 vs 08:00 start, no exempt", 10,
      con.execute(f"SELECT fn_DelayMinutes({tm('08:10:00')},{tm('08:00:00')},0)").fetchone()[0])
check("ATT-04", "delay 08:10 with 10 minutes exempt (grace)", 0,
      con.execute(f"SELECT fn_DelayMinutes({tm('08:10:00')},{tm('08:00:00')},10)").fetchone()[0])
check("ATT-04", "delay 08:20 with 10 minutes exempt", 10,
      con.execute(f"SELECT fn_DelayMinutes({tm('08:20:00')},{tm('08:00:00')},10)").fetchone()[0])
check("ATT-04", "an early check-in is not a delay", 0,
      con.execute(f"SELECT fn_DelayMinutes({tm('07:50:00')},{tm('08:00:00')},0)").fetchone()[0])

# --- ATT-05 delay -> overtime adjustment -------------------------------------
check("ATT-05", "delay 10 minutes deducts 30", 30,
      con.execute("SELECT fn_DelayOtAdjustment(10)").fetchone()[0])
check("ATT-05", "delay 30 minutes deducts 30", 30,
      con.execute("SELECT fn_DelayOtAdjustment(30)").fetchone()[0])
check("ATT-05", "delay 35 minutes deducts 35", 35,
      con.execute("SELECT fn_DelayOtAdjustment(35)").fetchone()[0])
check("ATT-05", "delay 40 minutes deducts 40", 40,
      con.execute("SELECT fn_DelayOtAdjustment(40)").fetchone()[0])
check("ATT-05", "no delay deducts nothing", 0,
      con.execute("SELECT fn_DelayOtAdjustment(0)").fetchone()[0])

# --- ATT-08 the worked example of the SRS ------------------------------------
raw = con.execute(f"SELECT fn_RawWorkerOvertime({tm('17:10:00')},{tm('16:00:00')})").fetchone()[0]
check("ATT-08", "raw worker overtime 17:10 against a 16:00 end", 70, raw)
adj = con.execute("SELECT fn_DelayOtAdjustment(10)").fetchone()[0]
check("ATT-08", "check-in 08:10, check-out 17:10 -> counted overtime", 30,
      con.execute("SELECT fn_RoundOvertime(GREATEST(0, 70 - %d))" % adj).fetchone()[0])
check("ATT-08", "check-in 08:35, check-out 17:10 -> deduction", 35,
      con.execute("SELECT fn_DelayOtAdjustment(35)").fetchone()[0])

# --- ATT-09 overtime rounding ------------------------------------------------
for minutes, expected, label in [
    (0, 0, " 0 minutes of overtime -> 0"),
    (25, 0, "25 minutes of overtime -> 0"),
    (26, 30, "26 minutes of overtime -> 30"),
    (55, 30, "55 minutes of overtime -> 30"),
    (56, 60, "56 minutes of overtime -> 60"),
    (60, 60, "60 minutes of overtime -> 60"),
    (85, 60, "85 minutes of overtime -> 60 (1 h + 25 min)"),
    (86, 90, "86 minutes of overtime -> 90 (1 h + 26 min)"),
    (120, 120, "120 minutes of overtime -> 120"),
]:
    check("ATT-09", label, expected,
          con.execute(f"SELECT fn_RoundOvertime({minutes})").fetchone()[0])

# --- SHP-3 night shift -------------------------------------------------------
check("SHP-3", "a 22:00 to 06:00 shift spans 8 hours", 480,
      con.execute(f"SELECT fn_ShiftSpanMinutes({tm('22:00:00')},{tm('06:00:00')})").fetchone()[0])
check("SHP-3", "a 08:00 to 16:00 shift spans 8 hours", 480,
      con.execute(f"SELECT fn_ShiftSpanMinutes({tm('08:00:00')},{tm('16:00:00')})").fetchone()[0])

# --- ATT-10 officer overtime (assumption A2) ---------------------------------
check("ATT-10", "officer 09:16 to 18:20 with a 60 minute break", 64,
      con.execute(
          f"SELECT fn_RawOfficerOvertime({tm('09:16:00')},{tm('18:20:00')},{tm('09:00:00')},{tm('17:00:00')},60)"
      ).fetchone()[0])

# --- LVE-4 pro-rated entitlement ---------------------------------------------
check("LVE-4", "joining in February with 10 days gives 9", 9,
      con.execute(f"SELECT fn_ProRatedEntitlement(10, DATE '2026-02-10', 2026)").fetchone()[0])
check("LVE-4", "joining in an earlier year gives the full entitlement", 10,
      con.execute(f"SELECT fn_ProRatedEntitlement(10, DATE '2025-02-10', 2026)").fetchone()[0])
check("LVE-4", "joining next year gives nothing", 0,
      con.execute(f"SELECT fn_ProRatedEntitlement(10, DATE '2027-01-05', 2026)").fetchone()[0])

# --- ERN-3 / ERN-4 earned leave ----------------------------------------------
check("ERN-3", "worker: 250 work days / 18", 13.9,
      con.execute("SELECT fn_EarnedLeave('Worker', 250, 0, 0)").fetchone()[0])
check("ERN-4", "officer: 250 work days, 10 sick, 6 casual", 8.1,
      con.execute("SELECT fn_EarnedLeave('Officer', 250, 10, 6)").fetchone()[0])

# --- ERN-5 the one-year rule -------------------------------------------------
check("ERN-5", "joined 2025-10-28, earned leave available from 2026-10-28", "2026-10-28",
      str(con.execute(
          "SELECT fn_EarnedLeaveAvailableFrom(DATE '2025-10-28')").fetchone()[0]))

# --- EIR-4 tenure ------------------------------------------------------------
check("EIR-4", "tenure from 2021-09-04 to 2026-09-26", "5y 0m 22d",
      con.execute("SELECT fn_TenureText(DATE '2021-09-04', DATE '2026-09-26')").fetchone()[0])
check("EIR-4", "tenure that borrows a month", "5y 0m 27d",
      con.execute("SELECT fn_TenureText(DATE '2021-09-04', DATE '2026-10-01')").fetchone()[0])

# --- report ------------------------------------------------------------------
print()
print(f"{'AREA':<8} {'TEST':<58} {'EXPECTED':<14} {'ACTUAL':<14} RESULT")
print("-" * 116)
for area, name, exp, act, res in results:
    print(f"{area:<8} {name:<58} {str(exp):<14} {str(act):<14} {res}")

print("-" * 116)
print(f"{PASS} passed, {FAIL} failed")
sys.exit(0 if FAIL == 0 else 1)
