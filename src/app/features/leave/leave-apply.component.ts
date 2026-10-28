import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { AuthService } from '../../core/auth';
import { LeaveService } from '../../core/leave.service';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent } from '../../shared/ui';
import { todayIso, yearOf } from '../../core/calc';

@Component({
  selector: 'app-leave-apply',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent],
  template: `
    <app-page-header
      title="Apply for leave"
      crumb="Leave"
      subtitle="ESS-2 — apply, then the approver decides. Sick leave needs a supporting document (LVE-7)."
    />

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start">
      <div class="card">
        <div class="card-head"><h3>New application</h3></div>
        <div class="card-pad">
          @if (!auth.can('hr.manage')) {
            <div class="field">
              <label class="label req">Employee</label>
              <input type="text" [value]="employee()?.fullName ?? '—'" disabled />
            </div>
          } @else {
            <div class="field">
              <label class="label req">Employee</label>
              <select [value]="employeeId()" (change)="employeeId.set($any($event.target).value)">
                <option value="">— select employee —</option>
                @for (e of store.employees.all(); track e.id) {
                  <option [value]="e.id">{{ e.id }} — {{ e.fullName }}</option>
                }
              </select>
            </div>
          }

          <div class="field mt-12">
            <label class="label req">Leave type</label>
            <select [value]="leaveTypeId()" (change)="leaveTypeId.set($any($event.target).value)">
              <option value="">— select —</option>
              @for (lt of availableTypes(); track lt.id) {
                <option [value]="lt.id">{{ lt.name }}</option>
              }
            </select>
            @if (selectedType()?.attachmentRequired) {
              <span class="hint">A supporting attachment is mandatory for this type (LVE-7).</span>
            }
          </div>

          <div class="grid grid-2 mt-12">
            <div class="field">
              <label class="label req">From</label>
              <input type="date" [value]="from()" (change)="from.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label class="label req">To</label>
              <input type="date" [value]="to()" (change)="to.set($any($event.target).value)" />
            </div>
          </div>

          <div class="field mt-12">
            <label class="label">Reason</label>
            <textarea [value]="reason()" (input)="reason.set($any($event.target).value)"
              placeholder="Reason for the leave"></textarea>
          </div>

          <div class="field mt-12">
            <label class="label">Attachment</label>
            <label class="btn btn-sm">
              <app-icon name="plus" [size]="13" /> {{ attachment() || 'Attach document' }}
              <input type="file" hidden (change)="onFile($event)" />
            </label>
            <span class="hint">Medical certificate for sick leave (LVE-7).</span>
          </div>

          <div class="field mt-12">
            <label class="label">Exception</label>
            <label class="check">
              <input type="checkbox" [checked]="isLwp()" (change)="isLwp.set($any($event.target).checked)" />
              Leave without pay (LWP)
            </label>
            <label class="check">
              <input type="checkbox" [checked]="isCnl()" (change)="isCnl.set($any($event.target).checked)" />
              Considered leave (CNL)
            </label>
            @if (isLwp() || isCnl()) {
              <label class="check mt-8">
                <input type="checkbox" [checked]="mgmtApproved()"
                  (change)="mgmtApproved.set($any($event.target).checked)" />
                Prior management approval obtained (LVE-6)
              </label>
            }
          </div>

          <button class="btn btn-primary mt-16" style="width: 100%" (click)="apply()">
            <app-icon name="check" [size]="14" /> Submit application
          </button>
        </div>
      </div>

      <div>
        <div class="card card-pad">
          <h3 class="mb-12">Leave summary — {{ balanceYear() }}</h3>
          @if (!employee()) {
            <app-empty text="Select an employee to see the leave balance" />
          } @else {
            <div class="bal-grid">
              @for (b of balances(); track b.leaveTypeId) {
                <div class="bal" [class.zero]="b.balance <= 0">
                  <span class="bal-name">{{ b.name }}</span>
                  <span class="bal-val">{{ b.balance }}<small>days</small></span>
                  <span class="bal-meta">
                    entitlement {{ b.entitlement }} · used {{ b.used }}
                    @if (b.carriedForward) {
                      · carried {{ b.carriedForward }}
                    }
                  </span>
                  @if (b.balance <= 0) {
                    <span class="bal-warn">Balance zero — apply as LWP or CNL</span>
                  }
                </div>
              }
            </div>
            <div class="divider"></div>
            <div class="row-between small">
              <span class="muted">Requested period</span>
              <b>
                @if (calcDays()) {
                  {{ calcDays()!.days }} day(s)@if (calcDays()!.sandwich) {
                    <span class="warn-text"> (includes {{ calcDays()!.sandwich }} sandwich day(s))</span>
                  }
                } @else {
                  —
                }
              </b>
            </div>
            <div class="row-between small mt-8">
              <span class="muted">Earned leave projection</span>
              <b>{{ elProjection().earned }} day(s)</b>
            </div>
            <div class="hint mt-8">
              ERN-2 — a provisional running balance on the year-end formula until the year closes.
            </div>
          }
        </div>

        <div class="card mt-12">
          <div class="card-head">
            <h3>My applications</h3>
            <span class="chip">{{ myApps().length }}</span>
          </div>
          <div class="table-wrap" style="max-height: 330px">
            <table class="data compact">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Period</th>
                  <th>Days</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @if (!myApps().length) {
                  <tr>
                    <td colspan="4"><app-empty text="No application yet" /></td>
                  </tr>
                } @else {
                  @for (a of myApps(); track a.id) {
                    <tr>
                      <td class="nowrap">{{ typeName(a.leaveTypeId) }}</td>
                      <td class="nowrap small">{{ a.fromDate }} → {{ a.toDate }}</td>
                      <td class="nowrap">{{ a.days }}</td>
                      <td>
                        <app-chip [kind]="statusKind(a.status)">{{ a.status }}</app-chip>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .bal-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .bal {
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        background: var(--surface-2);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .bal.zero {
        background: var(--warn-soft);
        border-color: #f0dcae;
      }
      .bal-name {
        font-size: 12px;
        color: var(--muted);
        font-weight: 650;
      }
      .bal-val {
        font-size: 22px;
        font-weight: 680;
      }
      .bal-val small {
        font-size: 11px;
        font-weight: 550;
        color: var(--muted);
        margin-left: 4px;
      }
      .bal-meta {
        font-size: 11px;
        color: var(--muted);
      }
      .bal-warn {
        font-size: 11px;
        color: var(--warn);
        font-weight: 600;
        margin-top: 3px;
      }
      .warn-text {
        color: var(--warn);
      }
    `,
  ],
})
export class LeaveApplyComponent {
  readonly store = inject(Store);
  readonly auth = inject(AuthService);
  private readonly leave = inject(LeaveService);
  private readonly toast = inject(ToastService);

  readonly employeeId = signal('');
  readonly leaveTypeId = signal('');
  readonly from = signal(todayIso());
  readonly to = signal(todayIso());
  readonly reason = signal('');
  readonly attachment = signal('');
  readonly isLwp = signal(false);
  readonly isCnl = signal(false);
  readonly mgmtApproved = signal(false);

  readonly employee = computed(() => {
    if (this.auth.can('hr.manage')) return this.store.employees.byId(this.employeeId());
    return this.auth.linkedEmployee();
  });

  readonly availableTypes = computed(() => {
    const e = this.employee();
    if (!e) return [];
    return this.store.leaveTypes.where((t) => t.active && e.leaveTypeIds.includes(t.id));
  });

  readonly selectedType = computed(() =>
    this.store.leaveTypes.byId(this.leaveTypeId()),
  );

  readonly balanceYear = computed(() => yearOf(this.from() || todayIso()));

  readonly balances = computed(() => {
    const e = this.employee();
    if (!e) return [];
    return this.leave.balance(e, this.balanceYear());
  });

  readonly elProjection = computed(() => {
    const e = this.employee();
    if (!e) return { earned: 0, workDays: 0, available: false };
    return this.leave.earnedLeaveProjection(e, this.balanceYear());
  });

  readonly calcDays = computed(() => {
    const e = this.employee();
    if (!e || !this.from() || !this.to() || this.from() > this.to()) return null;
    return this.leave.computeDays(e, this.from(), this.to());
  });

  readonly myApps = computed(() => {
    const e = this.employee();
    if (!e) return [];
    return this.leave.historyFor(e).slice(0, 20);
  });

  typeName(id: string): string {
    return this.store.leaveTypes.byId(id)?.name ?? '—';
  }

  statusKind(s: string): any {
    return s === 'Approved' || s === 'Settled' ? 'ok' : s === 'Rejected' ? 'danger' : 'warn';
  }

  onFile(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) this.attachment.set(f.name);
  }

  apply(): void {
    const e = this.employee();
    const lt = this.selectedType();
    if (!e) {
      this.toast.show('Select an employee.', 'error');
      return;
    }
    if (!lt) {
      this.toast.show('Select a leave type.', 'error');
      return;
    }
    if (!this.from() || !this.to() || this.from() > this.to()) {
      this.toast.show('The leave period is not valid.', 'error');
      return;
    }
    const res = this.leave.apply({
      employee: e,
      leaveType: lt,
      fromDate: this.from(),
      toDate: this.to(),
      reason: this.reason(),
      attachmentName: this.attachment() || null,
      isLwp: this.isLwp(),
      isCnl: this.isCnl(),
      managementApproved: this.mgmtApproved(),
    });
    if (!res.ok) {
      this.toast.show(res.message, 'error');
      return;
    }
    this.toast.show('Leave application submitted — the approver has been notified.', 'ok');
    this.reason.set('');
    this.attachment.set('');
    this.isLwp.set(false);
    this.isCnl.set(false);
    this.mgmtApproved.set(false);
  }
}
