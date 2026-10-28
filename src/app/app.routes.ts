import { Routes } from '@angular/router';
import { hrGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'setup',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/setup/setup.component').then((m) => m.SetupComponent),
  },
  {
    path: 'employees',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/employees/employee-list.component').then((m) => m.EmployeeListComponent),
  },
  {
    path: 'employees/new',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/employees/employee-form.component').then((m) => m.EmployeeFormComponent),
  },
  {
    path: 'employees/:id',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/employees/employee-form.component').then((m) => m.EmployeeFormComponent),
  },
  {
    path: 'employees/:id/id-card',
    loadComponent: () => import('./features/employees/id-card.component').then((m) => m.IdCardComponent),
  },
  {
    path: 'shift/policies',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/shift/shift-policy.component').then((m) => m.ShiftPolicyComponent),
  },
  {
    path: 'shift/roster',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/shift/duty-roster.component').then((m) => m.DutyRosterComponent),
  },
  {
    path: 'shift/calendar',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/shift/calendar.component').then((m) => m.CalendarComponent),
  },
  {
    path: 'attendance/daily',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/attendance/daily-attendance.component').then((m) => m.DailyAttendanceComponent),
  },
  {
    path: 'attendance/manual',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/attendance/manual-punch.component').then((m) => m.ManualPunchComponent),
  },
  {
    path: 'attendance/job-card',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/attendance/job-card.component').then((m) => m.JobCardComponent),
  },
  {
    path: 'leave/apply',
    loadComponent: () => import('./features/leave/leave-apply.component').then((m) => m.LeaveApplyComponent),
  },
  {
    path: 'leave/approvals',
    loadComponent: () => import('./features/leave/leave-approvals.component').then((m) => m.LeaveApprovalsComponent),
  },
  {
    path: 'leave/balance',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/leave/leave-balance.component').then((m) => m.LeaveBalanceComponent),
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/reports-hub.component').then((m) => m.ReportsHubComponent),
  },
  {
    path: 'reports/:id',
    loadComponent: () => import('./features/reports/report-page.component').then((m) => m.ReportPageComponent),
  },
  {
    path: 'self/profile',
    loadComponent: () => import('./features/self-service/my-profile.component').then((m) => m.MyProfileComponent),
  },
  {
    path: 'self/leave',
    loadComponent: () => import('./features/self-service/my-leave.component').then((m) => m.MyLeaveComponent),
  },
  {
    path: 'audit',
    canActivate: [hrGuard],
    loadComponent: () => import('./features/audit/audit-log.component').then((m) => m.AuditLogComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
