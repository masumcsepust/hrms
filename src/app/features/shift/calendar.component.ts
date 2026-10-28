import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { SchedulingService } from '../../core/scheduling.service';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, IconComponent } from '../../shared/ui';
import { DayType } from '../../core/models';
import { addDays, daysInMonth, monthName, toDate, weekdayOf, WEEKDAY_LABELS } from '../../core/calc';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, IconComponent],
  template: `
    <app-page-header
      title="Work & holiday calendar"
      crumb="Setup / Calendar"
      subtitle="Declare a day as holiday, workday or adjustment day. Changes are written to the audit trail (CAL-6)."
    >
      <span actions>
        <div class="month-nav">
          <button class="btn btn-sm btn-icon" (click)="shiftMonth(-1)">‹</button>
          <span class="month-label">{{ monthTitle() }}</span>
          <button class="btn btn-sm btn-icon" (click)="shiftMonth(1)">›</button>
          <button class="btn btn-sm" (click)="goToday()">Today</button>
        </div>
        <select class="wg-select" [value]="workGroup()" (change)="workGroup.set($any($event.target).value)">
          <option value="">All work groups</option>
          @for (w of store.workGroups.all(); track w.id) {
            <option [value]="w.id">{{ w.name }}</option>
          }
        </select>
      </span>
    </app-page-header>

    <div class="card">
      <div class="card-head">
        <h3>{{ monthTitle() }}</h3>
        <div class="legend">
          <span><i class="swatch" style="background: #ffe9a8"></i>Weekend</span>
          <span><i class="swatch" style="background: #b9ecc9"></i>Holiday</span>
          <span><i class="swatch" style="background: #bcd7f7"></i>Adjustment</span>
          <span><i class="swatch" style="background: #ffffff; border: 1px solid #dfe5ef"></i>Workday</span>
        </div>
      </div>

      <div class="cal-grid">
        @for (d of weekdayHeads; track d) {
          <div class="cal-head">{{ d }}</div>
        }
        @for (cell of cells(); track cell.date) {
          <button class="cal-cell" [class]="cellClass(cell)" (click)="pick(cell.date)">
            <span class="daynum">{{ cell.day }}</span>
            @if (cell.specific) {
              <span class="dot-mark" title="Specific to this work group"></span>
            }
            @if (cell.comment) {
              <span class="comment">{{ cell.comment }}</span>
            }
            @if (cell.type !== 'Workday' && !cell.comment) {
              <span class="type-tag">{{ cell.type }}</span>
            }
          </button>
        }
      </div>
    </div>

    @if (selected()) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>Declare day — {{ selected()! }}</h3>
            <button class="btn btn-icon btn-ghost" (click)="close()">✕</button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label class="label req">Day type</label>
              <div class="radio-col">
                @for (t of dayTypes; track t) {
                  <label class="check">
                    <input type="radio" name="dt" [value]="t" [checked]="form.dayType === t"
                      (change)="form.dayType = t" />
                    {{ t }}
                  </label>
                }
              </div>
            </div>
            <div class="field mt-12">
              <label class="label">Comment / reason</label>
              <textarea [value]="form.comment" (input)="form.comment = $any($event.target).value"
                placeholder="Why is this day declared?"></textarea>
            </div>
            <div class="field mt-12">
              <label class="label">Applies to</label>
              <select [value]="form.workGroupId" (change)="form.workGroupId = $any($event.target).value">
                <option value="">All work groups</option>
                @for (w of store.workGroups.all(); track w.id) {
                  <option [value]="w.id">{{ w.name }}</option>
                }
              </select>
              <span class="hint">CAL-4 — the calendar is maintained per work group.</span>
            </div>
          </div>
          <div class="modal-foot">
            @if (existingEntry()) {
              <button class="btn btn-danger" (click)="removeEntry()">Remove declaration</button>
            }
            <button class="btn" (click)="close()">Cancel</button>
            <button class="btn btn-primary" (click)="save()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .month-nav {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .month-label {
        font-weight: 650;
        min-width: 128px;
        text-align: center;
        font-size: 13px;
      }
      .wg-select {
        height: 34px;
        width: auto;
        min-width: 170px;
      }
      .cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        background: var(--border);
      }
      .cal-head {
        background: #eff3f9;
        padding: 8px 10px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-2);
      }
      .cal-cell {
        position: relative;
        min-height: 76px;
        border: none;
        background: #fff;
        text-align: left;
        padding: 7px 8px;
        cursor: pointer;
        font: inherit;
        display: flex;
        flex-direction: column;
        gap: 3px;
        transition: background 0.12s ease;
      }
      .cal-cell:hover {
        background: #f0f5fd;
      }
      .cal-cell.other {
        background: #f7f9fc;
        color: var(--muted);
      }
      .cal-cell.workday {
        background: #fff;
      }
      .cal-cell.weekend {
        background: #fff7e0;
      }
      .cal-cell.holiday {
        background: #e9f9ef;
      }
      .cal-cell.adjustment {
        background: #eaf2fd;
      }
      .daynum {
        font-size: 13px;
        font-weight: 650;
      }
      .type-tag {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-2);
      }
      .comment {
        font-size: 10.5px;
        color: var(--text-2);
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .dot-mark {
        position: absolute;
        top: 9px;
        right: 9px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--brand-2);
      }
      .radio-col {
        display: flex;
        flex-direction: column;
        gap: 7px;
        padding: 6px 0;
      }
    `,
  ],
})
export class CalendarComponent {
  readonly store = inject(Store);
  private readonly sched = inject(SchedulingService);
  private readonly toast = inject(ToastService);

  readonly weekdayHeads = WEEKDAY_LABELS;
  readonly dayTypes: DayType[] = ['Workday', 'Holiday', 'Adjustment', 'WeeklyOff'];

  readonly year = signal(new Date().getFullYear());
  readonly month = signal(new Date().getMonth());
  readonly workGroup = signal('');
  readonly selected = signal<string | null>(null);

  form: { dayType: DayType; comment: string; workGroupId: string } = {
    dayType: 'Holiday',
    comment: '',
    workGroupId: '',
  };

  readonly monthTitle = computed(
    () => `${monthName(this.month())} ${this.year()}`,
  );

  readonly cells = computed(() => {
    const y = this.year();
    const m = this.month();
    const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lead = weekdayOf(first);
    const total = daysInMonth(y, m);
    const cells: {
      date: string;
      day: number;
      type: DayType;
      comment: string;
      specific: boolean;
      other: boolean;
    }[] = [];

    for (let i = lead; i > 0; i--) {
      const d = addDays(first, -i);
      cells.push({ date: d, day: Number(d.slice(8)), type: 'Workday', comment: '', specific: false, other: true });
    }
    for (let d = 1; d <= total; d++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const info = this.dayInfo(date);
      cells.push({ date, day: d, type: info.type, comment: info.comment, specific: info.specific, other: false });
    }
    let day = 1;
    while (cells.length % 7 !== 0) {
      const y2 = m === 11 ? y + 1 : y;
      const m2 = m === 11 ? 0 : m + 1;
      const date = `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const info = this.dayInfo(date);
      cells.push({ date, day, type: info.type, comment: info.comment, specific: info.specific, other: true });
      day++;
    }
    return cells;
  });

  /** Effective day type for a date, honouring group specific entries. */
  dayInfo(date: string): { type: DayType; comment: string; specific: boolean } {
    const wg = this.workGroup();
    const entries = this.store.calendar.where((c) => c.date === date);
    const specific = wg ? entries.find((e) => e.workGroupId === wg) : undefined;
    const generic = entries.find((e) => !e.workGroupId);
    const entry = specific ?? generic;
    if (entry) {
      const type: DayType =
        entry.dayType === 'WeeklyOff' ? 'Weekend' : entry.dayType;
      return { type, comment: entry.comment, specific: !!specific };
    }
    // fall back to the roster working days of the selected work group
    const roster = this.store.dutyRosters.where(
      (r) =>
        r.active &&
        r.startDate <= date &&
        r.endDate >= date &&
        (!wg || r.workGroupId === wg) &&
        !r.employeeId,
    )[0];
    if (roster && !roster.weekDays.includes(weekdayOf(date))) {
      return { type: 'Weekend', comment: 'Weekly holiday', specific: false };
    }
    return { type: 'Workday', comment: '', specific: false };
  }

  cellClass(cell: { type: DayType; other: boolean }): string {
    return [
      'cal-cell',
      cell.type.toLowerCase() === 'weeklyoff' ? 'weekend' : cell.type.toLowerCase(),
      cell.other ? 'other' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  shiftMonth(n: number): void {
    let m = this.month() + n;
    let y = this.year();
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    this.month.set(m);
    this.year.set(y);
  }

  goToday(): void {
    const n = new Date();
    this.month.set(n.getMonth());
    this.year.set(n.getFullYear());
  }

  pick(date: string): void {
    const wg = this.workGroup();
    const entries = this.store.calendar.where((c) => c.date === date);
    const specific = wg ? entries.find((e) => e.workGroupId === wg) : undefined;
    const generic = entries.find((e) => !e.workGroupId);
    const entry = specific ?? generic;
    this.form = {
      dayType: entry ? (entry.dayType === 'WeeklyOff' ? 'WeeklyOff' : entry.dayType) : 'Holiday',
      comment: entry?.comment ?? '',
      workGroupId: wg,
    };
    this.selected.set(date);
  }

  existingEntry(): any | undefined {
    const date = this.selected();
    if (!date) return undefined;
    const wg = this.form.workGroupId;
    return this.store.calendar.where(
      (c) => c.date === date && (c.workGroupId ?? '') === (wg ?? ''),
    )[0];
  }

  close(): void {
    this.selected.set(null);
  }

  save(): void {
    const date = this.selected();
    if (!date) return;
    this.sched.declareDay(date, this.form.dayType, this.form.comment, this.form.workGroupId || null);
    this.toast.show(`${date} declared as ${this.form.dayType}.`, 'ok');
    this.close();
  }

  removeEntry(): void {
    const entry = this.existingEntry();
    if (!entry) return;
    this.store.calendar.remove(entry.id);
    this.store.log('Calendar change', 'Calendar', entry.date, 'Declaration removed');
    this.toast.show('Declaration removed.', 'ok');
    this.close();
  }
}
