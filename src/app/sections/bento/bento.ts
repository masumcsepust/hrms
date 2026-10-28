import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FEATURES } from '../../data/content';
import { IconComponent } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal';
import { SpotlightDirective } from '../../shared/spotlight';

@Component({
  selector: 'app-bento',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RevealDirective, SpotlightDirective],
  templateUrl: './bento.html',
  styleUrl: './bento.scss',
})
export class BentoComponent {
  protected readonly features = FEATURES;

  protected readonly pipelineCols = [
    { name: 'Applied', count: 24, items: ['MK', 'JP', 'AL'] },
    { name: 'Screen', count: 9, items: ['NS', 'RB'] },
    { name: 'Offer', count: 3, items: ['DT', 'HV', 'YS'] },
  ];

  protected readonly checklist = [
    { label: 'Contract signed', done: true },
    { label: 'Laptop + access', done: true },
    { label: 'Welcome email sent', done: true },
    { label: 'Buddy introduced', done: false },
    { label: 'Day-one agenda', done: false },
  ];

  protected readonly sentiment = [
    { label: 'Thriving', pct: 54, tone: 'teal' },
    { label: 'Steady', pct: 29, tone: 'sun' },
    { label: 'Strained', pct: 13, tone: 'coral' },
    { label: 'At risk', pct: 4, tone: 'ink' },
  ];

  protected readonly days = [
    { d: 'M', off: false },
    { d: 'T', off: false },
    { d: 'W', off: true },
    { d: 'T', off: false },
    { d: 'F', off: true },
    { d: 'S', off: false },
    { d: 'S', off: false },
  ];

  protected readonly payslip = [
    { k: 'Base salary', v: '4,200' },
    { k: 'Overtime (12h)', v: '480' },
    { k: 'Wellness budget', v: '150' },
  ];
}
