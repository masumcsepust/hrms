import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn<T = any> {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** excel column width */
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** returns a hex fill colour when the cell should be highlighted */
  highlight?: (row: T) => string | null;
  /** returns a hex font colour when the cell should be highlighted */
  fontColor?: (row: T) => string | null;
}

export interface ExportSummary {
  label: string;
  value: string | number;
}

export const HIGHLIGHT = {
  delay: '#FFF3BF',
  absent: '#FFE3E3',
  leave: '#E7F5FF',
  ot: '#E6FCF5',
  manual: '#F3F0FF',
};

@Injectable({ providedIn: 'root' })
export class ExportService {
  /** NFR-4 / JOB-6 — Excel export keeping the row highlights. */
  toExcel<T>(
    fileName: string,
    sheetName: string,
    columns: ExportColumn<T>[],
    rows: T[],
    summary?: ExportSummary[],
  ): void {
    const header = columns.map((c) => c.header);
    const body = rows.map((r) => columns.map((c) => c.value(r) ?? ''));

    const ws: any = XLSX.utils.aoa_to_sheet([header, ...body]);

    // header styling
    const headRange = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    for (let c = headRange.s.c; c <= headRange.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1F3A5F' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
    }

    // body styling + highlights
    rows.forEach((row, ri) => {
      columns.forEach((col, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
        const cell = ws[ref];
        if (!cell) return;
        const fill = col.highlight?.(row);
        const fontColor = col.fontColor?.(row);
        const s: any = {
          alignment: { horizontal: col.align ?? 'left', vertical: 'top', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'D9E0EA' } },
            bottom: { style: 'thin', color: { rgb: 'D9E0EA' } },
            left: { style: 'thin', color: { rgb: 'D9E0EA' } },
            right: { style: 'thin', color: { rgb: 'D9E0EA' } },
          },
        };
        if (fill) s.fill = { fgColor: { rgb: fill.replace('#', '') } };
        if (fontColor) s.font = { color: { rgb: fontColor.replace('#', '') }, bold: true };
        cell.s = s;
      });
    });

    ws['!cols'] = columns.map((c) => ({ wch: c.width ?? Math.max(12, c.header.length + 4) }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
    XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
  }

  /** NFR-4 / JOB-6 — PDF export keeping the row highlights. */
  toPdf<T>(
    fileName: string,
    title: string,
    columns: ExportColumn<T>[],
    rows: T[],
    summary?: ExportSummary[],
  ): void {
    const doc = new jsPDF({ orientation: columns.length > 8 ? 'landscape' : 'portrait' });
    doc.setFontSize(14);
    doc.setTextColor(31, 58, 95);
    doc.text(title, 14, 16);
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 135);
    doc.text(
      `Generated ${new Date().toLocaleString('en-GB')} — Asia/Dhaka`,
      14,
      22,
    );

    autoTable(doc, {
      startY: 27,
      head: [columns.map((c) => c.header)],
      body: rows.map((r) => columns.map((c) => String(c.value(r) ?? ''))),
      styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: [217, 224, 234], lineWidth: 0.1 },
      headStyles: { fillColor: [31, 58, 95], textColor: 255, fontSize: 7.5, halign: 'center' },
      alternateRowStyles: { fillColor: [249, 251, 254] },
      margin: { left: 10, right: 10 },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        const col = columns[data.column.index];
        const fill = col?.highlight?.(row);
        if (fill) {
          const rgb = fill.replace('#', '');
          data.cell.styles.fillColor = [
            parseInt(rgb.slice(0, 2), 16),
            parseInt(rgb.slice(2, 4), 16),
            parseInt(rgb.slice(4, 6), 16),
          ];
        }
        const fc = col?.fontColor?.(row);
        if (fc) {
          const rgb = fc.replace('#', '');
          data.cell.styles.textColor = [
            parseInt(rgb.slice(0, 2), 16),
            parseInt(rgb.slice(2, 4), 16),
            parseInt(rgb.slice(4, 6), 16),
          ];
        }
        if (col?.align) data.cell.styles.halign = col.align;
      },
    });

    if (summary?.length) {
      const y = (doc as any).lastAutoTable?.finalY ?? 100;
      doc.setFontSize(8);
      doc.setTextColor(31, 58, 95);
      let offset = 0;
      for (const s of summary) {
        const text = `${s.label}: ${s.value}`;
        doc.text(text, 14, y + 8 + offset);
        offset += 5;
      }
    }

    doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  }
}
