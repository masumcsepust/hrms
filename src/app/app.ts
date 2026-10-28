import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';

import { NavComponent } from './sections/nav/nav';
import { HeroComponent } from './sections/hero/hero';
import { BentoComponent } from './sections/bento/bento';
import { WorkflowComponent } from './sections/workflow/workflow';
import { MetricsComponent } from './sections/metrics/metrics';
import { OrgmapComponent } from './sections/orgmap/orgmap';
import { StoriesComponent } from './sections/stories/stories';
import { PricingComponent } from './sections/pricing/pricing';
import { FaqComponent } from './sections/faq/faq';
import { CtaComponent } from './sections/cta/cta';
import { FooterComponent } from './sections/footer/footer';
import { IconComponent } from './shared/icon';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NavComponent,
    HeroComponent,
    BentoComponent,
    WorkflowComponent,
    MetricsComponent,
    OrgmapComponent,
    StoriesComponent,
    PricingComponent,
    FaqComponent,
    CtaComponent,
    FooterComponent,
    IconComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly showTop = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.showTop.set(window.scrollY > 900);
  }

  protected toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
