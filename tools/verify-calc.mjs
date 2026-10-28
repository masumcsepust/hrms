/**
 * Verification of the calculation engine against the worked examples in the SRS.
 *
 *   node tools/verify-calc.mjs
 *
 * The engine is bundled from TypeScript with esbuild before the checks run, so
 * this exercises exactly the code the application uses.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tmp = path.join(root, 'node_modules', '.cache', 'calc-engine.mjs');

fs.mkdirSync(path.dirname(tmp), { recursive: true });
execFileSync(
  path.join(root, 'node_modules', '.bin', 'esbuild'),
  [
    path.join(root, 'src/app/core/calc.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${tmp}`,
  ],
  { stdio: 'inherit' },
);

const C = await import(`file://${tmp}`);

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}  →  ${JSON.stringify(actual)}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}  →  got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

const shift = (over = {}) => ({
  id: 'sh-x',
  name: 'Shift (8:00 - 16:00)',
  startTime: '08:00',
  endTime: '16:00',
  breakMinutes: 0,
  exemptMinutes: 0,
  shiftType: 'Day',
  active: true,
  ...over,
});

console.log('\n=== 3.8.2 delay management (Worker) ===');
// ATT-04: delay is measured from the scheduled shift start plus exempt time
check('delay 08:00 vs 08:00 start, 0 exempt', C.calcDelay('08:00', shift()), 0);
check('delay 08:10 vs 08:00 start, 0 exempt', C.calcDelay('08:10', shift()), 10);
check('delay 08:10 vs 08:00 start, 10 exempt (grace)', C.calcDelay('08:10', shift({ exemptMinutes: 10 })), 0);
check('delay 08:20 vs 08:00 start, 10 exempt', C.calcDelay('08:20', shift({ exemptMinutes: 10 })), 10);
check('delay 07:50 (early) is zero', C.calcDelay('07:50', shift()), 0);

console.log('\n=== 3.8.2 delay OT adjustment table ===');
// up to 30 minutes -> deduct 30 ; more than 30 -> 30 + every minute beyond 30
check('delay 10 min  -> deduct 30', C.delayOtAdjustment(10), 30);
check('delay 30 min  -> deduct 30', C.delayOtAdjustment(30), 30);
check('delay 35 min  -> deduct 35', C.delayOtAdjustment(35), 35);
check('delay 40 min  -> deduct 40', C.delayOtAdjustment(40), 40);
check('no delay      -> deduct 0', C.delayOtAdjustment(0), 0);

console.log('\n=== 3.8.2 worked example: shift starting 8:00 AM ===');
{
  const s = shift();
  // check-in 8:10, check-out 17:10 -> raw OT 70 min, deduct 30 -> 40 -> rounds to 30
  const r1 = C.calcOvertime('Worker', '08:10', '17:10', C.calcDelay('08:10', s), s);
  check('8:10 / 17:10 raw OT', r1.rawOt, 70);
  check('8:10 / 17:10 deduction', r1.delayAdjustment, 30);
  check('8:10 / 17:10 counted OT', r1.countedOt, 30);

  // check-in 8:30, check-out 17:10 -> raw OT 70, deduct 30 -> 40 -> 30
  const r2 = C.calcOvertime('Worker', '08:30', '17:10', C.calcDelay('08:30', s), s);
  check('8:30 / 17:10 counted OT', r2.countedOt, 30);

  // check-in 8:35, check-out 17:10 -> raw OT 70, deduct 35 -> 35 -> rounds to 30
  const r3 = C.calcOvertime('Worker', '08:35', '17:10', C.calcDelay('8:35'.replace('8:35', '08:35'), s), s);
  check('8:35 / 17:10 deduction', r3.delayAdjustment, 35);
  check('8:35 / 17:10 counted OT', r3.countedOt, 30);
}

console.log('\n=== 3.8.3 overtime rounding table ===');
check(' 0 min overtime -> 0', C.roundOt(0), 0);
check('25 min overtime -> 0', C.roundOt(25), 0);
check('26 min overtime -> 30', C.roundOt(26), 30);
check('55 min overtime -> 30', C.roundOt(55), 30);
check('56 min overtime -> 60', C.roundOt(56), 60);
check('60 min overtime -> 60', C.roundOt(60), 60);
check('85 min overtime -> 60 (1h + 25 min)', C.roundOt(85), 60);
check('86 min overtime -> 90 (1h + 26 min)', C.roundOt(86), 90);
check('120 min overtime -> 120', C.roundOt(120), 120);

console.log('\n=== SHP-3 night shift ===');
check('22:00 -> 06:00 spans 8h', C.spanMinutes('22:00', '06:00'), 480);
check('08:00 -> 16:00 spans 8h', C.spanMinutes('08:00', '16:00'), 480);

console.log('\n=== ATT-06 / ATT-10 officer overtime (assumption A2) ===');
{
  const s = shift({ startTime: '09:00', endTime: '17:00', breakMinutes: 60, exemptMinutes: 15 });
  // 09:16 -> 18:20 = 9h04 worked, minus 1h break = 8h04 net; shift net = 7h -> 64 min OT -> 60
  const r = C.calcOvertime('Officer', '09:16', '18:20', C.calcDelay('09:16', s), s);
  check('officer raw OT', r.rawOt, 64);
  check('officer counted OT', r.countedOt, 60);
  check('officer takes no delay deduction', r.delayAdjustment, 0);
}

console.log('\n=== LVE-4 pro-rated entitlement for a mid-year joiner ===');
// example from the SRS: joining in February with 10 days gives 10/12 x 11
check('join 2026-02-10, casual 10 days', C.proRatedEntitlement(10, '2026-02-10', 2026), 9);
check('join 2025-02-10, casual 10 days (full year)', C.proRatedEntitlement(10, '2025-02-10', 2026), 10);
check('join 2027-01-05, casual 10 days (no entitlement)', C.proRatedEntitlement(10, '2027-01-05', 2026), 0);

console.log('\n=== 3.17 earned leave (ERN-3 / ERN-4) ===');
check('Worker: 250 work days / 18', C.calcEarnedLeave('Worker', 250, 0, 0).earned, 13.9);
check('Officer: 250 work days, 10 sick, 6 casual', C.calcEarnedLeave('Officer', 250, 10, 6).earned, 8.1);
check('Officer denominator = 18 + sick + 50% casual', C.calcEarnedLeave('Officer', 250, 10, 6).denominator, 31);

console.log('\n=== ERN-5 / A6 earned leave becomes available after one year ===');
check('joined 2025-10-28, available 2026-10-28', C.elAvailableFrom('2025-10-28'), '2026-10-28');
check('eligible on 2026-10-28', C.earnedLeaveEligible('2025-10-28', '2026-10-28'), true);
check('not eligible on 2026-10-27', C.earnedLeaveEligible('2025-10-28', '2026-10-27'), false);

console.log('\n=== EIR-4 tenure ===');
{
  const t = C.calcTenure('2021-09-04', '2026-09-26');
  check('tenure label', t.label, '5y 0m 22d');
}

console.log('\n=== LVE-8 sandwich leave ===');
{
  // Friday is the weekly holiday; leave on Thursday and Saturday
  const fridayIsOff = (d) => new Date(d + 'T00:00:00Z').getUTCDay() === 5;
  const worker = C.leaveDaysBetween('Worker', '2026-10-01', '2026-10-03', fridayIsOff);
  const officer = C.leaveDaysBetween('Officer', '2026-10-01', '2026-10-03', fridayIsOff);
  check('Worker counts the intervening Friday', worker.days, 3);
  check('Worker sandwich days', worker.sandwich, 1);
  check('Officer excludes the intervening Friday', officer.days, 2);
  check('Officer sandwich days identified but excluded', officer.sandwich, 1);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
