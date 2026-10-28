import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, EmptyComponent, IconComponent } from '../../shared/ui';
import { spanMinutes, fmtDurText, toMin } from '../../core/calc';

@Component({
  selector: 'app-shift-policy',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, EmptyComponent, IconComponent],
  template: `
    <app-page-header
      title="Shift policies"
      crumb="Setup / Shift"
      subtitle="Shift start, end, break and exempt time. A shift that ends before it starts is a night shift (SHP-3)."
    >
      <span actions>
        <button class="btn btn-primary btn-sm" (click)="openNew()">
          <app-icon name="plus" [size]="14" /> New shift policy
        </button>
      </span>
    </app-page-header>

    <div class="grid grid-3">
      @for (s of store.shiftPolicies.all(); track s.id) {
        <div class="card shift-card" [class.off]="!s.active">
          <div class="card-head">
            <div>
              <h3>{{ s.name }}</h3>
              <div class="small muted">{{ s.shiftType }} shift</div>
            </div>
            <app-chip [kind]="s.active ? 'ok' : ''">{{ s.active ? 'Active' : 'Inactive' }}</app-chip>
          </div>
          <div class="card-pad">
            <div class="time-row">
              <div class="time-box">
                <span class="t-label">Start</span>
                <span class="t-value">{{ s.startTime }}</span>
              </div>
              <div class="arrow">→</div>
              <div class="time-box">
                <span class="t-label">End</span>
                <span class="t-value">{{ s.endTime }}</span>
              </div>
            </div>
            <div class="divider"></div>
            <div class="fact">
              <span>Length</span><b>{{ length(s) }}</b>
            </div>
            <div class="fact">
              <span>Break</span><b>{{ s.breakMinutes }} min</b>
            </div>
            <div class="fact">
              <span>Exempt time</span><b>{{ s.exemptMinutes }} min</b>
            </div>
            <div class="fact">
              <span>Grace ends at</span><b>{{ grace(s) }}</b>
            </div>
            @if (isNight(s)) {
              <div class="night-flag">Night shift — ends on the following day (SHP-3)</div>
            }
            <div class="row gap-8 mt-12">
              <button class="btn btn-sm" (click)="openEdit(s)">Edit</button>
              <button class="btn btn-sm btn-danger" (click)="remove(s)">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>

    @if (editing()) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ form.id ? 'Edit' : 'New' }} shift policy</h3>
            <button class="btn btn-icon btn-ghost" (click)="close()">✕</button>
          </div>
          <div class="modal-body">
            <div class="grid grid-2">
              <div class="field span2">
                <label class="label req">Shift name</label>
                <input type="text" [value]="form.name" (input)="form.name = $any($event.target).value"
                  placeholder="General Shift (8:00 - 16:00)" />
              </div>
              <div class="field">
                <label class="label req">Start time</label>
                <input type="time" [value]="form.startTime" (input)="form.startTime = $any($event.target).value" />
              </div>
              <div class="field">
                <label class="label req">End time</label>
                <input type="time" [value]="form.endTime" (input)="form.endTime = $any($event.target).value" />
                @if (form.startTime && form.endTime && form.endTime <= form.startTime) {
                  <span class="hint">Ends on the next day — treated as a night shift (SHP-3).</span>
                }
              </div>
              <div class="field">
                <label class="label">Break time (minutes)</label>
                <input type="number" min="0" [value]="form.breakMinutes"
                  (input)="form.breakMinutes = +$any($event.target).value" />
              </div>
              <div class="field">
                <label class="label">Exempt time (minutes)</label>
                <input type="number" min="0" [value]="form.exemptMinutes"
                  (input)="form.exemptMinutes = +$any($event.target).value" />
                <span class="hint">Grace period after shift start — late check-in allowed (for example 10 min).</span>
              </div>
              <div class="field">
                <label class="label">Shift type</label>
                <input type="text" [value]="form.shiftType" (input)="form.shiftType = $any($event.target).value"
                  placeholder="Day / Night / Ramadan" />
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
      .shift-card.off {
        opacity: 0.65;
      }
      .time-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .time-box {
        flex: 1;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 8px 10px;
      }
      .t-label {
        display: block;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--muted);
        font-weight: 700;
      }
      .t-value {
        font-size: 19px;
        font-weight: 680;
      }
      .arrow {
        color: var(--muted);
      }
      .fact {
        display: flex;
        justify-content: space-between;
        font-size: 12.5px;
        padding: 3px 0;
        color: var(--text-2);
      }
      .fact b {
        color: var(--text);
      }
      .night-flag {
        margin-top: 9px;
        padding: 6px 9px;
        border-radius: 6px;
        background: var(--violet-soft);
        color: var(--violet);
        font-size: 11.5px;
        font-weight: 600;
      }
      .span2 {
        grid-column: span 2;
      }
    `,
  ],
})
export class ShiftPolicyComponent {
  readonly store = inject(Store);
  private readonly toast = inject(ToastService);

  readonly editing = signal<any | null>(null);
  form: any = {};

  length(s: any): string {
    return fmtDurText(spanMinutes(s.startTime, s.endTime));
  }
  grace(s: any): string {
    const m = (toMin(s.startTime) + (s.exemptMinutes || 0)) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  isNight(s: any): boolean {
    return s.endTime <= s.startTime;
  }

  openNew(): void {
    this.form = {
      id: '',
      name: '',
      startTime: '08:00',
      endTime: '16:00',
      breakMinutes: 60,
      exemptMinutes: 10,
      shiftType: 'Day',
      active: true,
    };
    this.editing.set(this.form);
  }

  openEdit(s: any): void {
    this.form = { ...s };
    this.editing.set(s);
  }

  close(): void {
    this.editing.set(null);
  }

  save(): void {
    if (!this.form.name?.trim()) {
      this.toast.show('Shift name is required.', 'error');
      return;
    }
    if (!this.form.startTime || !this.form.endTime) {
      this.toast.show('Start and end time are required.', 'error');
      return;
    }
    const record = { ...this.form, id: this.form.id || `sh-${Date.now().toString(36)}` };
    this.store.shiftPolicies.upsert(record);
    this.store.log(
      this.form.id ? 'Shift policy update' : 'Shift policy create',
      'Shift policy',
      record.id,
      `${record.name} ${record.startTime}–${record.endTime}`,
    );
    this.toast.show('Shift policy saved.', 'ok');
    this.editing.set(null);
  }

  remove(s: any): void {
    const used = this.store.dutyRosters.where((r) => r.shiftPolicyId === s.id).length;
    if (used) {
      this.toast.show(`${used} duty roster(s) still use this shift policy.`, 'warn');
      return;
    }
    if (!confirm(`Delete shift policy “${s.name}”?`)) return;
    this.store.shiftPolicies.remove(s.id);
    this.store.log('Shift policy delete', 'Shift policy', s.id, s.name);
    this.toast.show('Shift policy deleted.', 'ok');
  }
}
