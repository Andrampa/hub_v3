# Brief Spotlight

## Purpose

A homepage section that shows one finding from a recent DIEM country brief at a
time, with the brief's own words as proof and a link to read the brief. Its job
is to send visitors to the briefs: the measure is clicks on the link per card
shown, not time spent on the animation.

Status: prototype on branch `brief-spotlight`, checked locally only. Not synced
to the deployment repository and not deployed anywhere.

## Where it lives

| Part | File |
|---|---|
| Homepage placeholder, lazy loading | `src/components/BriefSpotlightSlot.tsx` (in `App.tsx`, between the Hub area cards and Recent publications) |
| Section, card, the five graphics | `src/components/BriefSpotlight.tsx` |
| Selection and wording rules (no React) | `src/lib/briefSpotlight.ts` |
| Styles and motion | `src/brief-spotlight.css` |
| Cards (generated, do not edit by hand) | `src/data/briefSpotlight.json` |

The Featured update popup and the latest-evidence strip are separate and
unchanged (`docs/hub_promotions.md`).

## Data

The cards are a public export of the private brief-knowledge corpus. The
exporter, its rules and its tests live in `hh_survey_v3`
(`management/brief_knowledge/README.md`, **Public export**). Regenerate with:

```powershell
# from C:\git\hh_survey_v3, after `git pull --ff-only` in ..\diem-survey-operations
python -m management.brief_knowledge.cli export-public --operations-root ..\diem-survey-operations --out <active-hub-worktree>\src\data\briefSpotlight.json --apply
```

A new brief needs no code change here: regenerate the file, commit it, deploy.
The file sits under `src/` because `scripts/sync-web-repository.ps1` does not
copy `public/`; it is imported only by the lazy component, so it never enters
the main bundle. Never copy anything else from the corpus into this repository.

After refreshing the export or UN boundary data, run `node scripts/build_spotlight_shapes.mjs`
from the Hub worktree to refresh the decorative globes. Each view centers its
country using the Hub’s local UN Geodata. The surrounding land is simplified
for the lazy payload. The country uses the Hub’s existing boundary detail.
The globe eases out from the current country, rotates along a great-circle
path and eases in on the next country. The slide content fades in with the
transition. With reduced motion enabled, both update immediately.

The export requires current validation hashes and takes the evidence quote from
the same edition as the link. The export decides what may be shown and which graphic a card supports
(`treatment`). This repository never rewrites a figure: `figure` and the bar
literals are printed exactly as the brief has them, in the brief's language.

## Visibility gate

ArcGIS Online stays authoritative. A card renders only while its brief's ArcGIS
item (`agol_item_id`) is among the public catalogue items the homepage has
loaded (`catalog.items`, before product-family grouping, so an edition grouped
under another one still qualifies). Until the catalogue has loaded, and when no
card is eligible, the section renders nothing and takes no space.

## Behaviour

- **Loading.** Component, styles and data load lazily when the placeholder comes
  within 600 px of the viewport.
- **First card.** Weighted toward the newest briefs (weight halves every 60
  days) and toward cards with a figure. Cards seen on recent visits
  (`localStorage`, last 8) are skipped while others remain.
- **Next card.** Another country when the pool has one, and preferably another
  chapter and another graphic. One eligible card is shown without controls.
- **Rotation.** A weighted selection of up to 20 distinct findings repeats in the
  same order until the page reloads or the eligible catalogue changes. Autoplay
  allows 12 seconds per card.
  It pauses when less than 35% of the card is visible, in a hidden tab, on hover, on keyboard focus, while the
  evidence is open and on Pause. The progress bar's CSS animation is the timer,
  so pausing it pauses the rotation exactly.
- **Reduced motion.** No automatic rotation and no entrance animation; the
  final state is shown at once and Next finding still works.
- **Graphics.** Count (the printed number rises into place; no intermediate
  digits are ever shown), percentage ring, comparison bars, month timeline,
  quote reveal. The export falls back to the quote reveal whenever the item
  does not support a graphic.
- **Accessibility.** Controls are buttons. A card change is announced only when
  the visitor asked for it. Screen readers get each figure and quote once, as
  text; quotes and source-language figures carry `lang`.
- **Same country, previous round.** Offered when the current cycle contains an
  earlier round.
- **Dashboard link.** Opens the DIEM dashboard at the brief's country and survey
  round. For multi-round briefs the button names the latest round it opens.
- **`iso3` prop.** Narrows the pool to one country, for a later country-page use.

## Measurement

`trackSpotlight` sends two events to the Google Analytics tag the Hub already
loads: `brief_spotlight_impression` (a card on screen in a visible tab) and
`brief_spotlight_click` (the link to the brief), each with `card_id`, `survey`,
`chapter` and `treatment`. Nothing about the visitor is added. Showing that the
spotlight raises readership needs a baseline or a comparison after release.

## Decisions for Neil (DIEM coordinator)

Presentation and labels are his call. The prototype uses the first option of
each point so there is something to react to.

1. **Section title and line.** "Brief spotlight" / "What the latest country
   briefs found" / "One finding at a time from DIEM household surveys in
   food-crisis countries, each with the brief's own words as proof."
2. **Headline.** The corpus's English summary sentence, unedited, up to 240
   characters. Alternative: a shorter headline written per finding and approved
   by the analysts.
3. **AgHiN.** Headlines keep "AgHiN" as the briefs do, with the footnote
   "AgHiN: agricultural households in need of assistance." under the card.
   Alternative: always spell it out in the headline.
4. **Figures from French and Spanish briefs.** Shown exactly as printed ("71
   pour cent") beside an English headline. Alternative: translate only the unit
   word ("71 percent").
5. **Context labels.** "Who", "Where", "When" for population, area and period.
6. **Chapter line.** The brief's own chapter title ("Why are the agricultural
   households in need of assistance?").
7. **Which chapters lead.** All chapters rotate; the first card favours a
   figure. Alternative: lead with AgHiN overview and geography only.
8. **Attribution.** "From the Chad brief, November 2026" (month of release on
   FAO Open Knowledge), and the link "Read the Chad brief (in French)".
9. **Evidence label.** "In the brief's words", with "Page 2 of the brief".
10. **Country names.** The Hub's own names ("Democratic Republic of the
    Congo", "Palestine" for the West Bank brief, "Sudan" for the Al Jazirah
    brief). Alternative: the area named in the brief's title.
11. **Unreviewed surveys.** 15 of 19 surveys still await human review of
    flagged items. Flagged items are never exported; the rest of those surveys
    is. Alternative for production: reviewed surveys only
    (`export-public --reviewed-only`, four surveys today).
12. **Licence line.** "Findings and quotations are taken from DIEM country
    briefs, © FAO, available under CC BY 4.0."

## Verification

```powershell
npx vitest run src/lib/briefSpotlight.test.ts src/components/BriefSpotlight.test.tsx
npm run build
```
