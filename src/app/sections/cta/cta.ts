import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IconComponent } from '../../shared/icon';

@Component({
  selector: 'app-cta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './cta.html',
  styleUrl: './cta.scss',
})
export class CtaComponent {
  protected readonly email = signal('');
  protected readonly sent = signal(false);

  protected onSubmit(e: Event): void {
    e.preventDefault();
    if (this.email().trim().length > 3) {
      this.sent.set(true);
    }
  }

  protected onInput(e: Event): void {
    this.email.set((e.target as HTMLInputElement).value);
    if (this.sent()) this.sent.set(false);
  }
}
