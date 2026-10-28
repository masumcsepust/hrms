import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { IconComponent } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal';

interface OrgNode {
  id: string;
  label: string;
  role: string;
  cx: number;
  cy: number;
  tone: 'coral' | 'teal' | 'sun' | 'violet' | 'plain';
  people: number;
}

interface OrgEdge {
  from: string;
  to: string;
}

@Component({
  selector: 'app-orgmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RevealDirective],
  templateUrl: './orgmap.html',
  styleUrl: './orgmap.scss',
})
export class OrgmapComponent {
  protected readonly active = signal<string | null>(null);

  protected readonly nodes: OrgNode[] = [
    { id: 'ceo', label: 'Ama Kone', role: 'Chief Executive', cx: 390, cy: 40, tone: 'coral', people: 1240 },
    { id: 'eng', label: 'Engineering', role: 'Ravi Patel', cx: 140, cy: 152, tone: 'teal', people: 38 },
    { id: 'pd', label: 'Product & Design', role: 'Sara Lund', cx: 390, cy: 152, tone: 'violet', people: 21 },
    { id: 'gtm', label: 'Go to market', role: 'Nils Berg', cx: 640, cy: 152, tone: 'sun', people: 44 },
    { id: 'platform', label: 'Platform', role: 'Jon Bell', cx: 60, cy: 272, tone: 'plain', people: 14 },
    { id: 'apps', label: 'Apps', role: 'Mei Fong', cx: 200, cy: 272, tone: 'plain', people: 24 },
    { id: 'research', label: 'Research', role: 'Ana Ruiz', cx: 340, cy: 272, tone: 'plain', people: 8 },
    { id: 'brand', label: 'Brand', role: 'Toby Hale', cx: 480, cy: 272, tone: 'plain', people: 13 },
    { id: 'sales', label: 'Sales', role: 'Priya N.', cx: 600, cy: 272, tone: 'plain', people: 27 },
    { id: 'support', label: 'Support', role: 'Lena Hart', cx: 720, cy: 272, tone: 'plain', people: 17 },
  ];

  protected readonly edges: OrgEdge[] = [
    { from: 'ceo', to: 'eng' },
    { from: 'ceo', to: 'pd' },
    { from: 'ceo', to: 'gtm' },
    { from: 'eng', to: 'platform' },
    { from: 'eng', to: 'apps' },
    { from: 'pd', to: 'research' },
    { from: 'pd', to: 'brand' },
    { from: 'gtm', to: 'sales' },
    { from: 'gtm', to: 'support' },
  ];

  protected readonly changes = [
    { who: 'Ravi Patel', what: 'moved to Engineering', when: '3 min ago' },
    { who: 'Ana Ruiz', what: 'joined Research', when: '41 min ago' },
    { who: 'Lena Hart', what: 'took over Support', when: '2 h ago' },
  ];

  private readonly byId = new Map(this.nodes.map((n) => [n.id, n]));

  protected readonly activeNode = computed(() => {
    const id = this.active();
    return id ? this.byId.get(id) ?? null : null;
  });

  protected readonly highlightedEdges = computed(() => {
    const id = this.active();
    if (!id) return new Set<string>();
    const set = new Set<string>();
    for (const e of this.edges) {
      if (e.from === id) set.add(e.to);
      if (e.to === id) set.add(e.from);
    }
    return set;
  });

  protected readonly dimmed = computed(() => {
    const id = this.active();
    if (!id) return new Set<string>();
    const keep = new Set<string>([id, ...this.highlightedEdges()]);
    return new Set(this.nodes.map((n) => n.id).filter((nid) => !keep.has(nid)));
  });

  protected edgePath(e: OrgEdge): string {
    const a = this.byId.get(e.from)!;
    const b = this.byId.get(e.to)!;
    const x1 = a.cx;
    const y1 = a.cy + 24;
    const x2 = b.cx;
    const y2 = b.cy - 24;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  }

  protected setActive(id: string | null): void {
    this.active.set(id);
  }
}
