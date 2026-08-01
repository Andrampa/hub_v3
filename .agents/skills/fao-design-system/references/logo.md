# FAO Logo Usage

The FAO logo is legally protected. The SVGs bundled in `assets/logos/` are approved for use on FAO properties and FAO-affiliated dashboards. Any other use requires written permission from `[email protected]`.

## What we ship

| File | When to use |
|---|---|
| `fao-logo-en.svg` | Standard blue English logo — for headers of English-language properties. |
| `fao-logo-blue-3lines-en.svg` | 3-line blue English logo — the preferred corporate-header variant because it reads clearly at small heights. |
| `fao-logo-three-lines.svg` | 3-line mark without language-specific wordmark — use in contexts where the language is implicit or when rendering at very small sizes. |

Additional variants (Arabic, Chinese, French, Russian, Spanish; 2-line layouts; black and white color variants) exist in the FAO corporate library. If you need one that isn't bundled, ask the user to download it from the FAO Sitefinity library rather than guessing.

## Hard rules

1. **Emblem + wordmark always together** — never use the wheat-ear emblem alone.
2. **Minimum height** — 40px on desktop, 35px on mobile. Measured from the tallest element of the logo.
3. **Clear space** — maintain padding equal to the x-height of the wordmark on all sides. No other logos, text, or UI elements may encroach.
4. **Color** — blue on light backgrounds, white on dark. **Never** recolor the logo (no brand-team "fun" orange variant, no red outline, no gradient).
5. **Do not skew, rotate, distort, or add effects** (shadow, glow, emboss, outline).
6. **Do not imply endorsement** — the logo must not appear next to commercial products, partners' proprietary logos, or third-party advertising unless FAO has given explicit written approval.

## Correct embedding

### In the corporate header (`.fao-header`)
```html
<div class="fao-header-left">
  <a href="https://www.fao.org/home/en/">
    <img src="./logos/fao-logo-blue-3lines-en.svg"
         alt="Food and Agriculture Organization of the United Nations"
         title="Food and Agriculture Organization of the United Nations"
         class="header-fao-logo">
  </a>
</div>
```

### In the app navbar (`.app-navbar`)
```html
<a class="navbar-brand p-0 me-0 me-lg-4 d-flex align-items-center" href="/" aria-label="FAO Dashboard">
  <img height="40" src="./logos/fao-logo-three-lines.svg" alt="FAO">
  <p class="d-none d-lg-block ms-3 mb-0 ps-3 fw-semibold text-uppercase text-gray">App name</p>
</a>
```

### In the footer
Use the same blue 3-line variant, larger (~80px tall), inside `.footer-logo.col-md-7`.

## Alt text recipe

Full: `alt="Food and Agriculture Organization of the United Nations"`
Short (when space is a factor): `alt="FAO"` — acceptable in an app navbar where the full name is elsewhere on the page.

Never use `alt="logo"` or `alt="image of FAO logo"` — describes the image, not its role.
