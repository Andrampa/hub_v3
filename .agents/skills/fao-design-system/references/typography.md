# FAO Typography

## Font families

`fao-theme.min.css` `@import`s the required Google Fonts automatically. Do not re-declare them.

- **Open Sans** — primary UI font. Weights: 300, 400, 500, 600, 700, 800.
- **Montserrat** — display weight for marketing pages and hero titles. Weights: 100–900.
- **Merriweather** — serif, used for long-form editorial content (e.g. blog body). Weights: 300, 400, 700.
- **Cairo** — Arabic script support.
- **Noto Sans JP** — Japanese script support.

Fallback stack when Open Sans cannot load (self-hosted failure, offline): `Helvetica, Arial, sans-serif`.

## Semantic heading mapping

Bootstrap's default heading scale is preserved. Use semantic HTML (`<h1>`…`<h6>`) first; add FAO modifier classes only when you need a specific display treatment.

- `<h1>` — page-level title (exactly one per page).
- `<h2>` — major section titles. Pair with `.page-title` when used inside `.subheader`.
- `<h3>`–`<h6>` — nested sections. Keep order logical; don't skip levels for sizing.

## FAO title modifier classes

| Class | Purpose |
|---|---|
| `.page-title` | The top page heading inside `.subheader`. Used on `<h1>` or `<h2>`. |
| `.sub-title` | A smaller sub-heading under `.page-title`. |
| `.title-category` | All-caps "kicker" label above a title (category/section tag). Put on `<h6>`. |
| `.title-link` | Wraps an anchored heading so the color + underline animate on hover. |
| `.title-highlight` | Emphasised pull-quote title. |
| `.title-caption` | Small caption title, e.g. photo credit heading. |
| `.detail-title` | Used in detail pages (articles, events). |

## Paragraph patterns

Default paragraph inherits Bootstrap's `1rem` / `1.5` line-height. For long-form content use `<article>` with default paragraphs. For photo captions:

```html
<figure>
  <img src="..." alt="...">
  <figcaption class="title-caption">Photo credit</figcaption>
</figure>
```

Blockquotes are styled by Bootstrap — add a bold trailing span for attribution:

```html
<blockquote>
  <p>"Quoted sentence."</p>
  <p><b>— Author, role</b></p>
</blockquote>
```

## Utility classes

- `.text-uppercase` — used on dashboard/app brand labels and `.title-category`.
- `.fw-semibold` / `.fw-bold` / `.fw-light` — Bootstrap weight helpers.
- `.fs-1`…`.fs-6` — Bootstrap size helpers.
- `.small` — reduced-size body text.
- `.text-end`, `.text-center`, `.text-start` — alignment.
- `.text-color-*` classes — see `colors.md`.

## Do / don't

- **Do** use `.title-category` above a `.card-title` to create the kicker → title pattern that runs through every card and list variant.
- **Do** keep Open Sans — the "minimum requirement" for FAO dashboards explicitly mandates it.
- **Don't** use Montserrat for body text — it's a display face; legibility suffers at small sizes.
- **Don't** mix serif (`Merriweather`) and sans in the same component. Merriweather is for editorial body copy only.
