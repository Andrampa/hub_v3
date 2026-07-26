# Country Editorial Content

## Purpose

Country pages can show editor-managed country context and one or two highlighted
resources above **Evidence collection**. ArcGIS Online remains authoritative:
editorial rows reference catalog resources by stable item ID, and the application
resolves the current title, thumbnail, type, modified date, and destination from
the live country catalog.

## ArcGIS Online Items

- [Editable source item](https://hqfao.maps.arcgis.com/home/item.html?id=4aa10392e4384de0900d2624afd89d88):
  `4aa10392e4384de0900d2624afd89d88`
- [Public read-only view item](https://hqfao.maps.arcgis.com/home/item.html?id=bfabf1dc1d354b3c92a3c801b0376452):
  `bfabf1dc1d354b3c92a3c801b0376452`
- Editor group: `7f5d03df97854f4687c2f9defad01f31`
- Provisioning script: `scripts/provision_country_editorial.py`

The editable source is private and shared with **DIEM content - editors group**,
which is a shared-update group. The view is public and query-only. The web app
stores the public view item ID and resolves its current service URL from ArcGIS
at runtime.

## Quick Guide For Editors

Editors work only in the **DIEM Hub 3.0 — Country editorial source** item. Do
not edit the similarly named public view: that item exists only so the website
can read published content.

Changes normally appear on the website after saving and reloading the country
page. No code change or website deployment is needed.

Saving published editorial content also updates the **Latest update** date in
the country-page header. ArcGIS fills the editor name and edit time
automatically; editors should not change the Created by, Created at, Updated by,
or Updated at fields.

### Country introduction

1. Open the editable source item.
2. Select the **Country page content** table.
3. Find the country by its name or three-letter code.
4. Edit **Country introduction**.
5. Leave **Text format** as **Plain text** unless you intentionally entered
   HTML.
6. Set **Publication status** to **Published** and save.
7. Reload the public country page and check the result.

The most useful fields are:

| Field shown in ArcGIS | What the editor should enter |
|---|---|
| Country ISO3 | The existing three-letter country code; normally do not change it |
| Country name | The name displayed in the editorial banner |
| Country introduction | The main country narrative |
| Text format | Plain text for normal writing; Safe HTML only when markup is used |
| Hero image URL | A public, full-size horizontal banner image |
| Publication status | Draft hides the introduction; Published displays it |
| Internal review notes | Notes for colleagues; never displayed publicly |

The seeded hero images are full `picture.jpg` attachments measuring 920×275.
The small 140×41 thumbnail attachment is retained as source metadata but is
never enlarged on the public page. For replacement images, use a horizontal
image close to a 3.35:1 ratio, ideally at least 1600×480 pixels.

### Put A Resource “In Evidence”

1. Select the **Country featured items** table.
2. Find the country row to edit, or add a row for another resource.
3. Paste the ArcGIS item ID from a resource already visible in that country’s
   Evidence collection.
4. Write whichever editorial text is useful:

   - **Introduction above the card** appears as a separate editorial note;
   - **Editorial headline** replaces the card title visually;
   - **Why this item is highlighted** appears inside the card.

   The introduction and inside-card description are independent. Editors may
   use either one or both.

5. Set **Display order**. Use `10` for the first item and `20` for the second.
6. Set **Publication status** to **Published** and save.
7. Reload the public country page and check the **In evidence** section.

Additional fields:

| Field shown in ArcGIS | What it does |
|---|---|
| Introduction format | Plain text or Safe HTML for the text above the card |
| Link label | Button wording, such as “Explore the evidence” |
| Demonstration content | Yes identifies the initial sample wording; change to No after editorial review |

If the item ID is mistyped, or the resource is no longer assigned to that
country, the website quietly omits it. This prevents editorial curation from
bypassing the country catalogue.

### Plain Text And Safe HTML

Most editors should use plain text. Paragraph breaks are preserved
automatically. Safe HTML is optional and supports:

- paragraphs and line breaks;
- headings `h2` through `h4`;
- ordered and unordered lists;
- bold and italic emphasis;
- blockquotes;
- safe links.

The browser sanitizes every HTML value. Scripts, styles, images, iframes,
embedded objects, event handlers, and unsafe URL protocols are removed. Editors
should use the dedicated image URL fields rather than inserting images in HTML.

Highlight descriptions may also contain the safe inline HTML described above.
The app detects markup automatically for this compact field and permits
paragraphs, lists, emphasis, and links.

## Publishing And Review Recommendation

For the current scope, a separate staging application is not recommended. The
layout is fixed, editors change only text, order, item references, and image
URLs, and every row already has a Draft/Published control. A dedicated preview
application would introduce another login, another deployment, and more
support work than this editorial workflow currently warrants.

Recommended working practice:

1. Draft or review substantial prose in Word or another shared document.
2. Paste the approved text into ArcGIS.
3. For a new highlight, keep the row as Draft until all fields are complete.
4. Ask a second editor to check the item ID, image, text, and links.
5. Change the row to Published and check the public page immediately.

One limitation should be understood: changing a row that is already Published
updates the public site directly. Editors should therefore avoid partially
editing a published row over a long period. For major revisions, prepare the
replacement text outside ArcGIS and paste it in one operation.

A private preview application becomes worthwhile only if the team later needs
frequent multi-person publishing, scheduled releases, multilingual variants,
or formal approval states. At that point the recommended next step is an
authenticated `/editor-preview` route reading a private view—not a second
content database.

## Image Treatment

The public design presents the full horizontal image in its native 920:275
proportion, with the country name over a restrained lower gradient. The country
narrative is placed below on white, so neither the photograph nor the text has
to compete for space. The application never uses `thumbnail_url` as a large
image and never falls back to a stretched thumbnail. If a full hero image is
missing or fails, the narrative uses the FAO blue no-image treatment.

## Provisioning And Reruns

Run with the ArcGIS Pro Python environment while signed in:

```powershell
& 'C:\Users\Amparore\AppData\Local\anaconda3\envs\env202409\python.exe' `
  scripts\provision_country_editorial.py `
  --source-item-id 4aa10392e4384de0900d2624afd89d88 `
  --view-item-id bfabf1dc1d354b3c92a3c801b0376452
```

The script verifies the shared-update group, preserves existing rows, adds
profiles only for missing country codes, and adds demo highlights only for
countries that have no highlight rows. It does not overwrite reviewed editorial
work. It also verifies service-level editor tracking and fills missing edit
dates on older rows so published editorial changes can contribute to the
country page's Latest update date.

On first creation, omit both item-ID arguments. The resulting IDs must be
reviewed and the public view ID recorded in
`src/services/countryEditorial.ts`.

## Initial Seed

On 2026-07-26 the provisioning run created:

- 55 country profile rows;
- 39 published profiles with legacy `long_description` content;
- 73 published demonstration highlights;
- one or two highlights per country, selected from its newest assigned catalog
  items using a deterministic ISO3-based count.

The profile seed reads `long_description`, `pic_url`, and `thumb_url` from
`HubCountriesApp/FeatureServer/0`, matched through its `iso` field. `pic_url`
opens the former HTML country page rather than an image. The provisioner
therefore queries the feature’s attachments and selects the full
`picture.jpg`; it records `thumbnail_url` separately but does not use it for
the large public banner. Missing legacy descriptions remain draft rows for
editors to complete.

## Failure Behaviour

Country catalog loading remains the page's primary data dependency. Editorial
loading happens separately:

- an editorial-service failure shows a compact notice while leaving Evidence
  collection usable;
- a country with no published introduction can still show highlights;
- a country with no valid published editorial rows shows no empty editorial
  section;
- invalid highlighted item IDs are omitted.
