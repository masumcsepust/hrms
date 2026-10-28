import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { AuthService } from '../../core/auth';
import { LeaveService } from '../../core/leave.service';
import { PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent } from '../../shared/ui';
import { todayIso, yearOf } from '../../core/calc';

@Component({
  selector: 'app-my-leave',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent],
  template: `
    <app-page-header title="My leave" crumb="Self service" subtitle="ESS-4 — leave summary and leave history.">
      <span actions>
        <a class="btn btn-primary btn-sm" routerLink="/leave/apply">
          <app-icon name="plus" [size]="14" /> Apply for leave
        </a>
      </span>
    </app-page-header>

    @if (emp(); as e) {
      <div class="grid grid-4">
        @for (b of balances(); track b.leaveTypeId) {
          <div class="kpi">
            <span class="label">{{ b.name }}</span>
            <span class="value" [style.color]="b.balance > 0 ? '#17202f' : '#b7791f'">{{ b.balance }}</span>
            <span class="foot">
              entitlement {{ b.entitlement }} · used {{ b.used }}
              @if (b.carriedForward) {
                · carried {{ b.carriedForward }}
              }
            </span>
          </div>
        }
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <h3>Leave history</h3>
          <span class="chip">{{ apps().length }} application(s)</span>
        </div>
        <div class="table-wrap" style="max-height: calc(100vh - 400px)">
          <table class="data">
            <thead>
              <tr>
                <th>Leave type</th>
                <th>Period</th>
                <th>Days</th>
                <th>Sandwich</th>
                <th>Applied on</th>
                <th>Remark</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @if (!apps().length) {
                <tr><td colspan="7"><app-empty text="No leave application yet" /></td></tr>
              } @else {
                @for (a of apps(); track a.id) {
                  <tr>
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
                    <td class="nowrap small">{{ a.appliedAt.slice(0, 10) }}</td>
                    <td class="small">{{ a.reason || '—' }}</td>
                    <td class="nowrap">
                      <app-chip [kind]="kind(a.status)">{{ a.status }}</app-chip>
                      @if (a.decisionRemark) {
                        <div class="small muted">{{ a.decisionRemark }}</div>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card card-pad mt-12">
        <h3 class="mb-12">How the balance works</h3>
        <div class="grid grid-2 small muted">
          <div>
            <b style="color: var(--text)">LVE-1 / LVE-2</b> — every leave type has its own limit and the new
            year's entitlement is added at year end.
          </div>
          <div>
            <b style="color: var(--text)">LVE-3</b> — sick and casual are not carried forward; earned leave
            carries forward up to 15 days.
          </div>
          <div>
            <b style="color: var(--text)">LVE-4</b> — a mid-year joiner gets a proportional balance:
            (total ÷ 12) × remaining months.
          </div>
          <div>
            <b style="color: var(--text)">LVE-8</b> — a weekend between leave days counts as leave for the
            Worker group and is excluded for the Officer group.
          </div>
        </div>
      </div>
    } @else {
      <div class="card card-pad">
        <app-empty
          text="This login is not linked to an employee record"
          hint="Switch to a user linked with an employee from the header."
        />
      </div>
    }
  `,
})
export class MyLeaveComponent {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly leave = inject(LeaveService);

  readonly emp = computed(() => this.auth.linkedEmployee());
  readonly year = yearOf(todayIso());

  readonly balances = computed(() => {
    const e = this.emp();
    return e ? this.leave.balance(e, this.year) : [];
  });

  readonly apps = computed(() => {
    const e = this.emp();
    return e ? this.leave.historyFor(e) : [];
  });

  typeName(id: string): string {
    return this.store.leaveTypes.byId(id)?.name ?? '—';
  }

  kind(s: string): any {
    return s === 'Approved' || s === 'Settled' ? 'ok' : s === 'Rejected' ? 'danger' : 'warn';
  }
}
