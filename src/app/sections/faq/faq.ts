import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FAQS } from '../../data/content';
import { IconComponent } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal';

@Component({
  selector: 'app-faq',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RevealDirective],
  templateUrl: './faq.html',
  styleUrl: './faq.scss',
})
export class FaqComponent {
  protected readonly faqs = FAQS;
  protected readonly open = signal<number | null>(0);

  protected toggle(i: number): void {
    this.open.set(this.open() === i ? null : i);
  }
}
