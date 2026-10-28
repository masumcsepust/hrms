// ---------------------------------------------------------------------------
// Calculation engine — SRS 3.8.2 (delay), 3.8.3 (overtime), 3.16 / 3.17 (leave)
//
// Every rule below is traceable to an SRS clause. Where the SRS marks a rule
// "TBD" the implemented behaviour is an explicit, documented assumption and is
// flagged as such in the UI (see ASSUMPTIONS).
// ---------------------------------------------------------------------------

import {
  AttendanceStatus,
  DayType,
  Employee,
  GroupType,
  LeaveApplication,
  LeaveType,
  Punch,
  ShiftPolicy,
} from './models';

export const ASSUMPTIONS: { id: string; clause: string; text: string }[] = [
  {
    id: 'A1',
    clause: 'ATT-04 / ATT-08',
    text: 'Worker delay is measured from the scheduled shift start. The exempt time is added to the scheduled start before the delay is measured, i.e. the first N minutes are grace, not delay. The worked examples in the delay adjustment table (a shift starting at 8:00 AM) therefore correspond to a shift with zero exempt time; with a grace period the effective delay is smaller and the deduction follows the same bands.',
  },
  {
    id: 'A2',
    clause: 'ATT-06 / ATT-10 (TBD)',
    text: 'Officer delay uses the same base as the Worker group (actual in-time minus shift start plus exempt time) but triggers no overtime deduction, because the delay adjustment is a Worker rule. Officer overtime is the actual time worked beyond the scheduled shift length.',
  },
  {
    id: 'A3',
    clause: 'ATT-09',
    text: 'The overtime rounding table is defined for the Worker group only. The same rounding is applied to Officer overtime as a documented assumption pending clarification.',
  },
  {
    id: 'A4',
    clause: 'LVE-4 (TBC)',
    text: 'Pro-rated entitlement for a mid-year joiner is rounded down to whole days.',
  },
  {
    id: 'A5',
    clause: 'ERN-4 (TBC)',
    text: '"Taken" means approved leave days settled in the calculation year, and the officer earned-leave denominator is rounded down to one decimal place.',
  },
  {
    id: 'A6',
    clause: 'ERN-5',
    text: 'Earned leave becomes usable once the employee has completed one full year from the joining date; the days are counted from the joining date.',
  },
];

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// --- date helpers ----------------------------------------------------------

export function toDate(v: string): Date {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(v: string, n: number): string {
  const d = toDate(v);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function todayIso(now: Date = new Date()): string {
  // NFR-7: the whole system runs on one configured time zone.
  return iso(new Date(now.getTime() + 6 * 60 * 60 * 1000)); // Asia/Dhaka = UTC+6
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000);
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekdayOf(v: string): number {
  return toDate(v).getUTCDay();
}

export function monthName(m: number): string {
  return [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][m];
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// --- time helpers ----------------------------------------------------------

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMin(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function fmtDur(min: number): string {
  const sign = min < 0 ? '-' : '';
  const v = Math.abs(Math.round(min));
  return `${sign}${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

export function fmtDurText(min: number): string {
  const sign = min < 0 ? '-' : '';
  const v = Math.abs(Math.round(min));
  const h = Math.floor(v / 60);
  const m = v % 60;
  if (!h) return `${sign}${m}m`;
  return `${sign}${h}h ${m ? m + 'm' : ''}`.trim();
}

/** Minutes between two HH:mm values on a shift that may cross midnight. */
export function spanMinutes(start: string, end: string): number {
  const s = toMin(start);
  const e = toMin(end);
  // SHP-3 (proposed): an end time earlier than the start time is a night shift.
  return e > s ? e - s : 1440 - s + e;
}

// --- ATT-04 / ATT-05 : delay ------------------------------------------------

/** Delay in minutes for a check-in, measured against shift start + exempt. */
export function calcDelay(inTime: string, shift: ShiftPolicy): number {
  const graceEnd = toMin(shift.startTime) + (shift.exemptMinutes || 0);
  const actual = toMin(inTime);
  let d = actual - graceEnd;
  if (d < 0) d = 0;
  // A night shift that ends after midnight: the in-time is on the next day.
  if (actual < graceEnd && graceEnd > 1440 - 1) d = 0;
  return d;
}

/**
 * Worker delay -> overtime adjustment (SRS 3.8.2).
 *   up to 30 minutes      -> deduct 30 minutes
 *   more than 30 minutes  -> deduct 30 + every minute beyond 30
 */
export function delayOtAdjustment(delayMinutes: number): number {
  if (delayMinutes <= 0) return 0;
  return delayMinutes > 30 ? delayMinutes : 30;
}

// --- ATT-08 / ATT-09 : overtime --------------------------------------------

/** Raw worker overtime: actual check-out minus scheduled shift end. */
export function rawWorkerOt(outTime: string, shift: ShiftPolicy): number {
  const end = toMin(shift.endTime);
  const out = toMin(outTime);
  let o = out - end;
  if (o < 0) o = 0;
  return o;
}

/** Officer overtime (assumption A2): worked time beyond the scheduled length. */
export function rawOfficerOt(inTime: string, outTime: string, shift: ShiftPolicy): number {
  const worked = spanMinutes(inTime, outTime) - (shift.breakMinutes || 0);
  const scheduled = spanMinutes(shift.startTime, shift.endTime) - (shift.breakMinutes || 0);
  const o = worked - scheduled;
  return o > 0 ? o : 0;
}

/**
 * Overtime rounding (SRS 3.8.3), applied inside every overtime hour:
 *   0-25 minutes   -> 0 minutes
 *   26-55 minutes  -> 30 minutes
 *   56-60 minutes  -> 60 minutes
 */
export function roundOt(minutes: number): number {
  if (minutes <= 0) return 0;
  const fullHours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  let bucket = 0;
  if (rem > 55) bucket = 60;
  else if (rem > 25) bucket = 30;
  return fullHours * 60 + bucket;
}

export interface OtResult {
  rawOt: number;
  delayAdjustment: number;
  adjustedOt: number;
  countedOt: number;
  lessTime: number;
}

export function calcOvertime(
  groupType: GroupType,
  inTime: string,
  outTime: string,
  delay: number,
  shift: ShiftPolicy,
): OtResult {
  if (groupType === 'Worker') {
    const rawOt = rawWorkerOt(outTime, shift);
    const delayAdjustment = delayOtAdjustment(delay);
    const adjusted = Math.max(0, rawOt - delayAdjustment);
    const shiftEnd = toMin(shift.endTime);
    const less = Math.max(0, shiftEnd - toMin(outTime));
    return {
      rawOt,
      delayAdjustment,
      adjustedOt: adjusted,
      countedOt: roundOt(adjusted),
      lessTime: less,
    };
  }
  const rawOt = rawOfficerOt(inTime, outTime, shift);
  const adjusted = rawOt;
  return {
    rawOt,
    delayAdjustment: 0,
    adjustedOt: adjusted,
    countedOt: roundOt(adjusted),
    lessTime: 0,
  };
}

// --- attendance day assembly ------------------------------------------------

export interface AttendanceDay {
  date: string;
  employeeId: string;
  dayType: DayType;
  status: AttendanceStatus;
  inTime: string | null;
  outTime: string | null;
  punchCount: number;
  delayMinutes: number;
  rawOt: number;
  delayAdjustment: number;
  countedOt: number;
  lessMinutes: number;
  totalWorkMinutes: number;
  regularMinutes: number;
  netMinutes: number;
  shiftMinutes: number;
  breakMinutes: number;
  shiftPolicyId: string | null;
  workGroupId: string;
  manual: boolean;
  remark: string;
  incomplete: boolean;
}

export interface AttendanceContext {
  shift: ShiftPolicy | null;
  dayType: DayType;
  onLeave: boolean;
  leaveRemark: string;
}

export function assembleAttendanceDay(
  emp: Employee,
  date: string,
  punches: Punch[],
  ctx: AttendanceContext,
  groupType: GroupType,
): AttendanceDay {
  const dayPunches = punches
    .filter((p) => p.employeeId === emp.id && p.date === date)
    .sort((a, b) => toMin(a.time) - toMin(b.time));

  const shift = ctx.shift;
  const breakMinutes = shift?.breakMinutes ?? 0;
  const shiftMinutes = shift ? spanMinutes(shift.startTime, shift.endTime) - breakMinutes : 0;

  const base: AttendanceDay = {
    date,
    employeeId: emp.id,
    dayType: ctx.dayType,
    status: 'Absent',
    inTime: null,
    outTime: null,
    punchCount: dayPunches.length,
    delayMinutes: 0,
    rawOt: 0,
    delayAdjustment: 0,
    countedOt: 0,
    lessMinutes: 0,
    totalWorkMinutes: 0,
    regularMinutes: 0,
    netMinutes: 0,
    shiftMinutes,
    breakMinutes,
    shiftPolicyId: shift?.id ?? null,
    workGroupId: emp.workGroupId,
    manual: dayPunches.some((p) => p.source !== 'Device'),
    remark: '',
    incomplete: false,
  };

  if (ctx.dayType === 'Holiday' || ctx.dayType === 'WeeklyOff') {
    if (dayPunches.length) {
      // worked on a holiday
      base.status = 'Present';
      base.remark = 'Worked on ' + ctx.dayType.toLowerCase();
    } else {
      base.status = ctx.dayType === 'Holiday' ? 'Holiday' : 'Weekend';
    }
    return base;
  }

  if (dayPunches.length === 0) {
    // ATT-13: no punch on a workday with no approved leave -> Absent
    base.status = ctx.onLeave ? 'On Leave' : 'Absent';
    if (ctx.onLeave) base.remark = ctx.leaveRemark;
    return base;
  }

  // ATT-11: first punch = in time, last punch = out time
  const inTime = dayPunches[0].time;
  const outTime = dayPunches.length > 1 ? dayPunches[dayPunches.length - 1].time : null;
  base.inTime = inTime;
  base.outTime = outTime;
  base.punchCount = dayPunches.length;
  base.totalWorkMinutes = outTime ? spanMinutes(inTime, outTime) : 0;
  base.netMinutes = Math.max(0, base.totalWorkMinutes - breakMinutes);

  if (!shift) {
    base.status = 'Present';
    base.remark = 'No shift policy assigned';
    return base;
  }

  const delay = calcDelay(inTime, shift);
  base.delayMinutes = delay;

  if (outTime) {
    const ot = calcOvertime(groupType, inTime, outTime, delay, shift);
    base.rawOt = ot.rawOt;
    base.delayAdjustment = ot.delayAdjustment;
    base.countedOt = ot.countedOt;
    base.lessMinutes = ot.lessTime;
    base.regularMinutes = Math.max(0, base.netMinutes - ot.countedOt);
  } else {
    base.regularMinutes = 0;
  }

  // ATT-12: a single punch is flagged as incomplete for HR review
  if (dayPunches.length === 1) {
    base.incomplete = true;
    base.status = 'Incomplete';
    base.remark = base.remark || 'Single punch — incomplete record';
  } else {
    base.status = 'Present';
  }
  return base;
}

// --- leave entitlement -----------------------------------------------------

/** LVE-4: pro-rated entitlement for a mid-year joiner. */
export function proRatedEntitlement(total: number, joiningDate: string, year: number): number {
  const join = toDate(joiningDate);
  if (join.getUTCFullYear() < year) return total;
  if (join.getUTCFullYear() > year) return 0;
  const month = join.getUTCMonth();
  const remaining = 12 - month; // joining in February -> 11 months
  const value = (total / 12) * remaining;
  return Math.floor(value + 1e-9); // A4: round down
}

/** EL availability: one full year from the joining date (ERN-5 / A6). */
export function elAvailableFrom(joiningDate: string): string {
  const d = toDate(joiningDate);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return iso(d);
}

export function earnedLeaveEligible(joiningDate: string, onDate: string): boolean {
  return onDate >= elAvailableFrom(joiningDate);
}

export interface ElCalculation {
  workDays: number;
  sickTaken: number;
  casualTaken: number;
  denominator: number;
  earned: number;
}

/** ERN-3 / ERN-4 */
export function calcEarnedLeave(
  groupType: GroupType,
  workDays: number,
  sickTaken: number,
  casualTaken: number,
): ElCalculation {
  const denominator =
    groupType === 'Worker'
      ? 18
      : 18 + sickTaken + 0.5 * casualTaken;
  const d = denominator === 0 ? 18 : denominator;
  const earned = Math.round((workDays / d) * 10) / 10; // A5: one decimal
  return { workDays, sickTaken, casualTaken, denominator: d, earned };
}

export interface LeaveBalanceRow {
  leaveTypeId: string;
  name: string;
  entitlement: number;
  carriedForward: number;
  used: number;
  paid: number;
  balance: number;
  applicable: boolean;
  calculated: boolean;
}

/**
 * LVE-8: a weekend that falls *between* the requested leave days counts as
 * leave for the Worker group and is excluded for the Officer group.
 *
 * The weekend days at the very start or the very end of the requested period
 * are not "between" days, so they are not added.
 */
export function sandwichDaysFor(
  groupType: GroupType,
  fromDate: string,
  toDate: string,
  isWeeklyOff: (d: string) => boolean,
): number {
  const dates = eachDate(fromDate, toDate);
  if (dates.length < 3) return 0;
  const inner = dates.slice(1, -1);
  return inner.filter(isWeeklyOff).length;
}

export function leaveDaysBetween(
  groupType: GroupType,
  fromDate: string,
  toDate: string,
  isWeeklyOff: (d: string) => boolean,
): { days: number; sandwich: number } {
  const dates = eachDate(fromDate, toDate);
  const working = dates.filter((d) => !isWeeklyOff(d)).length;
  const inner = dates.length > 2 ? dates.slice(1, -1) : [];
  const sandwich = inner.filter(isWeeklyOff).length;
  // Worker: the intervening weekend is leave as well. Officer: it is excluded.
  const days = groupType === 'Worker' ? working + sandwich : working;
  return { days, sandwich };
}

// --- EIR-4 : tenure --------------------------------------------------------

export interface Tenure {
  years: number;
  months: number;
  days: number;
  label: string;
}

export function calcTenure(from: string, to: string): Tenure {
  const a = toDate(from);
  const b = toDate(to);
  if (b < a) return { years: 0, months: 0, days: 0, label: '0y 0m 0d' };
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  let months = b.getUTCMonth() - a.getUTCMonth();
  let days = b.getUTCDate() - a.getUTCDate();
  if (days < 0) {
    months -= 1;
    const prev = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0));
    days += prev.getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days, label: `${years}y ${months}m ${days}d` };
}

export function yearOf(v: string): number {
  return Number(v.slice(0, 4));
}
