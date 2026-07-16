# Context Index

## Documentation Map

| Document | Use it for |
|---|---|
| `README.md` | Human-facing overview and commands |
| `AGENTS.md` | Repository-wide agent rules |
| `docs/project_spec.md` | Confirmed product scope and non-goals |
| `docs/architecture.md` | Runtime flow and code boundaries |
| `docs/services_and_data.md` | ArcGIS behavior and metadata interpretation |
| `docs/service_manifest.md` | Endpoint inventory |
| `docs/authentication.md` | OAuth, community validation, sessions, and redirect safety |
| `docs/country_explorer.md` | Country routes, ArcGIS category contract, normalization, and map behavior |
| `docs/data_access.md` | Protected data route, resource manifest, permissions, and download behavior |
| `docs/user_journeys.md` | Public discovery behavior |
| `docs/development_workflow.md` | Commands and verification |
| `docs/handoff.md` | Active unfinished work |
| `docs/changelog.md` | Durable change history |

## Task Routing

- Catalog request/filter change: `architecture.md`, then `services_and_data.md`.
- Country page or category change: `country_explorer.md`, then `services_and_data.md`.
- Microdata, aggregated downloads, guides, or protected items: `data_access.md`, then `authentication.md`.
- ArcGIS endpoint work: `services_and_data.md`, then `service_manifest.md`.
- Authentication or protected access: `authentication.md`, then `services_and_data.md`.
- UI, copy, or navigation work: `project_spec.md`, then `user_journeys.md`.
- Setup, scripts, or verification: `development_workflow.md`.
- Resume work: `handoff.md`, then the file named there.

## Minimal Startup Sets

- Small UI fix: `AGENTS.md` plus target component and stylesheet.
- Data bug: `AGENTS.md`, `services_and_data.md`, and target service/helper.
- New product area: `AGENTS.md`, `project_spec.md`, `architecture.md`, and `user_journeys.md`.

## Token Discipline

Read targeted source sections first. Do not load every document or all 1,096 remote records into agent context unless the task needs them.

## Router Maintenance

Update this index when a durable document or major implementation area is added, renamed, or removed.
