import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * vSpotlight — moves a radial highlight with the pointer.
 * Writes --mx / --my (px) on the host element.
 */
@Directive({ selector: '[vSpotlight]' })
export class SpotlightDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private onMove = (e: PointerEvent) => {
    const host = this.el.nativeElement;
    const r = host.getBoundingClientRect();
    host.style.setProperty('--mx', `${e.clientX - r.left}px`);
    host.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  ngOnInit(): void {
    this.el.nativeElement.addEventListener('pointermove', this.onMove);
  }

  ngOnDestroy(): void {
    this.el.nativeElement.removeEventListener('pointermove', this.onMove);
  }
}
