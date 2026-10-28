import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { AuthService } from '../../core/auth';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, EmptyComponent, IconComponent } from '../../shared/ui';
import { calcTenure, todayIso } from '../../core/calc';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, ChipComponent, EmptyComponent, IconComponent],
  template: `
    <app-page-header title="Employees" crumb="People" subtitle="Employee master data, employment status and separation.">
      <span actions>
        <button class="btn btn-sm" (click)="exportCsv()"><app-icon name="download" [size]="14" /> CSV</button>
        <a class="btn btn-primary btn-sm" routerLink="/employees/new">
          <app-icon name="plus" [size]="14" /> New employee
        </a>
      </span>
    </app-page-header>

    <div class="filter-bar">
      <div class="field" style="min-width: 230px">
        <label class="label">Search</label>
        <input type="search" placeholder="ID, name, NID, phone…" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>
      <div class="field">
        <label class="label">Company</label>
        <select [value]="company()" (change)="company.set($any($event.target).value)">
          <option value="">All</option>
          @for (c of store.companies.all(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label class="label">Department</label>
        <select [value]="dept()" (change)="dept.set($any($event.target).value)">
          <option value="">All</option>
          @for (d of store.departments.all(); track d.id) {
            <option [value]="d.id">{{ d.name }}</option>
          }
        </select>
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
        <label class="label">Status</label>
        <select [value]="status()" (change)="status.set($any($event.target).value)">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="separated">Separated</option>
        </select>
      </div>
      <div class="field" style="min-width: 110px">
        <label class="label">Rows</label>
        <select [value]="limit()" (change)="limit.set(+$any($event.target).value)">
          <option [value]="25">25</option>
          <option [value]="50">50</option>
          <option [value]="100">100</option>
          <option [value]="9999">All</option>
        </select>
      </div>
    </div>

    <div class="card mt-12">
      <div class="card-head">
        <h3>{{ filtered().length }} employee(s)</h3>
        <span class="small muted">Showing {{ Math.min(limit(), filtered().length) }}</span>
      </div>
      <div class="table-wrap" style="max-height: calc(100vh - 330px)">
        <table class="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Company</th>
              <th>Department</th>
              <th>Section</th>
              <th>Designation</th>
              <th>Work group</th>
              <th>Joining</th>
              <th>Tenure</th>
              <th>Status</th>
              <th class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (!filtered().length) {
              <tr>
                <td colspan="11"><app-empty text="No employee matches the filters" /></td>
              </tr>
            } @else {
              @for (e of page(); track e.id) {
                <tr>
                  <td class="mono nowrap">{{ e.id }}</td>
                  <td class="nowrap">
                    <div class="row gap-8">
                      <div class="avatar">{{ initials(e.fullName) }}</div>
                      <span>{{ e.fullName }}</span>
                    </div>
                  </td>
                  <td class="nowrap">{{ name(store.companies, e.companyId) }}</td>
                  <td class="nowrap">{{ name(store.departments, e.departmentId) }}</td>
                  <td class="nowrap">{{ name(store.sections, e.sectionId) }}</td>
                  <td class="nowrap">{{ name(store.designations, e.designationId) }}</td>
                  <td class="nowrap">{{ name(store.workGroups, e.workGroupId) }}</td>
                  <td class="nowrap">{{ e.joiningDate }}</td>
                  <td class="nowrap small">{{ tenure(e) }}</td>
                  <td class="nowrap">
                    @if (e.separation) {
                      <app-chip kind="danger">{{ e.separation.type }}</app-chip>
                    } @else if (e.active) {
                      <app-chip kind="ok">Active</app-chip>
                    } @else {
                      <app-chip>Inactive</app-chip>
                    }
                  </td>
                  <td class="right nowrap">
                    <a class="btn btn-sm" [routerLink]="['/employees', e.id]">Open</a>
                    <a class="btn btn-sm" [routerLink]="['/employees', e.id, 'id-card']" title="ID card (CRD-1)">ID</a>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [
    `
      .avatar {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--brand-soft);
        color: var(--brand);
        display: grid;
        place-items: center;
        font-size: 10.5px;
        font-weight: 700;
      }
    `,
  ],
})
export class EmployeeListComponent {
  readonly store = inject(Store);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly q = signal('');
  readonly company = signal('');
  readonly dept = signal('');
  readonly wg = signal('');
  readonly status = signal('');
  readonly limit = signal(50);
  readonly Math = Math;

  readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.store.employees
      .all()
      .filter((e) => {
        if (this.company() && e.companyId !== this.company()) return false;
        if (this.dept() && e.departmentId !== this.dept()) return false;
        if (this.wg() && e.workGroupId !== this.wg()) return false;
        if (this.status() === 'active' && !e.active) return false;
        if (this.status() === 'inactive' && e.active) return false;
        if (this.status() === 'separated' && !e.separation) return false;
        if (q) {
          const hay = `${e.id} ${e.fullName} ${e.nid} ${e.phone} ${e.email}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  });

  readonly page = computed(() => this.filtered().slice(0, this.limit()));

  name(coll: any, id: string): string {
    return coll.byId(id)?.name ?? '—';
  }

  initials(n: string): string {
    return n
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase();
  }

  tenure(e: any): string {
    return calcTenure(e.joiningDate, e.separation?.date ?? todayIso()).label;
  }

  exportCsv(): void {
    const head = ['ID', 'Name', 'Company', 'Department', 'Section', 'Designation', 'Work Group', 'Employee Type', 'Joining Date', 'Status'];
    const lines = this.filtered().map((e) =>
      [
        e.id,
        e.fullName,
        this.name(this.store.companies, e.companyId),
        this.name(this.store.departments, e.departmentId),
        this.name(this.store.sections, e.sectionId),
        this.name(this.store.designations, e.designationId),
        this.name(this.store.workGroups, e.workGroupId),
        this.name(this.store.employeeTypes, e.employeeTypeId),
        e.joiningDate,
        e.separation ? e.separation.type : e.active ? 'Active' : 'Inactive',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'employees.csv';
    a.click();
    this.toast.show('Employee list exported as CSV.', 'ok');
  }
}
