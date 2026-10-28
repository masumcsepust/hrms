import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export { IconComponent } from './icon';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-head">
      <div class="titles">
        <div class="crumb small muted">{{ crumb() }}</div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="muted small">{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content select="[actions]" /></div>
    </div>
  `,
  styles: [
    `
      .page-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
        flex-wrap: wrap;
      }
      .crumb {
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 10.5px;
        font-weight: 650;
        margin-bottom: 2px;
      }
      .titles h1 {
        font-size: 21px;
      }
      .titles p {
        margin-top: 2px;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>('');
  crumb = input<string>('');
}

@Component({
  selector: 'app-kpi',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpi" [class.clickable]="clickable()" (click)="clicked.emit()">
      <span class="label">{{ label() }}</span>
      <span class="value" [style.color]="color()">{{ value() }}</span>
      @if (foot()) {
        <span class="foot">{{ foot() }}</span>
      }
    </div>
  `,
})
export class KpiComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  foot = input<string>('');
  color = input<string>('');
  clickable = input(false);
  clicked = output<void>();
}

export type ChipKind = 'ok' | 'warn' | 'danger' | 'info' | 'violet' | 'brand' | '';

@Component({
  selector: 'app-chip',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="chip" [class]="'chip ' + kind()"><ng-content /></span>`,
})
export class ChipComponent {
  kind = input<ChipKind>('');
}

@Component({
  selector: 'app-empty',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty">
      <div style="font-size: 26px; opacity: 0.35">🗂</div>
      <div style="margin-top: 6px">{{ text() }}</div>
      @if (hint()) {
        <div class="small muted" style="margin-top: 3px">{{ hint() }}</div>
      }
    </div>
  `,
})
export class EmptyComponent {
  text = input.required<string>();
  hint = input<string>('');
}

@Component({
  selector: 'app-legend',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="legend">
      @for (item of items(); track item.label) {
        <span><i class="swatch" [style.background]="item.color"></i>{{ item.label }}</span>
      }
    </div>
  `,
})
export class LegendComponent {
  items = input<{ label: string; color: string }[]>([]);
}
