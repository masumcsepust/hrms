export interface NavLink {
  label: string;
  href: string;
}

export interface Feature {
  tag: string;
  title: string;
  body: string;
  art: 'pipeline' | 'checklist' | 'sentiment' | 'leave' | 'org' | 'payslip';
  span: 'wide' | 'tall' | 'std';
}

export interface WorkflowStep {
  key: string;
  label: string;
  title: string;
  body: string;
  points: string[];
  stat: { value: string; label: string };
}

export interface Metric {
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
  label: string;
}

export interface Quote {
  text: string;
  name: string;
  role: string;
  company: string;
  initials: string;
  hue: number;
}

export interface Plan {
  name: string;
  blurb: string;
  monthly: number | null;
  yearly: number | null;
  unit: string;
  cta: string;
  features: string[];
  featured: boolean;
  note: string;
}

export interface Faq {
  q: string;
  a: string;
}

export const BRAND = {
  name: 'Huma',
  tagline: 'People ops, without the busywork.',
};

export const NAV: NavLink[] = [
  { label: 'Product', href: '#features' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Customers', href: '#stories' },
  { label: 'Pricing', href: '#pricing' },
];

export const TRUST_POINTS = [
  'No credit card for 30 days',
  'SOC 2 Type II & GDPR ready',
  'Syncs with Slack, Google & BambooHR',
];

export const CLIENT_LOGOS: string[] = [
  'NORTHWIND',
  'Kettle &amp; Co.',
  'Paperleaf',
  'Orbita',
  'Fjord Health',
  'Studio Maru',
  'Vela Labs',
  'Brightpath',
];

export const FEATURES: Feature[] = [
  {
    tag: 'Recruiting',
    title: 'Applicant tracking without the tab circus',
    body: 'Post a role, share a link, and watch every candidate move through your pipeline. Résumés, notes, scorecards, and offers live in one thread.',
    art: 'pipeline',
    span: 'wide',
  },
  {
    tag: 'Onboarding',
    title: 'Day one, already sorted',
    body: 'Templates, tasks, equipment, and buddy intros — triggered the moment a contract is signed.',
    art: 'checklist',
    span: 'tall',
  },
  {
    tag: 'Reviews',
    title: 'Reviews people don’t dread',
    body: 'Two-minute check-ins that actually get finished, with sentiment trends you can act on.',
    art: 'sentiment',
    span: 'std',
  },
  {
    tag: 'Time off',
    title: 'Leave without the approvals spiral',
    body: 'Balances, holidays, sick days and cover — approved in Huma, synced to calendars.',
    art: 'leave',
    span: 'std',
  },
  {
    tag: 'Org chart',
    title: 'An org chart that’s never out of date',
    body: 'Roles, teams, and reporting lines update themselves. No more “who reports to whom?” in DMs.',
    art: 'org',
    span: 'std',
  },
  {
    tag: 'Payroll',
    title: 'Payslips on autopilot',
    body: 'Approved hours flow straight to payroll. Everyone gets a payslip they understand.',
    art: 'payslip',
    span: 'wide',
  },
];

export const WORKFLOW: WorkflowStep[] = [
  {
    key: 'hire',
    label: 'Hire',
    title: 'From first résumé to signed offer in 6 days',
    body: 'Huma keeps the whole hiring team in the same room — literally. Post once, review together, and let automations handle the nudges you’d otherwise forget.',
    points: [
      'Auto-sourced job posts for every team',
      'Structured scorecards, no vague gut calls',
      'Offer letters generated from your template',
    ],
    stat: { value: '6 days', label: 'median time to offer' },
  },
  {
    key: 'onboard',
    label: 'Onboard',
    title: 'New joiners feel like they’ve been here a week',
    body: 'The first day is where people decide whether they’ll stay. Huma removes every friction point: accounts, equipment, introductions, and a plan for week one.',
    points: [
      'Role-based onboarding templates',
      'Equipment & access requests, tracked',
      'Automated buddy intros and week-one nudges',
    ],
    stat: { value: '94%', label: 'ready on day one' },
  },
  {
    key: 'grow',
    label: 'Grow',
    title: 'Reviews that actually change something',
    body: 'Lightweight check-ins replace the annual form. Spot where people are stuck, celebrate wins in time, and keep development plans alive between cycles.',
    points: [
      'Two-minute pulse check-ins, weekly',
      'Growth plans with real milestones',
      'Skills map that follows the team',
    ],
    stat: { value: '2 min', label: 'per check-in' },
  },
  {
    key: 'retain',
    label: 'Retain',
    title: 'Catch the quiet resignations early',
    body: 'Huma watches the signals — time off patterns, sentiment drift, workload spikes — and flags the people who need a conversation before they hand in notice.',
    points: [
      'Early-warning signals, quietly collected',
      'Private 1:1 notes and pulse history',
      'Compensation review in the same place',
    ],
    stat: { value: '−31%', label: 'regretted attrition' },
  },
];

export const METRICS: Metric[] = [
  { value: 4.2, prefix: '', suffix: '×', decimals: 1, label: 'Faster time-to-hire' },
  { value: 38, prefix: '', suffix: '%', decimals: 0, label: 'Less time spent on admin' },
  { value: 92, prefix: '', suffix: '%', decimals: 0, label: 'Team adoption in 90 days' },
  { value: 11, prefix: '', suffix: ' min', decimals: 0, label: 'Saved per employee, monthly' },
];

export const QUOTES: Quote[] = [
  {
    text: 'We killed three spreadsheets and a project-management tool in the first month. Huma is now the single place my team looks before they ask me anything.',
    name: 'Rena Östberg',
    role: 'Head of People',
    company: 'Fjord Health',
    initials: 'RÖ',
    hue: 12,
  },
  {
    text: 'Onboarding went from six weeks of chasing to two days of setup. New joiners write their first PR before their laptop even unboxes.',
    name: 'Tobias Ferrand',
    role: 'VP Engineering',
    company: 'Orbita',
    initials: 'TF',
    hue: 168,
  },
  {
    text: 'The org chart alone paid for it. We stopped losing two days a month on “who’s on which team” and finally started planning headcount properly.',
    name: 'Priya Nandakumar',
    role: 'COO',
    company: 'Paperleaf',
    initials: 'PN',
    hue: 38,
  },
];

export const PLANS: Plan[] = [
  {
    name: 'Starter',
    blurb: 'For small teams getting off spreadsheets.',
    monthly: 8,
    yearly: 6,
    unit: 'per person / month',
    cta: 'Start free',
    features: [
      'Profiles, documents &amp; org chart',
      'Time off with approvals',
      'Onboarding templates',
      'Email support',
    ],
    featured: false,
    note: 'Up to 25 people',
  },
  {
    name: 'Team',
    blurb: 'The full people system, running end to end.',
    monthly: 16,
    yearly: 13,
    unit: 'per person / month',
    cta: 'Start free',
    features: [
      'Everything in Starter',
      'Applicant tracking &amp; offers',
      'Review cycles &amp; growth plans',
      'People analytics &amp; early warnings',
      'Slack &amp; Google Workspace sync',
    ],
    featured: true,
    note: 'Best for 25–500 people',
  },
  {
    name: 'Enterprise',
    blurb: 'For organisations with real complexity.',
    monthly: null,
    yearly: null,
    unit: 'custom',
    cta: 'Talk to sales',
    features: [
      'Everything in Team',
      'SSO, SCIM &amp; audit trails',
      'Multi-entity &amp; multi-country',
      'Payroll connectors',
      'Dedicated success manager',
    ],
    featured: false,
    note: 'From 500 people',
  },
];

export const FAQS: Faq[] = [
  {
    q: 'How long does it take to move our data in?',
    a: 'Most teams are live in under a week. We import from spreadsheets, BambooHR, HiBob, and CSV — including leave balances, org structure, and document history. A migration specialist handles the messy cases with you.',
  },
  {
    q: 'Do we need our own developers to set this up?',
    a: 'No. Huma is a no-code product with a canvas builder, workflow automations, and an API when you outgrow the UI. Your first workflows can be live in an afternoon.',
  },
  {
    q: 'Can employees use it on a phone?',
    a: 'Yes. Leave requests, check-ins, payslips, and the org chart are all mobile-first. Approval flows work from a phone notification without opening the app.',
  },
  {
    q: 'How do you handle payroll and sensitive data?',
    a: 'Data is encrypted in transit and at rest, hosted in the EU or US region of your choosing. We are SOC 2 Type II certified and GDPR compliant, and never train models on your people data.',
  },
  {
    q: 'What if we are a distributed team across time zones?',
    a: 'Huma shows every time-off balance in the person’s local timezone, supports overlapping hours, and lets you set cover rules per team. The holiday calendars are region-aware.',
  },
];

export const FOOTER_COLUMNS: { title: string; links: string[] }[] = [
  {
    title: 'Product',
    links: ['Recruiting', 'Onboarding', 'Reviews', 'Time off', 'Payroll', 'Org chart'],
  },
  {
    title: 'Resources',
    links: ['Help centre', 'API docs', 'Templates', 'People ops blog', 'HR calculator', 'Status'],
  },
  {
    title: 'Company',
    links: ['About', 'Customers', 'Careers', 'Press kit', 'Contact'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Security', 'DPA', 'Sub-processors'],
  },
];
