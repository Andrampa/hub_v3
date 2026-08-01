# FAO Color Palette

The FAO tokens are defined as CSS custom properties in `:root` of `fao-theme.min.css`. Dark mode remaps automatically via `[data-bs-theme="dark"]` — toggle by setting that attribute on `<html>` or any subtree.

## Hex values and where to use them

| Role | Hex | RGB | CSS var | Utility classes |
|---|---|---|---|---|
| **FAO Blue (primary)** | `#116BAC` | `17,107,172` | `--primary`, `--link`, `--btn-primary` | `.bg-primary`, `.text-color-primary` |
| Primary light (tint) | `#E5ECF4` | `229,236,244` | `--primary-light` | `.bg-primary-light`, `.text-color-primary-light` |
| Gray Dark (body text) | `#545454` | `84,84,84` | `--on-background`, `--on-surface` | `.text-color-default`, `.text-color-gray-dark` |
| Gray Medium (secondary text) | `#999999` | `153,153,153` | `--on-background-secondary` | `.text-color-gray-medium` |
| Gray Light (surfaces, row stripes) | `#F2F2F2` | `242,242,242` | `--line` | `.bg-gray-light`, `.text-color-gray-light` |
| White FAO | `#F7F8F9` | — | | `.bg-white-fao`, `.text-color-white-fao` |
| Caption Blue (dark captions / photo credits) | `#1C4767` | `28,71,103` | | `.bg-caption`, `.text-color-caption` |
| FAO Orange (accent, warning) | `#F58320` | `245,131,32` | | `.bg-orange`, `.text-color-orange` |
| Emergency Red (critical, destructive) | `#980000` | `152,0,0` | | `.bg-emergency`, `.text-color-emergency` |
| UN Blue (UN-aligned branding) | `#5792C9` | `87,146,202` | | `.bg-un-blue`, `.text-color-un-blue` |
| Hover primary | `#1688DA` | — | `--btn-primary-hover` | — |
| Border | — | — | `--border` (#dee2e6) | — |

## Dark theme remap (partial)

When `[data-bs-theme="dark"]` is active:

- `--primary` → `#1D82F6` (brighter blue for contrast on dark)
- `--primary-light` → `#212529`
- `--background` → `#161616`
- `--surface` → `#212529`
- `--on-background` → `rgba(255,255,255,0.85)`
- `--on-background-secondary` → `rgba(255,255,255,0.65)`

## Usage rules

1. **Primary actions only use FAO Blue.** Never use Orange or Emergency for primary buttons — Orange is reserved for warnings, Emergency for destructive/critical.
2. **Body text is `#545454`, not black.** The theme sets this by default — don't override to `#000`.
3. **Semantic hierarchy**: primary action → `btn-primary`, secondary action → `btn-secondary` (which renders with an outline), tertiary → `btn-outline`.
4. **Dark-on-light contrast**: never place `text-color-gray-medium` on `bg-gray-light` — the ratio falls below WCAG AA. Use `text-color-default` or `text-color-gray-dark` on light surfaces.
5. **UN Blue** is only for content that explicitly aligns with UN-wide identity — not a generic "alternative blue."
6. **Emergency** should be paired with an icon and clear label (e.g. `<i class="bi bi-exclamation-triangle-fill"></i> Critical`).
