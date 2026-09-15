/**
 * Recent releases for the Living Shock Atlas symbol layer.
 *
 * "Released" reads `created`, the date the product entered the catalogue, not
 * `modified`: the August 2026 category migration rewrote `modified` across the
 * group (see itemYear in catalog.ts).
 */
export const RELEASE_WINDOW_MONTHS = 6
/** Below this many products in the window, show the latest N instead. */
export const RELEASE_MINIMUM = 5

export interface ReleaseCandidate {
  created: number
}

export interface RecentReleaseSelection<T> {
  items: T[]
  /** True when the window held too few products and the latest N are shown. */
  fallback: boolean
  since: number
}

export function releaseWindowStart(now: number, months = RELEASE_WINDOW_MONTHS) {
  const start = new Date(now)
  start.setUTCMonth(start.getUTCMonth() - months)
  return start.getTime()
}

export function recentReleases<T extends ReleaseCandidate>(
  items: T[],
  now = Date.now(),
  months = RELEASE_WINDOW_MONTHS,
  minimum = RELEASE_MINIMUM,
): RecentReleaseSelection<T> {
  const since = releaseWindowStart(now, months)
  const sorted = items
    .filter((item) => Number.isFinite(item.created) && item.created <= now)
    .sort((a, b) => b.created - a.created)
  const inWindow = sorted.filter((item) => item.created >= since)
  if (inWindow.length >= minimum) return { items: inWindow, fallback: false, since }
  return { items: sorted.slice(0, minimum), fallback: sorted.length > inWindow.length, since }
}
