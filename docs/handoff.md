# Handoff

## In Progress

The public catalog, country explorer, protected data workspace, internal dataset explorer, and OAuth with PKCE are implemented. End-to-end protected-data acceptance still requires human tests with one approved and one unapproved community account. The first required live check is `/data/499917f1518141209c2a6de55a79d991`: service metadata, map geometry, filters, CSV/GeoJSON downloads and token-free API links. Deployment selection and additional thematic group decisions remain open.

## Resume Checklist

1. Run `git status --short`.
2. Read `AGENTS.md` and `docs/context_index.md`.
3. Run `npm run build`.
4. For authentication work, read `docs/authentication.md` and inspect `src/services/auth.ts` first.
5. For country work, read `docs/country_explorer.md` and inspect `src/services/countries.ts` first.
6. For protected downloads, read `docs/data_access.md` and inspect `src/services/protectedData.ts` first.
