import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { QUOTES } from '../../data/content';
import { IconComponent } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal';

@Component({
  selector: 'app-stories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RevealDirective],
  templateUrl: './stories.html',
  styleUrl: './stories.scss',
})
export class StoriesComponent {
  protected readonly quotes = QUOTES;
  protected readonly index = signal(0);

  protected go(i: number): void {
    this.index.set((i + this.quotes.length) % this.quotes.length);
  }

  protected next(): void {
    this.go(this.index() + 1);
  }

  protected prev(): void {
    this.go(this.index() - 1);
  }
}
