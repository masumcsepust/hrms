import { ChangeDetectionStrategy, Component } from '@angular/core';
import { METRICS } from '../../data/content';
import { CountUpDirective } from '../../shared/count-up';
import { RevealDirective } from '../../shared/reveal';

@Component({
  selector: 'app-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective, RevealDirective],
  templateUrl: './metrics.html',
  styleUrl: './metrics.scss',
})
export class MetricsComponent {
  protected readonly metrics = METRICS;
}
