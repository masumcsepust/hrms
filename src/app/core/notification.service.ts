import { Injectable, inject, signal } from '@angular/core';
import { Store } from './store';
import { ToastService } from './toast.service';
import { Employee, LeaveApplication } from './models';

export interface OutboxMail {
  id: string;
  at: string;
  to: string;
  subject: string;
  body: string;
  kind: 'leave' | 'delay' | 'payoff';
}

/**
 * NFR-3 / ESS-3 — notifications are sent without manual action.
 *
 * The application is a front end, so the messages are written to a visible
 * outbox (and to the audit trail) instead of being handed to an SMTP server.
 * The service boundary is the single place to plug a real mail gateway into.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly store = inject(Store);
  private readonly toast = inject(ToastService);

  readonly outbox = signal<OutboxMail[]>([]);

  private send(to: string, subject: string, body: string, kind: OutboxMail['kind']): void {
    const mail: OutboxMail = {
      id: `ml-${Date.now().toString(36)}-${this.outbox().length}`,
      at: new Date().toISOString(),
      to,
      subject,
      body,
      kind,
    };
    this.outbox.update((m) => [mail, ...m].slice(0, 100));
    this.store.log('Notification sent', 'Outbox', mail.id, `${subject} → ${to}`);
  }

  private emailOf(emp: Employee | undefined): string {
    return emp?.email || 'hr@hanabike.com.bd';
  }

  leaveApplied(app: LeaveApplication, emp: Employee | undefined): void {
    this.send(
      this.emailOf(emp),
      `Leave application — ${emp?.fullName ?? app.employeeId}`,
      `Application for ${app.fromDate} to ${app.toDate} (${app.days} day(s)) is waiting for approval.`,
      'leave',
    );
    this.toast.show('Approver notified by e-mail (ESS-3).', 'info');
  }

  leaveApproved(app: LeaveApplication, emp: Employee | undefined): void {
    this.send(
      this.emailOf(emp),
      `Leave approved — ${emp?.fullName ?? app.employeeId}`,
      `Your leave from ${app.fromDate} to ${app.toDate} (${app.days} day(s)) has been approved.`,
      'leave',
    );
    this.toast.show('Employee notified of the approval (ESS-3).', 'info');
  }

  leaveRejected(app: LeaveApplication, emp: Employee | undefined): void {
    this.send(
      this.emailOf(emp),
      `Leave rejected — ${emp?.fullName ?? app.employeeId}`,
      `Your leave from ${app.fromDate} to ${app.toDate} (${app.days} day(s)) has been rejected.`,
      'leave',
    );
    this.toast.show('Employee notified of the rejection (ESS-3).', 'info');
  }

  /** ATT-07 — three delays in a calendar month. */
  delayAlert(emp: Employee, count: number, month: string): void {
    this.send(
      this.emailOf(emp),
      `Delay alert — ${emp.fullName}`,
      `${count} delays were recorded for ${emp.fullName} in ${month}. Please review the attendance record.`,
      'delay',
    );
  }

  /** ERN-8 — earned leave pay-off. */
  payOff(emp: Employee, days: number, year: number): void {
    this.send(
      this.emailOf(emp),
      `Earned leave pay-off — ${emp.fullName}`,
      `${days} earned leave day(s) have been paid out for ${year}.`,
      'payoff',
    );
  }
}
