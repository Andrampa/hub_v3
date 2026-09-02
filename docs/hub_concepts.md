# DIEM Hub 3.0: concepts, structure and editorial controls

This note summarizes the main ideas used to build DIEM Hub 3.0 and records how
the structure proposed in Josselin's email is reflected in the current product.
Status is current to 2 September 2026.

## Core principles

- **One authoritative catalogue.** ArcGIS Online remains the source of truth.
  The Hub reads current metadata, categories, sharing and resources rather than
  maintaining a second catalogue.
- **Visibility follows membership and permissions.** A public product must be
  in the DIEM Hub content group. Protected resources are shown only after
  sign-in and only when ArcGIS grants the user access.
- **Several paths can lead to one product.** The same item may be reached from
  the catalogue, a country page, a thematic service page or an editorial
  highlight. The Hub links to the authoritative item instead of duplicating it.
- **Stable IDs, mutable presentation.** Item IDs are stable references; titles,
  descriptions, tags, categories, images, dates and links may be updated in
  ArcGIS and are read live by the Hub.
- **Editorial classifications are explicit.** Publisher-managed group
  categories organize countries, product types, scope, languages and impact
  assessments. The interface does not present title/tag guesses as an official
  DIEM taxonomy.
- **Languages are grouped.** Reviewed language variants appear as one product
  family with separate language links, rather than as duplicate products.
- **Resilient public access.** Search, filters, sorting, pagination, shareable
  URLs, responsive layouts, accessible controls, and clear loading, empty and
  error states are built into the main discovery paths.

## How information is available

Public catalogue and country content is requested live from ArcGIS Online.
Cards retain source, date, geography, product type, summary and a link to the
publisher's resource where available. Household survey schedules and products,
hazard-impact assessments and flood assessments also use live services or
catalogue categories. External applications such as the Household Survey
Explorer, EVE and VISTA remain specialist applications reached through the Hub;
they are not rebuilt or copied.

The `/data` workspace is different: anonymous visitors see an explanation and
the sign-in route, but protected metadata and files are requested only after
ArcGIS community authentication. ArcGIS sharing then determines access item by
item. Available datasets can be filtered, mapped, previewed, exported within
documented limits, or accessed through token-free API examples.

## Main sections and functions

| Area | What users can do |
|---|---|
| **Home** | Understand DIEM, choose a programme pathway, search the complete catalogue, scan recent evidence and see an optional featured campaign. |
| **Products (`/catalog`)** | Search and filter the complete public collection by country, content/theme, year and other available facets; sort, paginate and open language variants. |
| **Countries** | Use a map or directory, open a country profile, read an editorial introduction and “In evidence” selection, see survey-round coverage, and filter the country's product library. Cross-country analysis has its own discovery entry. |
| **Household surveys** | Follow arrivals and releases, browse survey products, open a selected country/round/theme in the full-screen Explorer, and reach authorized data downloads. |
| **Hazard impacts** | Explore the Living Shock Atlas, latest assessments, filters, individual dossiers and a chronological evidence timeline. |
| **Flood services** | Follow the flood-evidence pathway, understand and open EVE capabilities, use VISTA resources, browse flood assessments and find the restricted field-evidence access route. |
| **Data access** | Sign in to inspect authorized microdata, aggregates, boundaries, guides and tools; preview, map, filter, download or use APIs according to access and size limits. |
| **Contact** | Use the DIEM contact form in the Hub or open it directly. |

## What editors can control

Normal editorial work happens in ArcGIS Online; code changes are not required
for the following tasks.

- **Catalogue item presentation:** edit the authoritative item's title,
  summary, dates, thumbnail, tags and resource link. Group membership controls
  whether it can appear publicly; group categories control its country,
  product-type and other discovery facets.
- **Country text and image:** in **DIEM Hub 3.0 — Country editorial source**,
  table **Country page content**, edit the introduction and public horizontal
  hero-image URL, then set **Publication status** to **Published**.
- **Country “In evidence”:** in the same source, table **Country featured
  items**, select an eligible catalogue resource by stable item ID. Editors can
  add an introductory sentence, editorial headline, reason for featuring, link
  label and display order. A highlighted item is rejected if it is not assigned
  to that country in the active Hub catalogue.
- **Homepage Latest evidence:** add the exact `Impact assessment` or `Country
  brief` tag to a public Hub item. The Hub automatically shows up to six of the
  most recently modified qualifying items.
- **Homepage featured popup:** editors can change its title, supporting text,
  image, destination and production/staging state in the current popup table.
  It appears only after meaningful dwell and scroll and remembers dismissal.
- **Programme pathways:** the current homepage cards and slides are reviewed
  application content. The planned ArcGIS promotion source supports copy,
  image, alternative text, CTA, destination, order, date window, staging and
  publication, but administrator provisioning/configuration is still required
  before editors can manage it there.

Editors should use `docs/editor_guide.md` for exact item links, field names,
preview steps and rollback instructions. Publishing flags control display, not
confidentiality; embargoed content must be protected through ArcGIS sharing.

## Josselin email: delivery status

| Proposal in the email | Status in Hub 3.0 |
|---|---|
| **Country entry point for all relevant evidence** | **Accomplished.** Country map/directory, profiles, categorized resources, chronological sorting, cross-country discovery, editorial introductions and featured items are available. Products not produced directly by DIEM can appear if editors add them to the Hub group and categorize them. |
| **Country emergency-agriculture-needs dashboard with AgHiN Phase 3+, “in need,” map and needs-group charts** | **Not yet implemented.** Country pages show published household-survey rounds and link to the Explorer; they do not reproduce the proposed four AgHiN widgets or extract brief highlights automatically. |
| **Links from country pages to household, flood and risk explorers** | **Partly accomplished.** Country pages deep-link to household survey exploration and data access. Flood services are available as a Hub section. A dedicated DIEM-Risk section and uniform country-level links to all explorers are still future work. |
| **Analytical products grouped by Context Monitoring, Hazard Impact Assessments, Research & Analysis and Seasonal Calendar** | **Partly accomplished.** Product-type categories and chronological discovery exist, and Hazard Impact Assessments has a dedicated page. The complete four-part country taxonomy has not been implemented as written. |
| **Crises section for major, ongoing and multi-country crises** | **Partly accomplished.** Cross-country products and hazard/date filters are available, but there is no editor-curated standalone Crises page ranking named crises such as the Middle East, El Niño or Sahel floods. |
| **Upgraded DIEM Impact discovery by hazard and date, featuring recent products** | **Accomplished.** The Hazard Impact Assessments page provides latest items, country and shock filters, dossiers and a timeline. Related files remain separate until publishers provide a stable assessment/event identifier. |
| **Data explorer covering household, flood and risk** | **Partly accomplished.** The Household Survey Explorer, protected dataset explorer and EVE/VISTA flood pathway are connected. DIEM-Risk is shown as a future area rather than a completed section. |
| **Research and analysis organized by topic, activated as material grows** | **Not yet implemented as a section.** Research products can be found in the catalogue and cross-country discovery, while DIEM-Research is visibly marked as forthcoming. The proposed topic pages and research-initiative invitation are not yet present. |
| **About us, impact, video, newsletters and methodology** | **Not yet implemented as a consolidated section.** DIEM purpose is introduced across current pages, methodology/guidance products can appear in discovery, and Contact exists, but there is no complete About area matching the email. |
| **One product accessible through geographic and thematic lenses** | **Accomplished.** Shared catalogue items can surface in several routes without being copied. |
| **External/partner products can be included** | **Accomplished by design.** Eligibility depends on Hub-group membership and editorial categorization, not authorship by the DIEM team. |
| **Two language versions should not appear as two products** | **Accomplished for reviewed families.** They render as one family with direct language links; unreviewed/untagged items remain independent. |
| **Introductory text for subsections and featured products** | **Partly accomplished.** Country introductions and per-highlight editorial text are editable, and major programme pages contain explanatory copy. Equivalent editor-managed introductions are not yet available for every possible crisis or research subsection. |

In short, Hub 3.0 has delivered the shared catalogue foundation, country-first
discovery, household monitoring, hazard-impact and flood pathways, controlled
data access, multilingual grouping and several practical editorial controls.
The largest remaining parts of the email's vision are the AgHiN country
dashboard, standalone crisis curation, the thematic DIEM-Research area,
DIEM-Risk, and a consolidated About section.
