# Hub Promotions

## Purpose

The homepage supports three promotional discovery surfaces:

- **Latest evidence** derives recent Impact assessment and Country brief items
  from the already-loaded public catalog.
- **Explore DIEM** presents a manually controlled programme carousel.
- **Featured update** presents one editor-managed campaign after both meaningful
  dwell time and scrolling.

The catalog remains authoritative for catalog resources. Promotions may point
to stable Hub routes or public external resources but do not copy or authorize
catalog records.

## Runtime Behaviour

`src/services/hubPromotions.ts` owns the promotion contract. When no promotion
view is configured, the carousel uses reviewed built-in slides and the popup
attempts to read the former public campaign item
`015a1eabdb454d1c90fd9ad282e407e6`. Its first table/layer ID is discovered from
the live service definition rather than assumed. Failure is non-blocking.

The popup appears only after:

1. the page has remained active for at least 4.5 seconds; and
2. the post-hero catalog statistics enter the upper 45 percent of the viewport.

Dismissal is stored by publication channel and stable campaign ID. The default
is seven days; editors can change `dismiss_days`. The popup does not steal
keyboard focus and motion is removed when the visitor requests reduced motion.

The carousel is manual by design. It exposes previous, next and direct slide
controls and does not move content without the visitor's action.

The latest-evidence strip uses exact, case-insensitive matches for the
publisher-provided tags `Impact assessment` and `Country brief`. It shows at
most six distinct items, ordered by current ArcGIS modification time. Movement
pauses on hover, keyboard focus or the visible Pause control. Mobile and
reduced-motion layouts are stationary.

## ArcGIS Editorial Contract

Provision the editable source and two read-only views with:

```powershell
& '<ArcGIS Pro Python environment>\python.exe' `
  scripts\provision_hub_promotions.py
```

The command returns stable item IDs for:

- the private editable source;
- the public production view, filtered to `published = 1 AND channel = 'prod'`;
- the public staging view, filtered to `published = 1 AND channel = 'stg'`.

Editors work only in the private source shared with the DIEM content-editor
shared-update group.

### Programme carousel fields

| Field | Purpose |
|---|---|
| `slide_id` | Stable identifier used by the UI |
| `sort_order` | Display order; use 10, 20, 30 and so on |
| `eyebrow` | Short programme/category label |
| `title` | Slide heading |
| `description` | Concise evidence-led explanation |
| `image_url` | Public horizontal image |
| `image_alt` | Meaningful alternative text, or blank for decorative imagery |
| `cta_label` | Action wording |
| `destination` | Hub-relative path or public HTTP(S) URL |
| `channel` | `stg` or `prod` |
| `published` | `1` to expose through the channel view |
| `start_at`, `end_at` | Optional display window |

### Popup campaign fields

| Field | Purpose |
|---|---|
| `campaign_id` | Stable identifier controlling dismissal recurrence |
| `sort_order` | Priority when more than one row is active |
| `title`, `description` | Campaign copy |
| `image_url` | Optional public image |
| `cta_label`, `destination` | Campaign action |
| `dismiss_days` | Days before a dismissed campaign may reappear |
| `channel`, `published` | Preview/production controls |
| `start_at`, `end_at` | Optional campaign window |

Use no more than one active popup row per channel. If several are active, the
first valid row returned by the view is used.

## Deployment Configuration

Production:

```text
VITE_HUB_PROMOTIONS_CHANNEL=prod
VITE_HUB_PROMOTIONS_VIEW_ITEM_ID=<production view item ID>
```

Staging:

```text
VITE_HUB_PROMOTIONS_CHANNEL=stg
VITE_HUB_PROMOTIONS_VIEW_ITEM_ID=<staging view item ID>
```

`VITE_HUB_PROMOTIONS_SERVICE_URL` may temporarily override view-item
resolution for diagnostics. It should not replace the stable view item ID as
the durable deployment contract.

The public staging view is suitable only for non-secret review content. A
hidden UI flag is not authorization. Embargoed material requires an
authenticated preview route and ArcGIS sharing enforcement.

## Editor Workflow

1. Create or duplicate a row with `channel = stg`.
2. Keep `published = 0` while fields are incomplete.
3. Set `published = 1` and inspect the staging deployment.
4. Have a second editor verify copy, images, links, dates, responsive layout
   and reduced-motion behaviour.
5. Create or update the equivalent `prod` row in one operation.
6. Set the production row to `published = 1`.
7. Reload production and verify immediately.
8. Roll back by setting `published = 0` or ending the campaign window.

## Failure Behaviour

- Catalog failure retains the existing homepage retry state.
- No matching latest-evidence tags omits the strip.
- Promotion-view failure keeps the built-in carousel and omits the popup.
- Invalid destinations, missing required copy and invalid images are rejected.
- Image delivery may still fail independently; editors must verify public image
  URLs before publishing.
