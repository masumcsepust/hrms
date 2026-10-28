import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { PLANS } from '../../data/content';
import { IconComponent } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal';

type Billing = 'monthly' | 'yearly';

@Component({
  selector: 'app-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RevealDirective],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class PricingComponent {
  protected readonly plans = PLANS;
  protected readonly billing = signal<Billing>('yearly');

  protected readonly yearly = computed(() => this.billing() === 'yearly');

  protected price(plan: (typeof PLANS)[number]): string {
    if (plan.monthly === null) return '';
    const v = this.yearly() ? plan.yearly : plan.monthly;
    return v === null ? '' : String(v);
  }

  protected setBilling(b: Billing): void {
    this.billing.set(b);
  }
}
