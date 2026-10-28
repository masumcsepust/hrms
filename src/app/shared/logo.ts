import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Huma mark — a pulse trace inside a rounded square, coral endpoint.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="mark" [class.mark--light]="tone() === 'light'">
      <svg viewBox="0 0 32 32" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false">
        <rect class="mark__bg" width="32" height="32" rx="10" />
        <path
          class="mark__pulse"
          d="M4.6 17.2h4.1l2.1-5.6 3.1 10.6 2.4-7.2 1.6 2.2h4.7"
          fill="none"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle class="mark__dot" cx="25.4" cy="17.2" r="2.5" />
      </svg>
    </span>
  `,
  styles: `
    .mark {
      display: inline-flex;
      line-height: 0;
    }
    .mark__bg {
      fill: #15141a;
    }
    .mark__pulse {
      stroke: #f7f3eb;
    }
    .mark__dot {
      fill: #ff5a30;
    }
    .mark--light .mark__bg {
      fill: #f7f3eb;
    }
    .mark--light .mark__pulse {
      stroke: #15141a;
    }
  `,
})
export class LogoComponent {
  readonly tone = input<'ink' | 'light'>('ink');
  readonly size = input(32);
}
