import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent } from '../../shared/ui';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent],
  template: `
    <app-page-header
      title="Audit trail"
      crumb="Reports"
      subtitle="NFR-2 / NFR-9 — manual punches, calendar changes, separations, earned leave pay-offs, payroll edits and report runs are logged with the user and time."
    />

    <div class="filter-bar">
      <div class="field">
        <label class="label">Action</label>
        <select [value]="action()" (change)="action.set($any($event.target).value)">
          <option value="">All</option>
          @for (a of actions(); track a) {
            <option [value]="a">{{ a }}</option>
          }
        </select>
      </div>
      <div class="field" style="min-width: 200px">
        <label class="label">Search</label>
        <input type="search" placeholder="User, entity or detail" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>
      <div class="field" style="min-width: 120px">
        <label class="label">&nbsp;</label>
        <button class="btn btn-sm" (click)="store.reset(); toast.show('Demo data restored.', 'ok')">
          <app-icon name="refresh" [size]="14" /> Reset data
        </button>
      </div>
    </div>

    <div class="card mt-12">
      <div class="card-head">
        <h3>{{ rows().length }} entry(s)</h3>
        <span class="chip">Time zone: {{ store.db().timeZone }}</span>
      </div>
      <div class="table-wrap" style="max-height: calc(100vh - 330px)">
        <table class="data compact">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Reference</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            @if (!rows().length) {
              <tr>
                <td colspan="6">
                  <app-empty
                    text="No audit entry yet"
                    hint="Record a manual punch, change the calendar or save an employee to see entries here."
                  />
                </td>
              </tr>
            } @else {
              @for (a of rows(); track a.id) {
                <tr>
                  <td class="nowrap small mono">{{ a.at.slice(0, 19).replace('T', ' ') }}</td>
                  <td class="nowrap">{{ a.user }}</td>
                  <td class="nowrap"><app-chip>{{ a.action }}</app-chip></td>
                  <td class="nowrap small">{{ a.entity }}</td>
                  <td class="nowrap small mono">{{ a.entityId }}</td>
                  <td class="small">{{ a.detail }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AuditLogComponent {
  readonly store = inject(Store);
  readonly toast = inject(ToastService);

  readonly action = signal('');
  readonly q = signal('');

  readonly actions = computed(() =>
    Array.from(new Set(this.store.audit.all().map((a) => a.action))).sort(),
  );

  readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.store.audit
      .all()
      .filter((a) => {
        if (this.action() && a.action !== this.action()) return false;
        if (q) {
          const hay = `${a.user} ${a.action} ${a.entity} ${a.entityId} ${a.detail}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice(0, 300);
  });
}
