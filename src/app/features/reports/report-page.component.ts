import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '../../core/store';
import { AuthService } from '../../core/auth';
import { AttendanceService } from '../../core/attendance.service';
import { LeaveService } from '../../core/leave.service';
import { PageHeaderComponent, IconComponent } from '../../shared/ui';
import { TableColumn, ReportViewComponent } from '../../shared/table';
import { ExportSummary, HIGHLIGHT } from '../../core/export.service';
import {
  addDays,
  calcTenure,
  daysInMonth,
  eachDate,
  fmtDurText,
  monthName,
  todayIso,
  yearOf,
} from '../../core/calc';

interface FilterSpec {
  key: string;
  label: string;
  type: 'select' | 'date' | 'dates' | 'text' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface ReportDef {
  title: string;
  clause: string;
  subtitle: string;
  filters: FilterSpec[];
  columns: TableColumn<any>[];
  rows: any[];
  summary: ExportSummary[];
  fileName: string;
}

@Component({
  selector: 'app-report-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, IconComponent, ReportViewComponent],
  template: `
    <app-page-header [title]="def().title" [crumb]="'Reports / ' + def().clause" [subtitle]="def().subtitle">
      <span actions>
        <a class="btn btn-sm" href="/reports">← Report centre</a>
      </span>
    </app-page-header>

    <div class="filter-bar">
      @for (fs of def().filters; track fs.key) {
        @switch (fs.type) {
          @case ('select') {
            <div class="field">
              <label class="label">{{ fs.label }}</label>
              <select [value]="val(fs.key)" (change)="set(fs.key, $any($event.target).value)">
                <option value="">All</option>
                @for (o of fs.options ?? []; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            </div>
          }
          @case ('date') {
            <div class="field">
              <label class="label">{{ fs.label }}</label>
              <input type="date" [value]="val(fs.key)" (change)="set(fs.key, $any($event.target).value)" />
            </div>
          }
          @case ('dates') {
            <div class="field">
              <label class="label">{{ fs.label }} from</label>
              <input type="date" [value]="val(fs.key + 'From')" (change)="set(fs.key + 'From', $any($event.target).value)" />
            </div>
            <div class="field">
              <label class="label">to</label>
              <input type="date" [value]="val(fs.key + 'To')" (change)="set(fs.key + 'To', $any($event.target).value)" />
            </div>
          }
          @case ('number') {
            <div class="field" style="min-width: 110px">
              <label class="label">{{ fs.label }}</label>
              <input type="number" [value]="val(fs.key)" (change)="set(fs.key, +$any($event.target).value)" />
            </div>
          }
          @default {
            <div class="field" style="min-width: 190px">
              <label class="label">{{ fs.label }}</label>
              <input type="text" [placeholder]="fs.placeholder ?? ''" [value]="val(fs.key)"
                (input)="set(fs.key, $any($event.target).value)" />
            </div>
          }
        }
      }
    </div>

    <app-report-view
      class="mt-12"
      [title]="def().title"
      [subtitle]="def().subtitle"
      [columns]="def().columns"
      [rows]="def().rows"
      [summary]="def().summary"
      [fileName]="def().fileName"
      maxHeight="58vh"
    />
  `,
  styles: [
    `
      app-report-view {
        display: block;
      }
    `,
  ],
})
export class ReportPageComponent {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly attendance = inject(AttendanceService);
  private readonly leave = inject(LeaveService);
  private readonly route = inject(ActivatedRoute);

  readonly f = signal<Record<string, any>>({});

  constructor() {
    // NFR-9 — a run of the Employee Information Report is logged with user and time
    effect(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id === 'employee-info') {
        untracked(() =>
          this.store.log(
            'Report run',
            'Employee information report',
            'all',
            'Employee information report opened',
          ),
        );
      }
    });
  }

  val(key: string): any {
    return this.f()[key] ?? '';
  }

  set(key: string, value: any): void {
    this.f.update((cur) => ({ ...cur, [key]: value }));
  }

  readonly def = computed<ReportDef>(() => {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    switch (id) {
      case 'employee-daily':
        return this.employeeDaily();
      case 'daily-attendance':
        return this.dailyAttendance();
      case 'punch-count':
        return this.punchCount();
      case 'delay-ratio':
        return this.delayRatio();
      case 'employee-info':
        return this.employeeInfo();
      case 'employee-statement':
        return this.employeeStatement();
      case 'leave-report':
        return this.leaveReport();
      case 'el-individual':
        return this.elIndividual();
      case 'el-detail':
        return this.elDetail();
      default:
        return this.employeeDaily();
    }
  });

  // -- helpers --------------------------------------------------------------
  private options(list: { id: string; name: string }[]): { value: string; label: string }[] {
    return list.map((x) => ({ value: x.id, label: x.name }));
  }

  private employeeOptions() {
    return this.store.employees.all().map((e) => ({ value: e.id, label: `${e.id} — ${e.fullName}` }));
  }

  private empFiltered(extra: (e: any) => boolean = () => true) {
    const f = this.f();
    return this.store.employees.all().filter((e) => {
      if (f['company'] && e.companyId !== f['company']) return false;
      if (f['department'] && e.departmentId !== f['department']) return false;
      if (f['section'] && e.sectionId !== f['section']) return false;
      if (f['workGroup'] && e.workGroupId !== f['workGroup']) return false;
      if (f['employeeType'] && e.employeeTypeId !== f['employeeType']) return false;
      if (f['employee'] && e.id !== f['employee']) return false;
      if (f['active'] && f['active'] === 'yes' && !e.active) return false;
      if (f['active'] && f['active'] === 'no' && e.active) return false;
      return extra(e);
    });
  }

  // -- EDR ------------------------------------------------------------------
  private employeeDaily(): ReportDef {
    const date = this.val('date') || todayIso();
    const rows = this.attendance
      .dailyRows(
        date,
        this.empFiltered(),
        this.val('workGroup') || undefined,
        this.val('section') || undefined,
      )
      .map((r) => ({
        id: r.employee.id,
        emp: r.employee,
        day: r.day,
      }));

    const present = rows.filter((r) => r.day.status === 'Present').length;
    const absent = rows.filter((r) => r.day.status === 'Absent').length;
    const onLeave = rows.filter((r) => r.day.status === 'On Leave').length;

    return {
      title: 'Employee daily report',
      clause: 'EDR',
      subtitle: `Date-wise attendance for ${date} (EDR-1). Filter by work group and section (EDR-2).`,
      fileName: 'employee-daily-report',
      filters: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'workGroup', label: 'Work group', type: 'select', options: this.options(this.store.workGroups.all()) },
        { key: 'section', label: 'Section', type: 'select', options: this.options(this.store.sections.all()) },
        { key: 'search', label: 'Search', type: 'text', placeholder: 'ID or name' },
      ],
      columns: [
        { key: 'id', header: 'ID', value: (r) => r.emp.id, width: '84px' },
        { key: 'name', header: 'Name', value: (r) => r.emp.fullName },
        { key: 'desig', header: 'Designation', value: (r) => this.store.designations.byId(r.emp.designationId)?.name ?? '' },
        { key: 'dept', header: 'Department', value: (r) => this.store.departments.byId(r.emp.departmentId)?.name ?? '' },
        { key: 'sec', header: 'Section', value: (r) => this.store.sections.byId(r.emp.sectionId)?.name ?? '' },
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
        { key: 'grp', header: 'Group', value: (r) => this.store.workGroups.byId(r.emp.workGroupId)?.name ?? '' },
        {
          key: 'remark',
          header: 'Remarks',
          value: (r) => r.day.remark || (r.day.manual ? 'Manual entry / correction' : ''),
          highlight: (r) => (r.day.manual ? HIGHLIGHT.manual : null),
        },
      ],
      rows,
      summary: [
        { label: 'Total employees', value: rows.length },
        { label: 'Present', value: present },
        { label: 'Absent', value: absent },
        { label: 'On leave', value: onLeave },
      ],
    };
  }

  // -- DAR ------------------------------------------------------------------
  private dailyAttendance(): ReportDef {
    const from = this.val('from') || todayIso();
    const to = this.val('to') || from;
    const rows = this.attendance.dailyAttendanceSummary(
      from,
      to,
      this.empFiltered(),
      this.val('workGroup') || undefined,
      this.val('section') || undefined,
    );
    const totalPresent = rows.reduce((s, r) => s + r.present, 0);
    const totalManpower = rows.reduce((s, r) => s + r.totalManpower, 0);
    return {
      title: 'Daily attendance report',
      clause: 'DAR',
      subtitle: 'Manpower, present count and present ratio per work group for each day (DAR-4).',
      fileName: 'daily-attendance-report',
      filters: [
        { key: 'from', label: 'From', type: 'date' },
        { key: 'to', label: 'To', type: 'date' },
        { key: 'workGroup', label: 'Work group', type: 'select', options: this.options(this.store.workGroups.all()) },
        { key: 'section', label: 'Section', type: 'select', options: this.options(this.store.sections.all()) },
      ],
      columns: [
        { key: 'date', header: 'Date', value: (r) => r.date, width: '96px' },
        { key: 'wg', header: 'Work group', value: (r) => r.workGroup },
        { key: 'man', header: 'Total manpower', value: (r) => r.totalManpower, align: 'right' },
        { key: 'p', header: 'Present', value: (r) => r.present, align: 'right' },
        { key: 'a', header: 'Absent', value: (r) => r.absent, align: 'right' },
        { key: 'l', header: 'On leave', value: (r) => r.onLeave, align: 'right' },
        {
          key: 'ratio',
          header: 'Present ratio',
          value: (r) => `${r.ratio}%`,
          align: 'right',
          bold: true,
          highlight: (r) => (r.ratio < 85 ? HIGHLIGHT.delay : null),
        },
      ],
      rows,
      summary: [
        { label: 'Rows', value: rows.length },
        { label: 'Total manpower (sum)', value: totalManpower },
        { label: 'Present (sum)', value: totalPresent },
        {
          label: 'Overall ratio',
          value: totalManpower ? `${Math.round((totalPresent / totalManpower) * 1000) / 10}%` : '—',
        },
      ],
    };
  }

  // -- DPC ------------------------------------------------------------------
  private punchCount(): ReportDef {
    const from = this.val('from') || addDays(todayIso(), -30);
    const to = this.val('to') || todayIso();
    const rows = this.attendance.punchCountRows(
      from,
      to,
      this.empFiltered(),
      this.val('workGroup') || undefined,
      this.val('section') || undefined,
      this.val('employee') || undefined,
    );
    return {
      title: 'Daily punch count report',
      clause: 'DPC',
      subtitle: 'Date-wise punch records with the number of punches. A single punch is flagged as incomplete (DPC-3).',
      fileName: 'daily-punch-count',
      filters: [
        { key: 'from', label: 'From', type: 'date' },
        { key: 'to', label: 'To', type: 'date' },
        { key: 'workGroup', label: 'Work group', type: 'select', options: this.options(this.store.workGroups.all()) },
        { key: 'section', label: 'Section', type: 'select', options: this.options(this.store.sections.all()) },
        { key: 'employee', label: 'Employee', type: 'select', options: this.employeeOptions() },
      ],
      columns: [
        { key: 'date', header: 'Date', value: (r) => r.date, width: '96px' },
        { key: 'id', header: 'Employee ID', value: (r) => r.employee.id, width: '96px' },
        { key: 'name', header: 'Employee name', value: (r) => r.employee.fullName },
        { key: 'wg', header: 'Work group', value: (r) => this.store.workGroups.byId(r.employee.workGroupId)?.name ?? '' },
        { key: 'sec', header: 'Section', value: (r) => this.store.sections.byId(r.employee.sectionId)?.name ?? '' },
        { key: 'in', header: 'In time', value: (r) => r.inTime, align: 'center' },
        { key: 'out', header: 'Out time', value: (r) => r.outTime || '—', align: 'center' },
        {
          key: 'n',
          header: 'Number of punches',
          value: (r) => r.punches,
          align: 'center',
          bold: true,
          highlight: (r) => (r.incomplete ? HIGHLIGHT.manual : null),
        },
      ],
      rows,
      summary: [
        { label: 'Rows', value: rows.length },
        { label: 'Incomplete records', value: rows.filter((r) => r.incomplete).length },
      ],
    };
  }

  // -- DLR ------------------------------------------------------------------
  private delayRatio(): ReportDef {
    const from = this.val('from') || addDays(todayIso(), -30);
    const to = this.val('to') || todayIso();
    const rows = this.attendance
      .delayRatioRows(
        from,
        to,
        this.empFiltered(),
        this.val('workGroup') || undefined,
        this.val('section') || undefined,
        this.val('employee') || undefined,
      )
      .filter((r) => r.totalWorkingDays > 0);
    return {
      title: 'Employee delay ratio report',
      clause: 'DLR',
      subtitle: 'Delay days against total working days per employee (DLR-3). Delay percentage = delay days ÷ working days × 100 (DLR-4).',
      fileName: 'delay-ratio-report',
      filters: [
        { key: 'from', label: 'From', type: 'date' },
        { key: 'to', label: 'To', type: 'date' },
        { key: 'workGroup', label: 'Work group', type: 'select', options: this.options(this.store.workGroups.all()) },
        { key: 'section', label: 'Section', type: 'select', options: this.options(this.store.sections.all()) },
        { key: 'employee', label: 'Employee', type: 'select', options: this.employeeOptions() },
      ],
      columns: [
        { key: 'id', header: 'Employee ID', value: (r) => r.employee.id, width: '96px' },
        { key: 'name', header: 'Employee name', value: (r) => r.employee.fullName },
        { key: 'wg', header: 'Work group', value: (r) => this.store.workGroups.byId(r.employee.workGroupId)?.name ?? '' },
        { key: 'wd', header: 'Total working days', value: (r) => r.totalWorkingDays, align: 'right' },
        {
          key: 'dd',
          header: 'Delay days',
          value: (r) => r.delayDays,
          align: 'right',
          highlight: (r) => (r.delayDays > 0 ? HIGHLIGHT.delay : null),
        },
        {
          key: 'pct',
          header: 'Delay percentage',
          value: (r) => `${r.delayPercentage}%`,
          align: 'right',
          bold: true,
          highlight: (r) => (r.delayPercentage > 30 ? HIGHLIGHT.absent : r.delayPercentage > 0 ? HIGHLIGHT.delay : null),
        },
        { key: 'min', header: 'Total delay time', value: (r) => fmtDurText(r.totalDelayMinutes), align: 'right' },
      ],
      rows,
      summary: [
        { label: 'Employees', value: rows.length },
        { label: 'Total delay days', value: rows.reduce((s, r) => s + r.delayDays, 0) },
        { label: 'Employees with delay', value: rows.filter((r) => r.delayDays > 0).length },
      ],
    };
  }

  // -- EIR ------------------------------------------------------------------
  private employeeInfo(): ReportDef {
    const field = this.val('dateField') || 'joining';
    const from = this.val('dateFrom');
    const to = this.val('dateTo');
    const minY = this.val('minYears');
    const maxY = this.val('maxYears');
    const today = todayIso();

    const rows = this.empFiltered()
      .filter((e) => {
        if (from || to) {
          const d = field === 'separation' ? e.separation?.date : e.joiningDate;
          if (!d) return false;
          if (from && d < from) return false;
          if (to && d > to) return false;
        }
        if (minY !== '' || maxY !== '') {
          const t = calcTenure(e.joiningDate, e.separation?.date ?? today);
          if (minY !== '' && t.years < +minY) return false;
          if (maxY !== '' && t.years > +maxY) return false;
        }
        return true;
      })
      .map((e) => ({
        id: e.id,
        e,
        tenure: calcTenure(e.joiningDate, e.separation?.date ?? today),
      }));

    const payroll = this.auth.canViewPayroll();
    const columns: TableColumn<any>[] = [
      { key: 'id', header: 'Employee ID', value: (r) => r.e.id, width: '96px' },
      { key: 'name', header: 'Full name', value: (r) => r.e.fullName },
      { key: 'co', header: 'Company', value: (r) => this.store.companies.byId(r.e.companyId)?.name ?? '' },
      { key: 'dp', header: 'Department', value: (r) => this.store.departments.byId(r.e.departmentId)?.name ?? '' },
      { key: 'se', header: 'Section', value: (r) => this.store.sections.byId(r.e.sectionId)?.name ?? '' },
      { key: 'ds', header: 'Designation', value: (r) => this.store.designations.byId(r.e.designationId)?.name ?? '' },
      { key: 'wg', header: 'Work group', value: (r) => this.store.workGroups.byId(r.e.workGroupId)?.name ?? '' },
      { key: 'et', header: 'Employee type', value: (r) => this.store.employeeTypes.byId(r.e.employeeTypeId)?.name ?? '' },
      { key: 'jd', header: 'Joining date', value: (r) => r.e.joiningDate, width: '100px' },
      { key: 'sd', header: 'Separation date', value: (r) => r.e.separation?.date ?? '—', width: '110px' },
      { key: 'tn', header: 'Tenure', value: (r) => r.tenure.label },
    ];
    if (payroll) {
      columns.push(
        { key: 'bk', header: 'Bank account no', value: (r) => r.e.bankAccountNo },
        { key: 'js', header: 'Joining salary', value: (r) => r.e.joiningSalary, align: 'right' },
        { key: 'ps', header: 'Present salary', value: (r) => r.e.presentSalary, align: 'right' },
      );
    }

    return {
      title: 'Employee information report',
      clause: 'EIR',
      subtitle: payroll
        ? 'Employee master data with tenure and the payroll-authorised bank and salary fields (EIR-3, EIR-5).'
        : 'Employee master data with tenure. Bank and salary fields are hidden — they need the payroll-authorised permission (NFR-8).',
      fileName: 'employee-information-report',
      filters: [
        { key: 'company', label: 'Company', type: 'select', options: this.options(this.store.companies.all()) },
        { key: 'department', label: 'Department', type: 'select', options: this.options(this.store.departments.all()) },
        { key: 'section', label: 'Section', type: 'select', options: this.options(this.store.sections.all()) },
        { key: 'workGroup', label: 'Work group', type: 'select', options: this.options(this.store.workGroups.all()) },
        { key: 'employeeType', label: 'Employee type', type: 'select', options: this.options(this.store.employeeTypes.all()) },
        { key: 'active', label: 'Active status', type: 'select', options: [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }] },
        { key: 'minYears', label: 'Service min (years)', type: 'number' },
        { key: 'maxYears', label: 'Service max (years)', type: 'number' },
        {
          key: 'dateField',
          label: 'Date field',
          type: 'select',
          options: [
            { value: 'joining', label: 'Joining date' },
            { value: 'separation', label: 'Separation date' },
          ],
        },
        { key: 'dateFrom', label: 'From', type: 'date' },
        { key: 'dateTo', label: 'To', type: 'date' },
      ],
      columns,
      rows,
      summary: [
        { label: 'Rows', value: rows.length },
        { label: 'Active', value: rows.filter((r) => r.e.active).length },
        { label: 'Separated', value: rows.filter((r) => r.e.separation).length },
      ],
    };
  }

  // -- EST ------------------------------------------------------------------
  private employeeStatement(): ReportDef {
    const companyFilter = this.val('company');
    const companies = this.store.companies
      .all()
      .filter((c) => c.active && (!companyFilter || c.id === companyFilter));

    const rows: any[] = [];
    let gPermanent = 0;
    let gTemporary = 0;

    for (const c of companies) {
      const members = this.store
        .activeEmployees()
        .filter((e) => e.companyId === c.id);
      let cPermanent = 0;
      let cTemporary = 0;

      for (const wg of this.store.workGroups.all()) {
        const group = members.filter((e) => e.workGroupId === wg.id);
        if (!group.length) continue;
        const permanent = group.filter((e) => this.store.employeeTypes.byId(e.employeeTypeId)?.permanent).length;
        const temporary = group.length - permanent;
        cPermanent += permanent;
        cTemporary += temporary;
        rows.push({
          id: `${c.id}-${wg.id}`,
          level: 'group',
          label: wg.name,
          company: c.name,
          permanent,
          temporary,
          total: group.length,
        });
      }
      gPermanent += cPermanent;
      gTemporary += cTemporary;
      rows.push({
        id: `${c.id}-total`,
        level: 'company',
        label: c.name,
        company: c.name,
        permanent: cPermanent,
        temporary: cTemporary,
        total: cPermanent + cTemporary,
      });
    }

    rows.push({
      id: 'grand-total',
      level: 'grand',
      label: 'Grand total',
      company: 'All companies',
      permanent: gPermanent,
      temporary: gTemporary,
      total: gPermanent + gTemporary,
    });

    return {
      title: 'Employee statement',
      clause: 'EST',
      subtitle: 'Headcount by company, work group and permanent versus temporary employees (EST-2). Only active employees are counted (EST-5).',
      fileName: 'employee-statement',
      filters: [
        {
          key: 'company',
          label: 'Company',
          type: 'select',
          options: this.options(this.store.companies.all()),
        },
      ],
      columns: [
        { key: 'co', header: 'Company', value: (r) => r.company },
        {
          key: 'lbl',
          header: 'Work group',
          value: (r) => (r.level === 'group' ? '   ' + r.label : r.label),
          bold: (r: any) => r.level !== 'group',
        },
        { key: 'p', header: 'Permanent', value: (r) => r.permanent, align: 'right' },
        { key: 't', header: 'Temporary', value: (r) => r.temporary, align: 'right' },
        { key: 'tot', header: 'Total', value: (r) => r.total, align: 'right', bold: true },
      ],
      rows,
      summary: [
        { label: 'Companies', value: companies.length },
        { label: 'Permanent', value: gPermanent },
        { label: 'Temporary', value: gTemporary },
        { label: 'Grand total', value: gPermanent + gTemporary },
      ],
    };
  }

  // -- LRP ------------------------------------------------------------------
  private leaveReport(): ReportDef {
    const year = this.val('year') || yearOf(todayIso());
    const emps = this.empFiltered();
    const rows = emps.map((e) => {
      const apps = this.store.leaveApplications.where(
        (l) =>
          l.employeeId === e.id &&
          yearOf(l.fromDate) === +year &&
          (l.status === 'Settled' || l.status === 'Approved'),
      );
      const months: Record<number, string> = {};
      let total = 0;
      for (const a of apps) {
        const m = yearOf(a.fromDate) - 1;
        const t = this.store.leaveTypes.byId(a.leaveTypeId)?.code ?? 'LV';
        months[m] = months[m] ? `${months[m]}, ${t}${a.isLwp ? '/LWP' : a.isCnl ? '/CNL' : ''} ${a.days}` : `${t}${a.isLwp ? '/LWP' : a.isCnl ? '/CNL' : ''} ${a.days}`;
        total += a.days;
      }
      const balances = this.leave.balance(e, +year);
      const el = balances.find((b) => b.name === 'Earned');
      return {
        id: e.id,
        e,
        months,
        total,
        balance: balances.reduce((s, b) => s + b.balance, 0),
        elBalance: el?.balance ?? 0,
      };
    });

    const monthCols: TableColumn<any>[] = [];
    for (let m = 0; m < 12; m++) {
      monthCols.push({
        key: `m${m}`,
        header: monthName(m).slice(0, 3),
        value: (r) => r.months[m] ?? '',
        align: 'center',
        highlight: (r) => (r.months[m] ? HIGHLIGHT.leave : null),
      });
    }

    return {
      title: 'Leave report',
      clause: 'LRP',
      subtitle: 'One row per employee with the leave taken in every month and the closing balance (LRP-2, LRP-4).',
      fileName: 'leave-report',
      filters: [
        { key: 'year', label: 'Year', type: 'text' },
        { key: 'company', label: 'Company', type: 'select', options: this.options(this.store.companies.all()) },
        { key: 'department', label: 'Department', type: 'select', options: this.options(this.store.departments.all()) },
        { key: 'workGroup', label: 'Work group', type: 'select', options: this.options(this.store.workGroups.all()) },
        { key: 'section', label: 'Section', type: 'select', options: this.options(this.store.sections.all()) },
        { key: 'employee', label: 'Employee', type: 'select', options: this.employeeOptions() },
      ],
      columns: [
        { key: 'id', header: 'ID', value: (r) => r.e.id, width: '84px' },
        { key: 'name', header: 'Name', value: (r) => r.e.fullName },
        { key: 'wg', header: 'Work group', value: (r) => this.store.workGroups.byId(r.e.workGroupId)?.name ?? '' },
        ...monthCols,
        { key: 'tot', header: 'Total days', value: (r) => r.total, align: 'right', bold: true },
        {
          key: 'bal',
          header: 'Balance',
          value: (r) => r.balance,
          align: 'right',
          bold: true,
          highlight: (r) => (r.balance <= 0 ? HIGHLIGHT.absent : null),
        },
      ],
      rows,
      summary: [
        { label: 'Employees', value: rows.length },
        { label: 'Leave days taken', value: rows.reduce((s, r) => s + r.total, 0) },
        { label: 'Total balance', value: rows.reduce((s, r) => s + r.balance, 0) },
      ],
    };
  }

  // -- ELI ------------------------------------------------------------------
  private elIndividual(): ReportDef {
    const employeeId = this.val('employee');
    const year = +(this.val('year') || yearOf(todayIso()));
    const emp = this.store.employees.byId(employeeId);
    if (!emp) {
      return {
        title: 'Earned leave — individual report',
        clause: 'ELI',
        subtitle: 'Select an employee to see the monthly earned leave statement.',
        fileName: 'el-individual',
        filters: [
          { key: 'employee', label: 'Employee', type: 'select', options: this.employeeOptions() },
          { key: 'year', label: 'Year', type: 'text' },
        ],
        columns: [],
        rows: [],
        summary: [],
      };
    }

    const projection = this.leave.earnedLeaveProjection(emp, year);
    const monthlyAccrual = Math.round((projection.earned / 12) * 100) / 100;
    const carry = this.leave.carriedForward(emp, year);
    const rows: any[] = [];
    let balance = carry;
    let totalWork = 0;
    let totalTaken = 0;
    let totalPaid = 0;

    for (let m = 0; m < 12; m++) {
      const days = daysInMonth(year, m);
      const monthStart = `${year}-${String(m + 1).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(m + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      const workDays = this.monthWorkDays(emp, year, m);
      const takenThisMonth = this.monthTaken(emp, year, m);
      const paid = this.monthPaid(emp, year, m);
      balance += monthlyAccrual - takenThisMonth - paid;
      totalWork += workDays;
      totalTaken += takenThisMonth;
      totalPaid += paid;
      rows.push({
        id: `m${m}`,
        month: monthName(m),
        workDays,
        earned: monthlyAccrual,
        taken: takenThisMonth,
        paid,
        balance: Math.round(balance * 100) / 100,
      });
    }

    return {
      title: 'Earned leave — individual report',
      clause: 'ELI',
      subtitle: `Monthly earned leave statement for ${emp.fullName} (${year}). Work days, earned, taken, paid and balance (ELI-2).`,
      fileName: 'el-individual-report',
      filters: [
        { key: 'employee', label: 'Employee', type: 'select', options: this.employeeOptions() },
        { key: 'year', label: 'Year', type: 'text' },
      ],
      columns: [
        { key: 'm', header: 'Month', value: (r) => r.month, width: '110px' },
        { key: 'wd', header: 'Work days', value: (r) => r.workDays, align: 'right' },
        { key: 'e', header: 'EL earned', value: (r) => r.earned, align: 'right' },
        { key: 't', header: 'EL taken', value: (r) => r.taken, align: 'right' },
        { key: 'p', header: 'EL paid', value: (r) => r.paid, align: 'right' },
        {
          key: 'b',
          header: 'EL balance',
          value: (r) => r.balance,
          align: 'right',
          bold: true,
          highlight: (r) => (r.balance < 0 ? HIGHLIGHT.absent : null),
        },
      ],
      rows,
      summary: [
        { label: 'Total work days', value: totalWork },
        { label: 'EL earned (year)', value: projection.earned },
        { label: 'Opening balance / carry forward', value: carry },
        { label: 'EL taken', value: totalTaken },
        { label: 'EL paid', value: totalPaid },
        { label: 'Closing balance', value: Math.round(balance * 100) / 100 },
      ],
    };
  }

  private elTypeId(): string {
    return this.store.leaveTypes.where((t) => t.code === 'EL')[0]?.id ?? '';
  }

  private monthWorkDays(emp: any, year: number, month: number): number {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
    return eachDate(start, end).filter((d) => this.dayTypeOf(emp, d) === 'Workday').length;
  }

  private monthTaken(emp: any, year: number, month: number): number {
    return this.store.leaveApplications
      .where(
        (l) =>
          l.employeeId === emp.id &&
          l.leaveTypeId === this.elTypeId() &&
          l.status === 'Settled' &&
          yearOf(l.fromDate) === year &&
          yearOf(l.fromDate) - 1 === month,
      )
      .reduce((s, l) => s + l.days, 0);
  }

  private monthPaid(emp: any, year: number, month: number): number {
    return this.store.elPayoffs
      .where((p) => p.employeeId === emp.id && p.year === year)
      .reduce((s, p) => s + p.days, 0);
  }

  private dayTypeOf(emp: any, date: string): string {
    const roster = this.store.dutyRosters.where(
      (r) =>
        r.active &&
        r.startDate <= date &&
        r.endDate >= date &&
        (r.employeeId === emp.id || (r.workGroupId === emp.workGroupId && !r.employeeId)),
    )[0];
    const cal = this.store.calendar.where((c) => c.date === date && (!c.workGroupId || c.workGroupId === emp.workGroupId))[0];
    if (cal) {
      if (cal.dayType === 'Holiday') return 'Holiday';
      if (cal.dayType === 'Adjustment') return 'Workday';
      if (cal.dayType === 'WeeklyOff') return 'Weekend';
      return 'Workday';
    }
    if (roster && !roster.weekDays.includes(new Date(date + 'T00:00:00Z').getUTCDay())) return 'Weekend';
    return 'Workday';
  }

  // -- ELD ------------------------------------------------------------------
  private elDetail(): ReportDef {
    const year = +(this.val('year') || yearOf(todayIso()));
    const emps = this.empFiltered((e) => e.active);
    const rows = emps.map((e) => {
      const projection = this.leave.earnedLeaveProjection(e, year);
      const taken = this.leave.takenByCode(e, year, 'EL');
      const paid = this.store.elPayoffs
        .where((p) => p.employeeId === e.id && p.year === year)
        .reduce((s, p) => s + p.days, 0);
      const carry = Math.min(15, Math.max(0, projection.earned - taken));
      return {
        id: e.id,
        e,
        workDays: projection.workDays,
        earned: projection.earned,
        taken,
        paid,
        carried: carry,
        balance: Math.round((projection.earned - taken - paid) * 100) / 100,
      };
    });

    return {
      title: 'Earned leave — detail report',
      clause: 'ELD',
      subtitle: `Earned leave per employee for ${year} with work days, earned, taken, paid, carried forward and balance (ELD-2).`,
      fileName: 'el-detail-report',
      filters: [
        { key: 'year', label: 'Year', type: 'text' },
        { key: 'company', label: 'Company', type: 'select', options: this.options(this.store.companies.all()) },
        { key: 'workGroup', label: 'Work group', type: 'select', options: this.options(this.store.workGroups.all()) },
        { key: 'department', label: 'Department', type: 'select', options: this.options(this.store.departments.all()) },
        { key: 'section', label: 'Section', type: 'select', options: this.options(this.store.sections.all()) },
      ],
      columns: [
        { key: 'id', header: 'Employee ID', value: (r) => r.e.id, width: '96px' },
        { key: 'name', header: 'Name', value: (r) => r.e.fullName },
        { key: 'wg', header: 'Work group', value: (r) => this.store.workGroups.byId(r.e.workGroupId)?.name ?? '' },
        { key: 'wd', header: 'Total work days', value: (r) => r.workDays, align: 'right' },
        { key: 'e', header: 'EL earned', value: (r) => r.earned, align: 'right' },
        { key: 't', header: 'EL taken', value: (r) => r.taken, align: 'right' },
        { key: 'p', header: 'EL paid', value: (r) => r.paid, align: 'right' },
        { key: 'c', header: 'EL carried forward', value: (r) => r.carried, align: 'right' },
        {
          key: 'b',
          header: 'EL balance',
          value: (r) => r.balance,
          align: 'right',
          bold: true,
          highlight: (r) => (r.balance < 0 ? HIGHLIGHT.absent : null),
        },
      ],
      rows,
      summary: [
        { label: 'Employees', value: rows.length },
        { label: 'Total work days', value: rows.reduce((s, r) => s + r.workDays, 0) },
        { label: 'EL earned', value: Math.round(rows.reduce((s, r) => s + r.earned, 0) * 10) / 10 },
        { label: 'EL taken', value: rows.reduce((s, r) => s + r.taken, 0) },
        { label: 'EL balance', value: Math.round(rows.reduce((s, r) => s + r.balance, 0) * 10) / 10 },
      ],
    };
  }
}
