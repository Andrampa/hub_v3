# DIEM Hub 3.0

DIEM Hub 3.0 is a custom public interface for discovering evidence published by FAO's Data in Emergencies programme. ArcGIS Online remains the authoritative catalog and content platform.

## What It Does

- Reads the complete public DIEM content group from ArcGIS Online.
- Summarizes formats, country labels, update activity, and data services.
- Provides client-side search, theme/content/year filters, sorting, and pagination.
- Adds a country-first explorer with a world map, searchable directory, and 54 live country pages.
- Uses ArcGIS group categories for country and product organization, with shareable filter URLs.
- Links every result to its authoritative ArcGIS item or published resource.
- Supports ArcGIS PKCE sign-in and account creation for enabled DIEM community members.
- Provides a login-only data workspace for microdata, aggregated indicators, boundaries, guides and analysis tools.

Protected thematic sections and specialized data experiences are planned next. Existing ArcGIS apps and dashboards are listed, not recreated.

## Tech Stack

- React 19 and TypeScript
- Vite
- ArcGIS Online Portal REST API
- Plain CSS with a custom FAO/DIEM visual system

## Local Development

Requires Node.js 20 or later.

```powershell
npm install
npm run dev
```

Production verification:

```powershell
npm run build
```

## Documentation Index

Start with [docs/context_index.md](docs/context_index.md). Product scope is in [docs/project_spec.md](docs/project_spec.md), country behavior in [docs/country_explorer.md](docs/country_explorer.md), and protected downloads in [docs/data_access.md](docs/data_access.md).

## Licence

Original documentation and editorial content are intended to be available under CC BY 4.0. ArcGIS catalog resources retain their own licences and attribution. The source-code licence remains to be confirmed; no software licence is granted by this repository yet.
