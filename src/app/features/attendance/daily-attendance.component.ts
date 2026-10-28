import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { AttendanceService } from '../../core/attendance.service';
import { PageHeaderComponent, ChipComponent, IconComponent, LegendComponent } from '../../shared/ui';
import { TableColumn, ReportViewComponent } from '../../shared/table';
import { HIGHLIGHT } from '../../core/export.service';
import { fmtDurText, todayIso, WEEKDAY_LONG, weekdayOf } from '../../core/calc';

@Component({
  selector: 'app-daily-attendance',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, IconComponent, LegendComponent, ReportViewComponent],
  template: `
    <app-page-header
      title="Daily attendance"
      crumb="Attendance"
      subtitle="Employee daily report (EDR) and the work-group manpower summary (DAR) for the selected date."
    />

    <div class="filter-bar">
      <div class="field">
        <label class="label">Date</label>
        <input type="date" [value]="date()" (change)="date.set($any($event.target).value)" />
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
        <label class="label">Section</label>
        <select [value]="section()" (change)="section.set($any($event.target).value)">
          <option value="">All</option>
          @for (s of store.sections.all(); track s.id) {
            <option [value]="s.id">{{ s.name }}</option>
          }
        </select>
      </div>
      <div class="field" style="min-width: 190px">
        <label class="label">Search</label>
        <input type="search" placeholder="ID or name" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>
      <div class="field">
        <label class="label">&nbsp;</label>
        <button class="btn btn-sm" (click)="date.set(today)">Today</button>
      </div>
    </div>

    <div class="grid grid-4 mt-12">
      <div class="kpi">
        <span class="label">Total manpower</span>
        <span class="value">{{ summary().total }}</span>
        <span class="foot">EDR-3</span>
      </div>
      <div class="kpi">
        <span class="label">Present</span>
        <span class="value" style="color: #0b8a5a">{{ summary().present }}</span>
        <span class="foot">{{ ratio() }}% of manpower</span>
      </div>
      <div class="kpi">
        <span class="label">Absent</span>
        <span class="value" style="color: #c53030">{{ summary().absent }}</span>
        <span class="foot">Informed {{ summary().informed }} · not informed {{ summary().uninformed }}</span>
      </div>
      <div class="kpi">
        <span class="label">On leave</span>
        <span class="value" style="color: #1c64c8">{{ summary().leave }}</span>
        <span class="foot">Incomplete {{ summary().incomplete }}</span>
      </div>
    </div>

    <app-report-view
      class="mt-16"
      title="Employee daily report"
      [subtitle]="dateLabel()"
      [columns]="columns()"
      [rows]="rows()"
      [summary]="summaryStrip()"
      fileName="daily-attendance"
      tableTitle="Date-wise attendance"
    >
      <div filters></div>
    </app-report-view>

    <app-report-view
      class="mt-16"
      title="Work group manpower summary"
      subtitle="DAR-4 — total manpower, present count and present ratio for each work group"
      [columns]="groupColumns()"
      [rows]="groupRows()"
      fileName="work-group-manpower"
      tableTitle="Manpower by work group"
    />

    <div class="card mt-12 card-pad">
      <app-legend
        [items]="[
          { label: 'Delay', color: '#FFF3BF' },
          { label: 'Absent', color: '#FFE3E3' },
          { label: 'On leave', color: '#E7F5FF' },
          { label: 'Manual / corrected punch', color: '#F3F0FF' },
          { label: 'Overtime', color: '#E6FCF5' }
        ]"
      />
    </div>
  `,
  styles: [
    `
      app-report-view {
        display: block;
      }
    `,
  ],
})
export class DailyAttendanceComponent {
  readonly store = inject(Store);
  private readonly attendance = inject(AttendanceService);

  readonly today = todayIso();
  readonly date = signal(this.today);
  readonly wg = signal('');
  readonly section = signal('');
  readonly q = signal('');

  readonly dateLabel = computed(
    () => `${WEEKDAY_LONG[weekdayOf(this.date())]}, ${this.date()}`,
  );

  readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    const emps = this.store.activeEmployees();
    const all = this.attendance.dailyRows(
      this.date(),
      emps,
      this.wg() || undefined,
      this.section() || undefined,
    );
    return all
      .filter((r) =>
        q ? `${r.employee.id} ${r.employee.fullName}`.toLowerCase().includes(q) : true,
      )
      .map((r) => ({
        id: r.employee.id,
        emp: r.employee,
        day: r.day,
      }));
  });

  readonly columns = computed<TableColumn<any>[]>(() => [
    {
      key: 'id',
      header: 'ID',
      value: (r) => r.emp.id,
      width: '84px',
    },
    { key: 'name', header: 'Name', value: (r) => r.emp.fullName },
    {
      key: 'desig',
      header: 'Designation',
      value: (r) => this.store.designations.byId(r.emp.designationId)?.name ?? '',
    },
    {
      key: 'dept',
      header: 'Department',
      value: (r) => this.store.departments.byId(r.emp.departmentId)?.name ?? '',
    },
    {
      key: 'sec',
      header: 'Section',
      value: (r) => this.store.sections.byId(r.emp.sectionId)?.name ?? '',
    },
    {
      key: 'status',
      header: 'Day status',
      value: (r) => r.day.status,
      highlight: (r) =>
        r.day.status === 'Absent'
          ? HIGHLIGHT.absent
          : r.day.status === 'On Leave'
            ? HIGHLIGHT.leave
            : r.day.status === 'Incomplete'
              ? HIGHLIGHT.manual
              : null,
    },
    { key: 'in', header: 'In time', value: (r) => r.day.inTime ?? '—', align: 'center' },
    { key: 'out', header: 'Out time', value: (r) => r.day.outTime ?? '—', align: 'center' },
    {
      key: 'shift',
      header: 'Shift timing',
      value: (r) => {
        const sh = this.store.shiftPolicies.byId(r.day.shiftPolicyId);
        return sh ? `${sh.startTime}–${sh.endTime}` : '—';
      },
    },
    {
      key: 'grp',
      header: 'Group',
      value: (r) => this.store.workGroups.byId(r.emp.workGroupId)?.name ?? '',
    },
    {
      key: 'delay',
      header: 'Delay',
      value: (r) => (r.day.delayMinutes ? fmtDurText(r.day.delayMinutes) : '—'),
      align: 'center',
      highlight: (r) => (r.day.delayMinutes ? HIGHLIGHT.delay : null),
    },
    {
      key: 'ot',
      header: 'OT',
      value: (r) => (r.day.countedOt ? fmtDurText(r.day.countedOt) : '—'),
      align: 'center',
      highlight: (r) => (r.day.countedOt ? HIGHLIGHT.ot : null),
    },
    {
      key: 'remark',
      header: 'Remarks',
      value: (r) => r.day.remark || (r.day.manual ? 'Manual entry / correction' : ''),
      highlight: (r) => (r.day.manual ? HIGHLIGHT.manual : null),
    },
  ]);

  readonly summary = computed(() => {
    const rows = this.rows();
    const present = rows.filter((r) => r.day.status === 'Present').length;
    const absent = rows.filter((r) => r.day.status === 'Absent').length;
    const leave = rows.filter((r) => r.day.status === 'On Leave').length;
    const incomplete = rows.filter((r) => r.day.incomplete).length;
    const informed = rows.filter(
      (r) => r.day.status === 'Absent' && this.attendance.informedAbsent(r.emp, this.date()),
    ).length;
    return {
      total: rows.length,
      present,
      absent,
      leave,
      incomplete,
      informed,
      uninformed: absent - informed,
    };
  });

  readonly ratio = computed(() =>
    this.summary().total
      ? Math.round((this.summary().present / this.summary().total) * 1000) / 10
      : 0,
  );

  readonly summaryStrip = computed(() => [
    { label: 'Total manpower', value: this.summary().total },
    { label: 'Present', value: this.summary().present },
    { label: 'Absent', value: this.summary().absent },
    { label: 'On leave', value: this.summary().leave },
    { label: 'Present ratio', value: `${this.ratio()}%` },
  ]);

  readonly groupRows = computed(() =>
    this.attendance.dailyAttendanceSummary(
      this.date(),
      this.date(),
      this.store.activeEmployees(),
      this.wg() || undefined,
      this.section() || undefined,
    ),
  );

  readonly groupColumns = computed<TableColumn<any>[]>(() => [
    { key: 'date', header: 'Date', value: (r) => r.date },
    { key: 'wg', header: 'Work group', value: (r) => r.workGroup },
    { key: 'total', header: 'Total manpower', value: (r) => r.totalManpower, align: 'right' },
    { key: 'present', header: 'Present', value: (r) => r.present, align: 'right' },
    { key: 'absent', header: 'Absent', value: (r) => r.absent, align: 'right' },
    { key: 'leave', header: 'On leave', value: (r) => r.onLeave, align: 'right' },
    {
      key: 'ratio',
      header: 'Present ratio',
      value: (r) => `${r.ratio}%`,
      align: 'right',
      highlight: (r) => (r.ratio < 80 ? HIGHLIGHT.delay : null),
    },
  ]);
}
