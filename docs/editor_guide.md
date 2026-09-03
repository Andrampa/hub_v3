# DIEM Hub 3.0 — Content Editor Guide

This is the starting point for people who update Hub content. It explains what
can be edited, where to edit it, how to preview it, and what makes it public.
No source-code knowledge is required for the normal editorial tasks described
here.

## Quick Reference

| Hub area | Where editors work | How it becomes public |
|---|---|---|
| Country introduction and country image | **DIEM Hub 3.0 — Country editorial source**, table **Country page content** | Set **Publication status** to **Published** |
| Highlighted country resources (“In evidence”) | The same source, table **Country featured items** | Set **Publication status** to **Published** |
| Homepage featured popup | Currently: `diem_hub_homepage_popup_settings`, table **hub_homepage_popup_settings** | Set `prod_or_stg` to `prod` |
| Homepage programme carousel | Built-in reviewed slides until the promotion editorial source is provisioned | After provisioning: publish `prod` rows in **Programme carousel** |
| Homepage Latest evidence strip | The normal public DIEM catalog items | Add the exact tag `Impact assessment` or `Country brief` |
| Catalog cards, titles, dates and links | The authoritative ArcGIS catalog item | Edit the original ArcGIS item; Hub reloads live metadata |
| Country-card evidence pathway | The item's controlled Hub group categories | Assign **DIEM pillars/Household monitoring system**, **Hazard impact assessment** or **Research**; **Product types/Crop calendar** supplies Seasonal calendar |
| Photo galleries | **DIEM Hub 3.0 — Photo gallery catalogue** | Add or update a row and set **Publication status** to **Published** |

## Important Editing Rules

1. ArcGIS Online is authoritative. Do not copy catalog records into another
   spreadsheet or database.
2. Work in the private editable source, never the similarly named public view.
3. Use stable ArcGIS item IDs when featuring an existing resource.
4. Prepare substantial text before changing a row that is already published.
   Saving a published row can update the public Hub immediately.
5. Images and destinations must be public HTTP(S) URLs.
6. A staging flag controls presentation only. It does not protect secret or
   embargoed information.
7. Country-card pathway labels come only from controlled Hub categories. Do not
   add a title keyword or general tag expecting it to change the pathway.

## Photo Galleries

Editable catalogue:

[Open DIEM Hub 3.0 — Photo gallery catalogue](https://hqfao.maps.arcgis.com/home/item.html?id=24afb02b6cf549f99380cd6b3780691b)

Flickr remains the home of the photographs. The ArcGIS layer supplies only the
metadata needed to build `/photo-galleries`; do not create a StoryMap wrapper.
Complete the gallery ID, title, short summary, canonical Flickr album URL,
public Flickr thumbnail URL, thumbnail alt text, ISO3, country name, event or
round, gallery date, credit and display order. Set **Publication status** to
`Published` only after checking both links. The service is intentionally
public and read-only; an owner must temporarily enable editing to maintain it,
then disable editing again immediately.

## Country Introductions

Editable source:

[Open DIEM Hub 3.0 — Country editorial source](https://hqfao.maps.arcgis.com/home/item.html?id=4aa10392e4384de0900d2624afd89d88)

Do not edit the public view item
`bfabf1dc1d354b3c92a3c801b0376452`.

### Edit an introduction

1. Open the editable source.
2. Open **Country page content**.
3. Find the country using **Country ISO3** or **Country name**.
4. Edit **Country introduction**.
5. Keep **Text format** as **Plain text** unless approved HTML is intentionally
   being used.
6. Add or replace **Hero image URL** only with a public, horizontal image.
7. Set **Publication status** to **Published**.
8. Save and reload `/countries/{ISO3}` in the Hub.

Use a horizontal image close to a 3.35:1 ratio, ideally at least 1600 × 480
pixels. If no valid image exists, leave the field empty; the Hub provides a
designed fallback.

## Highlighted Country Resources

Highlighted resources appear in the country page’s **In evidence** section.

1. In the same editable source, open **Country featured items**.
2. Find the country row or add a new row.
3. Paste the stable ArcGIS **item ID** of a resource already present in that
   country’s Evidence collection.
4. Optionally complete:
   - **Introduction above the card**
   - **Editorial headline**
   - **Why this item is highlighted**
   - **Link label**
5. Set **Display order** to `10`, `20`, and so on.
6. Set **Publication status** to **Published**.
7. Save and check the relevant country page.

The Hub rejects a highlighted item that is not part of the active country
catalog. This prevents editorial curation from bypassing the publisher-managed
country assignment.

Full field guidance, safe HTML rules and image details are in
`docs/country_editorial.md`.

## Homepage Featured Popup

Current editable item:

[Open diem_hub_homepage_popup_settings](https://hqfao.maps.arcgis.com/home/item.html?id=015a1eabdb454d1c90fd9ad282e407e6)

Open the table **hub_homepage_popup_settings**. During the compatibility period,
edit the existing row rather than adding several rows.

| Field | What to enter |
|---|---|
| `title` | Short campaign title |
| `subtitle` | One concise supporting sentence |
| `image_url` | Public image URL |
| `product_url` | Public destination URL |
| `prod_or_stg` | `stg` for staging review or `prod` for production |

The production popup appears when:

- the row contains all required values;
- `prod_or_stg` is `prod`;
- the visitor has stayed on the homepage for at least 4.5 seconds;
- the visitor has scrolled until the post-hero statistics reach the upper part
  of the viewport; and
- that visitor has not dismissed the same campaign during its recurrence
  period.

To retest after dismissing it, use a new private/incognito browser window or
delete local-storage entries beginning with
`diem-hub-promotion-dismissed`.

### Current staging limitation

The legacy table contains one row. Changing it from `prod` to `stg` temporarily
removes that campaign from production. The new promotion editorial source
solves this by keeping separate production and staging views. Provisioning and
deployment configuration are described in `docs/hub_promotions.md`.

## Homepage Programme Carousel

The current slides are reviewed built-in fallbacks, so the carousel works
before a new ArcGIS editorial source exists. Editors cannot yet change those
fallback slides directly in ArcGIS.

After an administrator runs `scripts/provision_hub_promotions.py` and configures
the returned view IDs:

1. Open the private **DIEM Hub 3.0 — Promotion editorial source**.
2. Open **Programme carousel**.
3. Create or update a row with `channel = stg`.
4. Complete the title, description, public image, alternative text, CTA and
   destination.
5. Use `sort_order` values `10`, `20`, `30`, and so on.
6. Set `published = 1` and check the staging Hub.
7. After review, create or update the equivalent `prod` row.
8. Set the production row to `published = 1` and check production.

Keep each slide concise. The carousel is a pathway into DIEM services, not a
second catalog.

## Homepage Latest Evidence

This strip is automatic and has no separate editorial table.

To include an item:

1. Open the authoritative ArcGIS item in the public DIEM catalog.
2. Add the exact tag `Impact assessment` or `Country brief`.
3. Confirm the item remains shared with the public DIEM catalog group.
4. Reload the Hub.

The Hub selects the six most recently modified matching items. An item receives
the **New** label when its ArcGIS modification date is within the last 14 days.
Changing item metadata may therefore affect both its order and New status.

## Preview and Publication Checklist

Before publishing any curated content:

- check spelling, dates and institutional terminology;
- confirm every image loads anonymously;
- confirm every destination opens the intended resource;
- check desktop and mobile layouts;
- check that headings and button labels remain concise;
- verify staging content is not confidential;
- have a second editor review high-visibility campaigns;
- check production immediately after publishing.

To roll back:

- country content: set **Publication status** to **Draft**;
- new promotion tables: set `published = 0` or end the display window;
- legacy popup: change `prod_or_stg` away from `prod`;
- Latest evidence: remove the qualifying tag from the authoritative item.

## Help for Administrators

- Country editorial implementation: `docs/country_editorial.md`
- Homepage promotion implementation and provisioning: `docs/hub_promotions.md`
- ArcGIS endpoints and IDs: `docs/service_manifest.md`
- Authentication and protected content: `docs/authentication.md`

After provisioning new homepage promotion views, add the returned source and
view links to this guide so editors never have to search for the correct item.
