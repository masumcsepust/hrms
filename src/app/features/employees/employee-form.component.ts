import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { AuthService } from '../../core/auth';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, IconComponent } from '../../shared/ui';
import { Employee, SeparationType } from '../../core/models';
import { AttendanceService } from '../../core/attendance.service';
import { todayIso } from '../../core/calc';

const TABS = [
  { key: 'base', label: 'Base data' },
  { key: 'separation', label: 'Separation' },
  { key: 'leave', label: 'Leave types' },
  { key: 'education', label: 'Education' },
  { key: 'contact', label: 'Contact' },
  { key: 'other', label: 'Other information' },
  { key: 'payroll', label: 'Payroll information' },
];

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, ChipComponent, IconComponent],
  template: `
    <app-page-header
      [title]="isNew ? 'New employee' : (model.fullName || 'Employee')"
      crumb="People / Employees"
      [subtitle]="isNew ? 'Create an employee record (EMP-1)' : 'Employee ID ' + model.id"
    >
      <span actions>
        <a class="btn btn-sm" routerLink="/employees">← Back to list</a>
        @if (!isNew) {
          <a class="btn btn-sm" [routerLink]="['/employees', model.id, 'id-card']">
            <app-icon name="printer" [size]="14" /> ID card
          </a>
        }
        <button class="btn btn-primary btn-sm" (click)="save()">Save employee</button>
      </span>
    </app-page-header>

    @if (delayAlert(); as d) {
      <div class="alert-banner">
        <app-icon name="bell" [size]="16" />
        <div>
          <b>Delay alert (ATT-07)</b> — {{ d.count }} delays were recorded in {{ d.month }} for this
          employee. The alert has been sent to the e-mail address on file.
        </div>
      </div>
    }

    <div class="card">
      <div class="tabs">
        @for (t of tabs; track t.key) {
          <button class="tab" [class.active]="tab() === t.key" (click)="tab.set(t.key)">
            {{ t.label }}
            @if (t.key === 'payroll' && !auth.canViewPayroll()) {
              <app-icon name="shield" [size]="12" />
            }
          </button>
        }
      </div>

      <div class="card-pad">
        <!-- ================= BASE DATA ================= -->
        @if (tab() === 'base') {
          <div class="split">
            <div class="photo-box">
              <div class="photo">
                @if (model.photo) {
                  <img [src]="model.photo" alt="Employee photo" />
                } @else {
                  <span class="ph">{{ initials() }}</span>
                }
              </div>
              <label class="btn btn-sm mt-8">
                <app-icon name="plus" [size]="13" /> Upload photo
                <input type="file" accept="image/*" hidden (change)="onPhoto($event)" />
              </label>
              <div class="hint mt-8">JPG or PNG, stored with the record.</div>
            </div>

            <div class="grid grid-2">
              <div class="field">
                <label class="label req">Employee ID</label>
                <input type="text" class="mono" [class.invalid]="bad('id')" [value]="model.id"
                  (input)="model.id = $any($event.target).value" placeholder="HB-1001" />
                @if (bad('id')) {
                  <span class="error-text">{{ errors()['id'] }}</span>
                } @else {
                  <span class="hint">Manual entry, must be unique (EMP-2).</span>
                }
              </div>

              <div class="field">
                <label class="label req">Full name</label>
                <input type="text" [class.invalid]="bad('fullName')" [value]="model.fullName"
                  (input)="model.fullName = $any($event.target).value" />
                @if (bad('fullName')) {
                  <span class="error-text">{{ errors()['fullName'] }}</span>
                }
              </div>

              <div class="field">
                <label class="label">Date of birth</label>
                <input type="date" [value]="model.dob" (input)="model.dob = $any($event.target).value" />
              </div>

              <div class="field">
                <label class="label">Gender</label>
                <select [value]="model.gender" (change)="model.gender = $any($event.target).value">
                  <option value="">— select —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div class="field">
                <label class="label req">Company</label>
                <select [class.invalid]="bad('companyId')" [value]="model.companyId"
                  (change)="model.companyId = $any($event.target).value">
                  <option value="">— select —</option>
                  @for (c of store.companies.all(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
                @if (bad('companyId')) {
                  <span class="error-text">{{ errors()['companyId'] }}</span>
                }
              </div>

              <div class="field">
                <label class="label req">Employee type</label>
                <select [class.invalid]="bad('employeeTypeId')" [value]="model.employeeTypeId"
                  (change)="model.employeeTypeId = $any($event.target).value">
                  <option value="">— select —</option>
                  @for (t of store.employeeTypes.all(); track t.id) {
                    <option [value]="t.id">{{ t.name }}</option>
                  }
                </select>
                @if (bad('employeeTypeId')) {
                  <span class="error-text">{{ errors()['employeeTypeId'] }}</span>
                }
              </div>

              <div class="field">
                <label class="label req">Department</label>
                <select [class.invalid]="bad('departmentId')" [value]="model.departmentId"
                  (change)="model.departmentId = $any($event.target).value">
                  <option value="">— select —</option>
                  @for (d of store.departments.all(); track d.id) {
                    <option [value]="d.id">{{ d.name }}</option>
                  }
                </select>
              </div>

              <div class="field">
                <label class="label req">Section</label>
                <select [class.invalid]="bad('sectionId')" [value]="model.sectionId"
                  (change)="model.sectionId = $any($event.target).value">
                  <option value="">— select —</option>
                  @for (s of store.sections.all(); track s.id) {
                    <option [value]="s.id">{{ s.name }}</option>
                  }
                </select>
              </div>

              <div class="field">
                <label class="label req">Designation</label>
                <select [class.invalid]="bad('designationId')" [value]="model.designationId"
                  (change)="model.designationId = $any($event.target).value">
                  <option value="">— select —</option>
                  @for (d of store.designations.all(); track d.id) {
                    <option [value]="d.id">{{ d.name }}</option>
                  }
                </select>
              </div>

              <div class="field">
                <label class="label req">Joining date</label>
                <input type="date" [class.invalid]="bad('joiningDate')" [value]="model.joiningDate"
                  (input)="model.joiningDate = $any($event.target).value" />
                @if (bad('joiningDate')) {
                  <span class="error-text">{{ errors()['joiningDate'] }}</span>
                }
              </div>

              <div class="field">
                <label class="label req">Work group</label>
                <select [class.invalid]="bad('workGroupId')" [value]="model.workGroupId"
                  (change)="model.workGroupId = $any($event.target).value">
                  <option value="">— select —</option>
                  @for (w of store.workGroups.all(); track w.id) {
                    <option [value]="w.id">{{ w.name }} ({{ w.groupType }})</option>
                  }
                </select>
                @if (bad('workGroupId')) {
                  <span class="error-text">{{ errors()['workGroupId'] }}</span>
                } @else {
                  <span class="hint">
                    The work group drives the default shift; an individual roster overrides it (EMP-4).
                  </span>
                }
              </div>

              <div class="field">
                <label class="label">Active</label>
                <label class="check" style="height: 34px">
                  <input type="checkbox" [checked]="model.active" (change)="model.active = $any($event.target).checked" />
                  {{ model.active ? 'Employee is active' : 'Employee is inactive' }}
                </label>
              </div>
            </div>
          </div>
        }

        <!-- ================= SEPARATION ================= -->
        @if (tab() === 'separation') {
          <div class="grid grid-2">
            <div class="field">
              <label class="label">Separation type</label>
              <div class="radio-row">
                @for (t of sepTypes; track t) {
                  <label class="check">
                    <input type="radio" name="sep" [value]="t" [checked]="sepType() === t"
                      (change)="setSepType(t)" />
                    {{ t }}
                  </label>
                }
              </div>
              <span class="hint">EMP-6 — select or radio.</span>
            </div>

            <div class="field">
              <label class="label">Separation date</label>
              <input type="date" [value]="sepDate()" (input)="setSepDate($any($event.target).value)" />
            </div>

            <div class="field span2">
              <label class="label">Separation comment / reason</label>
              <textarea [value]="sepComment()" (input)="setSepComment($any($event.target).value)"
                placeholder="Reason for the separation"></textarea>
            </div>
          </div>

          <div class="divider"></div>

          <div class="notice">
            <div>
              <b>EMP-9 —</b> recording a separation does not deactivate the employee automatically.
            </div>
            <div class="mt-8 row gap-8">
              <button class="btn btn-sm" (click)="setActive(!model.active)">
                {{ model.active ? 'Deactivate employee' : 'Reactivate employee' }}
              </button>
              @if (model.separation) {
                <button class="btn btn-sm btn-danger" (click)="clearSeparation()">Clear separation</button>
              }
              <app-chip [kind]="model.active ? 'ok' : ''">{{ model.active ? 'Active' : 'Inactive' }}</app-chip>
            </div>
          </div>
        }

        <!-- ================= LEAVE ================= -->
        @if (tab() === 'leave') {
          <div class="field" style="max-width: 520px">
            <label class="label">Applicable leave types</label>
            <div class="check-list">
              @for (lt of store.leaveTypes.all(); track lt.id) {
                <label class="check">
                  <input type="checkbox" [checked]="model.leaveTypeIds.includes(lt.id)"
                    (change)="toggleLeave(lt.id)" />
                  {{ lt.name }}
                  <span class="small muted">
                    @if (lt.calculated) {
                      calculated (ERN-3)
                    } @else {
                      {{ lt.annualDays }} days / year
                    }
                  </span>
                </label>
              }
            </div>
            <span class="hint">EMP-3 — leave types come from the setup list.</span>
          </div>
        }

        <!-- ================= EDUCATION ================= -->
        @if (tab() === 'education') {
          <div class="grid grid-2">
            <div class="field">
              <label class="label">Degree</label>
              <input type="text" list="degree-list" [value]="model.degree"
                (input)="model.degree = $any($event.target).value" placeholder="Graduation / Masters / Other" />
              <datalist id="degree-list">
                <option value="Graduation"></option>
                <option value="Masters"></option>
                <option value="Higher Secondary"></option>
                <option value="Other"></option>
              </datalist>
            </div>
            <div class="field">
              <label class="label">Institute / University</label>
              <input type="text" [value]="model.institute" (input)="model.institute = $any($event.target).value" />
            </div>
          </div>
        }

        <!-- ================= CONTACT ================= -->
        @if (tab() === 'contact') {
          <div class="grid grid-2">
            <div class="field">
              <label class="label">Phone</label>
              <input type="text" [value]="model.phone" (input)="model.phone = $any($event.target).value" />
            </div>
            <div class="field">
              <label class="label">Emergency phone</label>
              <input type="text" [value]="model.emergencyPhone"
                (input)="model.emergencyPhone = $any($event.target).value" />
            </div>
            <div class="field">
              <label class="label">Email</label>
              <input type="email" [class.invalid]="bad('email')" [value]="model.email"
                (input)="model.email = $any($event.target).value" />
              @if (bad('email')) {
                <span class="error-text">{{ errors()['email'] }}</span>
              }
            </div>
            <div class="field">
              <label class="label">Present address</label>
              <input type="text" [value]="model.presentAddress"
                (input)="model.presentAddress = $any($event.target).value" />
            </div>
            <div class="field span2">
              <label class="label">Permanent address</label>
              <input type="text" [value]="model.permanentAddress"
                (input)="model.permanentAddress = $any($event.target).value" />
            </div>
          </div>
        }

        <!-- ================= OTHER ================= -->
        @if (tab() === 'other') {
          <div class="grid grid-2">
            <div class="field">
              <label class="label">Marital status</label>
              <select [value]="model.maritalStatus" (change)="model.maritalStatus = $any($event.target).value">
                <option value="">— select —</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
            <div class="field">
              <label class="label">NID</label>
              <input type="text" class="mono" [class.invalid]="bad('nid')" [value]="model.nid"
                (input)="model.nid = $any($event.target).value" />
              @if (bad('nid')) {
                <span class="error-text">{{ errors()['nid'] }}</span>
              } @else {
                <span class="hint">Basic NID validation — 10 digits.</span>
              }
            </div>
            <div class="field">
              <label class="label">Reference by</label>
              <input type="text" list="ref-list" [value]="model.referenceBy"
                (input)="model.referenceBy = $any($event.target).value" />
              <datalist id="ref-list">
                @for (e of store.employees.all(); track e.id) {
                  <option [value]="e.id + ' — ' + e.fullName"></option>
                }
              </datalist>
            </div>
            <div class="field">
              <label class="label">Reference remark</label>
              <input type="text" [value]="model.referenceRemark"
                (input)="model.referenceRemark = $any($event.target).value" />
            </div>
          </div>
        }

        <!-- ================= PAYROLL (restricted) ================= -->
        @if (tab() === 'payroll') {
          @if (!auth.canViewPayroll()) {
            <div class="notice warn">
              <b>NFR-8 —</b> bank and salary fields are visible only to users holding the payroll-authorised
              permission. Switch to a payroll-authorised user from the header to view them.
            </div>
          } @else {
            <div class="grid grid-2">
              <div class="field">
                <label class="label">Bank account no</label>
                <input type="text" class="mono" [value]="model.bankAccountNo"
                  (input)="model.bankAccountNo = $any($event.target).value" />
              </div>
              <div class="field"></div>
              <div class="field">
                <label class="label">Joining salary</label>
                <input type="number" [value]="model.joiningSalary"
                  (input)="model.joiningSalary = +$any($event.target).value" />
              </div>
              <div class="field">
                <label class="label">Present salary</label>
                <input type="number" [value]="model.presentSalary"
                  (input)="model.presentSalary = +$any($event.target).value" />
              </div>
            </div>
            <div class="hint mt-12">
              EMP-11 / NFR-9 — edits to these fields are written to the audit trail.
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .split {
        display: grid;
        grid-template-columns: 190px 1fr;
        gap: 22px;
      }
      .photo-box {
        text-align: center;
      }
      .photo {
        width: 170px;
        height: 200px;
        border-radius: var(--radius);
        border: 1px dashed var(--border-strong);
        background: var(--surface-2);
        display: grid;
        place-items: center;
        overflow: hidden;
        margin: 0 auto;
      }
      .photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .ph {
        font-size: 40px;
        font-weight: 700;
        color: var(--border-strong);
      }
      .radio-row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        padding: 7px 0;
      }
      .check-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 0;
      }
      .notice {
        padding: 12px 14px;
        border-radius: var(--radius-sm);
        background: var(--info-soft);
        border: 1px solid #c3d9f5;
        color: #1b4a86;
        font-size: 12.8px;
      }
      .notice.warn {
        background: var(--warn-soft);
        border-color: #f0dcae;
        color: #8a5a12;
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
      @media (max-width: 900px) {
        .split {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class EmployeeFormComponent {
  readonly store = inject(Store);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly attendance = inject(AttendanceService);

  readonly tabs = TABS;
  readonly sepTypes: SeparationType[] = ['Resigned', 'Released', 'Normal Separation'];
  readonly tab = signal('base');
  readonly isNew = !this.route.snapshot.paramMap.get('id');
  readonly errors = signal<Record<string, string>>({});

  /** ATT-07 — three delays in a calendar month raise an alert. */
  readonly delayAlert = computed(() => {
    const e = this.store.employees.byId(this.model.id);
    if (!e) return null;
    const res = this.attendance.delayAlertState(e);
    return res.alert ? res : null;
  });

  model: any = this.blank();

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const found = this.store.employees.byId(id);
      if (found) this.model = { ...this.blank(), ...found };
    }
    effect(() => {
      const e = this.store.employees.byId(this.model.id);
      if (e) untracked(() => this.attendance.raiseDelayAlert(e));
    });
  }

  private blank() {
    return {
      id: '',
      fullName: '',
      photo: null as string | null,
      dob: '',
      gender: '',
      companyId: '',
      employeeTypeId: '',
      departmentId: '',
      sectionId: '',
      designationId: '',
      joiningDate: '',
      workGroupId: '',
      active: true,
      separation: null as any,
      leaveTypeIds: [] as string[],
      degree: '',
      institute: '',
      phone: '',
      emergencyPhone: '',
      email: '',
      presentAddress: '',
      permanentAddress: '',
      maritalStatus: '',
      nid: '',
      referenceBy: '',
      referenceRemark: '',
      bankAccountNo: '',
      joiningSalary: 0,
      presentSalary: 0,
      approverId: null,
    };
  }

  initials(): string {
    return (this.model.fullName || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((x: string) => x[0])
      .join('')
      .toUpperCase();
  }

  bad(field: string): boolean {
    return !!this.errors()[field];
  }

  sepType(): string {
    return this.model.separation?.type ?? '';
  }
  sepDate(): string {
    return this.model.separation?.date ?? '';
  }
  sepComment(): string {
    return this.model.separation?.comment ?? '';
  }

  setSepType(t: SeparationType): void {
    this.model.separation = { type: t, date: this.sepDate() || todayIso(), comment: this.sepComment() };
  }
  setSepDate(d: string): void {
    this.model.separation = { type: this.sepType() || 'Resigned', date: d, comment: this.sepComment() };
  }
  setSepComment(c: string): void {
    this.model.separation = { type: this.sepType() || 'Resigned', date: this.sepDate() || todayIso(), comment: c };
  }
  clearSeparation(): void {
    this.model.separation = null;
  }
  setActive(v: boolean): void {
    this.model.active = v;
  }

  toggleLeave(id: string): void {
    const i = this.model.leaveTypeIds.indexOf(id);
    if (i >= 0) this.model.leaveTypeIds.splice(i, 1);
    else this.model.leaveTypeIds.push(id);
  }

  onPhoto(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => (this.model.photo = String(reader.result));
    reader.readAsDataURL(file);
  }

  validate(): boolean {
    const e: Record<string, string> = {};
    const m = this.model;
    if (!m.id.trim()) e['id'] = 'Employee ID is required';
    else if (this.store.employees.all().some((x) => x.id.toLowerCase() === m.id.trim().toLowerCase() && x.id !== m.id))
      e['id'] = 'This employee ID already exists';
    if (!m.fullName.trim()) e['fullName'] = 'Full name is required';
    if (!m.companyId) e['companyId'] = 'Company is required';
    if (!m.employeeTypeId) e['employeeTypeId'] = 'Employee type is required';
    if (!m.departmentId) e['departmentId'] = 'Department is required';
    if (!m.sectionId) e['sectionId'] = 'Section is required';
    if (!m.designationId) e['designationId'] = 'Designation is required';
    if (!m.workGroupId) e['workGroupId'] = 'Work group is required';
    if (!m.joiningDate) e['joiningDate'] = 'Joining date is required';
    if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email))
      e['email'] = 'Enter a valid email address';
    if (m.nid && !/^\d{10}$/.test(m.nid.trim())) e['nid'] = 'NID must be 10 digits';
    this.errors.set(e);
    if (Object.keys(e).length) {
      this.tab.set(e['id'] ? 'base' : 'base');
      this.toast.show('Please correct the highlighted fields.', 'error');
      return false;
    }
    return true;
  }

  save(): void {
    if (!this.validate()) return;
    const m = this.model as Employee;
    const before = this.store.employees.byId(m.id);
    this.store.employees.upsert({ ...m, id: m.id.trim() });

    if (before) {
      this.store.log('Employee update', 'Employee', m.id, `${m.fullName} record updated`);
      if (
        authChanged(before.bankAccountNo, m.bankAccountNo) ||
        authChanged(before.joiningSalary, m.joiningSalary) ||
        authChanged(before.presentSalary, m.presentSalary)
      ) {
        this.store.log('Payroll field update', 'Employee', m.id, 'Bank or salary field changed');
      }
    } else {
      this.store.log('Employee create', 'Employee', m.id, `${m.fullName} created`);
    }
    if (m.separation) {
      this.store.log('Separation recorded', 'Employee', m.id, `${m.separation.type} on ${m.separation.date}`);
    }
    this.toast.show('Employee saved.', 'ok');
    this.router.navigate(['/employees', m.id]);
  }
}

function authChanged(a: any, b: any): boolean {
  return String(a ?? '') !== String(b ?? '');
}
