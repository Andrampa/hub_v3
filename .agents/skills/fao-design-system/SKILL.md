---
name: fao-design-system
description: Use this skill to build or restyle web interfaces under the FAO (Food and Agriculture Organization) brand — whether FAO is named explicitly or implied by context. Trigger on explicit mentions: FAO, Food and Agriculture Organization, FAOSTAT, fao.org, FAO regional conferences or offices (RAF, RAP). Also trigger when FAO is implied: "the Organization" in a UN agency voice; "Director General" briefings; Sitefinity subsites; "our intranet" or "our design system" where the speaker is FAO staff; Open Sans as an institutional typeface; field officers or programme staff needing an on-brand tool; or restyling something to match "the Organization's" visual identity. Interface type doesn't matter — dashboards, intake forms, admin panels, automation consoles, report viewers, registration forms, landing pages, or microsites all qualify. Implements FAO Design System v3.6.8 with Bootstrap 5, official FAO header/footer, Open Sans, and the FAO Blue palette.
---

# FAO Design System

A complete toolkit for building visually consistent, accessible, FAO-branded web interfaces — public sites, internal apps, dashboards, forms, admin consoles, reports. Built on top of Bootstrap 5 with FAO-specific theming, components, SDG/flag sprites, and strict brand rules.

This skill bundles the v3.6.8 minified CSS and the official FAO logos so you can build offline.

---

## Step 0 — Classify the build

Before picking a template or writing markup, decide which tier the interface belongs to. This decision drives **everything**: the starter template, the visual tone, how much creative latitude you take, and which accent patterns you apply. If the user hasn't said, infer from the task description; when genuinely ambiguous, ask one short question.

### External (strict brand) tier
**Audience**: public visitors, partners, media, the world.
**Examples**: landing page, campaign microsite, programme hub, public subsite, event page, topic page, news item, publication landing, corporate "About" page.
**Signals**: "landing page", "microsite", "campaign", "public-facing", "fao.org/…", "we're announcing", "press release", "public launch".
**Rules**: maximum brand fidelity. Conservative visual tone. Follow the corporate patterns in `components.md` verbatim. Use the full `.footer` with social icons. No invented components, no custom gradients beyond what `components.md` shows. Start from `assets/templates/starter-subsite.html`.

### Internal (expressive) tier
**Audience**: FAO staff, field officers, project managers, analysts, ops teams.
**Examples**: dashboard, admin panel, data-entry form, intake/collection system, automation console, bulk-upload tool, approval workflow, report viewer, pipeline monitor, job queue, validation console, field-officer app, internal utility.
**Signals**: "admin", "internal", "for staff", "for my team", "backend", "console", "intake", "data entry", "bulk upload", "automation", "pipeline", "queue", "monitor", "workflow", "approval".
**Rules**: brand identity stays fixed (header, footer, palette, typography, logo) but visual tone can be **richer**: gradient heroes, colored left-borders on cards, status dots, progress bars, sparklines, micro-interactions, illustration empty states, hover lifts. See `references/internal-vivid-patterns.md` for the concrete moves. Start from `assets/templates/starter-dashboard.html`, `starter-internal-tool.html`, or `starter-form.html` depending on shape.

### When to pick which starter

| Shape | Tier | Starter |
|---|---|---|
| Landing page, campaign hub, microsite, public topic page | External | `starter-subsite.html` |
| Dashboard with KPIs + charts + tables | Internal | `starter-dashboard.html` |
| Automation console / job queue / monitor / bulk tool | Internal | `starter-internal-tool.html` |
| Multi-step form / intake / data-collection / submission | Internal | `starter-form.html` |
| Admin panel for records (CRUD-like) | Internal | `starter-dashboard.html` (adapt the main area) |
| Report viewer (reading, not editing) | Internal | `starter-dashboard.html` |

If the task doesn't match any, build from the closest starter and adapt.

---

## First moves — always read this

1. **Read `references/dashboard-requirements.md` first** if the user is building a dashboard or app. There are non-negotiable rules (header, footer, typography, logo) that must be present or the output is non-compliant.
2. **Start from `assets/templates/starter-dashboard.html`** rather than writing boilerplate from scratch — it already wires Bootstrap 5, Bootstrap Icons, the FAO theme CSS, Open Sans, the corporate header, and the app footer. Copy it, then customize.
3. **Copy the asset files** the user needs into their project:
   - `assets/css/fao-theme.min.css` — required for every FAO page (143KB, includes all component classes, tokens, SDG/flag sprites)
   - `assets/css/fao-home.min.css` — only include if building an FAO **homepage-style** hero layout; skip for dashboards/apps
   - `assets/logos/fao-logo-en.svg` — default English blue logo for headers
   - `assets/logos/fao-logo-blue-3lines-en.svg` — 3-line blue variant (preferred in the corporate header)
   - `assets/logos/fao-logo-three-lines.svg` — language-neutral 3-line mark
4. **If the user has not said what language variant they need**, ask before producing translated copy. The design system ships UI patterns for AR / ZH / EN / FR / RU / ES; default to English only when no signal is given.

If the user hasn't told you whether this is a public microsite, an internal dashboard, or an app, ask — the skeletons differ.

---

## Required dependencies

FAO's CSS assumes **Bootstrap 5** (5.2+) and **Bootstrap Icons 1.13+**. Without Bootstrap JS, accordions, dropdowns, modals, offcanvas, tabs, and collapsible search will not work.

```html
<!-- In <head> -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="./css/fao-theme.min.css">
<!-- Bootstrap Icons are already @imported inside fao-theme.min.css -->

<!-- Before </body> -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
```

`fao-theme.min.css` already `@import`s Open Sans, Montserrat, Merriweather, Cairo, Noto Sans JP, and Bootstrap Icons from their CDNs. **Do not** add duplicate font links unless the user works offline, in which case self-host them and rewrite the `@import`s.

### npm path

If the user prefers npm:

```bash
npm install fao-design-system bootstrap@5.3.3 bootstrap-icons@1.13.1
```

Then import `node_modules/fao-design-system/fao-theme.min.css` and (optionally) `fao-home.min.css`. Bootstrap is a **peer dependency** — the FAO package does not ship it.

---

## Mandatory elements for any FAO interface

Every public-facing FAO app or dashboard MUST include all three. This is not stylistic preference — it is the `styles/dashboard-minimum-requirements` contract.

1. **FAO header** with the FAO logo linking back to the root — see `references/components.md` § Headers. Use the `.fao-header` or `.app-navbar` variant; both qualify.
2. **FAO footer** including links to Contact us, Terms and Conditions, Data protection and privacy, Scam Alert, Report Misconduct, Transparency and accountability, plus the `© FAO <year>` copyright — see `references/components.md` § Footers. The lightweight `.footer.footer-app` form is fine for internal apps.
3. **Open Sans typography + official FAO color palette**. `fao-theme.min.css` sets these for you as long as you do not override `font-family` or the primary tokens.

Verify every dashboard you produce against `references/dashboard-requirements.md` before reporting the task complete.

---

## Visual richness — default to imagery, not icons

FAO pages look flat and generic when cards and sections are icon-only. When building anything with a marketing or editorial feel (landing pages, subsite sections, hero areas, campaign hubs, pillar/feature grids), default to **real imagery** first and only fall back to icons when the user explicitly asks for icon-only.

### Feature / pillar / topic cards
Every `.card` that represents a topic, section, pillar, or story **must** include `.card-image.ratio.ratio-3x2 > img`. Picking "three icon tiles" is a shortcut that looks unbranded. Canonical pattern:

```html
<div class="card h-100">
  <div class="card-image ratio ratio-3x2">
    <img src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800" alt="Smallholder farmer in field">
  </div>
  <div class="card-body">
    <h6 class="title-category">Pillar</h6>
    <h5 class="card-title"><a href="#" class="title-link">Sustainability</a></h5>
    <p class="card-text">Body copy.</p>
    <a href="#" class="link-icon">Explore<i class="bi bi-chevron-right"></i></a>
  </div>
</div>
```

When the user hasn't supplied imagery, use **Unsplash** URLs themed around the content — food, farming, smallholders, forests, water, fisheries, markets, communities, women in agriculture, climate, rural landscapes. Pattern: `https://images.unsplash.com/photo-<id>?w=800` (standard dimensions). A safe, thematic default set:
- Agriculture / crops — `photo-1500937386664-56d1dfef3854`, `photo-1464226184884-fa280b87c399`
- Food / nutrition — `photo-1490818387583-1baba5e638af`, `photo-1506484381205-f7945653044d`
- Fisheries / water — `photo-1518770660439-4636190af475`, `photo-1516467508483-a7212febe31a`
- Forest / biodiversity — `photo-1448375240586-882707db888b`, `photo-1441974231531-c6227db76b6e`
- Community / markets — `photo-1519682337058-a94d519337bc`, `photo-1604335398980-ededa9a5e0a9`

If Unsplash is blocked or the user is offline, fall back to `https://picsum.photos/800/532?random=N`.

Always write real `alt` text describing the scene — never `alt="image"` or `alt="pillar 1"`.

### Card variety — don't repeat one variant three times
A row of three identical white cards reads as wireframe. Mix variants for visual rhythm:
- **Default light card** (white) for the first.
- **`.card.bg-primary-light`** or **`.card.bg-gray-light`** for the second — tinted surface.
- **`.card.card-overlay`** with a background image and `.card-img-overlay` caption for the third — most dramatic.

Or use the overlay pattern on all three for a high-impact landing hero row. For overlay cards the text sits on top of the image with a dark gradient for legibility — see `references/components.md` § Cards for the exact markup.

### Hero banners with real imagery
A `.hero-banner` without a `background-image` is an empty gray box. Always set one:

```html
<div class="hero-banner" style="background-image: url('https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1600');">
  <div class="hero-caption">
    <h6 class="title-category">Campaign</h6>
    <h1 class="title-link"><a href="#">Headline</a></h1>
    <p>Lede paragraph.</p>
    <a href="#register" class="btn btn-primary btn-lg">Primary CTA<i class="bi bi-chevron-right"></i></a>
  </div>
</div>
```

If text legibility fights the image, add a gradient overlay via a scoped `<style>`:
```css
.hero-banner::before {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(17,107,172,0.75) 0%, rgba(17,107,172,0) 60%);
}
```

### Accent colors — use them
Conservative gray-on-white pages are *boring*, not *professional*. Deploy accents tactically:
- **`.bg-caption`** (`#1C4767`) for a dramatic dark band — a pull-quote section, a feature strip, the CTA before the footer.
- **`.bg-primary-light`** for an alternating tinted section that breaks up long white pages.
- **`.bg-orange`** / **`.text-color-orange`** for attention callouts — "New", "Early-bird deadline", limited-time banners. Use sparingly (one per page).
- **`.bg-emergency`** / **`.text-color-emergency`** only for critical/destructive states or urgent alerts. Never decorative.

### SDG icons as brand accents
Any page touching policy, research, programmes, or targets should carry at least one `.sdg-list` row with the relevant SDG icons (`.sdg.sdg-1` through `.sdg.sdg-17`). They add bright, instantly-recognizable color without competing with FAO Blue.

### Summary rule
**If your page has 3 cards and none of them have an image, stop and add images.** If your landing has a hero but no background image, stop and add one. If every section of your page is white, stop and introduce one `.bg-primary-light` or `.bg-caption` band. Vividness within brand standards means photography + disciplined accent color + SDG/flag splashes — not neon, not gradients, not drop shadows.

---

## Expressive patterns for the internal tier

For **internal** tools (dashboards, admin panels, automation consoles, data-entry forms), the corporate palette and typography stay fixed but the visual register can be more expressive. Plain gray-on-white is *not* "professional", it is *unfinished*. Apply the patterns below liberally — they are listed in `references/internal-vivid-patterns.md` with copy-paste snippets. Quick overview:

- **Gradient FAO-blue heroes** on the top band (`linear-gradient(135deg, #116BAC → #1C4767)`) with white or light-blue typography. Works especially well for dashboard overview pages and internal tool homepages.
- **Left-accent KPI cards** — a colored 4px left border (`border-left: 4px solid var(--primary)` or orange/emergency) on `.card` that encodes meaning at a glance.
- **Status pills and dots** — rounded `.badge` variants for row-status, and small colored dots for realtime/online indicators.
- **Inline progress bars** and **sparklines** inside table cells or cards.
- **Soft shadows and hover lifts** on interactive cards (`transition: transform .15s; &:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(17,107,172,0.08); }`).
- **Illustration empty states** for tables with no rows, forms before submission, or tools awaiting input — a large Bootstrap icon in a tinted circle, a short helpful sentence, and a primary action.
- **Colored section bands** alternating `.bg-primary-light` and white to split long pages.
- **Toast / inline alert patterns** with leading icon, colored left border, and dismiss button.
- **Live indicators** — a small pulsing dot using a `@keyframes pulse` animation — for live data feeds, running jobs, active sessions.
- **Montserrat for display numerics** in KPI tiles (e.g. `font-family: 'Montserrat', ...; font-weight: 700; letter-spacing: -0.02em;`) — the one place non-Open-Sans type is sanctioned, and only for large numbers.

**What stays strict even internally**: the FAO logo (unmodified), the full footer with all six mandatory policy links + `© FAO`, Open Sans as the body typeface, the mandatory `.fao-header` or `.app-navbar`. Nothing in the expressive tier overrides brand compliance — it only enriches the visual treatment between those anchors.

See `references/internal-vivid-patterns.md` for ready-to-paste CSS + HTML snippets for each of these patterns.

---

## FAO brand tokens (quick reference)

Full palette + usage rules are in `references/colors.md`. The high-signal ones:

| Purpose | Token | Hex | CSS var | Utility classes |
|---|---|---|---|---|
| Primary brand | FAO Blue | `#116BAC` | `--primary`, `--link`, `--btn-primary` | `.bg-primary`, `.text-color-primary` |
| Primary light (tinted bg) | | `#E5ECF4` | `--primary-light` | `.bg-primary-light`, `.text-color-primary-light` |
| Body text | Gray Dark | `#545454` | `--on-background`, `--on-surface` | `.text-color-default`, `.text-color-gray-dark` |
| Secondary text | Gray Medium | `#999999` | `--on-background-secondary` | `.text-color-gray-medium` |
| Subtle surfaces | Gray Light | `#F2F2F2` | `--line` | `.bg-gray-light` |
| Accent / warning | FAO Orange | `#F58320` | | `.bg-orange`, `.text-color-orange` |
| Critical / emergency | Emergency Red | `#980000` | | `.bg-emergency`, `.text-color-emergency` |
| Deep captions / dark surface | Caption Blue | `#1C4767` | | `.bg-caption`, `.text-color-caption` |
| UN alignment | UN Blue | `#5792C9` | | `.bg-un-blue`, `.text-color-un-blue` |

**Primary typeface**: Open Sans, weights 300/400/500/600/700/800. Fallbacks: Helvetica, Arial. For Arabic content, `Cairo` is loaded; for Japanese content, `Noto Sans JP`. Headings follow Bootstrap's `h1`–`h6` sizing with FAO-specific modifier classes — see `references/typography.md`.

**Dark mode** is supported natively: set `data-bs-theme="dark"` on `<html>` or any container. All the tokens above remap automatically.

---

## Component catalog

Full HTML + class lists are in `references/components.md`. Scan the table below first to pick the right component, then read the matching section.

| Need | Component | Page in ref |
|---|---|---|
| Page-level brand bar + language switch + discover menu | `.fao-header.subsite-header` | Headers |
| Sticky sidebar + topbar app shell | `.app-navbar` + `.app-layout` + `.app-sidebar` | Headers, Layout |
| Policy / legal footer | `.footer` or `.footer.footer-app` | Footers |
| Primary / secondary / outline buttons, icon buttons, round buttons | `.btn` + variants | Buttons |
| Clickable content tile with image | `.card` + type modifier (`.card-news`, `.card-events`, `.card-publication`, etc.) | Cards |
| Detail list row (like a search hit) | `.d-list` + type modifier | Lists |
| Collapsible Q&A | `.accordion` (Bootstrap 5) | Accordion |
| Tabs | `.tabbed-content` + Bootstrap tabs | Tabbed content |
| Hero banner (image or looping video) | `.hero-banner` + `.hero-caption` | Hero banners |
| Carousel / slider | `.swiper` variants (Swiper.js) | Swipers |
| Page-level search + advanced filters | `.dynamic-search` | Searches |
| Breadcrumbs | Bootstrap `.breadcrumb` | Breadcrumbs |
| Pagination | Bootstrap `.pagination` | Paginations |
| Tag / badge strip | `.tags-list` + `.badge.text-bg-secondary` | Tag lists |
| Co-branded sub-header strip | `.custom-sub-header` | Custom sub header |
| SDG icons (1–17) | `.sdg.sdg-N` or `.sdg-small.sdg-N` | SDG icons (references/components.md) |
| Country flags (ISO-3) | `.flag.flag-<iso3>` (+ `.flag-small`) | Flags |
| Leaflet maps with UN basemap | `.ratio.ratio-21x9` + Leaflet init | Maps |
| Interactive timeline | KnightLab TimelineJS | Timeline |

**Bootstrap everything else**: `container`, `row`, `col-*`, `d-flex`, `input-group`, `form-control`, `modal`, `offcanvas`, `table`, `dropdown`, `alert`, spacing utilities, `ratio` — use Bootstrap 5 docs as the source of truth; FAO just restyles.

---

## Layout skeletons

### Subsite page (public content)

```html
<header class="fao-header subsite-header">...</header>
<div class="subheader">
  <div class="container"><div class="row"><div class="col-12">
    <h2 class="page-title">Page title</h2>
  </div></div></div>
</div>
<main>
  <div class="container">
    <!-- .row / .col-* here -->
  </div>
</main>
<footer class="footer">...</footer>
```

### App / dashboard with sidebar

```html
<header class="navbar navbar-expand-lg navbar-dark app-navbar sticky-top">...</header>
<div class="app-layout">
  <aside class="app-sidebar">
    <nav>
      <ul class="list-unstyled">
        <li class="app-sidebar-item">
          <a class="app-sidebar-link" href="#">Dashboard</a>
        </li>
      </ul>
    </nav>
  </aside>
  <main class="app-main">
    <div class="container-fluid">
      <!-- widgets, KPI cards, charts -->
    </div>
  </main>
</div>
<footer class="footer footer-app">...</footer>
```

For a single-column app without sidebar, add `.app-no-sidebar` to the layout wrapper and drop the `<aside>`.

Full skeletons with working header + footer markup are in `assets/templates/`.

---

## Charts, data viz, and metrics

The FAO Design System does **not** ship a charting library — dashboards are expected to bring their own (Chart.js, ECharts, Plotly, D3, Highcharts). When doing so, **always** style data series using the FAO palette so charts visually belong to the brand. Concrete guidance and ready-to-paste color arrays: `references/charts.md`.

For KPI tiles, reuse a `.card` with a large number inside `.card-title` and a label in `.title-category`. Don't invent new "stat" classes.

---

## Logo rules — read before embedding

The FAO logo is legally protected. The skill's `assets/logos/` bundle is OK to use on FAO properties, but any external use requires written permission from `[email protected]`.

Hard rules:
- **Emblem + wordmark always together** — never crop or separate them.
- **Minimum height**: 40px desktop, 35px mobile.
- Use the **blue** logo on light backgrounds, **white** on dark. Never recolor.
- Never imply endorsement of a product or partner.

Language variants (2-line and 3-line) exist for AR / ZH / EN / FR / RU / ES. Full usage matrix is in `references/logo.md`.

---

## Accessibility baseline

Every FAO interface must:
- Provide `alt` text for non-decorative images; use `aria-label` for icon-only controls (Search, Share, Close, etc.).
- Use semantic landmarks: one `<h1>`, logical heading order, `<header>/<nav>/<main>/<footer>`.
- Preserve keyboard navigability — no hover-only interactions.
- Maintain 4.5:1 contrast (the FAO tokens already satisfy this when used correctly — don't, for example, put `text-color-gray-medium` on `bg-gray-light`).

Per-component ARIA contracts (accordion, modal, dropdown, tablist, pagination, breadcrumb, disabled items) live in `references/accessibility.md`. Always copy the ARIA attributes from the reference examples verbatim — they are not optional.

---

## When in doubt

- If a pattern exists in `references/components.md`, use it verbatim rather than inventing markup. The FAO CSS only styles the documented classes; ad-hoc markup will look unbranded.
- If a component is missing from the reference, fall back to plain Bootstrap 5 with FAO color/typography tokens applied.
- If the user asks for something that would violate the minimum requirements (hide the header, remove the footer links, replace Open Sans, recolor the logo), push back and explain why — these are contractual, not stylistic.
- Live docs and the changelog are at https://design-system.fao.org/ — fetch them if the user references a component this skill's references don't cover.
