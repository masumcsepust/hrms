import { Injectable, computed, inject } from '@angular/core';
import { Store } from './store';
import { Employee, ID } from './models';

export type Permission =
  | 'hr.manage'
  | 'payroll.view'
  | 'leave.apply'
  | 'leave.approve'
  | 'leave.manage'
  | 'self.view';

/**
 * NFR-1 / NFR-8 — role based access.
 *  HR         : full master data, attendance, leave processing, reports
 *  Payroll    : HR + the restricted salary and bank fields
 *  Employee   : own profile and own leave only
 *  Approver   : approve or reject leave
 *  Management : prior approval for LWP / CNL
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  HR: ['hr.manage', 'leave.manage', 'leave.approve', 'leave.apply', 'self.view'],
  Payroll: [
    'hr.manage',
    'payroll.view',
    'leave.manage',
    'leave.approve',
    'leave.apply',
    'self.view',
  ],
  Employee: ['leave.apply', 'self.view'],
  Approver: ['leave.approve', 'leave.apply', 'self.view'],
  Management: ['leave.approve', 'leave.apply', 'self.view'],
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(Store);

  readonly user = this.store.currentUser;
  readonly role = computed(() => this.user()?.role ?? 'Employee');

  readonly permissions = computed(() => ROLE_PERMISSIONS[this.role()] ?? []);

  readonly can = (p: Permission) => this.permissions().includes(p);

  /** NFR-8 — restricted payroll fields. */
  readonly canViewPayroll = computed(() => this.can('payroll.view'));

  /** The employee record linked to the logged-in user (self-service). */
  readonly linkedEmployee = computed<Employee | undefined>(() => {
    const u = this.user();
    if (!u?.employeeId) return undefined;
    return this.store.employeesById().get(u.employeeId);
  });

  /** Employees visible to the current user. */
  visibleEmployees(): Employee[] {
    if (this.can('hr.manage')) return this.store.employees.all();
    const me = this.linkedEmployee();
    return me ? [me] : [];
  }

  canAccessEmployee(id: ID): boolean {
    if (this.can('hr.manage')) return true;
    return this.linkedEmployee()?.id === id;
  }
}
