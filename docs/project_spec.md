# Project Spec

## Product Purpose

DIEM Hub 3.0 improves access to FAO Data in Emergencies evidence while retaining ArcGIS Online as the content platform.

## Product Identity

- Name: DIEM Hub 3.0
- Language at launch: English
- Tone: direct, evidence-led, humane, operational
- Visual direction: FAO institutional blues, restrained emergency orange, strong accessibility and data clarity

## Target Users

Public decision-makers, governments, partners, researchers, donors, practitioners, and FAO staff seeking DIEM evidence.

## Current Scope

- Query the public ArcGIS group `ab8a43038b6347ac93507988f7e2a90b` live.
- Visual overview of catalog scale and formats.
- Search, filters, sorting, pagination, and links to authoritative resources.
- Responsive English interface.
- Country-first discovery over group `c27d3dbba52343c6addfd61edaaa3e86`.
- Searchable map and directory, country profiles, controlled product filters, and cross-country analysis.

## Next Confirmed Priority

ArcGIS community authentication is implemented using authorization-code flow with PKCE. Country discovery is public. The next content decision is which protected groups and thematic catalogs authenticated community members should see after sign-in.

## What The Product Does Not Do

- Recreate existing apps or dashboards.
- Manage feature visibility.
- Host a second copy of catalog metadata.
- Infer access rights from tags.
- Define final thematic taxonomy from provisional title/tag matching.

## Engineering Principles

- Prefer stable item/group IDs over fuzzy searches.
- Keep external access behind a typed service boundary.
- Build focused thematic paths later without fragmenting shared catalog behavior.
- Degrade clearly when metadata or remote resources are missing.

## Security / Privacy / Legal

Public requests remain anonymous. Login uses ArcGIS OAuth with PKCE and no browser-held secret, and accepts only enabled members of organization `D5aXW6TZFpeM2wke`. Original documentation/editorial content is intended as CC BY 4.0; source-code licensing is pending. Catalog items keep their own terms.
