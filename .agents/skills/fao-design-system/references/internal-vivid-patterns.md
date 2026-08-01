# Internal expressive patterns

Copy-paste snippets for the internal tier (dashboards, admin panels, automation tools, forms). Each pattern keeps FAO brand anchors intact but gives the interface more visual life than a strict corporate page. Use liberally on internal tools — sparingly on external pages.

## 1. Gradient FAO-blue hero

Works for dashboard overviews, internal tool landing states, top-of-page banners.

```html
<section class="internal-hero py-5 mb-4">
  <div class="container-fluid px-4">
    <h6 class="title-category">Dashboard</h6>
    <h1 class="display-5 fw-bold mb-2">Programme overview</h1>
    <p class="lead mb-0">A summary of active programmes, recent activity, and alerts requiring action.</p>
  </div>
</section>

<style>
  .internal-hero {
    background: linear-gradient(135deg, #116BAC 0%, #1C4767 100%);
    position: relative;
    overflow: hidden;
  }
  /* IMPORTANT: FAO theme sets explicit colors on h1/h2/p — they win by specificity
     over a parent `color: #fff` or Bootstrap's `.text-white`. Override per-element
     inside the hero so text actually renders white. Same trick for .form-shell,
     .bg-caption sections, and any dark-background band. */
  .internal-hero,
  .internal-hero h1, .internal-hero h2, .internal-hero h3,
  .internal-hero h4, .internal-hero h5, .internal-hero h6,
  .internal-hero p, .internal-hero .lead,
  .internal-hero a { color: #fff; }
  .internal-hero .title-category { color: rgba(255, 255, 255, 0.8); }
  /* Optional decorative blob */
  .internal-hero::after {
    content: "";
    position: absolute;
    top: -40%; right: -10%;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(87,146,202,0.35) 0%, transparent 70%);
    pointer-events: none;
  }
</style>
```

**Contrast gotcha** — never rely on `class="text-white"` alone or on a parent `color: #fff` for typography inside a dark-colored band. FAO's theme CSS sets explicit colors on `h1, h2, p`, and those win by CSS specificity. Always write per-element overrides in your scoped `<style>` block as shown above. This applies to `.bg-caption`, `.bg-primary`, `.form-shell`, `.internal-hero`, and any custom gradient section.

## 2. Left-accent KPI cards

Colored 4px left border encodes type (info/warning/success/danger) at a glance. Pair with Montserrat numerics for the value.

```html
<div class="row g-3 mb-4">
  <div class="col-md-3">
    <div class="card kpi-card kpi-info h-100">
      <div class="card-body">
        <h6 class="title-category">Countries</h6>
        <div class="kpi-value">194</div>
        <p class="mb-0 small text-color-gray-medium"><i class="bi bi-globe-americas me-1"></i> Member states</p>
      </div>
    </div>
  </div>
  <div class="col-md-3">
    <div class="card kpi-card kpi-success h-100">
      <div class="card-body">
        <h6 class="title-category">Active projects</h6>
        <div class="kpi-value">1,284</div>
        <p class="mb-0 small text-color-gray-medium"><i class="bi bi-arrow-up-right me-1" style="color:#2a7a2a"></i> +3.2% YoY</p>
      </div>
    </div>
  </div>
  <div class="col-md-3">
    <div class="card kpi-card kpi-warning h-100">
      <div class="card-body">
        <h6 class="title-category">Pending review</h6>
        <div class="kpi-value">42</div>
        <p class="mb-0 small text-color-gray-medium">Needs action</p>
      </div>
    </div>
  </div>
  <div class="col-md-3">
    <div class="card kpi-card kpi-danger h-100">
      <div class="card-body">
        <h6 class="title-category">Alerts</h6>
        <div class="kpi-value text-color-emergency">7</div>
        <p class="mb-0 small text-color-gray-medium"><span class="live-dot"></span>Live</p>
      </div>
    </div>
  </div>
</div>

<style>
  .kpi-card { border-left: 4px solid var(--primary); transition: transform .15s ease, box-shadow .15s ease; }
  .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(17,107,172,0.10); }
  .kpi-info    { border-left-color: #116BAC; }
  .kpi-success { border-left-color: #2a7a2a; }
  .kpi-warning { border-left-color: #F58320; }
  .kpi-danger  { border-left-color: #980000; }
  .kpi-value {
    font-family: 'Montserrat', 'Open Sans', sans-serif;
    font-weight: 700;
    font-size: 2.25rem;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--gray-dark, #545454);
    margin: 0.25rem 0;
  }
</style>
```

## 3. Status pills (data-row semantics)

```html
<span class="status-pill status-active"><span class="dot"></span>Active</span>
<span class="status-pill status-review"><span class="dot"></span>Under review</span>
<span class="status-pill status-done"><span class="dot"></span>Completed</span>
<span class="status-pill status-hold"><span class="dot"></span>On hold</span>
<span class="status-pill status-archived"><span class="dot"></span>Archived</span>

<style>
  .status-pill {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-size: 0.8rem; font-weight: 600;
    background: #F2F2F2; color: #545454;
  }
  .status-pill .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .status-active   { background: #E5ECF4; color: #116BAC; }
  .status-review   { background: #fff3e0; color: #F58320; }
  .status-done     { background: #e8f2e8; color: #2a7a2a; }
  .status-hold     { background: #fbebea; color: #980000; }
  .status-archived { background: #F2F2F2; color: #999; }
</style>
```

## 4. Live pulsing dot

For realtime indicators — running jobs, live feeds, active sessions.

```html
<span class="live-dot" aria-label="Live"></span> Live

<style>
  .live-dot {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #2a7a2a;
    margin-right: 0.35rem;
    animation: live-pulse 1.6s ease-in-out infinite;
  }
  @keyframes live-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(42,122,42,0.6); }
    50%      { box-shadow: 0 0 0 6px rgba(42,122,42,0); }
  }

  /* Brighter variant for use on dark backgrounds — dark navy .app-navbar, .bg-caption,
     or any dark-blue band. The default #2a7a2a green turns muddy on dark navy; the
     lighter #22c55e stays visibly green and the glow halo reads through. */
  .app-navbar .live-dot,
  .bg-caption .live-dot,
  .internal-hero .live-dot,
  .live-dot-bright {
    background: #22c55e;
    animation-name: live-pulse-bright;
  }
  @keyframes live-pulse-bright {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.85); }
    50%      { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
  }
</style>
```

Use plain `.live-dot` on light/white surfaces. On any dark-blue background (the `.app-navbar`, `.bg-caption` band, or any gradient hero) the context selectors above kick in automatically — or apply `.live-dot-bright` explicitly.

## 5. Inline progress bar in a card or table cell

```html
<td>
  <div class="d-flex align-items-center gap-2">
    <div class="progress flex-grow-1" style="height: 6px;">
      <div class="progress-bar bg-primary" style="width: 68%"></div>
    </div>
    <span class="small text-color-gray-medium" style="min-width:36px;">68%</span>
  </div>
</td>
```

## 6. Sparkline (inline SVG, no library)

```html
<svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
  <polyline points="0,22 14,18 28,20 42,12 56,15 70,8 84,10 100,4"
            fill="none" stroke="#116BAC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="0,22 14,18 28,20 42,12 56,15 70,8 84,10 100,4 100,30 0,30"
            fill="rgba(17,107,172,0.1)" stroke="none"/>
</svg>

<style>
  .sparkline { width: 100px; height: 24px; display: inline-block; vertical-align: middle; }
</style>
```

## 7. Hoverable card with lift

Apply to any `.card` that is clickable / interactive.

```html
<div class="card card-hover h-100">...</div>

<style>
  .card-hover { transition: transform .15s ease, box-shadow .15s ease; cursor: pointer; }
  .card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(17,107,172,0.12); }
</style>
```

## 8. Illustration empty state

For empty tables, forms before submission, dashboards before first job, tools awaiting input.

```html
<div class="empty-state text-center py-5">
  <div class="empty-state-icon">
    <i class="bi bi-inbox"></i>
  </div>
  <h4 class="mt-3 mb-1">No submissions yet</h4>
  <p class="text-color-gray-medium mb-3">Field officers' reports will appear here as they are received.</p>
  <a href="#" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i> Create the first one</a>
</div>

<style>
  .empty-state-icon {
    width: 96px; height: 96px; border-radius: 50%;
    background: #E5ECF4; color: #116BAC;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 2.75rem;
  }
</style>
```

Pick icon by context: `bi-inbox` (empty queue), `bi-file-earmark-check` (no submissions), `bi-cloud-upload` (awaiting upload), `bi-search` (no search results), `bi-bar-chart` (no data yet).

## 9. Alternating section bands

Split long internal pages so they read in rhythm.

```html
<section class="py-5">...</section>
<section class="py-5 bg-primary-light">...</section>
<section class="py-5">...</section>
<section class="py-5 bg-caption text-white">...</section>
```

## 10. Toast / inline alert

Leading icon, colored left border, dismiss button.

```html
<div class="toast-inline toast-success" role="alert">
  <i class="bi bi-check-circle-fill"></i>
  <div class="toast-body">
    <strong>Saved.</strong> Your changes are live.
  </div>
  <button type="button" class="btn-close" aria-label="Close"></button>
</div>

<style>
  .toast-inline {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    border-left: 4px solid;
    background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .toast-success { border-left-color: #2a7a2a; color: #2a7a2a; }
  .toast-warn    { border-left-color: #F58320; color: #F58320; }
  .toast-danger  { border-left-color: #980000; color: #980000; }
  .toast-info    { border-left-color: #116BAC; color: #116BAC; }
  .toast-inline .toast-body { flex: 1; color: #545454; }
  .toast-inline .bi { font-size: 1.25rem; }
</style>
```

## 11. Form multi-step progress indicator

```html
<nav class="form-steps mb-4" aria-label="Form progress">
  <ol>
    <li class="done"><span class="num">1</span> Project info</li>
    <li class="current"><span class="num">2</span> Activities</li>
    <li><span class="num">3</span> Outcomes</li>
    <li><span class="num">4</span> Review</li>
  </ol>
</nav>

<style>
  .form-steps ol { display: flex; gap: 0; list-style: none; padding: 0; margin: 0; }
  .form-steps li {
    flex: 1; display: flex; align-items: center; gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 3px solid #e0e0e0;
    color: #999; font-size: 0.9rem;
  }
  .form-steps li .num {
    width: 26px; height: 26px; border-radius: 50%;
    background: #F2F2F2; color: #999;
    display: inline-flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.85rem;
  }
  .form-steps li.done    { color: #2a7a2a; border-bottom-color: #2a7a2a; }
  .form-steps li.done .num { background: #2a7a2a; color: #fff; }
  .form-steps li.current { color: #116BAC; border-bottom-color: #116BAC; font-weight: 600; }
  .form-steps li.current .num { background: #116BAC; color: #fff; }
</style>
```

## 12. Upload dropzone

```html
<label class="dropzone" tabindex="0">
  <input type="file" multiple hidden>
  <i class="bi bi-cloud-arrow-up"></i>
  <div>
    <strong>Drop files here</strong> or click to browse
    <p class="small text-color-gray-medium mb-0">CSV, XLSX, or JSON up to 50 MB</p>
  </div>
</label>

<style>
  .dropzone {
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
    padding: 2rem; border: 2px dashed #116BAC; border-radius: 8px;
    background: #E5ECF4; color: #116BAC; cursor: pointer;
    transition: background .15s ease, border-color .15s ease;
    text-align: center;
  }
  .dropzone:hover, .dropzone:focus { background: #d9e4ef; border-color: #0e5d95; outline: none; }
  .dropzone .bi { font-size: 2.5rem; }
  .dropzone strong { color: #116BAC; }
</style>
```

## 13. Log / activity feed

Compact event stream — good for job outputs, audit trails, recent activity.

```html
<ul class="activity-feed list-unstyled">
  <li>
    <span class="dot dot-success"></span>
    <div>
      <strong>validation.csv</strong> completed successfully
      <span class="text-color-gray-medium small d-block">2 min ago · 1,284 rows · 0 errors</span>
    </div>
  </li>
  <li>
    <span class="dot dot-warn"></span>
    <div>
      <strong>intake-2026-q2.xlsx</strong> finished with 3 warnings
      <span class="text-color-gray-medium small d-block">14 min ago · 842 rows</span>
    </div>
  </li>
  <li>
    <span class="dot dot-info"></span>
    <div>
      New job submitted by <strong>m.diaz</strong>
      <span class="text-color-gray-medium small d-block">1 hour ago</span>
    </div>
  </li>
</ul>

<style>
  .activity-feed { position: relative; margin: 0; padding-left: 1.25rem; }
  .activity-feed::before {
    content: ""; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 2px; background: #F2F2F2;
  }
  .activity-feed li { position: relative; padding: 0.5rem 0 0.5rem 1rem; }
  .activity-feed .dot {
    position: absolute; left: -1.25rem; top: 0.85rem;
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid #fff; box-shadow: 0 0 0 1px #F2F2F2;
  }
  .dot-success { background: #2a7a2a; }
  .dot-warn    { background: #F58320; }
  .dot-info    { background: #116BAC; }
  .dot-danger  { background: #980000; }
</style>
```

## 14. Segmented control (filter switch)

```html
<div class="segmented" role="group" aria-label="Filter scope">
  <button class="seg-btn active">All</button>
  <button class="seg-btn">Active</button>
  <button class="seg-btn">Pending</button>
  <button class="seg-btn">Archived</button>
</div>

<style>
  .segmented { display: inline-flex; background: #F2F2F2; border-radius: 6px; padding: 3px; gap: 2px; }
  .seg-btn {
    background: transparent; border: none; padding: 0.35rem 0.9rem;
    border-radius: 4px; font: inherit; font-size: 0.85rem; color: #545454; cursor: pointer;
    transition: background .1s, color .1s;
  }
  .seg-btn:hover { background: rgba(255,255,255,0.6); }
  .seg-btn.active { background: #fff; color: #116BAC; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
</style>
```

## 15. SDG icon sizing — pick the right variant

The FAO CSS ships **two** SDG sprite variants and they look different on purpose:

- **`.sdg.sdg-N`** — 60×60px tile. Uses `background-image: url(https://www.fao.org/images/corporatelibraries/sdg/sdgXX-en.svg)` which renders the **full UN SDG icon artwork** (illustration + number + label). Requires network access to fao.org. Use this when the SDG is a *feature* of the section — an "SDG focus" panel, a research programme tile, a report header.

- **`.sdg-small.sdg-N`** — 18×18px rounded square. **Colored background + the number in white**, via `::before { content: "N" }`. *No illustration — this is by design,* not a broken sprite. Use this inline (inside a checkbox label, a table cell, a tag row, a classifications strip). At 18px an illustration would be unreadable anyway.

If the user expects to see illustrated icons (leaf, globe, etc.), reach for `.sdg`; if they need a compact color-coded marker, reach for `.sdg-small`.

Localised variants exist (`-fr`, `-es`, `-zh`, `-ar`, `-ru`) and activate automatically based on a language context class in FAO CMS output — in a standalone HTML page you get the English URL by default.

---

## 16. Guardrails — what stays off-limits even internally

- **Do not** recolor the FAO logo, add a shadow to it, or combine it with a partner logo without a visible "·" separator and equal sizing.
- **Do not** replace Open Sans in body copy. Montserrat is allowed only on large display numerics (KPI tiles) and optional display H1s.
- **Do not** invent new primary colors (neon, magenta, teal). Stay inside the FAO palette + the sanctioned green `#2a7a2a` for positive/success.
- **Do not** remove the six mandatory footer links or the `© FAO` copyright — even on internal screens.
- **Do not** use gradients that cross the color wheel (e.g. blue-to-magenta). Only blue-to-blue (`#116BAC → #1C4767`) or blue-to-navy gradients.
- **Do not** use drop shadows heavier than `0 8px 28px rgba(17,107,172,0.15)` — internal should feel crisp, not chubby.
