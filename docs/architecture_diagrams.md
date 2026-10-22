# Architecture Diagrams Page

`/architecture` shows the four DIEM architecture diagrams to signed-in DIEM
Contributors, with a system map of how the systems hand off to each other.

## Access model: a UI gate, not access control

Decided by the product owner on 2026-10-21: the diagram files may be public;
what matters is that the Hub does not show, link or load them for anonymous
visitors or non-Contributors.

- **Who sees the page.** Signed-in members of the Contributors group
  (`ad13b87919464cb6b9bb6cd8defa0257`, `capabilities.contributor`). Anonymous
  visitors get a sign-in prompt; signed-in non-Contributors get a no-access
  message. The link appears only in Contributor navigation (About DIEM menu and
  mobile menu).
- **What is not protected.** The diagram HTML and manifest are bundled into the
  public build as lazy chunks and are committed in the public `hub_v3`
  repository. Anyone who finds a chunk URL can read it. Do not put anything in a
  diagram that must stay confidential.
- **What the gate guarantees.** Nothing about the diagrams, not even the
  manifest, is requested until a Contributor is signed in; the main bundle holds
  no diagram text; `/architecture` is excluded from the sitemap and marked
  `noindex`. Signing out or switching account discards all diagram state.
- **Catalogue rule.** This page is not a public discovery surface and the
  diagrams are not catalogue products, so it is exempt from the
  `CONTENT_GROUP_ID` membership rule in `AGENTS.md`. Nothing is added to the Hub
  content group or to ArcGIS.

## Sources

The source repositories stay authoritative. The Hub keeps copies in
`src/content/architecture/` only because the deployment build cannot read
sibling checkouts.

| Key | System | Source | GitHub visibility |
|---|---|---|---|
| `monitoring` | DIEM household monitoring | `Andrampa/hh_survey_v3` `docs/diagrams/diem_data_architecture.html` | private |
| `hub` | DIEM Hub | `Andrampa/hub_v3` `docs/diagrams/diem_hub_architecture.html` | public |
| `eve` | EVE flood monitoring, including the daily VIIRS run | `Andrampa/eve` `docs/diagrams/eve_architecture.html` | private |
| `vista` | VISTA water atlas | `Andrampa/vista-water-atlas` `docs/diagrams/vista_architecture.html` | private |

Visibility was read with `gh repo view` on 2026-10-21. The Hub diagram was
already public in `hub_v3` before this page existed; copying the three private
diagrams into this public repository makes them public too, as accepted above.
The page labels private source links "GitHub access required".

## Updating a diagram

1. Edit and commit the diagram in its source repository. Each footer links the
   other three sources and `https://data-in-emergencies.fao.org/architecture/<key>`.
2. From `C:\git\hub_v3`, with the sibling checkouts in `C:\git`:

   ```bash
   node scripts/sync_architecture_diagrams.mjs
   ```

   It refuses a source with uncommitted changes. `--allow-dirty` exists for a
   local preview only; the manifest then marks those diagrams and the page shows
   a warning. `--check` exits non-zero when the Hub copies are stale.
3. Run `npm test` and `npm run build`, commit the changed files in
   `src/content/architecture/`, and deploy the Hub as usual.

Adding a diagram means a new entry in `scripts/architecture_diagrams.config.json`
and a sync: navigation, tabs, map nodes and routes come from the manifest.
Relationships are editorial and stay explicit in the same config file.

## Manifest (`src/content/architecture/manifest.json`)

Schema version 1, validated by `validateArchitectureManifest`
(`src/services/architectureDiagrams.ts`) before anything renders:

- `schemaVersion`, `syncedAt` (UTC ISO; when the Hub copy last changed),
  `diagrams`, `relationships`.
- Each diagram: `key` (`^[a-z][a-z0-9-]{1,31}$`, unique), `title`, `system`,
  `summary`, `repository` (`owner/name`), `repositoryVisibility`, `path`
  (repository-relative `.html`, no `..`), `commit` (full 40-character hash of the
  last commit touching the file), `sourceChangedAt` (that commit's date, UTC),
  `uncommittedChanges`, `sha256` of the copied file, `sortOrder`.
- Optional version-1 fields: `status` (`current` or `target`) and
  `architectureAsOf` (a valid `YYYY-MM-DD` date). The sync reads these from the
  source HTML's `diem-architecture-status` and `diem-architecture-as-of` meta
  tags. Older manifests without them remain valid. This is the date the
  architecture describes, not a claim that a fresh operational audit took place;
  it is separate from the source commit date and the Hub copy date.
- Each relationship: `from`, `to` (listed keys), `kinds` (`data`, `embedded`,
  `link`), `label`, `detail`.

An unsupported schema version shows an error naming both versions. Source links
are built from the validated repository, commit and path, never taken from the
manifest as URLs.

## Relationships (verified 2026-10-21)

| Edge | Kinds | Evidence |
|---|---|---|
| Monitoring → Hub | data, embedded app | `src/services/monitoring.ts` reads the survey config view and statistics; `/monitoring` embeds the app (`monitoringEmbed.ts`) |
| EVE → Hub | data, reference link | `src/services/eve.ts` reads `eve_mastertable_adm0` for country eligibility and links to `diem-eve.apps.fao.org` |
| VISTA → EVE | data | `eve/src/eve_pipeline/utils/naming.py` reads `vista_products/monthly/frequency` |
| VISTA → Hub | reference link | `src/pages/FloodServices.tsx` links to the VISTA explorer, bucket browser and guide; no data |

## Rendering policy

`src/lib/diagramDocument.ts` builds each diagram into a complete, inert
document; fetched HTML is never inserted into the Hub DOM.

- Rendered in `<iframe sandbox="" srcdoc>`: no `allow-scripts`, no
  `allow-same-origin`. The frame has a reserved responsive height
  (`clamp(440px, 74vh, 920px)`) with internal scrolling, an Expand modal
  and the diagrams' own horizontal scrolling. The native `<dialog>` uses
  `showModal()` for focus containment and an inert background, restores focus
  to Expand when closed, and closes on Escape while the parent document has
  focus. Escape inside the script-free frame does not reach the parent; the
  always-visible Close expanded view button is the reliable exit. Scripts and
  same-origin access remain forbidden in the iframe.
- Allowlist sanitizer: only the HTML and SVG elements and attributes the
  diagrams use survive. Scripts, event handlers, forms, frames, objects, images,
  `use`, `foreignObject`, animation and every non-local `url()` are removed;
  attribute `url()` must be `url(#id)`. DOMPurify is deliberately not used here:
  it returns input unchanged when it judges the environment unsupported.
- CSS: `@import`, `@font-face`, external `url()`, `expression()` and
  `behavior` are stripped. Google Fonts links are dropped.
- CSP: `default-src 'none'; style-src 'unsafe-inline'; font-src data:;
  img-src data:; base-uri 'none'; form-action 'none'`.
- Links become plain text so the frame cannot navigate away; related systems
  and source links live in the Hub interface.
- All four sources are standalone UTF-8 HTML documents with a viewport and
  language declaration. Each has a visible architecture status line
  (`.architecture-status`); the Hub shows the status in its own panel and drops
  that line from the embedded view (`hideStatus`), while downloads keep it. Each
  also has an expandable numbered reading sequence (`details`/`summary`, allowed by the
  sanitizer). The native disclosure works without scripts in the frame and in
  downloaded copies. VISTA uses dotted boxes for planned components and dashed
  grey boxes for implemented conditional steps; the full shared-symbol redesign
  remains separate work.
- Fonts: the Hub has no dark theme, so `data-theme="light"` is always set. The
  Hub's Open Sans replaces Archivo and IBM Plex Sans, embedded as a `data:`
  font because the opaque-origin frame cannot fetch it; monospace falls back to
  the system stack.
- "Open full page" is `/architecture/<key>/full` (same gate and renderer,
  opened with `noopener`). "Download HTML" saves the same sanitized document
  with a provenance comment; object URLs are revoked after ten seconds and on
  unmount. A downloaded copy cannot be withdrawn later; the page says so.

### Label fit after the font change

Measured 2026-10-21 in the in-app browser by comparing every SVG text's box in
Open Sans with the original IBM Plex rendering: text is about 3% wider on
average. No label inside a box overflows. The few flagged items (EVE "country
pages", "DAILY · VIIRS_PROCESS"; VISTA "Phase 3B, GDAL mosaic", "run on the
workstation"; monitoring "loaded once, kept current") are connector or lane
annotations that sit on edges by design and do so identically in Plex. No source
diagram change was needed.

## System map

Columns follow the handoffs (a system sits one column right of what feeds it);
edges that skip a column arc around the column they cross, and long labels wrap
to two lines. The map is never drawn below 1:1 (900 px), so its text stays at or
above the Hub's 11 px floor. Below 700 px it is replaced by a list of the same
handoffs, and the diagram tabs become a horizontal strip.
The phone list includes the full handoff descriptions available in the desktop
map caption.

## Verification

2026-10-22 follow-up: 48 focused tests pass, including old-manifest compatibility,
invalid optional metadata, complete source-document rendering, modal cancellation,
close/navigation cleanup and mobile handoff text. Build passes with the existing
large-chunk warning. A temporary local harness exercised the actual frame and
system-map components with all real source files: native modal/inert background,
focus return, parent Escape, iframe Escape limitation, expandable reading guide,
loading/error/retry, full-page sizing, and no outer horizontal overflow at 375,
768, 1024 and 1440 px. Hub corrections and VISTA notation were visually checked.
This is component verification, not a fresh signed-in Contributor acceptance
test. The temporary harness was removed after checking. Source parity passes
with `--check --allow-dirty`; ordinary `--check` intentionally refuses the
uncommitted source changes.

- `npx vitest run src/services/architectureDiagrams.test.ts src/lib/diagramDocument.test.ts src/pages/Architecture.test.tsx src/components/SiteHeader.test.tsx`
- Signed-in Contributor check, 2026-10-21, in the in-app browser at 1280 px and
  about 360 px: deep links and reload, tab strip, map hover/focus/click (client-side
  navigation), Expand and Escape with focus return, Download HTML (CSP,
  provenance, no scripts or links), full-page route, unknown key. Map labels
  were measured for overlap. Known source-side quirk: at phone width each diagram
  document is a few pixels wider than its frame (the Hub diagram about 150 px),
  identically with the original fonts; it scrolls inside the frame.
- Not checked live: a non-Contributor account (no such account was available;
  covered by `Architecture.test.tsx`) and sign-out in the browser (covered by tests).
- `npm run build`, then confirm diagram text appears only in the per-diagram
  and manifest chunks of `dist/assets`, not in `index-*.js`.
