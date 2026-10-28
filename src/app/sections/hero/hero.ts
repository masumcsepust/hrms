import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LogoComponent } from '../../shared/logo';
import { IconComponent } from '../../shared/icon';
import { SpotlightDirective } from '../../shared/spotlight';
import { CLIENT_LOGOS, TRUST_POINTS } from '../../data/content';

@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LogoComponent, IconComponent, SpotlightDirective],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class HeroComponent {
  protected readonly trust = TRUST_POINTS;
  protected readonly logos = CLIENT_LOGOS;

  protected readonly tiles = [
    { k: 'Open roles', v: '18', d: '+4' },
    { k: 'Onboarding', v: '3', d: 'now' },
    { k: 'Leave reqs', v: '2', d: 'today' },
  ];

  protected readonly people = [
    { i: 'RÖ', h: 12 },
    { i: 'TF', h: 168 },
    { i: 'PN', h: 38 },
    { i: 'SK', h: 258 },
    { i: 'AN', h: 320 },
  ];
}
