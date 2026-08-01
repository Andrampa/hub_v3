# FAO Dashboard Minimum Requirements

Source: https://design-system.fao.org/styles/dashboard-minimum-requirements

Every FAO dashboard, web app, or internal tool **must** satisfy the following. This is not a style suggestion — it is the contract that makes an interface officially FAO-branded.

## The three pillars

### 1. Header
- Include the FAO corporate header (`.fao-header.subsite-header`) **or** the app-style navbar (`.app-navbar`) — both qualify.
- The FAO logo must appear, link back to `https://www.fao.org/` (or the parent FAO property), and carry a descriptive `alt` attribute.
- For multi-language content, include the language switcher pattern (dropdown inside `.fao-header-right`).

### 2. Footer
Must include — in this order, as `<li class="list-inline-item">` entries inside the footer's `<ul class="list-inline">`:
1. Contact us → `https://www.fao.org/contact-us/en/`
2. Terms and Conditions → `https://www.fao.org/contact-us/terms/en/`
3. Data protection and privacy → `https://www.fao.org/contact-us/data-protection-and-privacy/en/`
4. Scam Alert → `https://www.fao.org/contact-us/scam-alert/en/`
5. Report Misconduct → `https://www.fao.org/audit-and-investigations/reporting-misconduct/en/`
6. Transparency and accountability → `https://www.fao.org/transparency/en`

Plus the copyright: `<a class="copyright" href="...">© FAO&nbsp;<YEAR></a>`.

The compact `.footer.footer-app` form is acceptable for internal apps. Public-facing dashboards should use the full `.footer`.

### 3. Typography + color
- Open Sans as the primary UI font (loaded automatically by `fao-theme.min.css`).
- Primary actions styled with FAO Blue `#116BAC` via `.btn-primary`.
- Body text uses `#545454` (`.text-color-default`, applied by default).

## Compliance checklist

Before reporting a dashboard task as complete, verify:

- [ ] `fao-theme.min.css` is loaded.
- [ ] Bootstrap 5 CSS + JS bundle is loaded (peer dep — required for dropdowns, offcanvas, modals).
- [ ] FAO logo appears in the header with correct alt text and link.
- [ ] Language switcher is present if the app serves multiple languages.
- [ ] All six mandatory footer links are present and resolve to fao.org.
- [ ] `© FAO <year>` copyright is present.
- [ ] Exactly one `<h1>` on the page; headings descend in logical order.
- [ ] Every icon-only control has `aria-label`.
- [ ] No hover-only interactions — all functionality reachable by keyboard.
- [ ] Color contrast ≥ 4.5:1 for body text (default tokens satisfy this — check if you override).
- [ ] Dashboard renders correctly at 375px, 768px, 1024px, and 1440px widths.
- [ ] Works in dark mode if `[data-bs-theme="dark"]` is togglable — or the toggle is disabled.

## Frequent mistakes to avoid

- Replacing Open Sans with a different sans-serif (Roboto, Inter, etc.). This breaks the brand contract.
- Using `.btn-primary` then recoloring it with inline `style` — keep the FAO Blue.
- Dropping the footer because "it's an internal tool." The compliance requirement applies to internal apps too.
- Using a cropped or recolored FAO logo. See `logo.md`.
- Putting dashboard data-viz colors outside the FAO palette. See `charts.md`.
