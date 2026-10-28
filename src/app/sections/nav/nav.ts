import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';
import { NAV } from '../../data/content';
import { LogoComponent } from '../../shared/logo';
import { IconComponent } from '../../shared/icon';

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
}

@Component({
  selector: 'app-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LogoComponent, IconComponent],
  templateUrl: './nav.html',
  styleUrl: './nav.scss',
})
export class NavComponent {
  protected readonly nav = NAV;
  protected readonly scrolled = signal(false);
  protected readonly open = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly progress = signal(0);

  protected readonly menuItems: MenuItem[] = [
    { icon: 'pipeline', label: 'Recruiting', desc: 'Post, review, offer' },
    { icon: 'checklist', label: 'Onboarding', desc: 'Day one, sorted' },
    { icon: 'sentiment', label: 'Reviews', desc: 'Two-minute check-ins' },
    { icon: 'leave', label: 'Time off', desc: 'Balances & approvals' },
    { icon: 'org', label: 'Org chart', desc: 'Always up to date' },
    { icon: 'payslip', label: 'Payroll', desc: 'On autopilot' },
  ];

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY;
    this.scrolled.set(y > 12);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.progress.set(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeAll(): void {
    this.menuOpen.set(false);
    this.open.set(false);
  }

  protected onNavClick(): void {
    this.open.set(false);
  }
}
