# Layouts

Three canonical skeletons. Pick one and paste in page content — don't invent a fourth.

## 1. Subsite / content page

For public-facing pages with editorial content (articles, project landing pages, topic hubs). Uses the full corporate header and full footer.

```html
<header class="fao-header subsite-header">...</header>

<div class="subheader">
  <div class="container">
    <div class="row">
      <div class="col-12">
        <h2 class="page-title">Page title</h2>
      </div>
    </div>
  </div>
</div>

<main>
  <div class="container">
    <!-- Bootstrap rows/cols with cards, lists, hero banners -->
  </div>
</main>

<footer class="footer">...</footer>
```

**Key classes**: `.subheader` (gray band below the header), `.page-title` (large heading), `.container` (max-width 1140px on ≥1400px screens — the FAO CSS caps it there, not Bootstrap's default 1320px).

## 2. App / dashboard with sidebar

For internal tools, dashboards, data-viz apps. Uses the compact app navbar and lightweight footer.

```html
<header class="navbar navbar-expand-lg navbar-dark app-navbar sticky-top">...</header>

<div class="app-layout">
  <aside class="app-sidebar offcanvas-lg offcanvas-start" id="appSidebar" tabindex="-1">
    <nav>
      <h6 class="app-sidebar-route-title">Navigation</h6>
      <ul class="list-unstyled">
        <li class="app-sidebar-item">
          <a class="app-sidebar-link active" href="#">Overview</a>
        </li>
        <li class="app-sidebar-item">
          <a class="app-sidebar-link" href="#">Indicators</a>
        </li>
      </ul>
    </nav>
  </aside>

  <main class="app-main">
    <div class="container-fluid p-4">
      <!-- widgets, KPI cards, charts -->
    </div>
  </main>
</div>

<footer class="footer footer-app">...</footer>
```

**Responsive behavior**: `.app-sidebar` collapses into a Bootstrap offcanvas on `<lg`. The header toggle button opens it. Add `data-bs-toggle="offcanvas" data-bs-target="#appSidebar"` on the toggle.

**Single-column variant**: drop `<aside>` and add `.app-no-sidebar` to the `.app-layout` wrapper:

```html
<div class="app-layout app-no-sidebar">
  <main class="app-main">...</main>
</div>
```

## 3. Standalone landing / microsite

For one-off campaign pages. Uses hero banner as the above-the-fold element.

```html
<header class="fao-header subsite-header">...</header>

<div class="hero-banner" style="background-image: url('./hero.jpg');">
  <div class="hero-caption">
    <h6 class="title-category">Campaign</h6>
    <h5 class="title-link"><a href="#">Headline</a></h5>
    <p>Lede paragraph.</p>
  </div>
</div>

<main>
  <div class="container py-5">
    <!-- Content rows -->
  </div>
</main>

<footer class="footer">...</footer>
```

**For looping video heroes**: replace the inline-styled `.hero-banner` with `<video class="hero-banner-video" loop autoplay playsinline preload="auto" poster="...">...</video>` inside a bare `<div class="hero-banner">`.

## Grid & spacing

- Container: `.container` (bounded) or `.container-fluid` (full-width — preferred for dashboards).
- Rows: `.row` with `.g-*` gutter utilities. Default gutter is 1.5rem.
- Columns: Bootstrap's 12-column grid with `.col-md-*`, `.col-lg-*` breakpoints.
- Section spacing: `.mb-comp` adds 2rem bottom margin — FAO's canonical component spacing. Prefer over ad-hoc `.mb-4`.
- Breakpoints: Bootstrap 5 defaults (sm 576, md 768, lg 992, xl 1200, xxl 1400).
