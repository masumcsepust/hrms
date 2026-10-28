import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store, Coll } from '../../core/store';
import { ToastService } from '../../core/toast.service';
import { PageHeaderComponent, ChipComponent, EmptyComponent, IconComponent } from '../../shared/ui';

type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea';

interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
}

interface MasterDef {
  key: string;
  title: string;
  clause: string;
  icon: string;
  desc: string;
  fields: FieldSpec[];
  coll: () => Coll<any>;
}

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ChipComponent, EmptyComponent, IconComponent],
  template: `
    <app-page-header
      title="Setup masters"
      crumb="Setup"
      subtitle="Master lists that employee records depend on. Values are maintained by an authorised user."
    />

    <div class="master-tabs">
      @for (m of masters; track m.key) {
        <button class="master-tab" [class.active]="active().key === m.key" (click)="select(m)">
          <app-icon [name]="m.icon" [size]="15" />
          {{ m.title }}
          <span class="count">{{ m.coll().count() }}</span>
        </button>
      }
    </div>

    <div class="card mt-12">
      <div class="card-head">
        <div>
          <h3>{{ active().title }}</h3>
          <div class="small muted">{{ active().desc }} <span class="mono">({{ active().clause }})</span></div>
        </div>
        <button class="btn btn-primary btn-sm" (click)="openNew()">
          <app-icon name="plus" [size]="14" /> New {{ singular() }}
        </button>
      </div>

      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              @for (f of active().fields; track f.key) {
                <th>{{ f.label }}</th>
              }
              <th style="width: 90px">Status</th>
              <th style="width: 130px" class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (!rows().length) {
              <tr>
                <td [attr.colspan]="active().fields.length + 2">
                  <app-empty text="Nothing configured yet" hint="Create the first record with the button above." />
                </td>
              </tr>
            } @else {
              @for (row of rows(); track row.id) {
                <tr>
                  @for (f of active().fields; track f.key) {
                    <td>
                      @if (f.type === 'checkbox') {
                        <app-chip [kind]="row[f.key] ? 'ok' : ''">{{ row[f.key] ? 'Yes' : 'No' }}</app-chip>
                      } @else if (f.type === 'select') {
                        {{ labelOf(f, row[f.key]) }}
                      } @else {
                        {{ row[f.key] }}
                      }
                    </td>
                  }
                  <td>
                    <app-chip [kind]="row.active ? 'ok' : ''">{{ row.active ? 'Active' : 'Inactive' }}</app-chip>
                  </td>
                  <td class="right nowrap">
                    <button class="btn btn-sm" (click)="openEdit(row)">Edit</button>
                    <button class="btn btn-sm btn-danger" (click)="remove(row)">Delete</button>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (editing()) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ form.id ? 'Edit' : 'New' }} {{ singular() }}</h3>
            <button class="btn btn-icon btn-ghost" (click)="close()">✕</button>
          </div>
          <div class="modal-body">
            <div class="grid grid-2">
              @for (f of active().fields; track f.key) {
                <div class="field" [class.span2]="f.type === 'textarea'">
                  <label class="label" [class.req]="f.required">{{ f.label }}</label>
                  @if (f.type === 'select') {
                    <select [class.invalid]="touched()[f.key] && !form[f.key]" (change)="form[f.key] = $any($event.target).value">
                      <option value="">— select —</option>
                      @for (o of f.options!; track o.value) {
                        <option [value]="o.value">{{ o.label }}</option>
                      }
                    </select>
                  } @else if (f.type === 'checkbox') {
                    <label class="check">
                      <input type="checkbox" [checked]="!!form[f.key]" (change)="form[f.key] = $any($event.target).checked" />
                      {{ f.hint || 'Yes' }}
                    </label>
                  } @else if (f.type === 'textarea') {
                    <textarea [class.invalid]="touched()[f.key] && !form[f.key]" (input)="form[f.key] = $any($event.target).value"></textarea>
                  } @else {
                    <input
                      [type]="f.type === 'number' ? 'number' : 'text'"
                      [class.invalid]="touched()[f.key] && !form[f.key]"
                      [value]="form[f.key] ?? ''"
                      (input)="form[f.key] = $any($event.target).value"
                    />
                  }
                  @if (touched()[f.key] && !form[f.key] && f.required) {
                    <span class="error-text">{{ f.label }} is required</span>
                  } @else if (f.hint && f.type !== 'checkbox') {
                    <span class="hint">{{ f.hint }}</span>
                  }
                </div>
              }
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="close()">Cancel</button>
            <button class="btn btn-primary" (click)="save()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .master-tabs {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .master-tab {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        height: 34px;
        padding: 0 13px;
        border-radius: 999px;
        border: 1px solid var(--border-strong);
        background: var(--surface);
        font: inherit;
        font-size: 12.8px;
        font-weight: 550;
        color: var(--text-2);
        cursor: pointer;
      }
      .master-tab.active {
        background: var(--brand);
        border-color: var(--brand);
        color: #fff;
      }
      .master-tab .count {
        background: var(--surface-3);
        color: var(--text-2);
        border-radius: 999px;
        padding: 1px 7px;
        font-size: 11px;
        font-weight: 700;
      }
      .master-tab.active .count {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
      .span2 {
        grid-column: span 2;
      }
    `,
  ],
})
export class SetupComponent {
  private readonly store = inject(Store);
  private readonly toast = inject(ToastService);

  readonly masters: MasterDef[] = [
    {
      key: 'employeeTypes',
      title: 'Employee types',
      clause: 'EMT-1 / EMT-2',
      icon: 'briefcase',
      desc: 'Permanent, probationary, contractual and other engagement types.',
      coll: () => this.store.employeeTypes,
      fields: [
        { key: 'name', label: 'Employee type name', type: 'text', required: true, unique: true },
        { key: 'code', label: 'Code', type: 'text', required: true, unique: true },
        {
          key: 'permanent',
          label: 'Permanent',
          type: 'checkbox',
          hint: 'Permanent types are counted as permanent in the employee statement (EST-3).',
        },
      ],
    },
    {
      key: 'departments',
      title: 'Departments',
      clause: 'DPT-1 / DPT-2',
      icon: 'building',
      desc: 'Department name and status.',
      coll: () => this.store.departments,
      fields: [{ key: 'name', label: 'Department name', type: 'text', required: true, unique: true }],
    },
    {
      key: 'sections',
      title: 'Sections',
      clause: 'SEC-1 / SEC-2',
      icon: 'list',
      desc: 'Section name, status and configurable fields.',
      coll: () => this.store.sections,
      fields: [{ key: 'name', label: 'Section name', type: 'text', required: true, unique: true }],
    },
    {
      key: 'designations',
      title: 'Designations',
      clause: 'DSG-1 / DSG-2',
      icon: 'user',
      desc: 'Designation name, status and configurable fields.',
      coll: () => this.store.designations,
      fields: [{ key: 'name', label: 'Designation name', type: 'text', required: true, unique: true }],
    },
    {
      key: 'workGroups',
      title: 'Work groups',
      clause: 'WRG-1 / WRG-2 / WRG-3',
      icon: 'users',
      desc: 'Group type decides every Worker / Officer rule for delay, overtime, sandwich leave and earned leave.',
      coll: () => this.store.workGroups,
      fields: [
        { key: 'code', label: 'Work group code', type: 'text', required: true, unique: true },
        { key: 'name', label: 'Work group name', type: 'text', required: true, unique: true },
        {
          key: 'groupType',
          label: 'Group type',
          type: 'select',
          required: true,
          options: [
            { value: 'Worker', label: 'Worker' },
            { value: 'Officer', label: 'Officer' },
          ],
          hint: 'Mandatory — drives delay, OT, sandwich leave and earned leave rules (WRG-3).',
        },
      ],
    },
    {
      key: 'companies',
      title: 'Companies',
      clause: 'CRD-2 / DSH-1',
      icon: 'building',
      desc: 'Each company owns its own ID card template.',
      coll: () => this.store.companies,
      fields: [
        { key: 'name', label: 'Company name', type: 'text', required: true, unique: true },
        { key: 'code', label: 'Code', type: 'text', required: true, unique: true },
      ],
    },
    {
      key: 'leaveTypes',
      title: 'Leave types',
      clause: 'LVE-1 / LVE-3',
      icon: 'plane',
      desc: 'Annual entitlement, carry forward rule and attachment requirement per leave type.',
      coll: () => this.store.leaveTypes,
      fields: [
        { key: 'name', label: 'Leave type name', type: 'text', required: true, unique: true },
        { key: 'code', label: 'Code', type: 'text', required: true, unique: true },
        {
          key: 'annualDays',
          label: 'Annual entitlement (days)',
          type: 'number',
          required: true,
          hint: 'Sick 14 · Casual 10 · Maternity 120 · Earned is calculated (ERN-3).',
        },
        {
          key: 'carryForward',
          label: 'Carry forward (days)',
          type: 'number',
          hint: 'Sick and casual are not carried forward; earned leave carries up to 15 days (LVE-3).',
        },
        {
          key: 'calculated',
          label: 'Calculated entitlement',
          type: 'checkbox',
          hint: 'Earned leave is calculated from working days (ERN-3 / ERN-4).',
        },
        {
          key: 'attachmentRequired',
          label: 'Attachment required',
          type: 'checkbox',
          hint: 'Sick leave requires a mandatory attachment (LVE-7).',
        },
      ],
    },
  ];

  readonly active = signal<MasterDef>(this.masters[0]);
  readonly editing = signal<any | null>(null);
  readonly touched = signal<Record<string, boolean>>({});
  form: any = {};

  readonly rows = computed(() => {
    const m = this.active();
    return m.coll().all().slice().sort((a: any, b: any) => String(a.name ?? a.title ?? '').localeCompare(String(b.name ?? b.title ?? '')));
  });

  select(m: MasterDef): void {
    this.active.set(m);
  }

  /** "Employee types" -> "Employee type" */
  singular(): string {
    const t = this.active().title;
    return t.endsWith('s') ? t.slice(0, -1) : t;
  }

  labelOf(f: FieldSpec, value: any): string {
    return f.options?.find((o) => o.value === value)?.label ?? value ?? '';
  }

  openNew(): void {
    this.form = { id: '', active: true };
    for (const f of this.active().fields) {
      if (f.type === 'checkbox') this.form[f.key] = false;
      else if (f.type === 'number') this.form[f.key] = 0;
      else this.form[f.key] = '';
    }
    this.touched.set({});
    this.editing.set(this.form);
  }

  openEdit(row: any): void {
    this.form = { ...row };
    this.touched.set({});
    this.editing.set(row);
  }

  close(): void {
    this.editing.set(null);
  }

  save(): void {
    const m = this.active();
    const missing: string[] = [];
    const touched: Record<string, boolean> = {};
    for (const f of m.fields) {
      touched[f.key] = true;
      const v = this.form[f.key];
      if (f.required && (v === '' || v === null || v === undefined)) missing.push(f.label);
      if (f.unique && v) {
        const dup = m
          .coll()
          .all()
          .find(
            (r: any) =>
              r.id !== this.form.id && String(r[f.key]).toLowerCase() === String(v).toLowerCase(),
          );
        if (dup) missing.push(`${f.label} “${v}” already exists`);
      }
    }
    this.touched.set(touched);
    if (missing.length) {
      this.toast.show(missing.join(' · '), 'error');
      return;
    }
    const record = {
      ...this.form,
      active: this.form.active !== false,
      id: this.form.id || `${m.key}-${Date.now().toString(36)}`,
    };
    m.coll().upsert(record);
    this.store.log(
      this.form.id ? 'Setup update' : 'Setup create',
      m.title,
      record.id,
      `${m.title}: ${record.name ?? record.code}`,
    );
    this.toast.show(`${m.title} saved.`, 'ok');
    this.editing.set(null);
  }

  remove(row: any): void {
    const m = this.active();
    if (!confirm(`Delete “${row.name ?? row.code}”? This cannot be undone.`)) return;
    m.coll().remove(row.id);
    this.store.log('Setup delete', m.title, row.id, `${m.title}: ${row.name ?? row.code}`);
    this.toast.show(`${m.title} deleted.`, 'ok');
  }
}
