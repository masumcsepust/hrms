import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExportColumn, ExportService, ExportSummary } from '../core/export.service';
import { ToastService } from '../core/toast.service';
import { Store } from '../core/store';

export interface TableColumn<T = any> {
  key: string;
  header: string;
  value: (row: T) => string | number | null | undefined;
  align?: 'left' | 'center' | 'right';
  width?: string;
  /** hex fill colour when the cell must be highlighted (NFR-6) */
  highlight?: (row: T) => string | null;
  bold?: boolean | ((row: T) => boolean);
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-wrap" [style.max-height]="maxHeight()">
      <table class="data" [class.compact]="dense()">
        <thead>
          <tr>
            @for (c of columns(); track c.key) {
              <th [style.text-align]="c.align ?? 'left'" [style.width]="c.width ?? null">
                {{ c.header }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (!rows().length) {
            <tr>
              <td [attr.colspan]="columns().length">
                <div class="empty">{{ emptyText() }}</div>
              </td>
            </tr>
          } @else {
            @for (row of rows(); track trackRow($index, row)) {
              <tr [class.row-click]="clickable()" (click)="clickable() ? rowClick.emit(row) : null">
                @for (c of columns(); track c.key) {
                  <td
                    [style.text-align]="c.align ?? 'left'"
                    [style.font-weight]="isBold(c, row) ? 650 : null"
                  >
                    <span
                      class="td-hl"
                      [style.background]="c.highlight ? c.highlight(row) : null"
                      [style.padding]="c.highlight && c.highlight(row) ? '1px 5px' : null"
                      [style.border-radius]="c.highlight && c.highlight(row) ? '4px' : null"
                    >{{ c.value(row) }}</span>
                  </td>
                }
              </tr>
            }
          }
        </tbody>
        @if (footer()) {
          <tfoot>
            <tr>
              @for (c of columns(); track c.key) {
                <td [style.text-align]="c.align ?? 'left'">{{ footer()![c.key] ?? '' }}</td>
              }
            </tr>
          </tfoot>
        }
      </table>
    </div>
  `,
})
export class TableComponent<T = any> {
  columns = input.required<TableColumn<T>[]>();
  rows = input.required<T[]>();
  emptyText = input('No records to show');
  dense = input(false);
  maxHeight = input<string>('none');
  footer = input<Record<string, string> | null>(null);
  clickable = input(false);
  rowClick = output<T>();

  trackRow(index: number, row: T): any {
    return (row as any).id ?? index;
  }

  isBold(col: TableColumn<T>, row: T): boolean {
    return typeof col.bold === 'function' ? col.bold(row) : !!col.bold;
  }
}

@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [CommonModule, TableComponent],
  template: `
    <div class="report-head">
      <div>
        <h2>{{ title() }}</h2>
        @if (subtitle()) {
          <p class="muted small" style="margin-top: 2px">{{ subtitle() }}</p>
        }
      </div>
      <div class="row gap-8">
        <button class="btn btn-sm" (click)="exportExcel()" [disabled]="!rows().length">
          ⬇ Excel
        </button>
        <button class="btn btn-sm" (click)="exportPdf()" [disabled]="!rows().length">
          ⬇ PDF
        </button>
      </div>
    </div>

    <ng-content select="[filters]" />

    <div class="card mt-12">
      <div class="card-head">
        <h3>{{ tableTitle() || title() }}</h3>
        <span class="chip">{{ rows().length }} row(s)</span>
      </div>
      <app-table
        [columns]="columns()"
        [rows]="rows()"
        [dense]="true"
        [maxHeight]="maxHeight()"
        [emptyText]="emptyText()"
      />
    </div>

    @if (summary().length) {
      <div class="summary-strip mt-12">
        @for (s of summary(); track s.label) {
          <span>{{ s.label }} <b>{{ s.value }}</b></span>
        }
      </div>
    }
  `,
  styles: [
    `
      .report-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class ReportViewComponent<T = any> {
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store);

  title = input.required<string>();
  subtitle = input<string>('');
  tableTitle = input<string>('');
  columns = input.required<TableColumn<T>[]>();
  rows = input.required<T[]>();
  summary = input<ExportSummary[]>([]);
  fileName = input<string>('report');
  emptyText = input('No data for the selected filters');
  maxHeight = input<string>('none');

  exportExcel(): void {
    this.exporter.toExcel(
      this.fileName(),
      this.title(),
      this.toExportColumns(),
      this.rows(),
      this.summary(),
    );
    this.audit('Excel');
    this.toast.show('Excel file downloaded.', 'ok');
  }

  exportPdf(): void {
    this.exporter.toPdf(
      this.fileName(),
      this.title(),
      this.toExportColumns(),
      this.rows(),
      this.summary(),
    );
    this.audit('PDF');
    this.toast.show('PDF file downloaded.', 'ok');
  }

  /** NFR-2 / NFR-9 — a report run is written to the audit trail. */
  private audit(format: string): void {
    this.store.log(
      'Report export',
      this.title(),
      this.fileName(),
      `${format} export — ${this.rows().length} row(s)`,
    );
  }

  private toExportColumns(): ExportColumn<T>[] {
    return this.columns().map((c) => ({
      header: c.header,
      value: c.value,
      width: c.width ? parseInt(c.width, 10) : undefined,
      align: c.align,
      highlight: c.highlight,
    }));
  }
}
