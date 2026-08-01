# FAO Accessibility Contracts

FAO properties target WCAG 2.1 AA. The tokens and component patterns already satisfy most requirements — your job is to preserve them.

## Cross-cutting principles

1. **Text alternatives** for non-text content (`alt`, `aria-label`, visually-hidden text).
2. **Color contrast** ≥ 4.5:1 for normal text, ≥ 3:1 for large text (18pt+ or 14pt+ bold) — the FAO palette satisfies this when used correctly. The combo to avoid: `text-color-gray-medium` (#999) on `bg-gray-light` (#F2F2F2) — contrast 2.4:1, fails.
3. **Keyboard operability** — every interactive control reachable by Tab; no hover-only menus or tooltips for critical info.
4. **Semantic landmarks** — `<header>`, `<nav>`, `<main>`, `<footer>`, `<aside>` must bracket the page. Exactly one `<h1>`; subsequent headings descend logically without skipping levels.
5. **Visible focus** — don't remove Bootstrap's focus ring. If restyling, preserve contrast.

## Per-component ARIA contracts

Copy the attributes from `components.md` verbatim — they are not optional styling; they are what makes the components readable by screen readers.

### Accordion / collapse
- `aria-expanded="true|false"` on the trigger button (flipped by Bootstrap JS).
- `aria-controls="<panel-id>"` on the trigger.
- `aria-labelledby="<header-id>"` on the collapsible panel.
- `data-bs-parent="#accordionId"` enforces one-panel-open behavior.
- If the trigger is an `<a>` or `<div>` instead of `<button>`, add `role="button"` and `tabindex="0"`.

### Breadcrumb
- `<nav aria-label="breadcrumb">` around the list.
- `aria-current="page"` on the final, non-link item.

### Dropdown / menu
- `aria-haspopup="true"` and `aria-expanded="false"` on the trigger.
- `aria-labelledby="<trigger-id>"` on the `.dropdown-menu`.
- Use `role="menu"` + `role="menuitem"` **only** when the list truly acts as a menu (e.g. the language switcher). A generic "open list of links" dropdown should not claim menu semantics.

### Icon-only control
Any `<button>` or `<a>` whose visible label is just `<i class="bi bi-*">` **must** have `aria-label="<Description>"`. Common labels: `Search`, `Share`, `Close`, `Toggle navigation`, `Menu`, `Open settings`.

### Modal
- `<div class="modal"` requires `tabindex="-1"`.
- `aria-labelledby="<title-id>"` pointing to the `.modal-title`.
- `aria-hidden="true"` while closed (Bootstrap flips this).
- `.btn-close` must have `aria-label="Close"` and `data-bs-dismiss="modal"`.

### Offcanvas
- Same as modal but `aria-labelledby` points to the offcanvas header title.
- Close button: `aria-label="Close"` + `data-bs-dismiss="offcanvas"`.

### Pagination
- `<nav aria-label="...">` wrapping the list.
- `aria-label="Previous"` / `aria-label="Next"` on the first/last controls.
- `aria-hidden="true"` on the decorative `«` / `»` span.
- `.page-item.active .page-link` gets `aria-current="page"`.

### Tabs
- `<ul role="tablist">`.
- Each `<a class="nav-link" role="tab" aria-selected="true|false" aria-controls="<panel-id>">`.
- Each panel `<div class="tab-pane" role="tabpanel" aria-labelledby="<tab-id>">`.

### Disabled items
- `aria-disabled="true"` on the visually disabled element.
- `tabindex="-1"` to remove from tab order.
- If the element is an `<a>`, also remove or nullify its `href`.

### Decorative icons
If an icon is purely decorative (the text next to it conveys the meaning), add `aria-hidden="true"` to the `<i>`.

## Language & direction

- Always set `<html lang="<code>">` — screen readers rely on this for pronunciation.
- For Arabic / Hebrew content, set `dir="rtl"` on `<html>` or the subtree. Bootstrap 5 ships RTL-aware utilities; the FAO CSS is compatible but test mirror-critical components (timeline, breadcrumbs, carousels).

## Forms

- Every `<input>`, `<select>`, `<textarea>` must have a visible `<label>` (`.form-label`) with `for="<input-id>"`, or — if space-constrained — a visually-hidden label (`<span class="visually-hidden">`).
- Required fields: `aria-required="true"` and a visible indicator (*).
- Error messages: `aria-describedby="<error-id>"` on the input; error text in an element with that id.
- Fieldsets with `<legend>` for grouped controls (radio sets, checkbox groups).

## Motion & animation

- Respect `prefers-reduced-motion`: the FAO CSS does not aggressively animate, but if you add custom transitions, wrap them in `@media (prefers-reduced-motion: no-preference)`.
- Auto-playing hero videos must be muted and carry a visible pause control.

## Test like a reviewer

Before marking an interface done:
- Tab through every control top-to-bottom. Does focus land in reading order? Is focus always visible?
- Run Axe or Lighthouse — aim for no critical or serious violations.
- Render at 200% zoom — no clipped content or horizontal scroll (outside data tables).
- Toggle `prefers-reduced-motion` — no essential information conveyed only through motion.
