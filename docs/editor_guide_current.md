# DIEM Hub 3.0 — Practical Guide for Content Editors

This guide covers only the content that editors can change **now**, without a
code change or a website deployment.

ArcGIS Online is the source of truth. Work in the editable resources linked
below, save your changes, and then reload the relevant Hub page to check the
result.

> **Before publishing:** check names, dates, links and images; ask a second
> editor to review prominent content; then inspect the public page on both a
> computer and a phone.

## At a glance

| What you can edit | Editable resource | HTML? | How it becomes visible |
|---|---|---|---|
| Country introduction and hero image | [Country editorial source](https://hqfao.maps.arcgis.com/home/item.html?id=4aa10392e4384de0900d2624afd89d88) → **Country page content** | Plain text or Safe HTML | Set **Publication status** to **Published** |
| Country “In evidence” highlight | [Country editorial source](https://hqfao.maps.arcgis.com/home/item.html?id=4aa10392e4384de0900d2624afd89d88) → **Country featured items** | Plain text or Safe HTML in the supported text fields | Set **Demonstration content** to **No** and **Publication status** to **Published** |
| Homepage featured popup | [Homepage popup settings](https://hqfao.maps.arcgis.com/home/item.html?id=015a1eabdb454d1c90fd9ad282e407e6) → **hub_homepage_popup_settings** | No—plain text only | Set `prod_or_stg` to `prod` |
| Homepage “Latest evidence” | The product’s own ArcGIS item | Not applicable | Add the exact qualifying tag |
| Product title, description, thumbnail and destination | The product’s own ArcGIS item in the [DIEM Hub content group](https://hqfao.maps.arcgis.com/home/group.html?id=ab8a43038b6347ac93507988f7e2a90b) | Title: no. Description: sanitized HTML is supported | Save the authoritative ArcGIS item |
| Photo gallery entry | [Photo gallery catalogue](https://hqfao.maps.arcgis.com/home/item.html?id=24afb02b6cf549f99380cd6b3780691b) | No—plain text only | Set **Publication status** to `Published` |

## The easiest safe way to prepare HTML

You never have to use HTML: **Plain text is the safest choice and is suitable
for most updates.** Use Safe HTML only when you need headings, lists, emphasis
or links.

Copy this template into Notepad. Replace only the words in CAPITAL LETTERS,
then paste the result into ArcGIS and select **Safe HTML**.

```html
<p>FIRST PARAGRAPH.</p>
<p>SECOND PARAGRAPH.</p>
<h3>Further information</h3>
<ul>
  <li><a href="https://EXACT-PUBLIC-LINK">DESCRIPTIVE LINK TEXT</a></li>
  <li><a href="https://EXACT-PUBLIC-LINK">DESCRIPTIVE LINK TEXT</a></li>
</ul>
```

For a short note above an “In evidence” card:

```html
<p><strong>WHY THIS MATTERS.</strong> ONE OR TWO SENTENCES OF CONTEXT.</p>
```

For a short explanation inside the card:

```html
<p>ONE SHORT EXPLANATION OF WHY THIS PRODUCT IS USEFUL NOW.</p>
```

Safety checklist:

1. Every paragraph starts with `<p>` and ends with `</p>`.
2. Every link begins with `https://` and sits between quotation marks after
   `href=`.
3. Use descriptive link text; avoid “click here”.
4. Never paste `<script>`, `<style>`, `<img>`, `<iframe>` or embed code.
5. Do not paste directly from Word into a Safe HTML field. Paste into Notepad
   first to remove hidden formatting, then add only the simple tags above.
6. Save as Draft first when possible, inspect the result, then publish.

If anything looks uncertain, use Plain text. Paragraph breaks are preserved
without HTML.

## 1. Edit a country introduction or hero image

Open the private editable source:

**[DIEM Hub 3.0 — Country editorial source](https://hqfao.maps.arcgis.com/home/item.html?id=4aa10392e4384de0900d2624afd89d88)**

Do not edit the [public read-only view](https://hqfao.maps.arcgis.com/home/item.html?id=bfabf1dc1d354b3c92a3c801b0376452).

1. Open the **Country page content** table.
2. Find the country using **Country ISO3** or **Country name**.
3. Edit **Country introduction**.
4. Leave **Text format** as **Plain text** for normal writing. Select **Safe
   HTML** only when you intentionally use the supported markup below.
5. To change the banner, enter a public URL in **Hero image URL**. Use a
   horizontal image close to a 3.35:1 ratio, ideally at least 1600 × 480 pixels.
6. Set **Publication status** to **Published** and save.
7. Reload the country page and check the result.

### HTML rules

Safe HTML is allowed in **Country introduction**. The Hub supports:

- paragraphs and line breaks: `<p>`, `<br>`;
- headings: `<h2>`, `<h3>`, `<h4>`;
- ordered and unordered lists: `<ol>`, `<ul>`, `<li>`;
- bold and italic emphasis: `<strong>`, `<b>`, `<em>`, `<i>`;
- blockquotes: `<blockquote>`;
- links: `<a href="https://…">Link text</a>`.

Scripts, styles, images, iframes, embedded objects, event handlers and unsafe
links are removed. Use **Hero image URL** rather than inserting an image in the
HTML.

### Existing example

The **Afghanistan** row (`AFG`) is a current published example. It contains a
Safe HTML introduction with paragraphs, a “Further information” heading and
links, plus a public ArcGIS attachment as its hero image.

See the result: **[Afghanistan country page](https://data-in-emergencies.fao.org/countries/afg)**.

## 2. Feature a product in a country’s “In evidence” section

Use the same editable source:

**[DIEM Hub 3.0 — Country editorial source](https://hqfao.maps.arcgis.com/home/item.html?id=4aa10392e4384de0900d2624afd89d88)**

1. Open **Country featured items**.
2. Find the country row or add a row.
3. Paste the 32-character **ArcGIS item ID** of a product already present in
   that country’s Evidence collection.
4. Complete the fields you need:
   - **Introduction above the card**;
   - **Editorial headline**;
   - **Why this item is highlighted**;
   - **Link label**;
   - **Display order**—normally `10` for the first item and `20` for the second.
5. Set **Demonstration content** to **No**. Rows marked Yes are deliberately
   hidden by the Hub.
6. Set **Publication status** to **Published**, save and reload the country page.

The Hub will omit a row if its item ID is invalid or if the product is no longer
part of that country’s active Hub catalogue.

### HTML rules

- **Introduction above the card** can be Plain text or Safe HTML and supports
  paragraphs, headings, lists, emphasis, blockquotes and safe links.
- **Why this item is highlighted** may contain compact Safe HTML: paragraphs,
  line breaks, lists, bold or italic emphasis, and safe links.
- **Editorial headline** and **Link label** are plain text. Do not enter HTML.

### Existing example

Afghanistan currently has two published highlights, both with **Demonstration
content = No**:

1. **[Afghanistan — DIEM Monitoring Brief, Round 11](https://hqfao.maps.arcgis.com/home/item.html?id=64ed561c0c5e4de581c02c581a1a19e7)**
   at display order `10`, with the link label “Read the monitoring brief”.
2. **[Afghanistan — DIEM StoryMap](https://hqfao.maps.arcgis.com/home/item.html?id=74419b128b2a42f59277eb68de35b9d2)**
   at display order `20`, with the link label “Explore the StoryMap”.

See them together on the **[Afghanistan country page](https://data-in-emergencies.fao.org/countries/afg)**.

### Examples of every optional choice

| Optional choice | Example entry | If left blank |
|---|---|---|
| **Introduction above the card** | `A recent household-monitoring brief for Afghanistan, selected for quick access.` | No introductory note appears above the card |
| **Introduction format** | `plain`, or `html` when using a safe template | Plain text is used unless HTML is selected |
| **Editorial headline** | `Afghanistan — DIEM Monitoring Brief, Round 11` | The current ArcGIS product title is shown |
| **Why this item is highlighted** | `Use this brief for the latest published Round 11 findings and recommendations.` | The card appears without an editorial explanation |
| **Link label** | `Read the monitoring brief` | The Hub uses `Open resource` |
| **Display order** | `10` for the first item and `20` for the second | Enter an explicit order for a predictable result |

## 3. Edit the homepage featured popup

Open:

**[diem_hub_homepage_popup_settings](https://hqfao.maps.arcgis.com/home/item.html?id=015a1eabdb454d1c90fd9ad282e407e6)**

Then open the **hub_homepage_popup_settings** table. During the current
compatibility period, edit the existing row rather than creating competing
rows.

| Field | What to enter |
|---|---|
| `title` | A short campaign title |
| `subtitle` | One concise supporting sentence or date line |
| `image_url` | A public HTTP(S) image URL |
| `product_url` | The public destination URL |
| `prod_or_stg` | `prod` to show it on the production homepage; another value removes it from production |

### HTML rules

HTML is **not** supported. The title and subtitle are rendered as plain text.
Do not enter tags such as `<br>` or `<strong>`.

The popup appears only after the visitor has spent several seconds on the
homepage and scrolled beyond the hero area. A visitor who dismisses it will not
see the same campaign again immediately.

### Existing example

The current production row is:

- **Title:** “Nepal floods - DIEM Monitoring Rapid Remote Sensing Assessment”
- **Subtitle:** “08 2026”
- **Channel:** `prod`
- **Destination item:**
  [`34e84a9b46c849c9afa6f8738be4ca91`](https://hqfao.maps.arcgis.com/home/item.html?id=34e84a9b46c849c9afa6f8738be4ca91)

See the surface where it appears: **[DIEM Hub homepage](https://data-in-emergencies.fao.org/)**.

## 4. Place a product in “Latest evidence”

There is no separate editorial table for this strip.

1. Open the product’s authoritative ArcGIS item. If you do not have its direct
   link, ask the catalogue administrator for it.
2. Add one of these exact tags:
   - `Impact assessment`
   - `Country brief`
3. Save the item and reload the Hub homepage.

Editors do not need to assign group membership or controlled categories for
this task. If the tagged product does not appear, ask the catalogue
administrator to check its publication eligibility.

The Hub selects up to six matching products using the current ArcGIS
modification date. Products modified within the last 14 days receive the
**New** label.

### HTML rules

Not applicable. Tags are exact plain-text metadata values.

### Existing example

**[Philippines — DIEM Monitoring Brief — Round 2](https://hqfao.maps.arcgis.com/home/item.html?id=82df717f9118490db29e799ff35e6b12)**
is a verified example. It is public, belongs to the DIEM Hub content group,
carries the exact `Country brief` tag and is categorized as a discoverable
product for the Philippines.

## 5. Edit a product’s catalogue presentation

Open the product’s original ArcGIS item from the
**[DIEM Hub content group](https://hqfao.maps.arcgis.com/home/group.html?id=ab8a43038b6347ac93507988f7e2a90b)**.

Editors can update the product’s:

- title;
- summary and description;
- thumbnail;
- public destination URL;
- tags.

The Hub reads these values from ArcGIS. Titles, URLs and counts can change, but
the ArcGIS item ID remains the stable identifier.

### HTML rules

- **Title** and **summary** should be plain text.
- The ArcGIS **description** may contain HTML. The Hub sanitizes it before
  display, so use ordinary semantic paragraphs, headings, lists, emphasis and
  links. Do not rely on scripts, styles, iframes or event handlers.

### Existing example

**[Afghanistan — DIEM Monitoring Brief — Round 11](https://hqfao.maps.arcgis.com/home/item.html?id=64ed561c0c5e4de581c02c581a1a19e7)**
is an existing catalogue item referenced by the country-editorial source. Its
item ID remains the reference even if an editor later improves its title,
description, thumbnail or destination.

## 6. Add or update a photo gallery

Open:

**[DIEM Hub 3.0 — Photo gallery catalogue](https://hqfao.maps.arcgis.com/home/item.html?id=24afb02b6cf549f99380cd6b3780691b)**

Flickr remains the home of the photographs. The ArcGIS catalogue stores only
the information the Hub needs to present and link to each album.

Complete:

- **Gallery ID**;
- **Title** and short **Summary**;
- canonical **Flickr URL**;
- public **Thumbnail URL** from `live.staticflickr.com`;
- meaningful **Thumbnail alt text**;
- country ISO3 and country name;
- event or monitoring round;
- gallery date;
- credit;
- featured flag and display order, where needed.

### Where the gallery appears

The country ISO3 decides which country page shows the gallery. It is the only
field that does: the country name is a label for readers and is never read as an
assignment.

- one country: enter its code, for example `TCD`;
- several countries: enter every code separated by a semicolon, for example
  `IRQ;LBN`. The gallery then appears on each of those country pages and on the
  cross-country page;
- no code: the gallery appears on **/photo-galleries** only. Leave it empty only
  when no country applies.

Do not type a country name, or words such as `Global`, into the ISO3 field. The
Hub ignores anything that is not a three-letter code, so the gallery would
simply reach no country page.

Each country page shows its three most recent galleries by gallery date, above
the evidence collection, and links to the full list. Never create a StoryMap to
carry a photo gallery: a catalogue row is the only supported route, and it keeps
the field date and leaves the gallery out of product counts.

### Legacy item ID

**Leave this empty for a new gallery.** It exists only for the galleries that
were once published as a StoryMap wrapper: it holds that wrapper's ArcGIS item
ID, so Hub links already circulating for it open the gallery instead of the
StoryMap. Where one gallery replaced two wrappers, both IDs are recorded,
separated by a semicolon.

Set **Publication status** to `Published` only after opening both the album and
thumbnail links anonymously. The service is normally public and read-only; its
owner must temporarily enable editing for maintenance and disable it again
immediately afterwards.

### HTML rules

HTML is **not** supported. Titles, summaries, alternative text, event names and
credits are rendered as plain text.

The album URL must be an FAO emergencies Flickr album or set under
`https://www.flickr.com/photos/faoemergencies/`. The thumbnail must use
`https://live.staticflickr.com/`.

### Existing example

The current featured entry is:

- **Gallery ID:** `cod-field-mission-2025-07`
- **Title:** “Democratic Republic of the Congo | DIEM field mission, July 2025”
- **Country:** Democratic Republic of the Congo (`COD`)
- **Event:** Field mission
- **Date:** 8 September 2025
- **Album:** [FAO emergencies Flickr album](https://www.flickr.com/photos/faoemergencies/albums/72177720328904503/)
- **Thumbnail:** [public Flickr image](https://live.staticflickr.com/65535/54772380727_275558796f_b.jpg)

See all published entries: **[DIEM photo galleries](https://data-in-emergencies.fao.org/photo-galleries)**.

## Publishing safely

For every change:

1. Prepare substantial text before editing an already published row; saving it
   may update the public Hub immediately.
2. Check spelling, dates and institutional terminology.
3. Open images and destinations in a private/incognito window.
4. Check the resulting Hub page on desktop and mobile.
5. Ask a second editor to review high-visibility content.

To undo a publication:

- set country content or a photo gallery back to **Draft**;
- mark a country highlight as Draft or Demonstration content;
- change the popup’s `prod_or_stg` away from `prod`;
- remove a qualifying Latest evidence tag;
- correct the authoritative item when catalogue metadata is wrong.
