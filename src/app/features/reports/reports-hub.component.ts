import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent, IconComponent } from '../../shared/ui';

interface ReportCard {
  id: string;
  title: string;
  clause: string;
  desc: string;
  icon: string;
  link: string;
  payroll?: boolean;
}

@Component({
  selector: 'app-reports-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, IconComponent],
  template: `
    <app-page-header
      title="Report centre"
      crumb="Reports"
      subtitle="Every report filters on work group, section, company, employee and date, and exports to PDF and Excel (NFR-4)."
    />

    <div class="grid grid-3">
      @for (r of reports; track r.id) {
        <a class="card rep-card" [routerLink]="r.link">
          <div class="card-pad">
            <div class="row gap-12">
              <div class="rep-icon"><app-icon [name]="r.icon" [size]="17" /></div>
              <div class="grow">
                <div class="row gap-8">
                  <h3>{{ r.title }}</h3>
                  <span class="chip">{{ r.clause }}</span>
                </div>
                <p class="small muted mt-8">{{ r.desc }}</p>
              </div>
            </div>
            <div class="rep-foot">
              <span class="small">Open report →</span>
              @if (r.payroll) {
                <span class="chip violet">Payroll fields restricted</span>
              }
            </div>
          </div>
        </a>
      }
    </div>
  `,
  styles: [
    `
      .rep-card {
        display: block;
        color: inherit;
        transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
      }
      .rep-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow);
        border-color: var(--border-strong);
      }
      .rep-icon {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        background: var(--brand-soft);
        color: var(--brand);
        display: grid;
        place-items: center;
        flex: 0 0 36px;
      }
      .rep-foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid var(--border);
        color: var(--brand-2);
        font-weight: 600;
      }
    `,
  ],
})
export class ReportsHubComponent {
  readonly reports: ReportCard[] = [
    {
      id: 'employee-daily',
      title: 'Employee daily report',
      clause: 'EDR-1…5',
      desc: 'Date-wise attendance for all employees or a selected work group and section, with counts and export.',
      icon: 'list',
      link: '/reports/employee-daily',
    },
    {
      id: 'daily-attendance',
      title: 'Daily attendance report',
      clause: 'DAR-1…6',
      desc: 'Manpower, present count and present ratio per work group for a date or a month.',
      icon: 'gauge',
      link: '/reports/daily-attendance',
    },
    {
      id: 'punch-count',
      title: 'Daily punch count report',
      clause: 'DPC-1…4',
      desc: 'Date-wise punch records with in and out time and the number of punches; single punches are highlighted.',
      icon: 'card',
      link: '/reports/punch-count',
    },
    {
      id: 'delay-ratio',
      title: 'Employee delay ratio report',
      clause: 'DLR-1…5',
      desc: 'Delay days against total working days per employee, with the delay percentage.',
      icon: 'clock',
      link: '/reports/delay-ratio',
    },
    {
      id: 'employee-info',
      title: 'Employee information report',
      clause: 'EIR-1…6',
      desc: 'Employee master data with service length, tenure and the restricted bank and salary fields.',
      icon: 'user',
      link: '/reports/employee-info',
      payroll: true,
    },
    {
      id: 'employee-statement',
      title: 'Employee statement',
      clause: 'EST-1…6',
      desc: 'Headcount by company, work group and permanent versus temporary employees, with subtotals.',
      icon: 'building',
      link: '/reports/employee-statement',
    },
    {
      id: 'leave-report',
      title: 'Leave report',
      clause: 'LRP-1…5',
      desc: 'One row per employee with the leave taken in every month and the closing balance.',
      icon: 'plane',
      link: '/reports/leave-report',
    },
    {
      id: 'el-individual',
      title: 'Earned leave — individual',
      clause: 'ELI-1…5',
      desc: 'Monthly work days, earned leave, leave taken, pay-off and balance for one employee.',
      icon: 'calendar',
      link: '/reports/el-individual',
    },
    {
      id: 'el-detail',
      title: 'Earned leave — detail',
      clause: 'ELD-1…4',
      desc: 'Earned leave per employee with work days, earned, taken, paid, carried forward and balance.',
      icon: 'briefcase',
      link: '/reports/el-detail',
    },
    {
      id: 'job-card',
      title: 'Job card',
      clause: 'JOB-1…6',
      desc: 'Monthly attendance register for one employee with the full column set and a summary.',
      icon: 'printer',
      link: '/attendance/job-card',
    },
  ];
}
