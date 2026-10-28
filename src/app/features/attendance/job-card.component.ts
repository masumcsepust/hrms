import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { AttendanceService } from '../../core/attendance.service';
import { PageHeaderComponent, IconComponent } from '../../shared/ui';
import { TableColumn, ReportViewComponent } from '../../shared/table';
import { HIGHLIGHT } from '../../core/export.service';
import { addDays, fmtDurText, todayIso, weekdayOf, WEEKDAY_LONG } from '../../core/calc';

@Component({
  selector: 'app-job-card',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, IconComponent, ReportViewComponent],
  template: `
    <app-page-header
      title="Job card"
      crumb="Attendance"
      subtitle="JOB-1 — date-wise or monthly attendance for a selected employee and date range, exportable to PDF and Excel (JOB-6)."
    />

    <div class="filter-bar">
      <div class="field" style="min-width: 250px">
        <label class="label">Employee</label>
        <select [value]="employeeId()" (change)="employeeId.set($any($event.target).value)">
          <option value="">— select employee —</option>
          @for (e of store.employees.all(); track e.id) {
            <option [value]="e.id">{{ e.id }} — {{ e.fullName }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label class="label">From</label>
        <input type="date" [value]="from()" (change)="from.set($any($event.target).value)" />
      </div>
      <div class="field">
        <label class="label">To</label>
        <input type="date" [value]="to()" (change)="to.set($any($event.target).value)" />
      </div>
      <div class="field">
        <label class="label">&nbsp;</label>
        <div class="row gap-8">
          <button class="btn btn-sm" (click)="range('week')">This week</button>
          <button class="btn btn-sm" (click)="range('month')">This month</button>
        </div>
      </div>
    </div>

    @if (employee()) {
      <div class="card card-pad mt-12 row gap-12 wrap">
        <div class="mini"><span>Employee</span><b>{{ employee()!.id }} · {{ employee()!.fullName }}</b></div>
        <div class="mini"><span>Work group</span><b>{{ wgName() }}</b></div>
        <div class="mini"><span>Shift</span><b>{{ shiftName() }}</b></div>
        <div class="mini"><span>Group type</span><b>{{ groupType() }}</b></div>
      </div>
    }

    <app-report-view
      class="mt-12"
      title="Job card"
      [subtitle]="employee() ? employee()!.fullName + ' · ' + from() + ' → ' + to() : 'Select an employee'"
      [columns]="columns()"
      [rows]="rows()"
      [summary]="summaryStrip()"
      fileName="job-card"
      tableTitle="Attendance register"
      maxHeight="62vh"
    />
  `,
  styles: [
    `
      app-report-view {
        display: block;
      }
      .mini {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 7px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--surface-2);
      }
      .mini span {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
        font-weight: 700;
      }
      .mini b {
        font-size: 13px;
      }
    `,
  ],
})
export class JobCardComponent {
  readonly store = inject(Store);
  private readonly attendance = inject(AttendanceService);

  readonly employeeId = signal(this.store.activeEmployees()[0]?.id ?? '');
  readonly from = signal(addDays(todayIso(), -29));
  readonly to = signal(todayIso());

  readonly employee = computed(() => this.store.employees.byId(this.employeeId()));

  readonly wgName = computed(
    () => this.store.workGroups.byId(this.employee()?.workGroupId)?.name ?? '—',
  );
  readonly groupType = computed(
    () => this.store.workGroups.byId(this.employee()?.workGroupId)?.groupType ?? '—',
  );
  readonly shiftName = computed(() => {
    const e = this.employee();
    if (!e) return '—';
    const sh = this.attendance.dayFor(e, this.from()) ;
    const policy = this.store.shiftPolicies.byId(sh.shiftPolicyId);
    return policy ? `${policy.name}` : '—';
  });

  readonly rows = computed(() => {
    const e = this.employee();
    if (!e) return [];
    return this.attendance.jobCard(e, this.from(), this.to()).days;
  });

  readonly summary = computed(() => {
    const e = this.employee();
    if (!e) return null;
    return this.attendance.jobCard(e, this.from(), this.to()).summary;
  });

  readonly summaryStrip = computed(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Total work days', value: s.totalWorkDays },
      { label: 'Present days', value: s.presentDays },
      { label: 'Absent days', value: s.absentDays },
      { label: 'Leave days', value: s.leaveDays },
      { label: 'Holidays / week offs', value: s.holidayDays },
      { label: 'Total delay', value: fmtDurText(s.totalDelay) },
      { label: 'Total overtime', value: fmtDurText(s.totalOt) },
      { label: 'Total work hours', value: s.totalWorkHours },
    ];
  });

  readonly columns = computed<TableColumn<any>[]>(() => [
    { key: 'date', header: 'Date', value: (r) => r.date, width: '104px' },
    {
      key: 'day',
      header: 'Day',
      value: (r) => WEEKDAY_LONG[weekdayOf(r.date)],
      width: '84px',
    },
    {
      key: 'dayType',
      header: 'Day status',
      value: (r) => (r.dayType === 'Workday' ? 'Workday' : r.dayType),
      width: '92px',
      highlight: (r) => (r.dayType === 'Workday' ? null : HIGHLIGHT.leave),
    },
    { key: 'in', header: 'In time', value: (r) => r.inTime ?? '—', align: 'center', width: '72px' },
    { key: 'out', header: 'Out time', value: (r) => r.outTime ?? '—', align: 'center', width: '76px' },
    {
      key: 'delay',
      header: 'Delay',
      value: (r) => (r.delayMinutes ? fmtDurText(r.delayMinutes) : '—'),
      align: 'center',
      width: '70px',
      highlight: (r) => (r.delayMinutes ? HIGHLIGHT.delay : null),
    },
    {
      key: 'regular',
      header: 'Regular work hour',
      value: (r) => fmtDurText(r.regularMinutes),
      align: 'center',
      width: '96px',
    },
    {
      key: 'total',
      header: 'Total work time',
      value: (r) => fmtDurText(r.totalWorkMinutes),
      align: 'center',
      width: '96px',
    },
    {
      key: 'shiftTime',
      header: 'Shift time',
      value: (r) => fmtDurText(r.shiftMinutes),
      align: 'center',
      width: '84px',
    },
    { key: 'wg', header: 'Work group', value: () => this.wgName(), width: '110px' },
    {
      key: 'remark',
      header: 'Remarks',
      value: (r) => r.remark || (r.manual ? 'Manual entry / correction' : ''),
      highlight: (r) => (r.manual ? HIGHLIGHT.manual : null),
    },
    {
      key: 'break',
      header: 'Break time',
      value: (r) => fmtDurText(r.breakMinutes),
      align: 'center',
      width: '80px',
    },
    {
      key: 'net',
      header: 'Net time',
      value: (r) => fmtDurText(r.netMinutes),
      align: 'center',
      width: '80px',
    },
    {
      key: 'ot',
      header: 'OT / Less time',
      value: (r) =>
        r.countedOt
          ? `OT ${fmtDurText(r.countedOt)}`
          : r.lessMinutes
            ? `Less ${fmtDurText(r.lessMinutes)}`
            : '—',
      align: 'center',
      width: '110px',
      highlight: (r) => (r.countedOt ? HIGHLIGHT.ot : r.lessMinutes ? HIGHLIGHT.absent : null),
    },
  ]);

  range(kind: 'week' | 'month'): void {
    const today = todayIso();
    if (kind === 'week') {
      const dow = weekdayOf(today);
      const diff = (dow + 1) % 7; // weeks start on Saturday
      this.from.set(addDays(today, -diff));
      this.to.set(today);
    } else {
      const d = new Date(today);
      this.from.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
      this.to.set(today);
    }
  }
}
