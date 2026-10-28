import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { LeaveService } from '../../core/leave.service';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent } from '../../shared/ui';
import { yearOf } from '../../core/calc';

@Component({
  selector: 'app-leave-approvals',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent],
  template: `
    <app-page-header
      title="Leave approvals"
      crumb="Leave"
      subtitle="ESS-2 — approve or reject an application. Approved leave is settled against the balance and history."
    />

    <div class="filter-bar">
      <div class="field">
        <label class="label">Status</label>
        <select [value]="status()" (change)="status.set($any($event.target).value)">
          <option value="Applied">Pending decision</option>
          <option value="Approved">Approved, not settled</option>
          <option value="Settled">Settled</option>
          <option value="Rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Work group</label>
        <select [value]="wg()" (change)="wg.set($any($event.target).value)">
          <option value="">All</option>
          @for (w of store.workGroups.all(); track w.id) {
            <option [value]="w.id">{{ w.name }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label class="label">Leave type</label>
        <select [value]="typeId()" (change)="typeId.set($any($event.target).value)">
          <option value="">All</option>
          @for (t of store.leaveTypes.all(); track t.id) {
            <option [value]="t.id">{{ t.name }}</option>
          }
        </select>
      </div>
      <div class="field" style="min-width: 190px">
        <label class="label">Search</label>
        <input type="search" placeholder="ID or name" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>
    </div>

    <div class="card mt-12">
      <div class="card-head">
        <h3>{{ rows().length }} application(s)</h3>
        <span class="chip warn">{{ pending() }} pending</span>
      </div>
      <div class="table-wrap" style="max-height: calc(100vh - 330px)">
        <table class="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Period</th>
              <th>Days</th>
              <th>Sandwich</th>
              <th>Balance</th>
              <th>Reason</th>
              <th>Status</th>
              <th class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (!rows().length) {
              <tr><td colspan="9"><app-empty text="No application matches the filters" /></td></tr>
            } @else {
              @for (a of rows(); track a.id) {
                <tr>
                  <td class="nowrap">
                    <span class="mono">{{ empName(a.employeeId) }}</span>
                    <div class="small muted">{{ empName(a.employeeId, true) }}</div>
                  </td>
                  <td class="nowrap">
                    {{ typeName(a.leaveTypeId) }}
                    @if (a.isLwp) {
                      <app-chip kind="warn">LWP</app-chip>
                    }
                    @if (a.isCnl) {
                      <app-chip kind="warn">CNL</app-chip>
                    }
                  </td>
                  <td class="nowrap small">{{ a.fromDate }} → {{ a.toDate }}</td>
                  <td class="nowrap">{{ a.days }}</td>
                  <td class="nowrap">{{ a.sandwichDays || '—' }}</td>
                  <td class="nowrap small">{{ balanceOf(a) }}</td>
                  <td class="small">{{ a.reason || '—' }}</td>
                  <td class="nowrap">
                    <app-chip [kind]="statusKind(a.status)">{{ a.status }}</app-chip>
                    @if (a.attachmentName) {
                      <div class="small muted nowrap">📎 {{ a.attachmentName }}</div>
                    }
                  </td>
                  <td class="right nowrap">
                    @if (a.status === 'Applied') {
                      <button class="btn btn-sm btn-ok" (click)="open(a, true)">Approve</button>
                      <button class="btn btn-sm btn-danger" (click)="open(a, false)">Reject</button>
                    } @else if (a.status === 'Approved') {
                      <button class="btn btn-sm btn-accent" (click)="settle(a)">Settle</button>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (decision(); as d) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ d.approve ? 'Approve' : 'Reject' }} leave — {{ empName(d.app.employeeId) }}</h3>
            <button class="btn btn-icon btn-ghost" (click)="close()">✕</button>
          </div>
          <div class="modal-body">
            <div class="row-between small mb-12">
              <span class="muted">{{ typeName(d.app.leaveTypeId) }}</span>
              <b>{{ d.app.fromDate }} → {{ d.app.toDate }} ({{ d.app.days }} days)</b>
            </div>
            <div class="field">
              <label class="label req">Decision remark</label>
              <textarea [value]="remark()" (input)="remark.set($any($event.target).value)"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="close()">Cancel</button>
            <button class="btn" [class.btn-ok]="d.approve" [class.btn-danger]="!d.approve" (click)="decide()">
              {{ d.approve ? 'Approve' : 'Reject' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LeaveApprovalsComponent {
  readonly store = inject(Store);
  private readonly leave = inject(LeaveService);
  private readonly toast = inject(ToastService);

  readonly status = signal('Applied');
  readonly wg = signal('');
  readonly typeId = signal('');
  readonly q = signal('');
  readonly decision = signal<{ app: any; approve: boolean } | null>(null);
  readonly remark = signal('');

  readonly pending = computed(() =>
    this.store.leaveApplications.where((a) => a.status === 'Applied').length,
  );

  readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.store.leaveApplications
      .all()
      .filter((a) => {
        if (this.status() && a.status !== this.status()) return false;
        if (this.typeId() && a.leaveTypeId !== this.typeId()) return false;
        const emp = this.store.employees.byId(a.employeeId);
        if (this.wg() && emp?.workGroupId !== this.wg()) return false;
        if (q) {
          const name = emp?.fullName ?? '';
          if (!`${a.employeeId} ${name}`.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  });

  empName(id: string, full = false): string {
    const e = this.store.employees.byId(id);
    if (!e) return '—';
    return full ? e.fullName : e.id;
  }

  typeName(id: string): string {
    return this.store.leaveTypes.byId(id)?.name ?? '—';
  }

  statusKind(s: string): any {
    return s === 'Approved' || s === 'Settled' ? 'ok' : s === 'Rejected' ? 'danger' : 'warn';
  }

  balanceOf(a: any): string {
    const e = this.store.employees.byId(a.employeeId);
    if (!e) return '—';
    const b = this.leave.balance(e, yearOf(a.fromDate)).find((r) => r.leaveTypeId === a.leaveTypeId);
    return b ? `${b.balance} day(s)` : '—';
  }

  open(app: any, approve: boolean): void {
    this.remark.set('');
    this.decision.set({ app, approve });
  }

  close(): void {
    this.decision.set(null);
  }

  decide(): void {
    const d = this.decision();
    if (!d) return;
    if (!this.remark().trim()) {
      this.toast.show('A decision remark is required.', 'error');
      return;
    }
    this.leave.decide(d.app.id, d.approve, this.remark().trim(), this.store.currentUser()?.name ?? '');
    this.toast.show(d.approve ? 'Leave approved.' : 'Leave rejected.', 'ok');
    this.close();
  }

  settle(app: any): void {
    this.leave.settle(app.id);
    this.toast.show('Leave settled against the balance.', 'ok');
  }
}
