import { Injectable, inject } from '@angular/core';
import { Store } from './store';
import { SchedulingService } from './scheduling.service';
import { Employee, ID, LeaveApplication, LeaveType } from './models';
import {
  ElCalculation,
  LeaveBalanceRow,
  calcEarnedLeave,
  earnedLeaveEligible,
  eachDate,
  leaveDaysBetween,
  proRatedEntitlement,
  todayIso,
  yearOf,
} from './calc';
import { uid } from './seed';
import { NotificationService } from './notification.service';

export interface ApplyInput {
  employee: Employee;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  attachmentName: string | null;
  isLwp: boolean;
  isCnl: boolean;
  managementApproved: boolean;
}

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly store = inject(Store);
  private readonly sched = inject(SchedulingService);
  private readonly notify = inject(NotificationService);

  // --- balances ------------------------------------------------------------

  /** Working days of an employee in a year, up to `until` (or the full year). */
  workDaysInYear(emp: Employee, year: number, until?: string): number {
    const end = until ?? `${year}-12-31`;
    const start = `${year}-01-01`;
    let count = 0;
    for (const d of eachDate(start, end)) {
      if (this.sched.dayType(emp, d) === 'Workday') count++;
    }
    return count;
  }

  private applicationsIn(emp: Employee, year: number, typeId?: ID) {
    return this.store.leaveApplications.where(
      (l) =>
        l.employeeId === emp.id &&
        yearOf(l.fromDate) === year &&
        (!typeId || l.leaveTypeId === typeId) &&
        (l.status === 'Settled' || l.status === 'Approved'),
    );
  }

  /** Days of a leave type actually taken (posted against the balance). */
  takenDays(emp: Employee, year: number, typeId: ID): number {
    return this.applicationsIn(emp, year, typeId)
      .filter((l) => l.status === 'Settled')
      .reduce((s, l) => s + l.days, 0);
  }

  /** Sick / casual days taken — used by the officer earned-leave formula. */
  takenByCode(emp: Employee, year: number, code: string): number {
    const type = this.store.leaveTypes.where((t) => t.code === code)[0];
    if (!type) return 0;
    return this.takenDays(emp, year, type.id);
  }

  /** LVE-4: entitlement for the year, pro-rated for a mid-year joiner. */
  entitlementFor(emp: Employee, lt: LeaveType, year: number): number {
    if (lt.calculated) {
      const el = this.earnedLeaveProjection(emp, year);
      return el.earned;
    }
    return proRatedEntitlement(lt.annualDays, emp.joiningDate, year);
  }

  /** ERN-2 / ERN-3 / ERN-4 — provisional running balance on the same formula. */
  earnedLeaveProjection(emp: Employee, year: number): ElCalculation & { available: boolean } {
    const groupType = this.store.workGroups.byId(emp.workGroupId)?.groupType ?? 'Worker';
    const workDays = this.workDaysInYear(emp, year, year === yearOf(todayIso()) ? todayIso() : undefined);
    const sick = this.takenByCode(emp, year, 'SL');
    const casual = this.takenByCode(emp, year, 'CL');
    const calc = calcEarnedLeave(groupType, workDays, sick, casual);
    const available = earnedLeaveEligible(emp.joiningDate, `${year}-12-31`);
    return { ...calc, available };
  }

  /**
   * LVE-3: sick and casual are not carried forward, earned leave is carried
   * forward up to 15 days. The rule is applied per leave type.
   */
  carriedForward(emp: Employee, year: number, leaveType?: LeaveType): number {
    const type =
      leaveType ?? this.store.leaveTypes.where((t) => t.code === 'EL')[0];
    if (!type || !type.carryForward) return 0;
    const prev = this.closingBalance(emp, year - 1, type.id);
    return Math.min(type.carryForward, Math.max(0, prev));
  }

  private closingBalance(emp: Employee, year: number, leaveTypeId?: ID): number {
    const rows = this.balance(emp, year, false, leaveTypeId);
    return rows.reduce((s, r) => s + r.balance, 0);
  }

  balance(
    emp: Employee,
    year: number,
    withCarry = true,
    onlyTypeId?: ID,
  ): LeaveBalanceRow[] {
    const types = this.store.leaveTypes
      .all()
      .filter((t) => t.active && emp.leaveTypeIds.includes(t.id));
    return types
      .filter((t) => !onlyTypeId || t.id === onlyTypeId)
      .map((t) => {
      const entitlement = this.entitlementFor(emp, t, year);
      const carriedForward = withCarry ? this.carriedForward(emp, year, t) : 0;
      const used = this.takenDays(emp, year, t.id);
      const paid = this.store.elPayoffs
        .where((p) => p.employeeId === emp.id && p.year === year)
        .reduce((s, p) => s + p.days, 0);
      const balance = entitlement + carriedForward - used - paid;
      return {
        leaveTypeId: t.id,
        name: t.name,
        entitlement,
        carriedForward,
        used,
        paid,
        balance,
        applicable: balance > 0 || t.calculated,
        calculated: t.calculated,
      };
    });
  }

  /** LVE-5: zero balance makes the type not normally applicable. */
  applicableType(emp: Employee, leaveTypeId: ID, year: number): boolean {
    const row = this.balance(emp, year).find((r) => r.leaveTypeId === leaveTypeId);
    if (!row) return false;
    return row.balance > 0;
  }

  // --- applications --------------------------------------------------------

  /** LVE-8: a weekend between leave days counts as leave for Workers only. */
  computeDays(emp: Employee, fromDate: string, toDate: string) {
    const groupType = this.store.workGroups.byId(emp.workGroupId)?.groupType ?? 'Worker';
    return leaveDaysBetween(groupType, fromDate, toDate, (d) =>
      this.sched.isWeeklyOff(emp, d),
    );
  }

  apply(input: ApplyInput): { ok: boolean; message: string; application?: LeaveApplication } {
    const year = yearOf(input.fromDate);
    const { days, sandwich } = this.computeDays(input.employee, input.fromDate, input.toDate);

    // LVE-7: sick leave requires a mandatory attachment
    if (input.leaveType.attachmentRequired && !input.attachmentName) {
      return { ok: false, message: 'A supporting attachment is mandatory for this leave type.' };
    }

    // LVE-5 / LVE-6: zero balance -> LWP or CNL with prior management approval
    if (!input.isLwp && !input.isCnl) {
      const balance = this.balance(input.employee, year).find(
        (r) => r.leaveTypeId === input.leaveType.id,
      );
      if (!balance || balance.balance <= 0) {
        return {
          ok: false,
          message:
            'Leave balance is zero. Apply as LWP or CNL with prior management approval (LVE-6).',
        };
      }
      if (balance.balance < days) {
        return {
          ok: false,
          message: `Requested ${days} day(s) but only ${balance.balance} day(s) are available.`,
        };
      }
    } else if (!input.managementApproved) {
      return {
        ok: false,
        message: 'LWP / CNL requires prior management approval (LVE-6).',
      };
    }

    const app: LeaveApplication = {
      id: uid('lv'),
      employeeId: input.employee.id,
      leaveTypeId: input.leaveType.id,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days,
      reason: input.reason,
      attachmentName: input.attachmentName,
      status: 'Applied',
      isLwp: input.isLwp,
      isCnl: input.isCnl,
      managementApproved: input.managementApproved,
      sandwichDays: sandwich,
      appliedAt: new Date().toISOString(),
      decidedBy: null,
      decidedAt: null,
      decisionRemark: '',
    };
    this.store.leaveApplications.upsert(app);
    this.store.log(
      'Leave applied',
      'Leave',
      app.id,
      `${input.employee.id} ${input.leaveType.name} ${input.fromDate} to ${input.toDate} (${days}d)`,
    );
    this.notify.leaveApplied(app, input.employee);
    return { ok: true, message: 'Leave application submitted.', application: app };
  }

  /** ESS-2: Approver decides; a rejected application ends the flow. */
  decide(id: ID, approve: boolean, remark: string, by: string): void {
    const app = this.store.leaveApplications.byId(id);
    if (!app) return;
    this.store.leaveApplications.patch(id, {
      status: approve ? 'Approved' : 'Rejected',
      decidedBy: this.store.currentUser()?.employeeId ?? null,
      decidedAt: new Date().toISOString(),
      decisionRemark: remark,
    });
    this.store.log(
      approve ? 'Leave approved' : 'Leave rejected',
      'Leave',
      id,
      `${app.employeeId} ${app.fromDate} to ${app.toDate}${remark ? ' — ' + remark : ''}`,
    );
    const emp = this.store.employees.byId(app.employeeId);
    if (approve) this.notify.leaveApproved(app, emp);
    else this.notify.leaveRejected(app, emp);
  }

  /** ESS-2: settle posts the leave against the balance and history. */
  settle(id: ID): void {
    const app = this.store.leaveApplications.byId(id);
    if (!app) return;
    this.store.leaveApplications.patch(id, { status: 'Settled' });
    this.store.log(
      'Leave settled',
      'Leave',
      id,
      `${app.employeeId} ${app.days} day(s) posted against the balance`,
    );
  }

  pendingForApprover(): LeaveApplication[] {
    return this.store.leaveApplications
      .where((l) => l.status === 'Applied')
      .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  }

  historyFor(emp: Employee): LeaveApplication[] {
    return this.store.leaveApplications
      .where((l) => l.employeeId === emp.id)
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  }

  // --- year end / earned leave pay off ------------------------------------

  /**
   * ERN-7 / LVE-2 / LVE-3: at year end, up to 15 earned leave days are carried
   * forward, the excess may be paid out. ERN-8: the pay-off is logged.
   */
  payoffEarnedLeave(emp: Employee, year: number, days: number, amount: number, remark: string) {
    const payoff = {
      id: uid('ep'),
      employeeId: emp.id,
      year,
      days,
      amount,
      at: new Date().toISOString(),
      by: this.store.currentUser()?.name ?? 'system',
      remark,
    };
    this.store.elPayoffs.upsert(payoff);
    this.store.log(
      'Earned leave pay-off',
      'Earned leave',
      payoff.id,
      `${emp.id} ${days} day(s) for ${year}${remark ? ' — ' + remark : ''}`,
    );
    this.notify.payOff(emp, days, year);
    return payoff;
  }

  /** Employees whose earned leave exceeds the 15-day carry-forward limit. */
  carryForwardCandidates(year: number): {
    employee: Employee;
    workDays: number;
    earned: number;
    taken: number;
    carryable: number;
    excess: number;
    eligible: boolean;
  }[] {
    return this.store.employees
      .where((e) => e.active)
      .map((e) => {
        const projection = this.earnedLeaveProjection(e, year);
        const taken = this.takenByCode(e, year, 'EL');
        const carryable = Math.min(15, Math.max(0, projection.earned - taken));
        return {
          employee: e,
          workDays: projection.workDays,
          earned: projection.earned,
          taken,
          carryable,
          excess: Math.max(0, projection.earned - taken - 15),
          eligible: projection.available,
        };
      })
      .filter((r) => r.excess > 0)
      .sort((a, b) => b.excess - a.excess);
  }
}
