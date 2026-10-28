import { Directive, ElementRef, OnDestroy, OnInit, inject, input, numberAttribute } from '@angular/core';

/**
 * vCount — animates a number from 0 to the target once it scrolls into view.
 * Usage: <span vCount="4.2" [decimals]="1"></span>
 */
@Directive({ selector: '[vCount]' })
export class CountUpDirective implements OnInit, OnDestroy {
  readonly vCount = input.required<number>();
  readonly decimals = input(0, { transform: numberAttribute });
  readonly duration = input(1500, { transform: numberAttribute });
  readonly prefix = input('');
  readonly suffix = input('');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private frame?: number;

  ngOnInit(): void {
    const node = this.el.nativeElement;
    node.textContent = `${this.prefix()}${this.fmt(0)}${this.suffix()}`;

    if (typeof IntersectionObserver === 'undefined') {
      node.textContent = `${this.prefix()}${this.fmt(this.vCount())}${this.suffix()}`;
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.run();
            this.observer?.unobserve(node);
          }
        }
      },
      { threshold: 0.4 },
    );
    this.observer.observe(node);
  }

  private run(): void {
    const node = this.el.nativeElement;
    const target = this.vCount();
    const duration = this.duration();
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = `${this.prefix()}${this.fmt(target * eased)}${this.suffix()}`;
      if (t < 1) {
        this.frame = requestAnimationFrame(tick);
      }
    };
    this.frame = requestAnimationFrame(tick);
  }

  private fmt(n: number): string {
    return n.toFixed(this.decimals());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
