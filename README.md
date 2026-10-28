# Huma — HRM landing page

A hand-built marketing landing page for **Huma**, a fictional HRM (human resource
management) product. Angular 22, standalone components, zero UI libraries — every
pixel of the interface is custom CSS/SVG.

## Run it

```bash
npm install
npm start          # dev server on http://localhost:4200
npm run build      # production build → dist/hrm-landing/browser
```

Requires **Node ≥ 22.22.3** (Angular 22's minimum).

## Design system — "Editorial Ops"

Warm paper and ink instead of the usual SaaS gradient, with a coral accent.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f7f3eb` | page background |
| `--ink` | `#15141a` | text, dark bands, buttons |
| `--coral` | `#ff5a30` | primary accent, CTAs, active state |
| `--teal` | `#0d6a5c` | positive / done states |
| `--sun` | `#f6c445` | highlights, ratings |

**Type** — Fraunces (variable serif) for display headings, Inter for UI and body,
Geist Mono for labels, data and eyebrows. All three are self-hosted variable fonts
in `public/fonts`, so there is no external font request.

## Structure

```
src/
  styles/
    _tokens.scss     design tokens + mixins (label, display, card)
    _fonts.scss      @font-face for the three variable fonts
    _base.scss       reset, typography, buttons, chips, keyframes
  app/
    app.ts|html|scss shell, back-to-top
    data/content.ts  every string on the page, in one typed file
    shared/
      icon.ts        hand-drawn 24×24 SVG icon set (1.6px stroke)
      logo.ts        the Huma pulse mark
      reveal.ts      vReveal — scroll-in transition
      count-up.ts    vCount — animated number
      spotlight.ts   vSpotlight — cursor-tracking radial highlight
    sections/
      nav/           sticky nav, mega menu, mobile drawer, scroll progress
      hero/          headline, product mock, floating cards, logo marquee
      bento/         6-cell asymmetric grid, each with its own mini product UI
      workflow/      Hire / Onboard / Grow / Retain tabs with mock screens
      metrics/       dark band with count-up statistics
      orgmap/        interactive org chart — hover a node to trace the team
      stories/       testimonial carousel
      pricing/       monthly/yearly toggle, three plans
      faq/           accordion
      cta/           email capture band
      footer/        sitemap, live office clock
```

## Interactions

- Scroll-reveal on every section (`vReveal`, with per-item stagger)
- Count-up statistics on first view (`vCount`)
- Cursor-tracking spotlight on bento cards and the hero panel (`vSpotlight`)
- Product mega menu, mobile drawer, scroll-progress hairline in the nav
- Workflow tabs with a sliding indicator, each showing a different mock screen
- Interactive org chart — hovering a node dims everything except its own branch
- Monthly/yearly price toggle, accordion FAQ, draggable-free testimonial carousel
- Live office clock in the footer

## Accessibility & responsiveness

- Semantic landmarks, skip link, `aria-expanded` / `aria-selected` / `role="tabpanel"`
- Visible focus rings, keyboard-operable org nodes and menus
- `prefers-reduced-motion` disables every animation
- Layout verified at 1440px and 390px with no horizontal overflow

## Notes

Company names, statistics, testimonials and pricing are fictional placeholders for
the demo. Fonts are licensed under the SIL Open Font License (Fraunces, Inter,
Geist Mono).
