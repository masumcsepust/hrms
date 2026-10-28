import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A small hand-drawn icon set drawn on a 24×24 grid with a 1.6px stroke.
 * Every glyph shares the same optical weight so it reads as one family.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name()) {
        @case ('pipeline') {
          <path d="M4 6.5h4.2v5H4z" />
          <path d="M9.4 9h3.3" />
          <path d="M15.4 6.5h4.6v5h-4.6z" />
          <path d="M9.4 9v5.5h6" />
          <path d="M4 17.6h4.2v-2" />
          <path d="M12.2 17.6h7.8" />
        }
        @case ('check') {
          <path d="M4.8 12.6 9.4 17 19.2 7.2" />
        }
        @case ('checklist') {
          <path d="M4 7.4 5.6 9 8.3 6.2" />
          <path d="M4 16.2 5.6 17.8 8.3 15" />
          <path d="M11.4 7.6h8.4" />
          <path d="M11.4 16.4h5.6" />
          <path d="M11.4 12h7" />
        }
        @case ('sentiment') {
          <path d="M4 15.6c1.9 0 2.5-2.6 4.3-2.6s2.4 2.6 4.2 2.6 2.4-2.6 4.1-2.6c1 0 1.5.6 2.4.6" />
          <circle cx="7.2" cy="8" r="1.3" />
          <circle cx="12" cy="6.4" r="1.3" />
          <circle cx="16.8" cy="8" r="1.3" />
        }
        @case ('leave') {
          <rect x="3.4" y="5.2" width="17.2" height="14.4" rx="2.4" />
          <path d="M3.4 9.4h17.2" />
          <path d="M8.4 3.4v3.4M15.6 3.4v3.4" />
          <path d="M8 13.2h3" />
          <path d="M8 16.4h6.4" />
        }
        @case ('org') {
          <rect x="9" y="3.4" width="6" height="4.6" rx="1.4" />
          <rect x="3.2" y="16" width="5.6" height="4.6" rx="1.4" />
          <rect x="15.2" y="16" width="5.6" height="4.6" rx="1.4" />
          <path d="M12 8v4.2M6 16v-2.4h12V16" />
        }
        @case ('payslip') {
          <path d="M6 3.4h9.2L19 7.2v13.4H6z" />
          <path d="M15 3.4v3.8h4" />
          <path d="M9 12.2h6M9 15.6h4.2" />
          <path d="M9 8.8h2.4" />
        }
        @case ('bolt') {
          <path d="M13.4 3.2 5.6 13.4h5.2l-.8 7.4 8-10.4h-5.2z" />
        }
        @case ('shield') {
          <path d="M12 3.2 19 6v5.4c0 4.2-2.8 7.4-7 9.4-4.2-2-7-5.2-7-9.4V6z" />
          <path d="M9.2 12.1 11.3 14l3.6-3.8" />
        }
        @case ('plug') {
          <path d="M9 3.6v4.2M15 3.6v4.2" />
          <path d="M6.6 7.8h10.8v3a5.4 5.4 0 0 1-10.8 0z" />
          <path d="M12 16.2v4.2" />
        }
        @case ('people') {
          <circle cx="9" cy="8" r="3.1" />
          <path d="M3.6 19.4c0-3 2.4-5.4 5.4-5.4s5.4 2.4 5.4 5.4" />
          <path d="M16 5.4a3.1 3.1 0 0 1 0 5.2" />
          <path d="M17.4 14.4c2 .7 3.4 2.6 3.4 5" />
        }
        @case ('globe') {
          <circle cx="12" cy="12" r="8.4" />
          <path d="M3.8 12h16.4" />
          <path d="M12 3.6c2.2 2.4 3.3 5.4 3.3 8.4s-1.1 6-3.3 8.4c-2.2-2.4-3.3-5.4-3.3-8.4S9.8 6 12 3.6z" />
        }
        @case ('doc') {
          <path d="M6.4 3.4h7.2l4.4 4.4v12.8H6.4z" />
          <path d="M13.6 3.4v4.4h4.4" />
          <path d="M9.4 13h5.2M9.4 16.2h3.4" />
        }
        @case ('star') {
          <path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z" />
        }
        @case ('arrow') {
          <path d="M4.4 12h14.4" />
          <path d="M13.4 6.6 18.8 12l-5.4 5.4" />
        }
        @case ('lock') {
          <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2.2" />
          <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" />
        }
        @case ('spark') {
          <path d="M12 3.4c.9 4.6 2 5.7 6.6 6.6-4.6.9-5.7 2-6.6 6.6-.9-4.6-2-5.7-6.6-6.6 4.6-.9 5.7-2 6.6-6.6z" />
          <path d="M18.4 15.4c.4 2 .9 2.5 2.9 2.9-2 .4-2.5.9-2.9 2.9-.4-2-.9-2.5-2.9-2.9 2-.4 2.5-.9 2.9-2.9z" />
        }
        @default {
          <circle cx="12" cy="12" r="8.4" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      flex: none;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(24);
}
