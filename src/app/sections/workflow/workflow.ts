import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { WORKFLOW } from '../../data/content';
import { IconComponent } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal';

@Component({
  selector: 'app-workflow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RevealDirective, LowerCasePipe],
  templateUrl: './workflow.html',
  styleUrl: './workflow.scss',
})
export class WorkflowComponent {
  protected readonly steps = WORKFLOW;
  protected readonly active = signal(0);

  protected select(i: number): void {
    this.active.set(i);
  }
}
