import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, EmptyComponent, IconComponent } from '../../shared/ui';
import { WEEKDAY_LABELS } from '../../core/calc';

@Component({
  selector: 'app-duty-roster',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, EmptyComponent, IconComponent],
  template: `
    <app-page-header
      title="Duty roster"
      crumb="Setup / Roster"
      subtitle="Assign a shift policy to a work group or to an individual employee. An individual assignment wins over the group roster (ROS-4)."
    >
      <span actions>
        <button class="btn btn-primary btn-sm" (click)="openNew()">
          <app-icon name="plus" [size]="14" /> New roster
        </button>
      </span>
    </app-page-header>

    <div class="card">
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Applies to</th>
              <th>Shift policy</th>
              <th>Period</th>
              <th>Working days</th>
              <th>Status</th>
              <th class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (!store.dutyRosters.all().length) {
              <tr>
                <td colspan="7"><app-empty text="No duty roster configured" /></td>
              </tr>
            } @else {
              @for (r of store.dutyRosters.all(); track r.id) {
                <tr>
                  <td class="mono nowrap">{{ r.code || r.id }}</td>
                  <td class="nowrap">
                    @if (r.employeeId) {
                      <app-chip kind="violet">Individual — {{ empName(r.employeeId) }}</app-chip>
                    } @else {
                      <app-chip kind="brand">{{ wgName(r.workGroupId) }}</app-chip>
                    }
                  </td>
                  <td class="nowrap">{{ shiftName(r.shiftPolicyId) }}</td>
                  <td class="nowrap small">{{ r.startDate }} → {{ r.endDate }}</td>
                  <td class="nowrap">
                    <span class="days">
                      @for (d of r.weekDays; track d) {
                        <span class="day">{{ WEEKDAY_LABELS[d] }}</span>
                      }
                    </span>
                  </td>
                  <td><app-chip [kind]="r.active ? 'ok' : ''">{{ r.active ? 'Active' : 'Inactive' }}</app-chip></td>
                  <td class="right nowrap">
                    <button class="btn btn-sm" (click)="openEdit(r)">Edit</button>
                    <button class="btn btn-sm btn-danger" (click)="remove(r)">Delete</button>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (editing()) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ form.id ? 'Edit' : 'New' }} duty roster</h3>
            <button class="btn btn-icon btn-ghost" (click)="close()">✕</button>
          </div>
          <div class="modal-body">
            <div class="grid grid-2">
              <div class="field">
                <label class="label">Roster code</label>
                <input type="text" [value]="form.code" (input)="form.code = $any($event.target).value" placeholder="optional" />
              </div>
              <div class="field">
                <label class="label">Shift policy</label>
                <select [value]="form.shiftPolicyId" (change)="form.shiftPolicyId = $any($event.target).value">
                  <option value="">— select —</option>
                  @for (s of store.shiftPolicies.all(); track s.id) {
                    <option [value]="s.id">{{ s.name }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label class="label">Start date</label>
                <input type="date" [value]="form.startDate" (input)="form.startDate = $any($event.target).value" />
              </div>
              <div class="field">
                <label class="label">End date</label>
                <input type="date" [value]="form.endDate" (input)="form.endDate = $any($event.target).value" />
              </div>
              <div class="field">
                <label class="label">Work group</label>
                <select [value]="form.workGroupId" (change)="form.workGroupId = $any($event.target).value">
                  <option value="">— none —</option>
                  @for (w of store.workGroups.all(); track w.id) {
                    <option [value]="w.id">{{ w.name }}</option>
                  }
                </select>
                <span class="hint">ROS-2 — a work group is assigned a shift for a week, month or year.</span>
              </div>
              <div class="field">
                <label class="label">Employee (individual assignment)</label>
                <select [value]="form.employeeId" (change)="form.employeeId = $any($event.target).value">
                  <option value="">— none —</option>
                  @for (e of store.employees.all(); track e.id) {
                    <option [value]="e.id">{{ e.id }} — {{ e.fullName }}</option>
                  }
                </select>
                <span class="hint">ROS-4 — takes precedence over the work group roster.</span>
              </div>
              <div class="field span2">
                <label class="label">Working days</label>
                <div class="week">
                  @for (d of weekDays; track d.i) {
                    <label class="check day-check">
                      <input type="checkbox" [checked]="form.weekDays.includes(d.i)"
                        (change)="toggleDay(d.i)" />
                      {{ d.name }}
                    </label>
                  }
                </div>
                <span class="hint">ROS-1 — the standard working week is Saturday to Thursday, so Friday is the weekly holiday.</span>
              </div>
              <div class="field">
                <label class="label">Status</label>
                <label class="check" style="height: 34px">
                  <input type="checkbox" [checked]="form.active" (change)="form.active = $any($event.target).checked" />
                  Active
                </label>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="close()">Cancel</button>
            <button class="btn btn-primary" (click)="save()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .days {
        display: inline-flex;
        gap: 3px;
        flex-wrap: wrap;
      }
      .day {
        background: var(--brand-soft);
        color: var(--brand);
        border-radius: 4px;
        padding: 1px 5px;
        font-size: 10.5px;
        font-weight: 650;
      }
      .week {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        padding: 6px 0;
      }
      .day-check {
        font-weight: 600;
      }
      .span2 {
        grid-column: span 2;
      }
    `,
  ],
})
export class DutyRosterComponent {
  readonly store = inject(Store);
  private readonly toast = inject(ToastService);

  readonly WEEKDAY_LABELS = WEEKDAY_LABELS;
  readonly weekDays = WEEKDAY_LABELS.map((name, i) => ({ i, name }));

  readonly editing = signal<any | null>(null);
  form: any = {};

  wgName(id: string | null): string {
    return this.store.workGroups.byId(id ?? undefined)?.name ?? '—';
  }
  empName(id: string | null): string {
    return this.store.employees.byId(id ?? undefined)?.fullName ?? '—';
  }
  shiftName(id: string): string {
    return this.store.shiftPolicies.byId(id)?.name ?? '—';
  }

  openNew(): void {
    this.form = {
      id: '',
      code: '',
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: `${new Date().getFullYear()}-12-31`,
      workGroupId: null,
      employeeId: null,
      shiftPolicyId: '',
      weekDays: [6, 0, 1, 2, 3, 4],
      active: true,
    };
    this.editing.set(this.form);
  }

  openEdit(r: any): void {
    this.form = { ...r, weekDays: [...r.weekDays] };
    this.editing.set(r);
  }

  close(): void {
    this.editing.set(null);
  }

  toggleDay(i: number): void {
    const idx = this.form.weekDays.indexOf(i);
    if (idx >= 0) this.form.weekDays.splice(idx, 1);
    else this.form.weekDays.push(i);
  }

  save(): void {
    if (!this.form.shiftPolicyId) {
      this.toast.show('Select a shift policy.', 'error');
      return;
    }
    if (!this.form.workGroupId && !this.form.employeeId) {
      this.toast.show('Assign the roster to a work group or an employee.', 'error');
      return;
    }
    if (!this.form.weekDays.length) {
      this.toast.show('Select at least one working day.', 'error');
      return;
    }
    if (this.form.startDate > this.form.endDate) {
      this.toast.show('Start date must be before the end date.', 'error');
      return;
    }

    // ROS-3 — only one active roster per work group for an overlapping period
    if (this.form.active && this.form.workGroupId) {
      const clash = this.store.dutyRosters.where(
        (r) =>
          r.id !== this.form.id &&
          r.active &&
          r.workGroupId === this.form.workGroupId &&
          !r.employeeId &&
          r.startDate <= this.form.endDate &&
          r.endDate >= this.form.startDate,
      );
      if (clash.length) {
        this.toast.show(
          `ROS-3 — this work group already has an active roster for the period (${clash[0].code || clash[0].id}).`,
          'error',
        );
        return;
      }
    }

    const record = { ...this.form, id: this.form.id || `ro-${Date.now().toString(36)}` };
    this.store.dutyRosters.upsert(record);
    this.store.log(
      this.form.id ? 'Duty roster update' : 'Duty roster create',
      'Duty roster',
      record.id,
      `${record.code || record.id} → ${this.shiftName(record.shiftPolicyId)}`,
    );
    this.toast.show('Duty roster saved.', 'ok');
    this.editing.set(null);
  }

  remove(r: any): void {
    if (!confirm(`Delete roster “${r.code || r.id}”?`)) return;
    this.store.dutyRosters.remove(r.id);
    this.store.log('Duty roster delete', 'Duty roster', r.id, r.code || r.id);
    this.toast.show('Duty roster deleted.', 'ok');
  }
}
