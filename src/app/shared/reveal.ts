import { Directive, ElementRef, OnDestroy, OnInit, inject, input, numberAttribute } from '@angular/core';

/**
 * vReveal — adds an entrance transition when the element scrolls into view.
 * Usage: <div vReveal>…</div>  |  <div [vReveal]="120">…</div> (delay in ms)
 */
@Directive({ selector: '[vReveal]' })
export class RevealDirective implements OnInit, OnDestroy {
  readonly vReveal = input(0, { transform: numberAttribute });

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const node = this.el.nativeElement;
    node.classList.add('reveal');
    node.style.setProperty('--reveal-delay', `${this.vReveal()}ms`);

    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-in');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add('is-in');
            this.observer?.unobserve(node);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
