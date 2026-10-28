import { Injectable, inject } from '@angular/core';
import { Store } from './store';
import { SchedulingService } from './scheduling.service';
import { Employee, GroupType, ID, LeaveApplication, Punch } from './models';
import {
  AttendanceDay,
  assembleAttendanceDay,
  daysInMonth,
  eachDate,
  todayIso,
} from './calc';
import { uid } from './seed';
import { NotificationService } from './notification.service';
import { monthName } from './calc';

export interface JobCardSummary {
  totalWorkDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  holidayDays: number;
  weeklyWorkDays: number;
  totalDelay: number;
  totalOt: number;
  totalWorkHours: number;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly store = inject(Store);
  private readonly sched = inject(SchedulingService);
  private readonly notify = inject(NotificationService);

  private groupTypeOf(emp: Employee): GroupType {
    return this.store.workGroups.byId(emp.workGroupId)?.groupType ?? 'Worker';
  }

  /** Approved leave covering a date. */
  leaveOn(emp: Employee, date: string): LeaveApplication | undefined {
    return this.store.leaveApplications
      .all()
      .find(
        (l) =>
          l.employeeId === emp.id &&
          (l.status === 'Approved' || l.status === 'Settled') &&
          l.fromDate <= date &&
          l.toDate >= date,
      );
  }

  /**
   * DSH-3 — an absent employee is "informed" when a leave record exists for the
   * day (applied, approved, LWP or CNL). No record at all means "not informed".
   */
  informedAbsent(emp: Employee, date: string): boolean {
    return this.store.leaveApplications.all().some(
      (l) => l.employeeId === emp.id && l.fromDate <= date && l.toDate >= date,
    );
  }

  dayFor(emp: Employee, date: string, punches?: Punch[]): AttendanceDay {
    const allPunches = punches ?? this.store.punches.all();
    const leave = this.leaveOn(emp, date);
    const shift = this.sched.shiftFor(emp, date);
    const dayType = this.sched.dayType(emp, date);
    return assembleAttendanceDay(
      emp,
      date,
      allPunches,
      {
        shift: shift ?? null,
        dayType,
        onLeave: !!leave,
        leaveRemark: leave ? 'Approved leave' : '',
      },
      this.groupTypeOf(emp),
    );
  }

  range(emp: Employee, from: string, to: string): AttendanceDay[] {
    const punches = this.store.punches.all();
    return eachDate(from, to).map((d) => this.dayFor(emp, d, punches));
  }

  jobCard(emp: Employee, from: string, to: string) {
    const days = this.range(emp, from, to);
    const summary: JobCardSummary = {
      totalWorkDays: days.filter((d) => d.dayType === 'Workday').length,
      presentDays: days.filter((d) => d.status === 'Present').length,
      absentDays: days.filter((d) => d.status === 'Absent').length,
      leaveDays: days.filter((d) => d.status === 'On Leave').length,
      holidayDays: days.filter((d) => d.dayType !== 'Workday').length,
      weeklyWorkDays: days.filter((d) => d.dayType === 'Workday').length,
      totalDelay: days.reduce((s, d) => s + d.delayMinutes, 0),
      totalOt: days.reduce((s, d) => s + d.countedOt, 0),
      totalWorkHours: Math.round((days.reduce((s, d) => s + d.netMinutes, 0) / 60) * 10) / 10,
    };
    return { days, summary };
  }

  /** ATT-02: manual punch or correction, always with a mandatory remark. */
  addPunch(
    employeeId: ID,
    date: string,
    time: string,
    remark: string,
    mode: 'Manual' | 'Corrected',
  ): Punch {
    const punch: Punch = {
      id: uid('pu'),
      employeeId,
      date,
      time,
      source: mode,
      remark,
      deviceId: 'MANUAL',
    };
    this.store.punches.upsert(punch);
    this.store.log(
      mode === 'Corrected' ? 'Attendance correction' : 'Manual punch',
      'Punch',
      punch.id,
      `${employeeId} ${date} ${time} — ${remark}`,
    );
    return punch;
  }

  removePunch(id: ID): void {
    const p = this.store.punches.byId(id);
    this.store.punches.remove(id);
    if (p) this.store.log('Punch removed', 'Punch', id, `${p.employeeId} ${p.date} ${p.time}`);
  }

  /** ATT-11 / ATT-12 helper: punches of a day, sorted. */
  punchesOf(employeeId: ID, date: string): Punch[] {
    return this.store.punches
      .all()
      .filter((p) => p.employeeId === employeeId && p.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  // --- reports -------------------------------------------------------------

  /** RPT-1 / EDR — employee daily (date-wise) attendance report. */
  dailyRows(date: string, employees: Employee[], workGroupId?: ID, sectionId?: ID) {
    const punches = this.store.punches.all();
    return employees
      .filter(
        (e) =>
          (!workGroupId || e.workGroupId === workGroupId) &&
          (!sectionId || e.sectionId === sectionId),
      )
      .map((e) => {
        const day = assembleAttendanceDay(
          e,
          date,
          punches,
          {
            shift: this.sched.shiftFor(e, date) ?? null,
            dayType: this.sched.dayType(e, date),
            onLeave: !!this.leaveOn(e, date),
            leaveRemark: 'Approved leave',
          },
          this.groupTypeOf(e),
        );
        return { employee: e, day };
      });
  }

  /** DAR — manpower, present count and present ratio per work group per day. */
  dailyAttendanceSummary(
    from: string,
    to: string,
    employees: Employee[],
    workGroupId?: ID,
    sectionId?: ID,
  ) {
    const rows: {
      date: string;
      workGroupId: ID;
      workGroup: string;
      totalManpower: number;
      present: number;
      absent: number;
      onLeave: number;
      ratio: number;
    }[] = [];
    const pool = employees.filter(
      (e) =>
        (!workGroupId || e.workGroupId === workGroupId) &&
        (!sectionId || e.sectionId === sectionId),
    );
    for (const date of eachDate(from, to)) {
      for (const wg of this.store.workGroups.all()) {
        const members = pool.filter((e) => e.workGroupId === wg.id);
        if (!members.length) continue;
        let present = 0;
        let absent = 0;
        let onLeave = 0;
        for (const e of members) {
          const d = this.dayFor(e, date);
          if (d.status === 'Present') present++;
          else if (d.status === 'Absent') absent++;
          else if (d.status === 'On Leave') onLeave++;
        }
        rows.push({
          date,
          workGroupId: wg.id,
          workGroup: wg.name,
          totalManpower: members.length,
          present,
          absent,
          onLeave,
          ratio: members.length ? Math.round((present / members.length) * 1000) / 10 : 0,
        });
      }
    }
    return rows;
  }

  /** DPC — daily punch count report. */
  punchCountRows(
    from: string,
    to: string,
    employees: Employee[],
    workGroupId?: ID,
    sectionId?: ID,
    employeeId?: ID,
  ) {
    const punches = this.store.punches.all();
    const out: {
      date: string;
      employee: Employee;
      inTime: string;
      outTime: string;
      punches: number;
      incomplete: boolean;
    }[] = [];
    for (const date of eachDate(from, to)) {
      for (const e of employees) {
        if (
          (workGroupId && e.workGroupId !== workGroupId) ||
          (sectionId && e.sectionId !== sectionId) ||
          (employeeId && e.id !== employeeId)
        )
          continue;
        const day = punches.filter((p) => p.employeeId === e.id && p.date === date);
        if (!day.length) continue;
        const sorted = [...day].sort((a, b) => a.time.localeCompare(b.time));
        out.push({
          date,
          employee: e,
          inTime: sorted[0].time,
          outTime: sorted.length > 1 ? sorted[sorted.length - 1].time : '',
          punches: sorted.length,
          incomplete: sorted.length === 1, // ATT-12 / DPC-3
        });
      }
    }
    return out;
  }

  /** DLR — delay ratio per employee. */
  delayRatioRows(
    from: string,
    to: string,
    employees: Employee[],
    workGroupId?: ID,
    sectionId?: ID,
    employeeId?: ID,
  ) {
    const punches = this.store.punches.all();
    return employees
      .filter(
        (e) =>
          (!workGroupId || e.workGroupId === workGroupId) &&
          (!sectionId || e.sectionId === sectionId) &&
          (!employeeId || e.id === employeeId),
      )
      .map((e) => {
        const days = eachDate(from, to).map((d) =>
          assembleAttendanceDay(
            e,
            d,
            punches,
            {
              shift: this.sched.shiftFor(e, d) ?? null,
              dayType: this.sched.dayType(e, d),
              onLeave: !!this.leaveOn(e, d),
              leaveRemark: 'Approved leave',
            },
            this.groupTypeOf(e),
          ),
        );
        const working = days.filter((d) => d.dayType === 'Workday');
        const delayDays = working.filter((d) => d.delayMinutes > 0).length;
        return {
          employee: e,
          totalWorkingDays: working.length,
          delayDays,
          delayPercentage: working.length
            ? Math.round((delayDays / working.length) * 1000) / 10
            : 0,
          totalDelayMinutes: working.reduce((s, d) => s + d.delayMinutes, 0),
        };
      });
  }

  /**
   * ATT-07 — the number of days with a delay in a calendar month.
   */
  delayCountInMonth(emp: Employee, year: number, month: number): number {
    const last = daysInMonth(year, month);
    const punches = this.store.punches.all();
    let count = 0;
    for (let d = 1; d <= last; d++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (date > todayIso()) break;
      if (this.sched.dayType(emp, date) !== 'Workday') continue;
      const day = assembleAttendanceDay(
        emp,
        date,
        punches,
        {
          shift: this.sched.shiftFor(emp, date) ?? null,
          dayType: this.sched.dayType(emp, date),
          onLeave: !!this.leaveOn(emp, date),
          leaveRemark: 'Approved leave',
        },
        this.groupTypeOf(emp),
      );
      if (day.delayMinutes > 0) count++;
    }
    return count;
  }

  /**
   * ATT-07 — the alert state for an employee. Pure read, safe to call from a
   * computed.
   */
  delayAlertState(emp: Employee): { count: number; month: string; alert: boolean } {
    const today = todayIso();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7)) - 1;
    const count = this.delayCountInMonth(emp, year, month);
    return { count, month: `${monthName(month)} ${year}`, alert: count >= 3 };
  }

  /**
   * ATT-07 — on the third delay of a calendar month an e-mail alert is sent and
   * an alert is shown on the employee profile. The alert is raised once per
   * employee and month. This writes to the store, so it must not be called from
   * inside a computed.
   */
  raiseDelayAlert(emp: Employee): void {
    const state = this.delayAlertState(emp);
    if (!state.alert) return;
    const already = this.store.audit
      .all()
      .some(
        (a) =>
          a.action === 'Delay alert' &&
          a.entityId === emp.id &&
          a.detail.includes(state.month),
      );
    if (already) return;
    this.store.log('Delay alert', emp.id, emp.id, `${state.count} delays in ${state.month}`);
    this.notify.delayAlert(emp, state.count, state.month);
  }

  today(): string {
    return todayIso();
  }
}
