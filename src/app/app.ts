import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from './core/store';
import { AuthService } from './core/auth';
import { ToastService } from './core/toast.service';
import { IconComponent } from './shared/icon';

interface NavItem {
  label: string;
  icon: string;
  link: string;
  hrOnly?: boolean;
  badge?: () => number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly store = inject(Store);
  readonly auth = inject(AuthService);
  readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);

  readonly groups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', icon: 'dashboard', link: '/dashboard' }],
    },
    {
      title: 'People',
      items: [
        { label: 'Employees', icon: 'users', link: '/employees' },
        { label: 'My profile', icon: 'user', link: '/self/profile' },
        { label: 'My leave', icon: 'plane', link: '/self/leave' },
      ],
    },
    {
      title: 'Setup',
      items: [
        { label: 'Setup masters', icon: 'sliders', link: '/setup', hrOnly: true },
        {
          label: 'Shift policies',
          icon: 'clock',
          link: '/shift/policies',
          hrOnly: true,
        },
        { label: 'Duty roster', icon: 'repeat', link: '/shift/roster', hrOnly: true },
        { label: 'Work calendar', icon: 'calendar', link: '/shift/calendar', hrOnly: true },
      ],
    },
    {
      title: 'Attendance',
      items: [
        { label: 'Daily attendance', icon: 'gauge', link: '/attendance/daily', hrOnly: true },
        { label: 'Manual punch', icon: 'card', link: '/attendance/manual', hrOnly: true },
        { label: 'Job card', icon: 'list', link: '/attendance/job-card', hrOnly: true },
      ],
    },
    {
      title: 'Leave',
      items: [
        { label: 'Apply for leave', icon: 'plane', link: '/leave/apply' },
        {
          label: 'Leave approvals',
          icon: 'check',
          link: '/leave/approvals',
          badge: () => this.leaveServicePending(),
        },
        { label: 'Balances & year end', icon: 'briefcase', link: '/leave/balance', hrOnly: true },
      ],
    },
    {
      title: 'Reports',
      items: [
        { label: 'Report centre', icon: 'chart', link: '/reports' },
        { label: 'Audit trail', icon: 'shield', link: '/audit', hrOnly: true },
      ],
    },
  ];

  private leaveServicePending(): number {
    return this.store.leaveApplications.where((l) => l.status === 'Applied').length;
  }

  visible(group: NavGroup): NavGroup {
    if (this.auth.can('hr.manage')) return group;
    return { ...group, items: group.items.filter((i) => !i.hrOnly) };
  }

  readonly pending = computed(() => this.leaveServicePending());

  switchUser(id: string): void {
    this.store.setCurrentUser(id);
    const u = this.store.users.byId(id);
    this.toast.show(`Signed in as ${u?.name} (${u?.role})`, 'info');
    const current = this.router.url;
    if (!this.auth.can('hr.manage') && /^\/(setup|shift|attendance|audit)/.test(current)) {
      this.router.navigate(['/self/profile']);
    }
  }

  resetData(): void {
    this.store.reset();
    this.toast.show('Demo data restored.', 'ok');
  }
}
