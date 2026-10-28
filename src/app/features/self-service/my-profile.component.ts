import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { AuthService } from '../../core/auth';
import { LeaveService } from '../../core/leave.service';
import { AttendanceService } from '../../core/attendance.service';
import { PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent } from '../../shared/ui';
import { calcTenure, todayIso, yearOf } from '../../core/calc';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, ChipComponent, IconComponent, EmptyComponent],
  template: `
    @if (emp(); as e) {
      <app-page-header title="My profile" crumb="Self service" [subtitle]="e.id + ' · ' + e.fullName">
        <span actions>
          <a class="btn btn-sm" routerLink="/self/leave"><app-icon name="plane" [size]="14" /> My leave</a>
        </span>
      </app-page-header>

      @if (delayAlert(); as d) {
        <div class="alert-banner">
          <app-icon name="bell" [size]="16" />
          <div>
            <b>Delay alert (ATT-07)</b> — {{ d.count }} delays were recorded in {{ d.month }}.
            The alert has been sent to your e-mail address.
          </div>
        </div>
      }

      <div class="grid" style="grid-template-columns: 300px 1fr; align-items: start">
        <div class="card">
          <div class="photo">
            @if (e.photo) {
              <img [src]="e.photo" alt="" />
            } @else {
              <span>{{ initials() }}</span>
            }
          </div>
          <div class="card-pad center">
            <h2>{{ e.fullName }}</h2>
            <p class="muted small mt-8">{{ designation() }}</p>
            <div class="row gap-8 mt-12" style="justify-content: center">
              <app-chip [kind]="e.active ? 'ok' : ''">{{ e.active ? 'Active' : 'Inactive' }}</app-chip>
              <app-chip kind="brand">{{ groupType() }}</app-chip>
            </div>
            <div class="divider"></div>
            <div class="row-between small">
              <span class="muted">Employee ID</span><b class="mono">{{ e.id }}</b>
            </div>
            <div class="row-between small mt-8">
              <span class="muted">Joining date</span><b>{{ e.joiningDate }}</b>
            </div>
            <div class="row-between small mt-8">
              <span class="muted">Tenure</span><b>{{ tenure() }}</b>
            </div>
            <div class="row-between small mt-8">
              <span class="muted">Company</span><b>{{ company() }}</b>
            </div>
            <div class="row-between small mt-8">
              <span class="muted">Department</span><b>{{ department() }}</b>
            </div>
            <div class="row-between small mt-8">
              <span class="muted">Section</span><b>{{ section() }}</b>
            </div>
            <div class="row-between small mt-8">
              <span class="muted">Designation</span><b>{{ designation() }}</b>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="tabs">
              <button class="tab" [class.active]="tab() === 'contact'" (click)="tab.set('contact')">Contact</button>
              <button class="tab" [class.active]="tab() === 'education'" (click)="tab.set('education')">Education</button>
              <button class="tab" [class.active]="tab() === 'other'" (click)="tab.set('other')">Other information</button>
              <button class="tab" [class.active]="tab() === 'leave'" (click)="tab.set('leave')">Leave summary</button>
            </div>
            <div class="card-pad">
              @if (tab() === 'contact') {
                <div class="grid grid-2">
                  <div class="row-between small"><span class="muted">Phone</span><b>{{ e.phone || '—' }}</b></div>
                  <div class="row-between small"><span class="muted">Emergency phone</span><b>{{ e.emergencyPhone || '—' }}</b></div>
                  <div class="row-between small"><span class="muted">Email</span><b>{{ e.email || '—' }}</b></div>
                  <div class="row-between small"><span class="muted">Date of birth</span><b>{{ e.dob || '—' }}</b></div>
                  <div class="row-between small span2"><span class="muted">Present address</span><b class="right">{{ e.presentAddress || '—' }}</b></div>
                  <div class="row-between small span2"><span class="muted">Permanent address</span><b class="right">{{ e.permanentAddress || '—' }}</b></div>
                </div>
              } @else if (tab() === 'education') {
                <div class="row-between small"><span class="muted">Degree</span><b>{{ e.degree || '—' }}</b></div>
                <div class="row-between small mt-12"><span class="muted">Institute / University</span><b>{{ e.institute || '—' }}</b></div>
              } @else if (tab() === 'other') {
                <div class="row-between small"><span class="muted">Gender</span><b>{{ e.gender || '—' }}</b></div>
                <div class="row-between small mt-12"><span class="muted">Marital status</span><b>{{ e.maritalStatus || '—' }}</b></div>
                <div class="row-between small mt-12"><span class="muted">NID</span><b class="mono">{{ e.nid || '—' }}</b></div>
                <div class="row-between small mt-12"><span class="muted">Employee type</span><b>{{ empType() }}</b></div>
                <div class="row-between small mt-12"><span class="muted">Applicable leave types</span><b>{{ leaveTypes() }}</b></div>
              } @else {
                <div class="grid grid-2">
                  @for (b of balances(); track b.leaveTypeId) {
                    <div class="bal">
                      <span class="bal-name">{{ b.name }}</span>
                      <span class="bal-val">{{ b.balance }}<small>days</small></span>
                      <span class="bal-meta">entitlement {{ b.entitlement }} · used {{ b.used }}</span>
                    </div>
                  }
                </div>
                <div class="hint mt-12">
                  ESS-4 — leave summary for {{ balanceYear }}. A zero balance means the type is not normally
                  applicable; LWP or CNL needs prior management approval (LVE-5, LVE-6).
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    } @else {
      <app-page-header title="My profile" crumb="Self service" />
      <div class="card card-pad">
        <app-empty
          text="This login is not linked to an employee record"
          hint="Switch to a user linked with an employee from the header to see the self-service view."
        />
      </div>
    }
  `,
  styles: [
    `
      .photo {
        height: 210px;
        background: var(--surface-3);
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      .photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .photo span {
        font-size: 58px;
        font-weight: 700;
        color: var(--border-strong);
      }
      .center {
        text-align: center;
      }
      .bal {
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        background: var(--surface-2);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .bal-name {
        font-size: 12px;
        color: var(--muted);
        font-weight: 650;
      }
      .bal-val {
        font-size: 22px;
        font-weight: 680;
      }
      .bal-val small {
        font-size: 11px;
        color: var(--muted);
        margin-left: 4px;
      }
      .bal-meta {
        font-size: 11px;
        color: var(--muted);
      }
      .span2 {
        grid-column: span 2;
      }
      .alert-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 14px;
        margin-bottom: 12px;
        border-radius: var(--radius-sm);
        background: var(--warn-soft);
        border: 1px solid #f0dcae;
        color: #8a5a12;
        font-size: 12.8px;
      }
    `,
  ],
})
export class MyProfileComponent {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly leave = inject(LeaveService);
  private readonly attendance = inject(AttendanceService);

  readonly tab = signal('contact');

  /** ATT-07 — three delays in a calendar month raise a profile alert. */
  readonly delayAlert = computed(() => {
    const e = this.emp();
    if (!e) return null;
    const res = this.attendance.delayAlertState(e);
    return res.alert ? res : null;
  });

  constructor() {
    effect(() => {
      const e = this.emp();
      if (e) untracked(() => this.attendance.raiseDelayAlert(e));
    });
  }
  readonly emp = computed(() => this.auth.linkedEmployee());

  readonly balanceYear = yearOf(todayIso());
  readonly balances = computed(() => {
    const e = this.emp();
    return e ? this.leave.balance(e, this.balanceYear) : [];
  });

  initials(): string {
    return (this.emp()?.fullName ?? '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase();
  }

  designation = computed(() => this.store.designations.byId(this.emp()?.designationId)?.name ?? '—');
  department = computed(() => this.store.departments.byId(this.emp()?.departmentId)?.name ?? '—');
  section = computed(() => this.store.sections.byId(this.emp()?.sectionId)?.name ?? '—');
  company = computed(() => this.store.companies.byId(this.emp()?.companyId)?.name ?? '—');
  empType = computed(() => this.store.employeeTypes.byId(this.emp()?.employeeTypeId)?.name ?? '—');
  groupType = computed(() => this.store.workGroups.byId(this.emp()?.workGroupId)?.groupType ?? '—');
  tenure = computed(() => {
    const e = this.emp();
    if (!e) return '—';
    return calcTenure(e.joiningDate, e.separation?.date ?? todayIso()).label;
  });
  leaveTypes = computed(
    () =>
      this.store.leaveTypes
        .where((t) => !!this.emp()?.leaveTypeIds.includes(t.id))
        .map((t) => t.name)
        .join(', ') || '—',
  );
}
