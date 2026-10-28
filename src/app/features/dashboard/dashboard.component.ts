import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../core/store';
import { AttendanceService } from '../../core/attendance.service';
import { AuthService } from '../../core/auth';
import { PageHeaderComponent, KpiComponent, ChipComponent, EmptyComponent, IconComponent } from '../../shared/ui';
import { todayIso, weekdayOf, WEEKDAY_LONG, monthName } from '../../core/calc';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, KpiComponent, ChipComponent, EmptyComponent, IconComponent],
  template: `
    <app-page-header title="Dashboard" [crumb]="'Overview'">
      <div class="titles-note muted small">{{ todayLabel }}</div>
      <span actions>
        <button class="btn btn-sm" (click)="store.reset(); refresh()">
          <app-icon name="refresh" [size]="14" /> Refresh demo data
        </button>
      </span>
    </app-page-header>

    <!-- DSH-1 / DSH-2 / DSH-3 / DSH-4 -->
    <div class="grid grid-4">
      <app-kpi label="Total active employees" [value]="activeTotal()" foot="DSH-1 — active only" />
      <app-kpi label="Present today" [value]="presentTotal()" color="#0b8a5a" foot="DSH-2" />
      <app-kpi label="On leave today" [value]="leaveTotal()" color="#1c64c8" foot="DSH-2" />
      <app-kpi label="Absent today" [value]="absentTotal()" color="#c53030" foot="DSH-3 — informed + not informed" />
    </div>

    <div class="grid grid-2 mt-16">
      <div class="card">
        <div class="card-head">
          <h3>Headcount by company</h3>
          <span class="chip brand">DSH-1</span>
        </div>
        <div class="card-pad">
          @for (row of byCompany(); track row.company) {
            <div class="hbar">
              <div class="hbar-label">
                <span>{{ row.company }}</span>
                <b>{{ row.count }}</b>
              </div>
              <div class="bar">
                <i [style.width.%]="row.pct" [style.background]="row.color"></i>
              </div>
            </div>
          }
          <div class="divider"></div>
          <div class="row-between small">
            <span class="muted">Total active</span><b>{{ activeTotal() }}</b>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Day status by company</h3>
          <span class="chip brand">DSH-2</span>
        </div>
        <div class="card-pad">
          @for (row of statusByCompany(); track row.company) {
            <div class="stat-row">
              <div class="stat-name">{{ row.company }}</div>
              <div class="stat-bar">
                @if (row.total) {
                  <i class="present" [style.width.%]="(row.present / row.total) * 100"></i>
                  <i class="leave" [style.width.%]="(row.leave / row.total) * 100"></i>
                }
              </div>
              <div class="stat-nums small">
                <span class="ok-text">{{ row.present }}</span>
                <span class="muted">/</span>
                <span class="info-text">{{ row.leave }}</span>
                <span class="muted">of {{ row.total }}</span>
              </div>
            </div>
          }
          <div class="legend mt-8">
            <span><i class="swatch" style="background: #0b8a5a"></i>Present</span>
            <span><i class="swatch" style="background: #1c64c8"></i>On leave</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 mt-16">
      <div class="card">
        <div class="card-head">
          <h3>Absence today</h3>
          <span class="chip brand">DSH-3</span>
        </div>
        <div class="card-pad">
          <div class="grid grid-2">
            <div class="mini-stat">
              <span class="mini-label">Informed</span>
              <span class="mini-value" style="color: #b7791f">{{ informedAbsent().length }}</span>
              <span class="small muted">approved leave / notified</span>
            </div>
            <div class="mini-stat">
              <span class="mini-label">Not informed</span>
              <span class="mini-value" style="color: #c53030">{{ uninformedAbsent().length }}</span>
              <span class="small muted">no record at all</span>
            </div>
          </div>
          <div class="divider"></div>
          @if (!absentList().length) {
            <app-empty text="No absence recorded for today" />
          } @else {
            <div class="abs-list">
              @for (a of absentList(); track a.emp.id) {
                <div class="abs-row">
                  <span class="mono">{{ a.emp.id }}</span>
                  <span class="grow">{{ a.emp.fullName }}</span>
                  <app-chip [kind]="a.informed ? 'warn' : 'danger'">
                    {{ a.informed ? 'Informed' : 'Not informed' }}
                  </app-chip>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Separations — {{ monthLabel }}</h3>
          <span class="chip brand">DSH-4</span>
        </div>
        <div class="card-pad">
          <div class="grid grid-3">
            <div class="mini-stat">
              <span class="mini-label">Resigned</span>
              <span class="mini-value">{{ sepCounts()['Resigned'] }}</span>
            </div>
            <div class="mini-stat">
              <span class="mini-label">Released</span>
              <span class="mini-value">{{ sepCounts()['Released'] }}</span>
            </div>
            <div class="mini-stat">
              <span class="mini-label">Normal separation</span>
              <span class="mini-value">{{ sepCounts()['Normal Separation'] }}</span>
            </div>
          </div>
          <div class="divider"></div>
          <div class="small muted mb-8">Separated employees are not deactivated automatically (EMP-9).</div>
          @if (!separationList().length) {
            <app-empty text="No separation recorded this month" />
          } @else {
            <div class="abs-list">
              @for (s of separationList(); track s.id) {
                <div class="abs-row">
                  <span class="mono">{{ s.id }}</span>
                  <span class="grow">{{ s.fullName }}</span>
                  <span class="small muted">{{ s.separation!.date }}</span>
                  <app-chip [kind]="s.separation!.type === 'Released' ? 'danger' : 'info'">
                    {{ s.separation!.type }}
                  </app-chip>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .titles-note {
        display: none;
      }
      .hbar {
        margin-bottom: 12px;
      }
      .hbar-label {
        display: flex;
        justify-content: space-between;
        font-size: 12.5px;
        margin-bottom: 5px;
      }
      .hbar-label b {
        font-size: 13px;
      }
      .stat-row {
        display: grid;
        grid-template-columns: 150px 1fr 130px;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .stat-name {
        font-size: 12.5px;
        font-weight: 550;
      }
      .stat-bar {
        display: flex;
        height: 9px;
        border-radius: 999px;
        background: var(--surface-3);
        overflow: hidden;
      }
      .stat-bar i.present {
        background: #0b8a5a;
      }
      .stat-bar i.leave {
        background: #1c64c8;
      }
      .stat-nums {
        text-align: right;
        white-space: nowrap;
      }
      .ok-text {
        color: var(--ok);
        font-weight: 650;
      }
      .info-text {
        color: var(--info);
        font-weight: 650;
      }
      .mini-stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 11px 13px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--surface-2);
      }
      .mini-label {
        font-size: 11.5px;
        color: var(--muted);
        font-weight: 600;
      }
      .mini-value {
        font-size: 22px;
        font-weight: 680;
      }
      .abs-list {
        max-height: 210px;
        overflow: auto;
      }
      .abs-row {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 6px 0;
        border-bottom: 1px dashed var(--border);
        font-size: 12.5px;
      }
      .abs-row:last-child {
        border-bottom: none;
      }
    `,
  ],
})
export class DashboardComponent {
  readonly store = inject(Store);
  private readonly attendance = inject(AttendanceService);
  private readonly auth = inject(AuthService);

  readonly today = todayIso();
  readonly todayLabel = `${WEEKDAY_LONG[weekdayOf(this.today)]}, ${this.today}`;
  readonly monthLabel = monthName(Number(this.today.slice(5, 7)) - 1);

  readonly activeTotal = computed(() => this.store.activeEmployees().length);

  readonly byCompany = computed(() => {
    const total = this.activeTotal() || 1;
    const colors = ['#2d5aa0', '#0b8a5a', '#b7791f', '#6b3fa0'];
    return this.store.companies
      .all()
      .filter((c) => c.active)
      .map((c, i) => {
        const count = this.store
          .activeEmployees()
          .filter((e) => e.companyId === c.id).length;
        return {
          company: c.name,
          count,
          pct: Math.round((count / total) * 100),
          color: colors[i % colors.length],
        };
      });
  });

  /** DSH-2 — present / on leave, total and company wise. */
  readonly dayRows = computed(() => {
    const emps = this.store.activeEmployees();
    return emps.map((e) => ({ emp: e, day: this.attendance.dayFor(e, this.today) }));
  });

  readonly presentTotal = computed(
    () => this.dayRows().filter((r) => r.day.status === 'Present').length,
  );
  readonly leaveTotal = computed(
    () => this.dayRows().filter((r) => r.day.status === 'On Leave').length,
  );
  readonly absentTotal = computed(
    () => this.dayRows().filter((r) => r.day.status === 'Absent').length,
  );

  readonly statusByCompany = computed(() =>
    this.store.companies
      .all()
      .filter((c) => c.active)
      .map((c) => {
        const rows = this.dayRows().filter((r) => r.emp.companyId === c.id);
        return {
          company: c.name,
          present: rows.filter((r) => r.day.status === 'Present').length,
          leave: rows.filter((r) => r.day.status === 'On Leave').length,
          total: rows.length,
        };
      }),
  );

  /** DSH-3 — informed (approved leave on file) vs not informed. */
  readonly absentList = computed(() =>
    this.dayRows()
      .filter((r) => r.day.status === 'Absent')
      .map((r) => ({
        emp: r.emp,
        // informed = the employee has a leave record on file for the day
        // (applied, approved, LWP or CNL); no record at all = not informed
        informed: this.store.leaveApplications.all().some(
          (l) =>
            l.employeeId === r.emp.id &&
            l.fromDate <= this.today &&
            l.toDate >= this.today,
        ),
      })),
  );
  readonly informedAbsent = computed(() => this.absentList().filter((a) => a.informed));
  readonly uninformedAbsent = computed(() => this.absentList().filter((a) => !a.informed));

  /** DSH-4 — separations of the current month. */
  readonly separationList = computed(() => {
    const month = this.today.slice(0, 7);
    return this.store
      .separatedEmployees()
      .filter((e) => e.separation && e.separation.date.startsWith(month));
  });

  readonly sepCounts = computed(() => {
    const c: Record<string, number> = {
      Resigned: 0,
      Released: 0,
      'Normal Separation': 0,
    };
    for (const s of this.separationList()) {
      const t = s.separation!.type as keyof typeof c;
      c[t] = (c[t] ?? 0) + 1;
    }
    return c;
  });

  refresh(): void {
    /* signals re-evaluate automatically */
  }
}
