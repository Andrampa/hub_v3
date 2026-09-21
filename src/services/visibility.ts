import type { FeatureLayerInfo } from './dataExplorer'

/**
 * The content-visibility rule.
 *
 * The rule is the one defined for the DIEM dashboard in register item 10 of
 * `hh_survey_v3/docs/deferred_infrastructure_changes.md`:
 *
 * - A **Contributor** - a member of the Contributors group, which is
 *   `capabilities.contributor` here - sees every row, including data not yet
 *   validated for publication.
 * - Everyone else sees only rows with `opendata = 1`.
 *
 * It is NOT identical to the dashboard's current behaviour, in two deliberate
 * ways. Do not describe the two as in lockstep.
 *
 * 1. The dashboard's data filter is switched off today (`enforceOpendata: false`
 *    in its `config.js`) until validated real surveys carry `opendata = 1`, so it
 *    presently shows `opendata = 0` rows. The Hub enforces the rule now: a
 *    download is harder to take back than a chart.
 * 2. The dashboard fails open on a layer with no `opendata` field (it simply does
 *    not filter). The Hub fails CLOSED: with no flag, no row is marked released,
 *    so a non-Contributor sees nothing from that layer. Every generation's
 *    pipeline writes the field (V3 by construction; V1/V2 through the
 *    `*_opening_data_to_public*.py` scripts in `hh_survey`), so a layer without
 *    it is a configuration error to surface, not a case to paper over.
 *
 * Two levels, both skipped for Contributors:
 * - Survey level: a community member is offered only surveys whose register row
 *   is `round_validated = Yes` (`fetchValidatedSurveyKeys`, applied in
 *   `discoverAggregatedSurveys`).
 * - Feature level: within an offered survey, only rows with `opendata = 1`.
 *
 * SCOPE OF ENFORCEMENT. This governs what the Hub shows, counts and packages.
 * It is not a security boundary: a public feature service returns every row to
 * anyone who queries it directly. The real boundary is the agreed rebuild
 * topology - private mother tables shared with Contributors, public views
 * exposing only `opendata = 1` rows - which is set up in ArcGIS, not here.
 */

export const OPENDATA_PUBLIC_WHERE = 'opendata = 1'

/** The field as the layer actually names it, or undefined when it has none. */
export function opendataField(layer: Pick<FeatureLayerInfo, 'fields'> | undefined) {
  return layer?.fields?.find((field) => field.name.toLowerCase() === 'opendata')?.name
}

/**
 * A clause that matches nothing: what a non-Contributor gets from a layer that
 * carries no `opendata` flag. Exported so callers can say why a result is empty
 * instead of presenting it as a dataset with no rows.
 */
export const WITHHELD_WHERE = '1=0'

/**
 * The clause restricting a layer to publicly released rows for this viewer, or
 * undefined for a Contributor, who sees everything.
 *
 * Microdata fails closed: a layer with no `opendata` field yields
 * `WITHHELD_WHERE`. Aggregated data fails open (see below).
 */
export function visibilityClause(
  layer: Pick<FeatureLayerInfo, 'fields'> | undefined,
  contributor: boolean,
  kind?: string,
) {
  if (contributor) return undefined
  const field = opendataField(layer)
  if (field) return `${field} = 1`
  // Aggregated data fails open: which surveys a community member sees is decided
  // at survey level by the register's Validated flag (`fetchValidatedSurveyKeys`),
  // and withholding an unflagged aggregate table hid every published survey.
  return kind === 'aggregate' ? undefined : WITHHELD_WHERE
}

export function isWithheld(clause: string | undefined) {
  return clause === WITHHELD_WHERE
}

/**
 * Whether the row-level rule governs a resource at all: survey data only -
 * aggregated tables and household microdata, grant views included.
 *
 * The dataset explorer also opens administrative boundaries and public
 * catalogue datasets. They are not survey data, carry no `opendata` flag and
 * are public by nature.
 */
export function governedByVisibility(kind: string | undefined) {
  return kind === 'aggregate' || kind === 'microdata'
}

/** ANDs the visibility clause into a query's `where`, leaving it untouched when none applies. */
export function withVisibility(where: string, clause: string | undefined) {
  if (!clause) return where
  if (!where || where.trim() === '1=1') return clause
  return `(${where}) AND ${clause}`
}

/**
 * Distinguishes the two visibility scopes in cache keys, so a sign-in or
 * sign-out misses entries cached under the other scope instead of showing
 * numbers filtered for someone else.
 */
export function visibilityScope(contributor: boolean) {
  return contributor ? 'restricted' : 'public'
}
