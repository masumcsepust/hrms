import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { FOOTER_COLUMNS } from '../../data/content';
import { IconComponent } from '../../shared/icon';
import { LogoComponent } from '../../shared/logo';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LogoComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class FooterComponent implements OnDestroy {
  protected readonly columns = FOOTER_COLUMNS;
  protected readonly clock = signal('—:—');
  protected readonly year = new Date().getFullYear();

  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    const d = new Date();
    this.clock.set(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    );
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
