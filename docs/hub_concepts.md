# DIEM Hub 3.0: principles, scope and operating model

This is the single, plain-language reference for how DIEM Hub 3.0 works, what
it deliberately does not do, and which parts editors, publishers and the
application each own. It also records how the proposed programme structure is
reflected in the current product. Status is current to 3 September
2026.

## Purpose, audience and design stance

DIEM Hub helps decision-makers, governments, partners, researchers,
practitioners and FAO staff find and use FAO Data in Emergencies evidence. It
is a public discovery and access layer over DIEM's ArcGIS Online content, not a
replacement content-management system, a data warehouse or a recreation of
specialist analytical applications.

The editorial voice is direct, evidence-led, humane and operational. FAO blue
and deep blue are institutional anchors; orange is restrained to urgency or
action. The interface should lead with user concepts and evidence rather than
ArcGIS implementation types, and retain accessible contrast, whitespace and
clear states at every screen size.

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

## Operating model and ownership

| Owner | Owns | Does not own |
|---|---|---|
| **ArcGIS publishers/editors** | Item metadata, resources, sharing, Hub-group membership, controlled group categories and editorial-source records. | A separate Hub catalogue or browser implementation. |
| **Hub editors** | Country copy/images, country highlights, eligible latest-evidence tags and approved promotion content. | Confidentiality: a publication flag does not make content public. |
| **Hub application** | Live retrieval, normalization, safe presentation, discovery controls, permission-aware protected requests and graceful failures. | Changing ArcGIS access rights or declaring inferred labels official. |
| **Specialist applications** | Analytical experiences such as the Monitoring Explorer, EVE and VISTA. | Being copied or maintained as parallel Hub functionality. |
| **Users** | Searching, filtering, opening authoritative resources and using authorized data tools. | Seeing protected metadata or resources merely by signing in. |

The Hub is a static React application with no custom backend or database. The
browser requests the public Portal REST API and retains returned data only in
memory. A transitional packaged-download generator supports some protected
formats, but is not a competing data store. Public requests remain anonymous;
OAuth uses authorization code with PKCE and no browser-held secret.

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

## Discovery rules, safety and limits

The application paginates ArcGIS searches beyond their 100-record page size,
then applies public search and filters to the loaded inventory. It keeps source
and freshness visible through publisher metadata and direct resource links.
Missing summaries/thumbnails receive useful fallbacks; an unavailable external
resource does not erase its ArcGIS source item.

Country discovery is intentionally stricter than the broad catalogue. It uses
the active Hub group, exact `Catalog role/Discoverable product`, the
`Countries` and `Product types` category branches, and
`Geographic scope/Multi-country` where applicable. It never falls back to the
retired country group or infers eligibility from an item's text.

Hazard-impact discovery uses the exact `Impact Assessment` tag within the Hub
group and controlled country, shock, role, scope, language and pillar facets.
Supporting services, web maps and images are excluded. Related resources stay
independent dossiers until publishers provide a stable assessment/event ID.

The protected explorer accepts only configured items, reads the permitted
feature-service schema and caps browser preview, CSV and GeoJSON exports at
20,000 matching records. Larger requests get transparent API/batching guidance
instead of silent truncation. API links never expose a token; ArcGIS remains
the item-by-item authorization decision.

The Hub expects data drift: counts, newest dates, thumbnails, links, titles,
tags and categories can change at any time. Group categories can be missing,
malformed or multiply assigned. The application explains these cases rather
than hiding the product or inventing a replacement classification.

## Deliberate product limits and roadmap

The delivered foundation is the shared public catalogue, country-first
discovery, multilingual product families, household-monitoring and flood
pathways, hazard-impact discovery, editorial country/promotion controls and a
permission-aware data workspace.

The Hub does not recreate existing dashboards/apps, manage ArcGIS sharing,
host a duplicate metadata store, infer access from tags, or promote provisional
title/tag matches to official taxonomy. Phase 1 also defers a DIEM-owned
large-export backend; any replacement needs an approved API, job queue/worker,
temporary object storage and expiring download URLs.

## Proposed programme structure: delivery status

| Proposal in the email | Status in Hub 3.0 |
|---|---|
| **Country entry point for all relevant evidence** | **Accomplished.** Country map/directory, profiles, categorized resources, chronological sorting, cross-country discovery, editorial introductions and featured items are available. Products not produced directly by DIEM can appear if editors add them to the Hub group and categorize them. |
| **Country emergency-agriculture-needs dashboard with AgHiN Phase 3+, “in need,” map and needs-group charts** | **Not yet implemented.** Country pages show published household-survey rounds and link to the Explorer; they do not reproduce the proposed four AgHiN widgets or extract brief highlights automatically. |
| **Links from country pages to household, flood and risk explorers** | **Accomplished.** Country pages deep-link to household survey exploration and data access. Countries in EVE's live ADM0 regular-monitoring catalog link directly to their EVE Overview, where flood monitoring and the embedded flood Exposure Model provide the risk-analysis pathway. |
| **Analytical products grouped by Context Monitoring, Hazard Impact Assessments, Research & Analysis and Seasonal Calendar** | **Accomplished.** Country product cards carry accessible pathway labels, icons and restrained color accents, with a shareable pathway filter for Regular monitoring, Hazard impact, Research & analysis and Seasonal calendar. Labels use controlled Hub categories rather than title/tag inference; product types remain a separate facet. |
| **Crises section for major, ongoing and multi-country crises** | **Partly accomplished.** Cross-country products and hazard/date filters are available, but there is no editor-curated standalone Crises page ranking named crises such as the Middle East, El Niño or Sahel floods. |
| **Upgraded DIEM Impact discovery by hazard and date, featuring recent products** | **Accomplished.** The Hazard Impact Assessments page provides latest items, country and shock filters, dossiers and a timeline. Related files remain separate until publishers provide a stable assessment/event identifier. |
| **Data explorer covering household, flood and risk** | **Accomplished.** Household monitoring-system data can be downloaded directly through the Hub's authorized data workspace. Flood-monitoring and Exposure Model risk data can be downloaded through EVE, with that access pathway described and linked from the Hub's Flood services page. |
| **Research and analysis organized by topic, activated as material grows** | **Not yet implemented as a section.** Research products can be found in the catalogue and cross-country discovery, while DIEM-Research is visibly marked as forthcoming. The proposed topic pages and research-initiative invitation are not yet present. |
| **About us, impact, video and newsletters** | **Accomplished.** The About DIEM menu groups the What is DIEM? overview, Photo galleries and Contact us. The overview explains DIEM's purpose and evidence cycle, presents introductory and user-story videos, and invites visitors to create a free DIEM community account to receive newsletter updates about assessments, datasets, initiatives and events. Impact is evidenced through the programme explanation, user stories and linked hazard-impact pathway. |
| **Photo galleries** | **Accomplished.** The About DIEM menu includes a native, responsive gallery page populated from the authoritative ArcGIS photo-gallery catalogue. Flickr remains the image host and destination; the initial five legacy StoryMaps and 21 further supplied Flickr albums are represented by 26 catalogue records, and StoryMap wrappers are no longer required for Hub discovery. |
| **One product accessible through geographic and thematic lenses** | **Accomplished.** Shared catalogue items can surface in several routes without being copied. |
| **External/partner products can be included** | **Accomplished by design.** Eligibility depends on Hub-group membership and editorial categorization, not authorship by the DIEM team. |
| **Two language versions should not appear as two products** | **Accomplished for reviewed families.** They render as one family with direct language links; unreviewed/untagged items remain independent. |
| **Introductory text for subsections and featured products** | **Partly accomplished.** Country introductions and per-highlight editorial text are editable, and major programme pages contain explanatory copy. Equivalent editor-managed introductions are not yet available for every possible crisis or research subsection. |

In short, Hub 3.0 has delivered the shared catalogue foundation, country-first
discovery, household monitoring, hazard-impact and flood pathways, controlled
data access, multilingual grouping and several practical editorial controls.
The largest remaining parts of the email's vision are the AgHiN country
dashboard, standalone crisis curation and the thematic DIEM-Research area.

## Practical test for a proposed change

Before accepting a feature, editorial workflow or data change, confirm: does
ArcGIS remain authoritative; is public visibility gated by Hub-group
membership; are protected resources authorized by ArcGIS per item; is each
classification explicit and publisher-controlled; does the item keep its stable
ID and authoritative destination; and does the experience remain useful when
remote metadata changes or fails? If any answer is no, redesign before release.
