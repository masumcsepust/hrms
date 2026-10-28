import { Injectable, inject } from '@angular/core';
import { Store } from './store';
import { DayType, DutyRoster, Employee, ShiftPolicy } from './models';
import { toDate } from './calc';

/**
 * Resolves the working calendar for an employee: duty roster (ROS-2..ROS-4)
 * and the work/holiday calendar (CAL-1..CAL-5).
 */
@Injectable({ providedIn: 'root' })
export class SchedulingService {
  private readonly store = inject(Store);

  /** ROS-4: an individual assignment takes precedence over the group roster. */
  rosterFor(emp: Employee, date: string): DutyRoster | undefined {
    const rosters = this.store.dutyRosters
      .all()
      .filter((r) => r.active && r.startDate <= date && r.endDate >= date);
    const individual = rosters.find((r) => r.employeeId === emp.id);
    if (individual) return individual;
    const group = rosters.find((r) => r.workGroupId === emp.workGroupId && !r.employeeId);
    return group;
  }

  shiftFor(emp: Employee, date: string): ShiftPolicy | undefined {
    const roster = this.rosterFor(emp, date);
    if (!roster) return undefined;
    return this.store.shiftPolicies.byId(roster.shiftPolicyId);
  }

  /** The roster working days (0 = Sunday … 6 = Saturday). */
  workingDays(emp: Employee, date: string): number[] {
    return this.rosterFor(emp, date)?.weekDays ?? [];
  }

  isRosterWorkingDay(emp: Employee, date: string): boolean {
    const days = this.workingDays(emp, date);
    if (!days.length) return true;
    return days.includes(toDate(date).getUTCDay());
  }

  /** CAL-2 / CAL-4: calendar entries that apply to this employee. */
  calendarEntries(date: string, workGroupId: string) {
    const all = this.store.calendar.where((c) => c.date === date);
    return [
      ...all.filter((c) => c.workGroupId === workGroupId),
      ...all.filter((c) => !c.workGroupId),
    ];
  }

  dayType(emp: Employee, date: string): DayType {
    const entries = this.calendarEntries(date, emp.workGroupId);
    const specific = entries.find((e) => e.workGroupId === emp.workGroupId);
    const generic = entries.find((e) => !e.workGroupId);
    const cal = specific ?? generic;
    if (cal) {
      if (cal.dayType === 'Holiday') return 'Holiday';
      if (cal.dayType === 'Adjustment') return 'Workday';
      if (cal.dayType === 'WeeklyOff') return 'Weekend';
      return 'Workday';
    }
    return this.isRosterWorkingDay(emp, date) ? 'Workday' : 'Weekend';
  }

  /** Weekends for the sandbox team used by the sandwich-leave rule (LVE-8). */
  weeklyOffDays(emp: Employee, date: string): number[] {
    const days = this.workingDays(emp, date);
    if (!days.length) return [5];
    const off: number[] = [];
    for (let i = 0; i < 7; i++) if (!days.includes(i)) off.push(i);
    return off.length ? off : [5];
  }

  isWeeklyOff(emp: Employee, date: string): boolean {
    return this.dayType(emp, date) === 'Weekend';
  }

  /** CAL-2: declare a day as Holiday / Workday / Adjustment with a comment. */
  declareDay(
    date: string,
    dayType: DayType,
    comment: string,
    workGroupId: string | null,
  ): void {
    const existing = this.store.calendar.where(
      (c) => c.date === date && c.workGroupId === workGroupId,
    );
    if (existing.length) {
      this.store.calendar.patch(existing[0].id, { dayType, comment });
    } else {
      this.store.calendar.upsert({
        id: `cal-${date}-${workGroupId ?? 'all'}`,

        date,
        dayType,
        comment,
        workGroupId,
      });
    }
    this.store.log(
      'Calendar change',
      'Calendar',
      date,
      `${dayType}${comment ? ' — ' + comment : ''}${workGroupId ? ' (work group ' + workGroupId + ')' : ' (all work groups)'}`,
    );
  }
}
