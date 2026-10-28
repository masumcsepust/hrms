import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { IconComponent } from '../../shared/ui';
import { calcTenure } from '../../core/calc';

@Component({
  selector: 'app-id-card',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    @if (emp(); as e) {
      <div class="toolbar no-print">
        <a class="btn btn-sm" [routerLink]="['/employees', e.id]">← Back to employee</a>
        <button class="btn btn-primary btn-sm" (click)="print()">
          <app-icon name="printer" [size]="14" /> Print ID card
        </button>
        <span class="small muted">CRD-1 / CRD-2 — the template follows the employee's company.</span>
      </div>

      <div class="card-stage">
        <div class="idcard" [style.border-top-color]="companyColor()">
          <div class="idcard-top">
            <div class="co">
              <div class="co-mark">{{ companyCode() }}</div>
              <div>
                <div class="co-name">{{ companyName() }}</div>
                <div class="co-sub">Human Resource Management</div>
              </div>
            </div>
            <div class="co-type">Employee ID</div>
          </div>

          <div class="idcard-body">
            <div class="photo">
              @if (e.photo) {
                <img [src]="e.photo" alt="" />
              } @else {
                <span>{{ initials() }}</span>
              }
            </div>

            <div class="lines">
              <div class="lname">{{ e.fullName }}</div>
              <div class="lrole">{{ designation() }}</div>
              <div class="lmeta">{{ department() }} · {{ section() }}</div>
              <div class="lmeta">{{ workGroup() }}</div>
            </div>
          </div>

          <div class="idcard-foot">
            <div>
              <span class="lbl">ID</span>
              <span class="val mono">{{ e.id }}</span>
            </div>
            <div>
              <span class="lbl">Joined</span>
              <span class="val">{{ e.joiningDate }}</span>
            </div>
            <div>
              <span class="lbl">Tenure</span>
              <span class="val">{{ tenure() }}</span>
            </div>
          </div>

          <div class="strip"></div>
        </div>
      </div>
    } @else {
      <div class="card card-pad">Employee not found.</div>
    }
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
      }
      .card-stage {
        display: flex;
        justify-content: center;
        padding: 26px;
      }
      .idcard {
        width: 340px;
        border-radius: 14px;
        background: #fff;
        border: 1px solid var(--border);
        border-top: 5px solid #2d5aa0;
        box-shadow: 0 16px 40px rgba(23, 32, 47, 0.16);
        overflow: hidden;
      }
      .idcard-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: linear-gradient(90deg, #f4f7fc, #fff);
        border-bottom: 1px solid var(--border);
      }
      .co {
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .co-mark {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: var(--brand);
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 12px;
      }
      .co-name {
        font-weight: 680;
        font-size: 13px;
      }
      .co-sub {
        font-size: 10px;
        color: var(--muted);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .co-type {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        font-weight: 700;
      }
      .idcard-body {
        display: flex;
        gap: 13px;
        padding: 14px;
      }
      .photo {
        width: 84px;
        height: 100px;
        border-radius: 9px;
        background: var(--surface-3);
        display: grid;
        place-items: center;
        overflow: hidden;
        flex: 0 0 84px;
      }
      .photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .photo span {
        font-size: 30px;
        font-weight: 700;
        color: var(--border-strong);
      }
      .lines {
        min-width: 0;
        padding-top: 2px;
      }
      .lname {
        font-size: 16px;
        font-weight: 680;
        line-height: 1.2;
      }
      .lrole {
        font-size: 12.5px;
        color: var(--brand-2);
        font-weight: 600;
        margin-top: 3px;
      }
      .lmeta {
        font-size: 11.5px;
        color: var(--text-2);
        margin-top: 3px;
      }
      .idcard-foot {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 11px 14px 14px;
        border-top: 1px dashed var(--border);
      }
      .lbl {
        display: block;
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--muted);
        font-weight: 700;
      }
      .val {
        font-size: 12px;
        font-weight: 600;
      }
      .strip {
        height: 6px;
        background: repeating-linear-gradient(
          90deg,
          #2d5aa0 0 10px,
          #17304f 10px 20px
        );
      }
      @media print {
        .card-stage {
          padding: 0;
        }
        .idcard {
          box-shadow: none;
        }
      }
    `,
  ],
})
export class IdCardComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);

  readonly emp = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return this.store.employees.byId(id);
  });

  companyName = computed(() => this.store.companies.byId(this.emp()?.companyId)?.name ?? 'Company');
  companyCode = computed(() => this.store.companies.byId(this.emp()?.companyId)?.code ?? 'ORG');
  companyColor = computed(
    () => (this.emp()?.companyId === 'co-2' ? '#0b8a5a' : '#2d5aa0'),
  );
  designation = computed(
    () => this.store.designations.byId(this.emp()?.designationId)?.name ?? '',
  );
  department = computed(() => this.store.departments.byId(this.emp()?.departmentId)?.name ?? '');
  section = computed(() => this.store.sections.byId(this.emp()?.sectionId)?.name ?? '');
  workGroup = computed(() => this.store.workGroups.byId(this.emp()?.workGroupId)?.name ?? '');

  tenure = computed(() => {
    const e = this.emp();
    if (!e) return '';
    return calcTenure(e.joiningDate, e.separation?.date ?? new Date().toISOString().slice(0, 10)).label;
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

  print(): void {
    window.print();
  }
}
