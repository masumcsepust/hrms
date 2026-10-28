import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { LeaveService } from '../../core/leave.service';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent } from '../../shared/ui';
import { TableColumn, ReportViewComponent } from '../../shared/table';
import { HIGHLIGHT } from '../../core/export.service';
import { fmtDurText, todayIso, yearOf } from '../../core/calc';

@Component({
  selector: 'app-leave-balance',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent, ReportViewComponent],
  template: `
    <app-page-header
      title="Leave balances & year-end processing"
      crumb="Leave"
      subtitle="LVE-1 to LVE-4 and ERN-3 to ERN-8 — entitlement, usage, carry forward and earned leave pay-off."
    >
      <span actions>
        <select class="yr" [value]="year()" (change)="year.set(+$any($event.target).value)">
          @for (y of years(); track y) {
            <option [value]="y">{{ y }}</option>
          }
        </select>
      </span>
    </app-page-header>

    <div class="grid grid-4 mt-12">
      <div class="kpi">
        <span class="label">Employees with a leave entitlement</span>
        <span class="value">{{ balanceRows().length }}</span>
        <span class="foot">Active employees only</span>
      </div>
      <div class="kpi">
        <span class="label">Sick leave days available</span>
        <span class="value">{{ totalByType('Sick') }}</span>
        <span class="foot">14 days / year, no carry forward (LVE-3)</span>
      </div>
      <div class="kpi">
        <span class="label">Casual leave days available</span>
        <span class="value">{{ totalByType('Casual') }}</span>
        <span class="foot">10 days / year, no carry forward (LVE-3)</span>
      </div>
      <div class="kpi">
        <span class="label">Earned leave to carry forward</span>
        <span class="value" style="color: #2d5aa0">{{ carryTotal() }}</span>
        <span class="foot">Up to 15 days per employee (ERN-7)</span>
      </div>
    </div>

    <app-report-view
      class="mt-16"
      title="Leave balance register"
      [subtitle]="'Entitlement, usage and closing balance for ' + year()"
      [columns]="columns()"
      [rows]="balanceRows()"
      [summary]="summaryStrip()"
      fileName="leave-balances"
      tableTitle="Balance by employee and leave type"
      maxHeight="52vh"
    />

    <div class="card mt-16">
      <div class="card-head">
        <div>
          <h3>Year-end earned leave processing</h3>
          <div class="small muted">
            ERN-7 — up to 15 earned leave days are carried forward; the excess may be paid out. ERN-8 — a
            pay-off is deducted from the balance and written to the audit trail.
          </div>
        </div>
        <span class="chip warn">{{ candidates().length }} candidate(s)</span>
      </div>
      <div class="table-wrap" style="max-height: 380px">
        <table class="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Work group</th>
              <th>Work days</th>
              <th>EL earned</th>
              <th>EL taken</th>
              <th>Carry forward (max 15)</th>
              <th>Excess for pay-off</th>
              <th>Eligible</th>
              <th class="right">Action</th>
            </tr>
          </thead>
          <tbody>
            @if (!candidates().length) {
              <tr>
                <td colspan="9">
                  <app-empty text="No employee exceeds the 15 day carry-forward limit" />
                </td>
              </tr>
            } @else {
              @for (c of candidates(); track c.employee.id) {
                <tr>
                  <td class="nowrap">
                    <span class="mono">{{ c.employee.id }}</span>
                    <div class="small muted">{{ c.employee.fullName }}</div>
                  </td>
                  <td class="nowrap">{{ wgName(c.employee.workGroupId) }}</td>
                  <td class="nowrap">{{ c.workDays }}</td>
                  <td class="nowrap">{{ c.earned }}</td>
                  <td class="nowrap">{{ c.taken }}</td>
                  <td class="nowrap">{{ c.carryable }}</td>
                  <td class="nowrap">
                    <span class="chip warn">{{ c.excess }}</span>
                  </td>
                  <td>
                    <app-chip [kind]="c.eligible ? 'ok' : ''">{{ c.eligible ? 'Yes' : '1 year not completed' }}</app-chip>
                  </td>
                  <td class="right">
                    <button class="btn btn-sm btn-primary" (click)="openPayoff(c)">Pay off</button>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (payoff(); as p) {
      <div class="modal-backdrop" (click)="closePayoff()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>Earned leave pay-off — {{ p.employee.id }}</h3>
            <button class="btn btn-icon btn-ghost" (click)="closePayoff()">✕</button>
          </div>
          <div class="modal-body">
            <div class="row-between small mb-12">
              <span class="muted">Employee</span><b>{{ p.employee.fullName }}</b>
            </div>
            <div class="row-between small mb-12">
              <span class="muted">Excess beyond the carry-forward limit</span><b>{{ p.excess }} day(s)</b>
            </div>
            <div class="grid grid-2 mt-12">
              <div class="field">
                <label class="label req">Days paid off</label>
                <input type="number" min="1" [value]="payDays()" (input)="payDays.set(+$any($event.target).value)" />
              </div>
              <div class="field">
                <label class="label">Amount</label>
                <input type="number" min="0" [value]="payAmount()" (input)="payAmount.set(+$any($event.target).value)" />
              </div>
            </div>
            <div class="field mt-12">
              <label class="label">Remark</label>
              <textarea [value]="payRemark()" (input)="payRemark.set($any($event.target).value)"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="closePayoff()">Cancel</button>
            <button class="btn btn-primary" (click)="confirmPayoff()">Confirm pay-off</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      app-report-view {
        display: block;
      }
      .yr {
        height: 34px;
        width: 110px;
      }
    `,
  ],
})
export class LeaveBalanceComponent {
  readonly store = inject(Store);
  private readonly leave = inject(LeaveService);
  private readonly toast = inject(ToastService);

  readonly year = signal(yearOf(todayIso()));
  readonly payoff = signal<any | null>(null);
  readonly payDays = signal(0);
  readonly payAmount = signal(0);
  readonly payRemark = signal('');

  readonly years = computed(() => {
    const y = yearOf(todayIso());
    return [y, y - 1, y - 2];
  });

  readonly balanceRows = computed(() => {
    const out: any[] = [];
    for (const e of this.store.activeEmployees()) {
      for (const b of this.leave.balance(e, this.year())) {
        out.push({
          id: `${e.id}-${b.leaveTypeId}`,
          emp: e,
          b,
        });
      }
    }
    return out;
  });

  readonly columns = computed<TableColumn<any>[]>(() => [
    { key: 'id', header: 'Employee ID', value: (r) => r.emp.id, width: '96px' },
    { key: 'name', header: 'Name', value: (r) => r.emp.fullName },
    {
      key: 'wg',
      header: 'Work group',
      value: (r) => this.store.workGroups.byId(r.emp.workGroupId)?.name ?? '',
    },
    { key: 'type', header: 'Leave type', value: (r) => r.b.name },
    {
      key: 'ent',
      header: 'Entitlement',
      value: (r) => r.b.entitlement,
      align: 'right',
    },
    {
      key: 'carry',
      header: 'Carried forward',
      value: (r) => r.b.carriedForward,
      align: 'right',
    },
    { key: 'used', header: 'Used', value: (r) => r.b.used, align: 'right' },
    { key: 'paid', header: 'Paid off', value: (r) => r.b.paid, align: 'right' },
    {
      key: 'bal',
      header: 'Balance',
      value: (r) => r.b.balance,
      align: 'right',
      bold: true,
      highlight: (r) => (r.b.balance <= 0 ? HIGHLIGHT.absent : null),
    },
    {
      key: 'status',
      header: 'Applicable',
      value: (r) => (r.b.balance > 0 ? 'Yes' : 'No — LWP or CNL'),
      highlight: (r) => (r.b.balance <= 0 ? HIGHLIGHT.delay : null),
    },
  ]);

  readonly summaryStrip = computed(() => [
    { label: 'Rows', value: this.balanceRows().length },
    { label: 'Sick available', value: this.totalByType('Sick') },
    { label: 'Casual available', value: this.totalByType('Casual') },
    { label: 'Earned carry forward', value: this.carryTotal() },
  ]);

  totalByType(name: string): number {
    return this.balanceRows()
      .filter((r) => r.b.name === name)
      .reduce((s, r) => s + Math.max(0, r.b.balance), 0);
  }

  carryTotal(): number {
    return this.balanceRows()
      .filter((r) => r.b.name === 'Earned')
      .reduce((s, r) => s + Math.min(15, Math.max(0, r.b.balance)), 0);
  }

  wgName(id: string): string {
    return this.store.workGroups.byId(id)?.name ?? '—';
  }

  readonly candidates = computed(() => this.leave.carryForwardCandidates(this.year()));

  openPayoff(c: any): void {
    this.payoff.set(c);
    this.payDays.set(c.excess);
    this.payAmount.set(c.excess * 5000);
    this.payRemark.set(`Earned leave pay-off for ${this.year()}`);
  }

  closePayoff(): void {
    this.payoff.set(null);
  }

  confirmPayoff(): void {
    const p = this.payoff();
    if (!p) return;
    if (this.payDays() <= 0) {
      this.toast.show('Enter the number of days to pay off.', 'error');
      return;
    }
    this.leave.payoffEarnedLeave(
      p.employee,
      this.year(),
      this.payDays(),
      this.payAmount(),
      this.payRemark(),
    );
    this.toast.show(`Earned leave pay-off recorded for ${p.employee.id}.`, 'ok');
    this.closePayoff();
  }
}
