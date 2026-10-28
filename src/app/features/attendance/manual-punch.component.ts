import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { AttendanceService } from '../../core/attendance.service';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent } from '../../shared/ui';
import { fmtDurText, todayIso } from '../../core/calc';

@Component({
  selector: 'app-manual-punch',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent],
  template: `
    <app-page-header
      title="Manual punch & correction"
      crumb="Attendance"
      subtitle="ATT-02 — record or correct a punch time. A remark is always mandatory and the record is highlighted in the job card (ATT-03)."
    />

    <div class="grid" style="grid-template-columns: 340px 1fr; align-items: start">
      <div class="card">
        <div class="card-head"><h3>{{ mode() === 'Manual' ? 'Record punch' : 'Correct punch' }}</h3></div>
        <div class="card-pad">
          <div class="field">
            <label class="label req">Employee</label>
            <select [value]="employeeId()" (change)="employeeId.set($any($event.target).value)">
              <option value="">— select employee —</option>
              @for (e of store.employees.all(); track e.id) {
                <option [value]="e.id">{{ e.id }} — {{ e.fullName }}</option>
              }
            </select>
          </div>

          <div class="field mt-12">
            <label class="label req">Date</label>
            <input type="date" [value]="date()" (change)="date.set($any($event.target).value)" />
          </div>

          <div class="field mt-12">
            <label class="label req">Punch time</label>
            <input type="time" [value]="time()" (change)="time.set($any($event.target).value)" />
          </div>

          <div class="field mt-12">
            <label class="label">Entry type</label>
            <div class="radio-col">
              <label class="check">
                <input type="radio" name="mode" value="Manual" [checked]="mode() === 'Manual'"
                  (change)="mode.set('Manual')" />
                Manual entry
              </label>
              <label class="check">
                <input type="radio" name="mode" value="Corrected" [checked]="mode() === 'Corrected'"
                  (change)="mode.set('Corrected')" />
                Correction of a device punch
              </label>
            </div>
          </div>

          <div class="field mt-12">
            <label class="label req">Remark</label>
            <textarea [value]="remark()" (input)="remark.set($any($event.target).value)"
              placeholder="Why is this punch being entered manually?"></textarea>
            @if (!remark().trim() && attempted()) {
              <span class="error-text">A remark is mandatory for a manual punch (ATT-02).</span>
            }
          </div>

          <button class="btn btn-primary mt-12" style="width: 100%" (click)="save()">
            <app-icon name="check" [size]="14" /> Save punch
          </button>
        </div>
      </div>

      <div>
        @if (day(); as d) {
          <div class="card">
            <div class="card-head">
              <h3>Attendance day — {{ employee()?.fullName }} ({{ date() }})</h3>
              <app-chip [kind]="d.status === 'Present' ? 'ok' : d.status === 'Absent' ? 'danger' : 'info'">
                {{ d.status }}
              </app-chip>
            </div>
            <div class="card-pad">
              <div class="grid grid-4">
                <div class="mini"><span>In time</span><b>{{ d.inTime ?? '—' }}</b></div>
                <div class="mini"><span>Out time</span><b>{{ d.outTime ?? '—' }}</b></div>
                <div class="mini"><span>Delay</span><b [class.warn]="d.delayMinutes > 0">{{ d.delayMinutes ? fmtDurText(d.delayMinutes) : '—' }}</b></div>
                <div class="mini"><span>Overtime</span><b [class.ok]="d.countedOt > 0">{{ d.countedOt ? fmtDurText(d.countedOt) : '—' }}</b></div>
              </div>
            </div>
          </div>
        }

        <div class="card mt-12">
          <div class="card-head">
            <h3>Punches of the day</h3>
            <span class="chip">{{ punches().length }} punch(es)</span>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Device</th>
                  <th>Remark</th>
                  <th class="right">Action</th>
                </tr>
              </thead>
              <tbody>
                @if (!punches().length) {
                  <tr>
                    <td colspan="5">
                      <app-empty text="No punch recorded for this employee on this date" />
                    </td>
                  </tr>
                } @else {
                  @for (p of punches(); track p.id) {
                    <tr [class.hl]="p.source !== 'Device'">
                      <td class="mono">{{ p.time }}</td>
                      <td>
                        @if (p.source === 'Device') {
                          <app-chip kind="ok">Device</app-chip>
                        } @else {
                          <app-chip kind="violet">{{ p.source }}</app-chip>
                        }
                      </td>
                      <td class="small">{{ p.deviceId }}</td>
                      <td class="small">{{ p.remark || '—' }}</td>
                      <td class="right">
                        <button class="btn btn-sm btn-danger" (click)="remove(p)">Delete</button>
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
      .radio-col {
        display: flex;
        flex-direction: column;
        gap: 7px;
        padding: 5px 0;
      }
      .mini {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 9px 11px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--surface-2);
      }
      .mini span {
        font-size: 11px;
        color: var(--muted);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .mini b {
        font-size: 16px;
      }
      .mini b.warn {
        color: var(--warn);
      }
      .mini b.ok {
        color: var(--ok);
      }
      tr.hl {
        background: #f6f2ff !important;
      }
    `,
  ],
})
export class ManualPunchComponent {
  readonly store = inject(Store);
  private readonly attendance = inject(AttendanceService);
  private readonly toast = inject(ToastService);

  readonly employeeId = signal('');
  readonly date = signal(todayIso());
  readonly time = signal('09:00');
  readonly mode = signal<'Manual' | 'Corrected'>('Manual');
  readonly remark = signal('');
  readonly attempted = signal(false);

  readonly employee = computed(() => this.store.employees.byId(this.employeeId()));

  readonly punches = computed(() =>
    this.employeeId()
      ? this.attendance.punchesOf(this.employeeId(), this.date())
      : [],
  );

  readonly day = computed(() => {
    const e = this.employee();
    if (!e) return null;
    return this.attendance.dayFor(e, this.date());
  });

  fmtDurText = fmtDurText;

  save(): void {
    this.attempted.set(true);
    if (!this.employeeId()) {
      this.toast.show('Select an employee.', 'error');
      return;
    }
    if (!this.remark().trim()) {
      this.toast.show('A remark is mandatory for a manual punch (ATT-02).', 'error');
      return;
    }
    this.attendance.addPunch(
      this.employeeId(),
      this.date(),
      this.time(),
      this.remark().trim(),
      this.mode(),
    );
    this.toast.show('Punch recorded and logged in the audit trail.', 'ok');
    this.remark.set('');
    this.attempted.set(false);
  }

  remove(p: any): void {
    if (!confirm(`Remove the punch at ${p.time}?`)) return;
    this.attendance.removePunch(p.id);
    this.toast.show('Punch removed.', 'ok');
  }
}
