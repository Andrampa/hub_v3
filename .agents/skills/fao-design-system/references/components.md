# FAO Design System — Component Reference

This document contains every FAO component's HTML markup, CSS class list, and ARIA contract. It is the authoritative reference for the skill — when generating code, match these patterns exactly rather than inventing markup. The FAO CSS only styles documented classes.

**Global dependencies**: All components assume Bootstrap 5 (`container`, `row`, `col-*`, `d-flex`, `btn`, `navbar`, `collapse`, `dropdown`, `modal`, `offcanvas`, `accordion`, `card`, `nav`, `nav-tabs`, `tab-pane`, `pagination`, `breadcrumb`, `input-group`, `form-control`, `badge`, `list-inline`, `list-unstyled`, `table`, `ratio`, text/bg/spacing utilities) plus Bootstrap Icons (`.bi` + `.bi-*`). The FAO CSS (`fao-theme.min.css`) adds FAO-branded classes on top. Include the Bootstrap JS bundle for interactive components.

Source: scraped from https://design-system.fao.org/ for v3.6.8.

---

## components/accordions

**Required Bootstrap 5 accordion + collapse plugin.** Wrap with `.accordion`.

```html
<div class="accordion" id="accordionExample">
  <div class="accordion-item">
    <div class="accordion-header" id="heading0">
      <h2 class="mb-0">
        <button class="accordion-button" type="button"
                data-bs-toggle="collapse" data-bs-target="#collapse0"
                aria-expanded="true" aria-controls="collapse0">
          Accordion 1
        </button>
      </h2>
    </div>
    <div id="collapse0" class="accordion-collapse collapse show"
         aria-labelledby="heading0" data-bs-parent="#accordionExample">
      <div class="accordion-body">Content 1...</div>
    </div>
  </div>
  <div class="accordion-item">
    <div class="accordion-header" id="heading1">
      <h2 class="mb-0">
        <button class="accordion-button collapsed" type="button"
                data-bs-toggle="collapse" data-bs-target="#collapse1"
                aria-expanded="false" aria-controls="collapse1">
          Accordion 2
        </button>
      </h2>
    </div>
    <div id="collapse1" class="accordion-collapse collapse"
         aria-labelledby="heading1" data-bs-parent="#accordionExample">
      <div class="accordion-body">Content 2...</div>
    </div>
  </div>
</div>
```

**Classes**: `.accordion`, `.accordion-item`, `.accordion-header`, `.accordion-button`, `.accordion-button.collapsed`, `.accordion-collapse`, `.collapse`, `.collapse.show`, `.collapsing`, `.accordion-body`, `.mb-0`

**ARIA/data attrs**: `aria-expanded="true|false"` (required), `aria-controls="<panel-id>"`, `aria-labelledby="<header-id>"`, `data-bs-toggle="collapse"`, `data-bs-target="#id"`, `data-bs-parent="#accordionId"` (single-open behavior). If the control is not a `<button>`, add `role="button"`.

---

## components/breadcrumbs

```html
<nav aria-label="breadcrumb">
  <ol class="breadcrumb">
    <li class="breadcrumb-item"><a href="#!">Docs</a></li>
    <li class="breadcrumb-item"><a href="#!">Components</a></li>
    <li class="breadcrumb-item active" aria-current="page">
      <span>Breadcrumbs</span>
    </li>
  </ol>
</nav>
```

**Classes**: `.breadcrumb`, `.breadcrumb-item`, `.breadcrumb-item.active`

**ARIA**: `aria-label="breadcrumb"` on `<nav>`, `aria-current="page"` on the active item. Uses Bootstrap 5 breadcrumb.

---

## components/buttons

All variants use `.btn` (Bootstrap 5) + FAO modifiers. Link form (`<a>`) and `<button>` both supported.

```html
<!-- Primary / Secondary / Outline -->
<a href="#" class="btn btn-primary">Primary</a>
<a href="#" class="btn btn-secondary">Secondary</a>
<a href="#" class="btn btn-outline">Outline</a>

<!-- Icon on right (trailing chevron) -->
<a class="btn btn-primary btn-icon">Primary <i class="bi bi-chevron-right"></i></a>
<a class="btn btn-secondary btn-icon">Secondary <i class="bi bi-chevron-right"></i></a>

<!-- Large icon button -->
<a class="btn btn-primary btn-icon btn-lg"><i class="bi bi-collection-play"></i> Primary</a>
<a class="btn btn-secondary btn-icon btn-lg"><i class="bi bi-collection-play"></i> Secondary</a>

<!-- Link-style button with icon -->
<a class="btn btn-link btn-icon btn-lg"><i class="bi bi-collection-play"></i> Primary</a>

<!-- Round icon button -->
<a href="#" class="btn btn-primary btn-icon btn-round"><i class="bi bi-chevron-right"></i></a>
<a href="#" class="btn btn-secondary btn-icon btn-round"><i class="bi bi-chevron-right"></i></a>

<!-- Round, large -->
<a href="#" class="btn btn-primary btn-icon btn-round btn-round-big"><i class="bi bi-chevron-right"></i></a>

<!-- Round, side (social-style inline row) -->
<a href="#" class="btn btn-primary btn-icon btn-round btn-round-side"><i class="bi bi-envelope"></i></a>
<a href="#" class="btn btn-primary btn-icon btn-round btn-round-side"><i class="bi bi-share"></i></a>
<a href="#" class="btn btn-primary btn-icon btn-round btn-round-side"><i class="bi bi-question-circle"></i></a>
```

**Classes**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-link`, `.btn-icon`, `.btn-lg`, `.btn-round`, `.btn-round-big`, `.btn-round-side`. Also sized `.btn-sm` (from Bootstrap), `.btn-icon-s` (used in header for small icon buttons).

**Variants documented**: Default (Primary / Secondary / Outline), Button Icon, Button Icon Large, Button Icon Link, Button Icon Round, Button Icon Round Large, Button Icon Round Side.

---

## components/cards

Core shell: `.card` → `.card-image.ratio.ratio-3x2` (image) + `.card-body` (content). Typography uses `.title-category` (kicker), `.card-title` + `.title-link`, `.card-text`, `.link-icon` (CTA).

### Default card
```html
<div class="card" style="width: 300px;">
  <div class="card-image ratio ratio-3x2">
    <img src="/images/placeholders/card-1.jpg" alt="Card title">
  </div>
  <div class="card-body">
    <h6 class="title-category">Category</h6>
    <h5 class="card-title"><a href="#" class="title-link">Card title</a></h5>
    <p class="card-text">Some quick example text...</p>
    <a href="#" title="Internal link" class="link-icon" target="_self">
      Internal link<i class="bi bi-chevron-right"></i>
    </a>
  </div>
</div>
```

### Static variants — add a modifier class to `.card`
- **No border**: `<div class="card border-0">`
- **Background (light)**: `<div class="card bg-gray-light">`
- **Background (dark)**: `<div class="card bg-gray-dark">` (uses `text-white` inside for contrast)
- **Overlay**: `<div class="card card-overlay">` + replace body with `.card-img-overlay.d-flex.flex-column.justify-content-center`, and use `.stretched-link` on the title link
- **Horizontal**: `<div class="card card-horizontal bg-caption">` with Bootstrap grid inside (`.row.g-0.align-items-center` → two `.col-md-6`)

```html
<!-- Overlay card -->
<div class="card card-overlay" style="width: 360px;">
  <div class="card-image ratio ratio-3x2">
    <img src="/images/placeholders/card-1.jpg" alt="Card title">
  </div>
  <div class="card-img-overlay d-flex flex-column justify-content-center">
    <h6 class="title-category">Category</h6>
    <h5 class="card-title"><a href="#" class="title-link stretched-link">Card title</a></h5>
    <h6 class="date">26/06/2020</h6>
  </div>
</div>

<!-- Horizontal card -->
<div class="card card-horizontal bg-caption">
  <div class="row g-0 align-items-center">
    <div class="col-md-6">
      <div class="card-image ratio ratio-3x2">
        <img src="/images/placeholders/card-1.jpg" alt="Card title">
      </div>
    </div>
    <div class="col-md-6">
      <div class="card-body">
        <h5 class="card-title text-white">Card title</h5>
        <p class="card-text text-white">...</p>
        <a href="#" class="link-icon">Internal link<i class="bi bi-chevron-right"></i></a>
      </div>
    </div>
  </div>
</div>
```

### Specific-content cards — add type class to `.card`
Pattern: `card card-<type>` where `<type>` is one of: `card-article`, `card-audio`, `card-blog`, `card-elearning`, `card-events`, `card-news`, `card-partners`, `card-photo-gallery`, `card-publication`, `card-speeches`, `card-video`, `card-twitter`. Event/story overlays use `.card-overlay.type-event` / `.card-overlay.type-story`.

```html
<!-- News card (representative) -->
<div class="card card-news" style="width: 300px;">
  <div class="card-image ratio ratio-3x2">
    <img src="/images/placeholders/card-1.jpg" alt="Card title">
  </div>
  <div class="card-body">
    <h6 class="title-category">News</h6>
    <h5 class="card-title"><a href="#" class="title-link">Card title</a></h5>
    <h6 class="date-location card-date-location">
      <span class="location"><i class="bi bi-geo-alt-fill"></i> Rome (Italy)</span>
      <span class="date">26/06/2020</span>
    </h6>
    <p class="card-text">Some quick example text...</p>
    <div class="classifications card-classifications">
      <div class="tags-list">
        <span class="badge text-bg-secondary">Lorem</span>
        <span class="badge text-bg-secondary">Ipsum</span>
      </div>
      <div class="hashtags-list">
        <span class="class-list__title">Hashtags:</span>
        <a class="badge" href="#">#Lorem</a>
        <a class="badge" href="#">#Ipsum</a>
      </div>
      <p class="category-list">
        <span class="category-list-title">Categories:</span>
        <a href="#" class="me-1">Lorem,</a>
        <a href="#" class="me-1">Ipsum,</a>
      </p>
      <div class="sdg-list">
        <span class="sdg-small sdg-1"></span>
        <span class="sdg-small sdg-2"></span>
        <span class="sdg-small sdg-3"></span>
      </div>
    </div>
    <a href="#" class="link-icon">Internal link<i class="bi bi-chevron-right"></i></a>
  </div>
</div>

<!-- Publication card: wrap image in .card-pub-image -->
<div class="card card-publication" style="width: 300px;">
  <div class="card-image ratio ratio-3x2">
    <div class="card-pub-image">
      <img src="/images/placeholders/publication-1.jpg" alt="Card title">
    </div>
  </div>
  <div class="card-body">
    <h6 class="title-category">Publication</h6>
    <h5 class="card-title"><a href="#" class="title-link">Card title</a></h5>
    <!-- ...same classifications block as above... -->
  </div>
</div>

<!-- Event card (no image — uses placeholder block with location) -->
<div class="card card-events" style="width: 300px;">
  <div class="card-placeholder ratio ratio-3x2">
    <div class="card-events--location">
      <i class="bi bi-geo-alt-fill"></i>
      <p>Event location</p>
    </div>
  </div>
  <div class="card-body">
    <h5 class="card-title"><a href="#" class="title-link">Card title</a></h5>
    <h6 class="date-location card-date-location">
      <span class="date">26/06/2020</span>
    </h6>
    <p class="card-text">...</p>
  </div>
</div>

<!-- Live event overlay card -->
<div class="card card-overlay type-event event-live" style="width: 360px;">
  <div class="card-image ratio ratio-3x2">
    <img src="/images/placeholders/card-1.jpg" alt="Card title">
  </div>
  <div class="card-img-overlay d-flex flex-column justify-content-center">
    <h6 class="card-event-live">Live</h6>
    <h6 class="title-category">Event</h6>
    <h5 class="card-title"><a href="#" class="title-link stretched-link">Card title</a></h5>
    <h6 class="date-location card-date-location">
      <span class="location"><i class="bi bi-geo-alt-fill"></i> Rome Time</span>
      <span class="date">26/06/2020</span>
    </h6>
  </div>
</div>

<!-- Story overlay card -->
<div class="card card-overlay type-story" style="width: 360px;">
  <div class="card-image ratio ratio-3x2">
    <img src="/images/placeholders/card-1.jpg" alt="Card title">
  </div>
  <div class="card-img-overlay d-flex flex-column justify-content-center">
    <h6 class="title-category">Story</h6>
    <h5 class="card-title"><a href="#" class="title-link stretched-link">Card title</a></h5>
    <h6 class="date-location card-date-location">
      <span class="location"><i class="bi bi-geo-alt-fill"></i> Rome, Italy</span>
      <span class="date">26/06/2020</span>
    </h6>
  </div>
</div>

<!-- Audio card: iframe in image slot (SoundCloud) -->
<div class="card card-audio" style="width: 300px;">
  <div class="card-image ratio ratio-3x2">
    <iframe src="https://w.soundcloud.com/player/?url=..." title="Card title"></iframe>
  </div>
  <div class="card-body">
    <h6 class="title-category">Audio</h6>
    <!-- ... -->
  </div>
</div>

<!-- Video card: iframe in image slot (YouTube embed) -->
<div class="card card-video" style="width: 300px;">
  <div class="card-image ratio ratio-3x2">
    <iframe src="https://www.youtube.com/embed/WeoIsjYBQH0?controls=0" title="Card title"></iframe>
  </div>
  <div class="card-body">
    <h6 class="title-category">Video</h6>
    <!-- ... -->
  </div>
</div>

<!-- Partners card (image-only, no card-body) -->
<div class="card-partners ratio ratio-3x2" style="width: 300px;">
  <img src="/images/placeholders/identity-test.svg" alt="...">
</div>

<!-- Twitter/X card -->
<div class="card card-twitter" style="width: 300px;">
  <div class="card-header">
    <i class="bi bi-twitter"></i>Join the conversation
  </div>
  <div class="card-body">
    <ul class="list-unstyled">
      <li><a href="https://twitter.com/home">#Hashtag-number-1</a></li>
      <li><a href="https://twitter.com/home">#Hashtag-number-2</a></li>
      <li>#Hashtag-number-3</li>
    </ul>
  </div>
</div>
```

**All classes**: `.card`, `.card-body`, `.card-header`, `.card-image`, `.card-img-overlay`, `.card-placeholder`, `.card-title`, `.card-text`, `.card-horizontal`, `.card-overlay`, `.card-pub-image`, `.card-date-location`, `.card-classifications`, `.card-article`, `.card-audio`, `.card-blog`, `.card-elearning`, `.card-events`, `.card-events--location`, `.card-event-live`, `.card-news`, `.card-partners`, `.card-photo-gallery`, `.card-publication`, `.card-speeches`, `.card-twitter`, `.card-video`, `.title-category`, `.title-link`, `.link-icon`, `.date`, `.date-location`, `.location`, `.type-event`, `.type-story`, `.event-live`, `.classifications`, `.tags-list`, `.hashtags-list`, `.category-list`, `.category-list-title`, `.class-list__title`, `.sdg-list`, `.sdg-small`, `.sdg-1`…`.sdg-17`, `.badge`, `.text-bg-secondary`, `.stretched-link`, `.border-0`, `.bg-gray-light`, `.bg-gray-dark`, `.bg-caption`, `.text-white`, `.ratio`, `.ratio-3x2`. Bootstrap grid utilities `.row`, `.g-0`, `.col-md-6`, `.d-flex`, `.flex-column`, `.justify-content-center`, `.align-items-center`, `.me-1`.

---

## components/content-backgrounds

One lightweight wrapper — used to apply FAO brand-tinted backgrounds to a card block.

```html
<div class="card text-color-default bg-primary-light">
  <div class="card-body">
    <p class="mb-0">Content Background</p>
  </div>
</div>
```

**Classes**: `.card`, `.card-body`, `.bg-primary-light`, `.text-color-default`, `.mb-0`.

---

## components/content-blocks

Styles the Sitefinity "Content Block" widget. Single class:

```html
<div class="sfContentBlock">
  <!-- rich-text content from CMS -->
</div>
```

**Classes**: `.sfContentBlock`

---

## components/custom-sub-header

Two-column pop-out header for co-branding under the main nav.

```html
<div class="custom-sub-header d-flex align-items-center justify-content-between flex-wrap">
  <div class="custom-sub-left d-flex align-items-center">
    <img src="/images/placeholders/identity-test.svg" class="pop-out" alt="...">
  </div>
  <div class="custom-sub-right d-flex align-items-center justify-content-end">
    <img src="/images/placeholders/identity-test-solo.svg" class="pop-out" alt="...">
  </div>
</div>
```

**Classes**: `.custom-sub-header`, `.custom-sub-left`, `.custom-sub-right`, `.pop-out`, `.d-flex`, `.align-items-center`, `.justify-content-between`, `.justify-content-end`, `.flex-wrap`.

---

## components/footers

Two flavors: full corporate footer (`.footer`) and app/subsite footer (`.footer.footer-app`).

### Full footer
```html
<footer class="footer">
  <div class="container">
    <div class="row">
      <div class="footer-logo col-md-7">
        <a href="/home/en/">
          <img src="/images/logo/fao80-1-logo-blue.svg" alt="..."
               title="Food and Agriculture Organization of the United Nations">
        </a>
      </div>
      <div class="footer-social col-md-5">
        <h6 class="title-category">Follow us on</h6>
        <ul class="list-inline social-icons">
          <li class="list-inline-item"><a href="#!" title="bluesky" target="_blank"><img src="/images/socials/bluesky.svg" alt="bluesky"></a></li>
          <li class="list-inline-item"><a href="#!" title="facebook" target="_blank"><img src="/images/socials/facebook.svg" alt="facebook"></a></li>
          <li class="list-inline-item"><a href="#!" title="instagram" target="_blank"><img src="/images/socials/instagram.svg" alt="instagram"></a></li>
          <li class="list-inline-item"><a href="#!" title="linkedin" target="_blank"><img src="/images/socials/linkedin.svg" alt="linkedin"></a></li>
          <li class="list-inline-item"><a href="#!" title="soundcloud" target="_blank"><img src="/images/socials/soundcloud.svg" alt="icon-soundcloud"></a></li>
          <li class="list-inline-item"><a href="#!" title="tiktok" target="_blank"><img src="/images/socials/tiktok.svg" alt="tiktok"></a></li>
          <li class="list-inline-item"><a href="#!" title="tuotiao" target="_blank"><img src="/images/socials/tuotiao.svg" alt="tuotiao"></a></li>
          <li class="list-inline-item"><a href="#!" title="wechat" target="_blank"><img src="/images/socials/wechat.svg" alt="wechat"></a></li>
          <li class="list-inline-item"><a href="#!" title="weibo" target="_blank"><img src="/images/socials/weibo.svg" alt="weibo"></a></li>
          <li class="list-inline-item"><a href="#!" title="whatsapp" target="_blank"><img src="/images/socials/whatsapp.svg" alt="whatsapp"></a></li>
          <li class="list-inline-item"><a href="#!" title="twitter" target="_blank"><img src="/images/socials/twitter.svg" alt="twitter"></a></li>
          <li class="list-inline-item"><a href="#!" title="youtube" target="_blank"><img src="/images/socials/youtube.svg" alt="youtube"></a></li>
        </ul>
      </div>
    </div>
    <div class="row">
      <div class="footer-links col-md-7">
        <div class="footer-links-top">
          <div><a href="#!" target="_top">FAO Organizational Chart</a></div>
          <div class="btn-group dropup">
            <button type="button" class="btn btn-secondary dropdown-toggle"
                    data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
              Worldwide Offices
            </button>
            <div class="dropdown-menu">
              <a href="#!" class="dropdown-item">Regional Office for Africa</a>
              <a href="#!" class="dropdown-item">Regional Office for Asia and the Pacific</a>
              <a href="#!" class="dropdown-item">Regional Office for Europe and Central Asia</a>
              <a href="#!" class="dropdown-item">Regional Office for Latin America and the Caribbean</a>
              <a href="#!" class="dropdown-item">Regional Office for the Near East and North Africa</a>
              <a href="#!" class="dropdown-item">Country Offices</a>
            </div>
          </div>
        </div>
        <div class="footer-links-bottom">
          <ul class="list-inline">
            <li class="list-inline-item"><a href="https://www.fao.org/employment/home/en/" target="_self">Jobs</a></li>
            <li class="list-inline-item"><a href="https://fao.org/contact-us/en/" target="_self">Contact us</a></li>
            <li class="list-inline-item"><a href="https://fao.org/contact-us/terms/en/" target="_self">Terms and Conditions</a></li>
            <li class="list-inline-item"><a href="https://fao.org/contact-us/data-protection-and-privacy/en/" target="_self">Data protection and privacy</a></li>
            <li class="list-inline-item"><a href="https://fao.org/contact-us/scam-alert/en/" target="_self">Scam Alert</a></li>
            <li class="list-inline-item"><a href="https://www.fao.org/audit-and-investigations/reporting-misconduct/en/" target="_self">Report Misconduct</a></li>
            <li class="list-inline-item"><a href="https://www.fao.org/transparency/en" target="_self">Transparency and accountability</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-download col-md-5">
        <a class="copyright" href="/contact-us/terms/en/">© FAO&nbsp;2026</a>
      </div>
    </div>
  </div>
</footer>
```

### App / subsite footer
```html
<footer class="footer footer-app">
  <div class="container pt-0">
    <div class="row">
      <div class="footer-links col-lg-8">
        <ul class="list-inline">
          <li class="list-inline-item"><a href="http://fao.org/contact-us/en/" target="_blank" rel="noreferrer">Contact us</a></li>
          <li class="list-inline-item"><a href="http://fao.org/contact-us/terms/en/" target="_blank" rel="noreferrer">Terms and Conditions</a></li>
          <li class="list-inline-item"><a href="http://fao.org/contact-us/data-protection-and-privacy/en/" target="_blank" rel="noreferrer">Data protection and privacy</a></li>
          <li class="list-inline-item"><a href="http://fao.org/contact-us/scam-alert/en/" target="_blank" rel="noreferrer">Scam Alert</a></li>
          <li class="list-inline-item"><a href="https://www.fao.org/audit-and-investigations/reporting-misconduct/en/" target="_blank" rel="noreferrer">Report Misconduct</a></li>
          <li class="list-inline-item"><a href="https://www.fao.org/transparency/en" target="_self">Transparency and accountability</a></li>
        </ul>
      </div>
      <div class="col-lg-4 text-end">
        <a class="copyright" href="https://www.fao.org/contact-us/terms/en/" target="_blank" rel="noreferrer">© FAO&nbsp;2026</a>
      </div>
    </div>
  </div>
</footer>
```

**Classes**: `.footer`, `.footer-app`, `.footer-logo`, `.footer-social`, `.footer-links`, `.footer-links-top`, `.footer-links-bottom`, `.footer-download`, `.social-icons`, `.copyright`, `.title-category`. Bootstrap: `.container`, `.row`, `.col-md-5`, `.col-md-7`, `.col-lg-4`, `.col-lg-8`, `.list-inline`, `.list-inline-item`, `.btn`, `.btn-secondary`, `.btn-group`, `.dropup`, `.dropdown-toggle`, `.dropdown-menu`, `.dropdown-item`, `.text-end`, `.pt-0`.

**Dropdown ARIA**: `data-bs-toggle="dropdown"`, `aria-haspopup="true"`, `aria-expanded="false"`.

---

## components/headers

Three pieces: the FAO corporate header (`.fao-header`), the optional share bar (`.header-share`), and the subsite/app navbar.

### FAO corporate header (with Discover/language dropdowns + search/share/theme)
```html
<header class="fao-header subsite-header">
  <div class="container">
    <div class="row">
      <div class="header-wrapper col-12">
        <div class="fao-header-left">
          <a href="/home/en/">
            <img src="/images/logo/fao-logo-blue.svg" alt="..."
                 title="Food and Agriculture Organization of the United Nations"
                 class="header-fao-logo">
          </a>
        </div>
        <div class="fao-header-right">
          <div class="dropdown discover-dropdown">
            <button class="btn btn-secondary dropdown-toggle" type="button"
                    id="dropdownDiscoverMenu" data-bs-toggle="dropdown"
                    aria-haspopup="true" aria-expanded="false">Discover</button>
            <div class="dropdown-menu" aria-labelledby="dropdownDiscoverMenu">
              <a class="dropdown-item" href="#!">About FAO</a>
              <a class="dropdown-item" href="#!">In action</a>
              <a class="dropdown-item" href="#!">Media</a>
              <a class="dropdown-item" href="#!">Main topics</a>
              <a class="dropdown-item" href="#!">Resources</a>
              <a class="dropdown-item" href="#!">Member countries</a>
              <a class="dropdown-item" href="#!">Get involved</a>
            </div>
          </div>
          <div class="dropdown language-switch" aria-label="Change Language" role="menu">
            <button class="btn btn-secondary dropdown-toggle" type="button"
                    id="dropdownLanguageMenu" data-bs-toggle="dropdown"
                    aria-haspopup="true" aria-expanded="false">English</button>
            <div class="dropdown-menu" aria-labelledby="dropdownLanguageMenu">
              <a class="dropdown-item" href="#!" role="menuitem" aria-label="Arabic">العربية</a>
              <a class="dropdown-item" href="#!" role="menuitem" aria-label="Chinese">中文</a>
              <a class="dropdown-item" href="#!" role="menuitem" aria-label="French">Français</a>
              <a class="dropdown-item" href="#!" role="menuitem" aria-label="Russian">Русский</a>
              <a class="dropdown-item" href="#!" role="menuitem" aria-label="Spanish">Español</a>
            </div>
          </div>
          <div class="header-icons">
            <button id="fao-theme-toggle" class="btn btn-sm dark-mode-toggle">
              <i class="bi bi-moon-stars"></i>
            </button>
            <a href="#!" type="button" data-bs-toggle="modal" data-bs-target="#shareModal" aria-label="Share">
              <i class="bi bi-share-fill"></i>
            </a>
            <a data-bs-toggle="collapse" href="#collapseExample" role="button"
               aria-expanded="false" aria-controls="collapseExample" aria-label="Search">
              <i class="bi bi-search"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-12">
        <div class="collapse" id="collapseExample">
          <div class="input-group my-3">
            <input type="text" class="form-control" placeholder="Search" aria-label="Search">
            <div class="input-group-append">
              <button type="button" class="btn btn-primary btn-icon">
                <i class="bi bi-search"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>
```

### Print/Send share bar
```html
<div class="header-share">
  <div class="container">
    <ul class="list-unstyled mb-0 d-flex justify-content-end">
      <li>
        <a href="#!" title="Placeholder link title" class="link-icon">
          <i class="bi bi-printer"></i><span>Print</span>
        </a>
      </li>
      <li>
        <a href="#!" title="Placeholder link title" class="link-icon">
          <i class="bi bi-envelope"></i><span>Send</span>
        </a>
      </li>
    </ul>
  </div>
</div>
```

### App navbar (with sidebar toggle, search modal trigger, language dropdown, offcanvas)
```html
<header class="navbar navbar-expand-lg navbar-dark app-navbar sticky-top">
  <div class="container-fluid flex-wrap flex-lg-nowrap" aria-label="Main navigation">
    <div class="bd-navbar-toggle">
      <button class="navbar-toggler p-2 border-0" type="button"
              data-bs-toggle="offcanvas" data-bs-target="#bdSidebar"
              aria-controls="bdSidebar" aria-label="Toggle docs navigation">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="bi"
             fill="currentColor" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M2.5 11.5A.5.5 0 0 1 3 11h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4A.5.5 0 0 1 3 7h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4A.5.5 0 0 1 3 3h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
        </svg>
        <span class="d-none fs-6 pe-1">Browse</span>
      </button>
    </div>
    <a class="navbar-brand p-0 me-0 me-lg-4 d-flex align-items-center" href="/" aria-label="Design System">
      <img width="100%" height="40px" src="/images/logo/fao-logo-three-lines.svg" alt="Design System">
      <p class="d-none d-lg-block ms-3 mb-0 ps-3 fw-semibold text-uppercase text-gray">Design System</p>
    </a>
    <div class="d-flex">
      <button class="btn btn-search btn-icon btn-icon-s btn-sm text-decoration-none text-color-gray-dark me-xl-2 d-lg-none"
              data-bs-toggle="modal" data-bs-target="#exampleModal">
        <i class="bi bi-search m-0 me-xl-2"></i>
        <span class="d-none d-xl-inline">Search</span>
      </button>
      <button class="navbar-toggler d-flex d-lg-none order-3 p-2 border-0" type="button"
              data-bs-toggle="offcanvas" data-bs-target="#bdNavbarTest"
              aria-controls="bdNavbarTest" aria-label="Toggle navigation">
        <i class="bi bi-three-dots"></i>
      </button>
    </div>
    <div class="offcanvas-lg offcanvas-end flex-grow-1" tabindex="-1"
         id="bdNavbarTest" aria-labelledby="bdNavbarTestOffcanvasLabel" data-bs-scroll="true">
      <div class="offcanvas-header px-4 pb-0">
        <!-- optional login/signup buttons can go here -->
        <button class="btn btn-link btn-icon btn-icon-s btn-sm text-decoration-none text-color-gray-dark">
          <i class="bi bi-pencil-square me-2"></i><span>Login</span>
        </button>
        <button class="btn btn-link btn-icon btn-icon-s btn-sm text-decoration-none text-color-gray-dark">
          <i class="bi bi-person-circle me-2"></i><span>Sign-up</span>
        </button>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas"
                aria-label="Close" data-bs-target="#bdNavbarTest"></button>
      </div>
      <div class="offcanvas-body p-4 pt-0 p-lg-0">
        <hr class="d-lg-none">
        <div class="dropdown d-lg-none">
          <button class="btn bg-gray-light btn-sm dropdown-toggle" type="button"
                  data-bs-toggle="dropdown" aria-expanded="false">ENGLISH</button>
          <ul class="dropdown-menu">
            <li><span class="dropdown-item">ESPAÑOL</span></li>
            <li><span class="dropdown-item">FRANÇAIS</span></li>
            <li><span class="dropdown-item">中文</span></li>
            <li><span class="dropdown-item">РУССКИЙ</span></li>
            <li><span class="dropdown-item">عربي</span></li>
          </ul>
        </div>
        <hr class="d-lg-none">
        <ul class="navbar-nav flex-row bd-navbar-nav flex-wrap">
          <li class="nav-item col-6 col-lg-auto"><a class="nav-link py-2 px-0 px-lg-2" href="#!">Styles</a></li>
          <li class="nav-item col-6 col-lg-auto"><a class="nav-link py-2 px-0 px-lg-2" href="#!">Components</a></li>
        </ul>
        <div class="flex-row ms-md-auto align-items-center d-none d-lg-flex justify-content-end nav-link">
          <button class="btn btn-link btn-icon btn-icon-s btn-sm text-decoration-none text-color-gray-dark">
            <i class="bi bi-pencil-square m-0 me-xl-2"></i>
            <span class="d-none d-xl-inline">Login</span>
          </button>
          <button class="btn btn-link btn-icon btn-icon-s btn-sm text-decoration-none text-color-gray-dark">
            <i class="bi bi-person-circle m-0 me-xl-2"></i>
            <span class="d-none d-xl-inline">Sign-up</span>
          </button>
          <div class="dropdown ps-2">
            <button class="btn bg-gray-light btn-sm dropdown-toggle" type="button"
                    data-bs-toggle="dropdown" aria-expanded="false">ENGLISH</button>
            <ul class="dropdown-menu">
              <li><span class="dropdown-item">ESPAÑOL</span></li>
              <li><span class="dropdown-item">FRANÇAIS</span></li>
              <li><span class="dropdown-item">中文</span></li>
              <li><span class="dropdown-item">РУССКИЙ</span></li>
              <li><span class="dropdown-item">عربي</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>
<div class="container-fluid d-lg-none" aria-label="Title">
  <p class="mb-0 p-3 nav-link fw-semibold text-center">DESIGN SYSTEM</p>
</div>
```

### Search modal (paired with `btn-search` trigger above)
```html
<div class="modal fade" id="exampleModal" tabindex="-1"
     aria-labelledby="exampleModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h1 class="modal-title fs-5" id="exampleModalLabel">Search</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        Coming soon <i class="bi bi-emoji-smile"></i>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>
```

**FAO-specific classes**: `.fao-header`, `.fao-header-left`, `.fao-header-right`, `.header-wrapper`, `.header-fao-logo`, `.header-icons`, `.header-share`, `.subsite-header`, `.app-navbar`, `.discover-dropdown`, `.language-switch`, `.dark-mode-toggle`, `.bd-navbar-toggle`, `.bd-navbar-nav`, `.btn-search`, `.btn-icon-s`, `.text-color-gray-dark`, `.text-gray`, `.bg-gray-light`, `.link-icon`.

**Bootstrap classes used**: `.navbar`, `.navbar-expand-lg`, `.navbar-dark`, `.navbar-brand`, `.navbar-toggler`, `.navbar-nav`, `.nav-item`, `.nav-link`, `.container`, `.container-fluid`, `.row`, `.col-12`, `.col-6`, `.col-lg-auto`, `.sticky-top`, `.dropdown`, `.dropdown-toggle`, `.dropdown-menu`, `.dropdown-item`, `.modal`, `.modal-dialog`, `.modal-content`, `.modal-header`, `.modal-title`, `.modal-body`, `.modal-footer`, `.fade`, `.offcanvas-lg`, `.offcanvas-end`, `.offcanvas-header`, `.offcanvas-body`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-link`, `.btn-sm`, `.btn-close`, `.btn-icon`, `.input-group`, `.input-group-append`, `.form-control`, `.list-unstyled`, `.collapse`, display utilities (`.d-flex`, `.d-none`, `.d-lg-none`, `.d-lg-block`, `.d-lg-flex`, `.d-xl-inline`), flex utilities (`.flex-row`, `.flex-wrap`, `.flex-grow-1`, `.flex-lg-nowrap`, `.align-items-center`, `.justify-content-end`), spacing (`.p-*`, `.m-*`, `.my-3`, `.me-*`, `.ms-*`, `.ps-*`, `.pe-*`, `.px-*`, `.py-*`, `.pb-0`, `.pt-0`), text (`.text-center`, `.text-uppercase`, `.text-decoration-none`, `.fw-semibold`, `.fs-5`, `.fs-6`), misc (`.order-3`, `.border-0`).

**ARIA/data**: `data-bs-toggle` = `dropdown` | `collapse` | `modal` | `offcanvas`; `data-bs-target`, `data-bs-dismiss`, `data-bs-scroll="true"`, `data-bs-parent`. `aria-expanded`, `aria-haspopup`, `aria-controls`, `aria-labelledby`, `aria-hidden`, `aria-label` (for every icon-only control — Search, Share, Close, Toggle navigation, language codes). `role="menu"`/`role="menuitem"` for the language switcher. `role="button"` on `<a>` that acts as a trigger.

---

## components/hero-banners

Background image or looping video. Text sits in `.hero-caption`.

```html
<!-- Image hero -->
<div class="hero-banner" style="background-image: url('/images/placeholders/banner-1.jpg');">  <div class="hero-caption">
    <h6 class="title-category">Category</h6>
    <h5 class="title-link"><a href="#!">Lorem ipsum dolor sit amet, consectetur adipiscing elit</a></h5>
    <p>Lorem ipsum dolor sit amet consectetur adipisicing elit...</p>
  </div>
</div>

<!-- Video hero -->
<div class="hero-banner">
  <video class="hero-banner-video" loop autoplay playsinline preload="auto"
         poster="/images/placeholders/banner-1.jpg">
    <source src="/videos/placeholders/banner-1.mp4" type="video/mp4">
  </video>
  <div class="hero-caption">
    <h6 class="title-category">Category</h6>
    <h5 class="title-link"><a href="#!">Lorem ipsum dolor sit amet, consectetur adipiscing elit</a></h5>
    <p>Lorem ipsum...</p>
  </div>
</div>
```

**Classes**: `.hero-banner`, `.hero-banner-video`, `.hero-caption`, `.title-category`, `.title-link`.

**Aspect ratio note** (from styles/images): desktop hero is 21:9; thumbnails are 3:2. Max width 2000px for hero images, 600px for thumbnails.

---

## components/lists

Detail-list patterns mirror card variants. Shell: `.d-list` + one type modifier. Visual rail on the left is `.d-list-visual` (often with `.ratio.ratio-3x2`), content on the right is `.d-list-content`. Optional `.d-list-player` is added when an iframe (audio/video) is embedded.

### Article list
```html
<div class="d-list d-list-article">
  <div class="d-list-content">
    <h5 class="title-link"><a href="#">Item title</a></h5>
    <h6 class="date-location d-list-date-location">
      <span class="location"><i class="bi bi-geo-alt-fill"></i> Rome, Italy</span>
      <span class="date">26/06/2020</span>
    </h6>
    <p class="d-list-description">Some quick example text...</p>
    <p class="d-list-website">
      <b class="d-list-website-label">WEBSITE: </b>
      <a href="#!" target="_blank">FAO - Food and Agriculture Organization</a>
    </p>
    <div class="classifications d-list-classifications">
      <div class="tags-list">
        <span class="badge text-bg-secondary">Lorem</span>
        <span class="badge text-bg-secondary">Ipsum</span>
      </div>
      <div class="hashtags-list">
        <span class="class-list__title">Hashtags:</span>
        <a class="badge" href="#">#Lorem</a>
      </div>
      <p class="category-list">
        <span class="category-list-title">Categories:</span>
        <a href="#" class="me-1">Lorem,</a>
        <a href="#" class="me-1">Ipsum,</a>
      </p>
      <div class="sdg-list">
        <span class="sdg-list__title">SDGs:</span>
        <span class="sdg-small sdg-1"></span>
        <span class="sdg-small sdg-2"></span>
        <span class="sdg-small sdg-3"></span>
      </div>
    </div>
  </div>
</div>
```

### Audio list with player
```html
<div class="d-list d-list-audio d-list-player">
  <div class="d-list-visual">
    <iframe title="Item title" width="100%" height="100%" allow="autoplay"
            src="https://w.soundcloud.com/player/?url=..."></iframe>
  </div>
  <div class="d-list-content">
    <h5 class="title-link"><a href="#">Item title</a></h5>
    <!-- ...same date-location/description/classifications block... -->
  </div>
</div>
```

### Audio list with image thumbnail
```html
<div class="d-list d-list-audio">
  <div class="d-list-visual ratio ratio-3x2">
    <a href="#"><img src="/images/placeholders/card-1.jpg" alt="Item title"></a>
  </div>
  <div class="d-list-content">...</div>
</div>
```

### Blog list (note `author` span in date-location row)
```html
<div class="d-list d-list-blog">
  <div class="d-list-visual ratio ratio-3x2">
    <img src="/images/placeholders/card-1.jpg" alt="Item title">
  </div>
  <div class="d-list-content">
    <h6 class="title-category">Blog label</h6>
    <h5 class="title-link"><a href="#">Item title</a></h5>
    <h6 class="date-location d-list-date-location">
      <span class="location"><i class="bi bi-geo-alt-fill"></i> ROME (ITALY)</span>
      <span class="date">- 26/06/2020</span>
      <span class="author">Lorem ipsum</span>
    </h6>
    <p class="d-list-description">...</p>
    <!-- classifications -->
  </div>
</div>
```

### E-learning list (with Enroll CTA)
```html
<div class="d-list d-list-elearning">
  <div class="d-list-content">
    <h5 class="title-link"><a href="#">Item title</a></h5>
    <h6 class="date-location d-list-date-location">
      <span class="location"><i class="bi bi-geo-alt-fill"></i> Rome, Italy</span>
      <span class="date">26/06/2020</span>
    </h6>
    <p class="d-list-description">...</p>
    <!-- classifications -->
  </div>
  <p class="mb-0">
    <a href="#!" class="ps-0 btn btn-link btn-icon">
      Enroll <i class="bi bi-pencil-square"></i>
    </a>
  </p>
</div>
```

### Event list (with calendar block, single or from-to)
```html
<!-- Date range -->
<div class="d-list d-list-event">
  <div class="d-list-visual">
    <div class="card-calendar">
      <div class="row-calendar">
        <p class="date">
          <span class="date__day">22</span>/<span class="date__month">5</span>
        </p>
        <p class="year">2021</p>
      </div>
      <div class="from-to-divider"></div>
      <div class="row-calendar">
        <p class="date">
          <span class="date__day">26</span>/<span class="date__month">5</span>
        </p>
        <p class="year">2022</p>
      </div>
    </div>
  </div>
  <div class="d-list-content">
    <h5 class="title-link"><a href="#">Item title</a></h5>
    <h6 class="date-location d-list-date-location">
      <span class="location"><i class="bi bi-geo-alt-fill"></i> ROME (ITALY),</span>
      <span class="date">22/05/2021 - 26/05/2022</span>
    </h6>
    <p class="d-list-description">...</p>
    <!-- classifications -->
  </div>
</div>

<!-- Single date: omit the second .row-calendar + .from-to-divider -->
```

### Forum list (table)
```html
<div class="table-responsive forum-list">
  <table class="table">
    <thead class="bg-gray-light">
      <tr>
        <th>Forum title</th><th>Threads</th><th>Post/Replies</th><th>LastPost</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><a href="#!">Lorem ipsum...</a></td>
        <td>1</td><td>1</td><td>16/08/2023, 06:37:57</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Meetings/docs list (table)
```html
<div class="table-responsive meetings-docs-list">
  <table class="table">
    <thead class="bg-gray-light">
      <tr><th>Number</th><th>Title</th><th>Category</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>C 2023/1</td>
        <td><a href="#!">Lorem ipsum...</a></td>
        <td>NL350</td>
      </tr>
    </tbody>
  </table>
</div>
```

### News list
```html
<div class="d-list d-list-news">
  <div class="d-list-visual ratio ratio-3x2">
    <img src="/images/placeholders/card-1.jpg" alt="Item title">
  </div>
  <div class="d-list-content">
    <h5 class="title-link"><a href="#">Item title</a></h5>
    <h6 class="date-location d-list-date-location">
      <span class="location"><i class="bi bi-geo-alt-fill"></i> Rome (Italy)</span>
      <span class="date">26/06/2020</span>
    </h6>
    <p class="d-list-description">...</p>
    <!-- classifications -->
  </div>
</div>
```

### Partners list (partnership metadata)
```html
<div class="d-list d-list-partners">
  <div class="d-list-visual ratio ratio-3x2">
    <img src="/images/placeholders/identity-test.svg" alt="Item title">
  </div>
  <div class="d-list-content">
    <h5 class="title-link"><a href="#">Item title</a></h5>
    <p class="d-list-description">...</p>
    <div>
      <p class="me-3 mb-2 d-inline-block"><b>IN PARTNERSHIP SINCE: </b>2013</p>
      <p class="me-3 mb-2 d-inline-block"><b>COUNTRY: </b>Italy</p>
    </div>
    <p class="me-3 mb-2"><b>AREAS OF COLLABORATION: </b>Lorem, Lorem Ipsum</p>
    <p class="me-3 mb-2"><b>Resources: </b><a href="#!">Lorem ipsum...</a></p>
    <!-- classifications -->
  </div>
</div>
```

### Photo gallery list
```html
<div class="d-list d-list-photogallery">
  <div class="d-list-visual ratio ratio-3x2">
    <img src="/images/placeholders/card-1.jpg" alt="Item title">
  </div>
  <div class="d-list-content">...</div>
</div>
```

### Project list item (full, tabular)
```html
<div class="project-list-item">
  <table class="table table-bordered">
    <tbody>
      <tr><th scope="row" class="bg-gray-light">Title</th>
          <td><a href="#!">Lorem ipsum...</a></td></tr>
      <tr><th scope="row" class="bg-gray-light">Abstract</th>
          <td>Lorem ipsum...</td></tr>
      <tr><th scope="row" class="bg-gray-light">Start Date</th><td>02/06/2022</td></tr>
      <tr><th scope="row" class="bg-gray-light">End Date</th><td>04/06/2022</td></tr>
      <tr><th scope="row" class="bg-gray-light">Recipient/Target areas</th>
          <td>Lorem, Ipsum, Lorem, Ipsum</td></tr>
      <tr><th scope="row" class="bg-gray-light">Budget</th><td>99999</td></tr>
      <tr><th scope="row" class="bg-gray-light">Donor</th><td>Lorem ipsum</td></tr>
      <tr><th scope="row" class="bg-gray-light">Project code</th><td>LOREM/IPS/UM</td></tr>
      <tr><th scope="row" class="bg-gray-light">Tags</th>
          <td>
            <div class="tags-list">
              <span class="badge text-bg-secondary">Lorem</span>
              <span class="badge text-bg-secondary">Ipsum</span>
            </div>
          </td></tr>
      <tr><th scope="row" class="bg-gray-light">Categories</th>
          <td>
            <p class="category-list mb-0">
              <span class="category-list-title">Categories:</span>
              <a href="#" class="me-1">Lorem,</a>
              <a href="#" class="me-1">Ipsum,</a>
            </p>
          </td></tr>
      <tr><th scope="row" class="bg-gray-light">SDGs</th>
          <td>
            <div class="sdg-list">
              <span class="sdg-small sdg-1"></span>
              <span class="sdg-small sdg-2"></span>
              <span class="sdg-small sdg-3"></span>
            </div>
          </td></tr>
    </tbody>
  </table>
</div>
```

### Project list item (minimal)
```html
<div class="project-list-item">
  <table class="table table-bordered">
    <tbody>
      <tr><th scope="row" class="bg-gray-light">Title</th>
          <td><a href="#!">Lorem ipsum...</a></td></tr>
      <tr><th scope="row" class="bg-gray-light">Budget</th><td>99999</td></tr>
      <tr><th scope="row" class="bg-gray-light">Donor</th><td>Lorem ipsum</td></tr>
    </tbody>
  </table>
</div>
```

### Project list (multiple rows, minimal table)
```html
<div class="table-responsive project-list-item-minimal">
  <table class="table table-bordered">
    <thead>
      <tr>
        <th class="bg-gray-light">Symbol</th>
        <th class="bg-gray-light">Title</th>
        <th class="bg-gray-light">From</th>
        <th class="bg-gray-light">to</th>
        <th class="bg-gray-light">Total Budget</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>LOREM/IPS/UM</td>
        <td><a href="#!">Lorem ipsum...</a></td>
        <td>2021</td><td>2023</td><td>300,000$</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Publication, Speeches, Story, Video lists — use `.d-list-publication`, `.d-list-speeches`, `.d-list-story`, `.d-list-video` (with optional `.d-list-player` when embedded iframe).
```html
<div class="d-list d-list-publication">
  <div class="d-list-visual">
    <img src="/images/placeholders/publication-1.jpg" alt="Item title">
  </div>
  <div class="d-list-content">...</div>
</div>

<div class="d-list d-list-video d-list-player">
  <div class="d-list-visual ratio ratio-3x2">
    <iframe src="https://www.youtube.com/embed/WeoIsjYBQH0?controls=0"
            title="iframe1"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
  </div>
  <div class="d-list-content">...</div>
</div>
```

**All classes**: `.d-list`, `.d-list-article`, `.d-list-audio`, `.d-list-blog`, `.d-list-elearning`, `.d-list-event`, `.d-list-news`, `.d-list-partners`, `.d-list-photogallery`, `.d-list-publication`, `.d-list-speeches`, `.d-list-story`, `.d-list-video`, `.d-list-player`, `.d-list-visual`, `.d-list-content`, `.d-list-description`, `.d-list-date-location`, `.d-list-classifications`, `.d-list-website`, `.d-list-website-label`, `.card-calendar`, `.row-calendar`, `.date`, `.date__day`, `.date__month`, `.year`, `.from-to-divider`, `.author`, `.forum-list`, `.meetings-docs-list`, `.project-list-item`, `.project-list-item-minimal`, `.title-category`, `.title-link`, `.date-location`, `.location`, `.classifications`, `.tags-list`, `.badge`, `.text-bg-secondary`, `.hashtags-list`, `.class-list__title`, `.category-list`, `.category-list-title`, `.sdg-list`, `.sdg-list__title`, `.sdg-small`, `.sdg-1`…`.sdg-17`. Bootstrap: `.table`, `.table-bordered`, `.table-responsive`, `.bg-gray-light`, `.d-inline-block`, `.me-1`, `.me-3`, `.mb-0`, `.mb-2`, `.ps-0`, `.btn`, `.btn-link`, `.btn-icon`.

---

## components/navbar

Subsite navbar with nested dropdown submenu.

```html
<nav class="navbar-subsite navbar navbar-expand-lg navbar-light bg-white">
  <button class="navbar-toggler" type="button"
          data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent" aria-expanded="false"
          aria-label="Toggle navigation">
    <span class="navbar-toggler-icon"></span>
  </button>
  <div class="collapse navbar-collapse" id="navbarSupportedContent">
    <ul class="navbar-nav me-auto">
      <li class="nav-item">
        <a class="nav-link" href="#!"><i class="bi bi-house-fill"></i></a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="#!">Link</a>
      </li>
      <li class="nav-item active">
        <a class="nav-link" href="#!">Active</a>
      </li>
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" href="#!" id="navbarDropdown"
           role="button" data-bs-toggle="dropdown"
           aria-haspopup="true" aria-expanded="false">Dropdown</a>
        <ul class="dropdown-menu" aria-labelledby="navbarDropdown">
          <li><a class="dropdown-item" href="#!">Link 1</a></li>
          <li><a class="dropdown-item" href="#!">Link 2</a></li>
          <li class="dropdown-submenu">
            <a class="dropdown-item dropdown-toggle" href="#!">Dropdown</a>
            <ul class="dropdown-menu">
              <li><a class="dropdown-item" href="#!">Sub Link 1</a></li>
              <li><a class="dropdown-item" href="#!">Sub Link 2</a></li>
            </ul>
          </li>
        </ul>
      </li>
      <li class="nav-item">
        <a class="nav-link disabled" href="#!" tabindex="-1" aria-disabled="true">Disabled</a>
      </li>
    </ul>
  </div>
</nav>
```

**FAO-specific classes**: `.navbar-subsite`, `.dropdown-submenu`.

**Bootstrap classes**: `.navbar`, `.navbar-expand-lg`, `.navbar-light`, `.navbar-toggler`, `.navbar-toggler-icon`, `.navbar-collapse`, `.navbar-nav`, `.nav-item`, `.nav-link`, `.nav-item.active`, `.nav-link.disabled`, `.dropdown`, `.dropdown-toggle`, `.dropdown-menu`, `.dropdown-item`, `.collapse`, `.bg-white`, `.me-auto`.

**ARIA**: `aria-controls="navbarSupportedContent"`, `aria-expanded="false"`, `aria-label="Toggle navigation"`, `role="button"`, `aria-haspopup="true"`, `aria-labelledby="navbarDropdown"`, `aria-disabled="true"` + `tabindex="-1"` on disabled links.

---

## components/paginations

```html
<nav aria-label="Page navigation example">
  <ul class="pagination justify-content-center">
    <li class="page-item">
      <a class="page-link" href="#!" aria-label="Previous">
        <span aria-hidden="true">«</span>
      </a>
    </li>
    <li class="page-item"><a class="page-link" href="#!1">1</a></li>
    <li class="page-item active"><a class="page-link" href="#!2">2</a></li>
    <li class="page-item"><a class="page-link" href="#!3">3</a></li>
    <li class="page-item">
      <a class="page-link" href="#!" aria-label="Next">
        <span aria-hidden="true">»</span>
      </a>
    </li>
  </ul>
</nav>
```

**Classes**: `.pagination`, `.page-item`, `.page-item.active`, `.page-link`, `.justify-content-center`.

**ARIA**: `aria-label="Page navigation example"` on `<nav>`, `aria-label="Previous"` / `"Next"` on controls, `aria-hidden="true"` on the `«`/`»` span.

---

## components/searches

Search input with expandable advanced panel (uses the Bootstrap accordion/collapse plugin).

```html
<div class="dynamic-search">
  <div class="input-main-search input-group">
    <input type="text" placeholder="Search" aria-label="Search" class="form-control">
    <div class="input-group-append">
      <button type="button" class="btn btn-primary btn-icon">
        <i class="bi bi-search"></i>
      </button>
    </div>
  </div>
  <div class="accordion dynamic-search-collapse" id="dynamicSearchAccordion">
    <div class="dynamic-search-header" id="dynamicSearchCollapse">
      <button class="btn btn-secondary btn-icon btn-adv-search collapsed" type="button"
              data-bs-toggle="collapse" data-bs-target="#dynamicSearchBody"
              aria-expanded="true" aria-controls="dynamicSearchBody">
        Advanced Search
        <i class="bi bi-chevron-down"></i>
      </button>
    </div>
    <div id="dynamicSearchBody" class="dynamic-search-body collapse"
         aria-labelledby="dynamicSearchCollapse" data-bs-parent="#dynamicSearchAccordion">
      <form>
        <div class="row">
          <div class="col-md-6 mb-4">
            <label class="form-label">Date from</label>
            <input type="date" class="form-control">
          </div>
          <div class="col-md-6">
            <label class="form-label">Date to</label>
            <input type="date" class="form-control">
          </div>
          <div class="col-md-4">
            <select id="inputState1" class="form-control"><option>Example</option></select>
          </div>
          <div class="col-md-4">
            <select id="inputState2" class="form-control"><option>Example</option></select>
          </div>
          <div class="col-md-4">
            <select id="inputState3" class="form-control"><option>Example</option></select>
          </div>
        </div>
        <div class="d-flex justify-content-end mt-3">
          <a href="www.fao.org" class="btn btn-primary">Search</a>
        </div>
      </form>
    </div>
  </div>
</div>
```

**FAO-specific classes**: `.dynamic-search`, `.input-main-search`, `.dynamic-search-collapse`, `.dynamic-search-header`, `.dynamic-search-body`, `.btn-adv-search`.

**Bootstrap classes**: `.input-group`, `.input-group-append`, `.form-control`, `.form-label`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-icon`, `.accordion`, `.collapse`, `.collapsed`, `.row`, `.col-md-4`, `.col-md-6`, `.d-flex`, `.justify-content-end`, `.mb-4`, `.mt-3`.

**ARIA/data**: `aria-label="Search"`, `aria-expanded="true"`, `aria-controls="dynamicSearchBody"`, `aria-labelledby="dynamicSearchCollapse"`, `data-bs-toggle="collapse"`, `data-bs-target`, `data-bs-parent`.

---

## components/swipers

Uses Swiper.js. Three variants: hero banner swiper, auto (multi-card) swiper, cards (stack) swiper.

### Hero swiper
```html
<div id="swiperBanner" class="swiper swiper-container">
  <div class="swiper-wrapper">
    <div class="swiper-slide">
      <div class="hero-banner" style="background-image: url('/images/placeholders/banner-1.jpg');">
        <div class="hero-caption">
          <h5 class="title-link"><a href="#!">Lorem ipsum...</a></h5>
          <p>Lorem ipsum...</p>
        </div>
      </div>
    </div>
    <!-- more .swiper-slide -->
  </div>
  <div class="swiper-button-prev"></div>
  <div class="swiper-button-next"></div>
</div>
```

### Auto cards swiper (multi-column card carousel)
```html
<div id="swiperAuto" class="swiper swiper-auto-cards-container">
  <div class="swiper-wrapper">
    <div class="swiper-slide">
      <div class="card card-news">
        <!-- full news card markup as above -->
      </div>
    </div>
    <!-- more .swiper-slide -->
  </div>
  <div class="swiper-button-prev"></div>
  <div class="swiper-button-next"></div>
</div>
```

### Cards stack swiper
```html
<div id="swiper23" class="swiper swiper-container swiper-cards">
  <div class="swiper-wrapper">
    <div class="swiper-slide">
      <div class="card card-news">...</div>
    </div>
  </div>
  <div class="swiper-button-prev"></div>
  <div class="swiper-button-next"></div>
</div>
```

**Classes**: `.swiper`, `.swiper-container`, `.swiper-auto-cards-container`, `.swiper-cards`, `.swiper-wrapper`, `.swiper-slide`, `.swiper-button-prev`, `.swiper-button-next`. Slides hold FAO components (cards, hero banners).

---

## components/tabbed-contents

Bootstrap 5 tabs with FAO wrapper.

```html
<div class="tabbed-content tabbed-content-search">
  <ul class="nav nav-tabs" id="tabs-1" role="tablist">
    <li class="nav-item">
      <a class="nav-link active" id="tab_1-1" data-bs-toggle="tab"
         href="#tab-panel_1-1" role="tab" aria-selected="true">Tab title 1</a>
    </li>
    <li class="nav-item">
      <a class="nav-link" id="tab_2-1" data-bs-toggle="tab"
         href="#tab-panel_2-1" role="tab">Tab title 2</a>
    </li>
  </ul>
  <div class="tab-content" id="tab-content-1">
    <div class="tab-pane fade show active" id="tab-panel_1-1" role="tabpanel">...</div>
    <div class="tab-pane fade" id="tab-panel_2-1" role="tabpanel">...</div>
  </div>
</div>
```

**FAO-specific classes**: `.tabbed-content`, `.tabbed-content-search`.

**Bootstrap classes**: `.nav`, `.nav-tabs`, `.nav-item`, `.nav-link`, `.nav-link.active`, `.tab-content`, `.tab-pane`, `.fade`, `.show`, `.active`.

**ARIA**: `role="tablist"` (`<ul>`), `role="tab"` (`<a>`), `aria-selected="true"`, `role="tabpanel"`. Data attrs: `data-bs-toggle="tab"`.

---

## components/tag-lists

```html
<div class="tags-list">
  <span class="badge text-bg-secondary">Lorem ipsum</span>
  <span class="badge text-bg-secondary">Lorem ipsum</span>
  <span class="badge text-bg-secondary">Lorem ipsum dolor sit amet</span>
  <a class="badge text-bg-secondary" href="#">Lorem ipsum</a>
</div>
```

**Classes**: `.tags-list`, `.badge`, `.text-bg-secondary` (Bootstrap 5 color-and-text-together badge utility).

---

## components/interactive/maps

Uses Leaflet with the official UN basemap tiles.

**Install**:
```bash
npm i leaflet
```

**Markup**:
```html
<div class="ratio ratio-21x9" id="yourId"></div>
```

**Import CSS + JS**:
```js
import L from "leaflet"
import "leaflet/dist/leaflet.css"
```

**Init**:
```js
const mapDefault = function () {
  const element = document.getElementById("yourId");
  // Official UN map tiles
  const layerUrl = "https://pro-ags1.dfs.un.org/arcgis/rest/services/basemaps/clearmap_webtopo_nolabel_cvw/MapServer/tile/{z}/{y}/{x}";
  const map = L.map(element).setView([0, 0], 2);
  L.tileLayer(layerUrl, {
    attribution: "© UN",
    maxZoom: 18,
  }).addTo(map);
  // Recommended — clamp panning to world bounds
  const bounds = L.latLngBounds(
    L.latLng([-89.98155760646617, -180]),
    L.latLng([89.99346179538875, 180])
  );
  map.setMaxBounds(bounds);
  map.on("drag", function () {
    map.panInsideBounds(bounds, { animate: false });
  });
};
```

**Classes**: `.ratio`, `.ratio-21x9` (Bootstrap ratio helper — FAO brand aspect).

---

## components/interactive/timeline

Uses KnightLab's TimelineJS.

```bash
npm i @knight-lab/timelinejs
```

```html
<div id="timeline" style="width: 100%; height: 500px;"></div>
```

```js
import { Timeline } from "@knight-lab/timelinejs"
import "@knight-lab/timelinejs/dist/css/timeline.css"

window.timeline = new Timeline("timeline", timelineData);
```

No FAO-specific classes — container is plain `<div id="timeline">` with inline width/height.

---

## styles/links

Anchor with trailing chevron (internal) or leading globe/file icon (external, publication). Class `.link-icon` adapts.

```html
<!-- Internal link (trailing chevron) -->
<a href="#!" title="Internal Link Example" class="link-icon" target="_self">
  Internal Link Example<i class="bi bi-chevron-right"></i>
</a>

<!-- External link (leading globe) -->
<a href="#!" title="External Link Example" class="link-icon" target="_self">
  <i class="bi bi-globe"></i>
  <span>External Link Example</span>
</a>

<!-- External link, globe with background chip -->
<a href="#!" title="External Link Example" class="link-icon" target="_self">
  <i class="bi bi-globe bi-bgico"></i>
  <span>External Link Example</span>
</a>

<!-- Publication link (file-earmark-text icon) -->
<a href="#!" title="Publication Link Example" class="link-icon" target="_self">  <i class="bi bi-file-earmark-text"></i>
  <span>Publication Link Example</span>
</a>

<!-- Simple list of links -->
<ul class="simple-list list-unstyled">
  <li>
    <a href="#!" class="link-icon" target="_self">
      Internal Link Example<i class="bi bi-chevron-right"></i>
    </a>
  </li>
  <li>
    <a href="#!" class="link-icon" target="_self">
      Internal Link Example<i class="bi bi-chevron-right"></i>
    </a>
  </li>
</ul>
```

**Classes**: `.link-icon`, `.simple-list`, `.list-unstyled`, `.bi`, `.bi-chevron-right`, `.bi-globe`, `.bi-file-earmark-text`, `.bi-bgico` (adds filled-chip background to the icon).

---

## styles/images

No custom classes — design guidelines only. Key rules:
- Hero aspect ratio (desktop): **21:9**; use `class="ratio ratio-21x9"`.
- Thumbnail aspect ratio (cards/lists): **3:2**; use `class="ratio ratio-3x2"`.
- Max widths: **2000px** for hero images, **600px** for thumbnails.
- Never put text or UI elements inside images.
- Required `alt` text on every non-decorative image — describe content + function, no "Image of…", no photographer name.

---

## styles/embeds

Bootstrap's ratio helper plus FAO's `ratio-3x2`.

```html
<div class="ratio ratio-3x2">
  <iframe src="https://www.youtube.com/embed/WeoIsjYBQH0?controls=0"
          title="iframe1"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>
</div>
```

**Classes**: `.ratio`, `.ratio-3x2` (and Bootstrap's default `.ratio-1x1`, `.ratio-4x3`, `.ratio-16x9`, `.ratio-21x9`).

---

## styles/icons

FAO uses **Bootstrap Icons** (`.bi` + `.bi-<name>`, ~2,000 icons).

```html
<!-- Default -->
<i class="bi-alarm"></i>

<!-- Numbered FAO custom icon glyphs baked into the CSS (icon-0 … icon-20) -->
<div>
  <i class="m-4 bi icon-0"></i>
  <i class="m-4 bi icon-1"></i>
  <i class="m-4 bi icon-2"></i>
  <i class="m-4 bi icon-3"></i>
  <i class="m-4 bi icon-4"></i>
  <i class="m-4 bi icon-5"></i>
  <i class="m-4 bi icon-6"></i>
  <i class="m-4 bi icon-7"></i>
  <i class="m-4 bi icon-8"></i>
  <i class="m-4 bi icon-9"></i>
  <i class="m-4 bi icon-10"></i>
  <i class="m-4 bi icon-11"></i>
  <i class="m-4 bi icon-12"></i>
  <i class="m-4 bi icon-13"></i>
  <i class="m-4 bi icon-14"></i>
  <i class="m-4 bi icon-15"></i>
  <i class="m-4 bi icon-16"></i>
  <i class="m-4 bi icon-17"></i>
  <i class="m-4 bi icon-18"></i>
  <i class="m-4 bi icon-19"></i>
  <i class="m-4 bi icon-20"></i>
</div>
```

**Classes**: `.bi`, `.bi-<name>` (any Bootstrap Icons name, e.g. `bi-alarm`, `bi-chevron-right`, `bi-geo-alt-fill`, `bi-envelope`, `bi-share-fill`, `bi-search`, `bi-moon-stars`, `bi-three-dots`, `bi-house-fill`, `bi-printer`, `bi-pencil-square`, `bi-person-circle`, `bi-twitter`, `bi-globe`, `bi-file-earmark-text`, `bi-collection-play`, `bi-question-circle`, `bi-emoji-smile`, `bi-chevron-down`, `bi-bgico`), and FAO brand glyphs `.icon-0` … `.icon-20`.

For accessibility: add `aria-label` or a visually hidden label when icons convey meaning.

---

## styles/sdg-icons

17 SDG badges, in two sizes.

```html
<!-- Large -->
<span class="sdg sdg-1"></span>
<span class="sdg sdg-2"></span>
<span class="sdg sdg-3"></span>
<span class="sdg sdg-4"></span>
<span class="sdg sdg-5"></span>
<span class="sdg sdg-6"></span>
<span class="sdg sdg-7"></span>
<span class="sdg sdg-8"></span>
<span class="sdg sdg-9"></span>
<span class="sdg sdg-10"></span>
<span class="sdg sdg-11"></span>
<span class="sdg sdg-12"></span>
<span class="sdg sdg-13"></span>
<span class="sdg sdg-14"></span>
<span class="sdg sdg-15"></span>
<span class="sdg sdg-16"></span>
<span class="sdg sdg-17"></span>

<!-- Small (used inside cards/lists) -->
<span class="sdg-small sdg-1"></span>
<span class="sdg-small sdg-2"></span>
<!-- …through sdg-17 -->
```

**Classes**: `.sdg`, `.sdg-small`, `.sdg-1` … `.sdg-17`.

---

## styles/flags

ISO-3166 alpha-3 flag classes. Two sizes: default and `flag-small`. Pattern: `flag flag-<iso3>`; optionally add `flag-small`.

```html
<!-- Large -->
<span class="flag flag-ita"></span>

<!-- Small -->
<span class="flag flag-small flag-ita"></span>

<!-- In heading/paragraph -->
<h2 class="page-title">
  <span class="flag flag-ita"></span>
  Heading
</h2>
<p>
  <span class="flag flag-ita flag-small"></span>
  Paragraph
</p>

<!-- In a list of country links -->
<ul class="simple-list list-unstyled">
  <li>
    <a href="#!" title="Placeholder link title" class="link-icon">
      <span class="flag flag-ita flag-small"></span>
      <span>Internal Link Example</span>
    </a>
  </li>
</ul>
```

**Classes**: `.flag`, `.flag-small`, and a `.flag-<iso3>` modifier for each country. The CSS ships all 251 ISO-3 codes including regional/placeholder codes; notable ones:
`flag-afg`, `flag-ago`, `flag-alb`, `flag-and`, `flag-arg`, `flag-arm`, `flag-aus`, `flag-aut`, `flag-aze`, `flag-bel`, `flag-ben`, `flag-bfa`, `flag-bgd`, `flag-bgr`, `flag-bhr`, `flag-bih`, `flag-blr`, `flag-bol`, `flag-bra`, `flag-brn`, `flag-btn`, `flag-can`, `flag-che`, `flag-chl`, `flag-chn`, `flag-civ`, `flag-cmr`, `flag-cod`, `flag-cog`, `flag-col`, `flag-cri`, `flag-cub`, `flag-cyp`, `flag-cze`, `flag-deu`, `flag-dnk`, `flag-dom`, `flag-dza`, `flag-ecu`, `flag-egy`, `flag-esp`, `flag-est`, `flag-eth`, `flag-eur` (EU), `flag-fin`, `flag-fra`, `flag-gbr`, `flag-geo`, `flag-gha`, `flag-grc`, `flag-hrv`, `flag-hti`, `flag-hun`, `flag-idn`, `flag-ind`, `flag-irl`, `flag-irn`, `flag-irq`, `flag-isl`, `flag-isr`, `flag-ita`, `flag-jam`, `flag-jor`, `flag-jpn`, `flag-kaz`, `flag-ken`, `flag-khm`, `flag-kor`, `flag-lao`, `flag-lbn`, `flag-lbr`, `flag-lby`, `flag-ltu`, `flag-lux`, `flag-lva`, `flag-mar`, `flag-mex`, `flag-mng`, `flag-moz`, `flag-mys`, `flag-nga`, `flag-nic`, `flag-nld`, `flag-nor`, `flag-npl`, `flag-nzl`, `flag-pak`, `flag-pan`, `flag-per`, `flag-phl`, `flag-pol`, `flag-prk`, `flag-prt`, `flag-pry`, `flag-qat`, `flag-rou`, `flag-rus`, `flag-rwa`, `flag-sau`, `flag-sdn`, `flag-sen`, `flag-sgp`, `flag-slb`, `flag-slv`, `flag-som`, `flag-srb`, `flag-ssd`, `flag-swe`, `flag-syr`, `flag-tcd`, `flag-tha`, `flag-tun`, `flag-tur`, `flag-twn`, `flag-tza`, `flag-uga`, `flag-ukr`, `flag-ury`, `flag-usa`, `flag-uzb`, `flag-vat`, `flag-ven`, `flag-vnm`, `flag-yem`, `flag-zaf`, `flag-zmb`, `flag-zwe`, plus `flag-xxx` (unknown/placeholder). Full list: all 193 UN member states + dependent territories.

---

## styles/layout-subsite

Page skeleton for a subsite (header → subheader/title band → main content in Bootstrap container).

```html
<header><!-- FAO/app header component --></header>
<div class="subheader">
  <div class="container">
    <div class="row">
      <div class="col-12">
        <h2 class="page-title">Food System</h2>
      </div>
    </div>
  </div>
</div>
<main>
  <div class="container">
    <div class="row">
      <div class="col-md-12">...</div>
    </div>
  </div>
</main>
```

**Classes**: `.subheader`, `.page-title`. Bootstrap: `.container`, `.row`, `.col-12`, `.col-md-12`.

---

## accessibility/getting-started

No code examples — conceptual overview. Applies to every component above.

**Key principles enforced across the system**:
- Provide text alternatives for non-text content (`alt`, `aria-label`, visually-hidden text).
- Ensure proper colour contrast and readable typography.
- Make all functionality available from a keyboard (don't rely on hover / pointer).
- Offer clear navigation and document structure (use landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`; one `<h1>` per page; logical heading order).
- Let content be presented in different ways (responsive; reflow; no fixed dimensions on text containers).
- Ensure compatibility with assistive technologies (valid HTML, correct ARIA, native elements first).

**Component-level ARIA contracts collected from all pages**:
- Collapsible controls (accordions, navbars, offcanvas, header search, advanced search, language dropdown): `aria-expanded`, `aria-controls`, `aria-labelledby`, `data-bs-toggle`, `data-bs-target`; `role="button"` when the control is not a `<button>`.
- Breadcrumb: `<nav aria-label="breadcrumb">` + `aria-current="page"` on the active crumb.
- Pagination: `<nav aria-label="...">` + `aria-label="Previous"/"Next"` + `aria-hidden="true"` on decorative `«`/`»`.
- Tabs: `role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected="true"` on the active tab.
- Dropdowns / menus: `aria-haspopup="true"`, `aria-expanded`, `aria-labelledby`; `role="menu"`, `role="menuitem"` when the dropdown truly behaves as a menu (language switcher).
- Modals: `aria-labelledby` pointing to the title id, `aria-hidden="true"`, `tabindex="-1"`, paired close with `aria-label="Close"`.
- Icon-only controls: always `aria-label` (Search, Share, Close, Toggle navigation, etc.); icon element itself is `aria-hidden` or decorative.
- Disabled items: `aria-disabled="true"` + `tabindex="-1"` on the link.

---

**Key findings**:
- The system is built on **Bootstrap 5 + Bootstrap Icons**, with FAO-brand layers on top. Ship both `fao-theme.min.css` (143KB) and `fao-home.min.css` (28KB) plus Bootstrap JS for interactive behavior (collapse, dropdown, modal, offcanvas, accordion, tab, scrollspy).
- Cards and lists share a classifications block (`.classifications`, `.tags-list`, `.hashtags-list`, `.category-list`, `.sdg-list`) — build it once as a partial.
- SDG icons are CSS background sprites (`.sdg.sdg-N` / `.sdg-small.sdg-N`, N=1..17) on empty `<span>` elements — accessible-name via surrounding text.
- Country flags follow `.flag.flag-<iso3>` (+ optional `.flag-small`), 251 codes covering all UN members and dependent territories.
- Interactive components (Maps, Timeline) are not FAO-specific — they use Leaflet (with the official UN basemap URL) and KnightLab's TimelineJS respectively.
- Extracted source HTML is cached at `/tmp/fao/*.html` and per-page extracted code/classes at `/tmp/fao/extracted/*.txt` if the user wants to re-derive anything.