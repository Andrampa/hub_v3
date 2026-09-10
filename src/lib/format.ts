/**
 * House style for figures the Hub prints, following FAO editorial practice:
 * dates as day, full month name and year ("12 June 2024"), and thousands
 * separated by a space rather than a comma ("12 500"). The space is a
 * non-breaking one so a figure never wraps across two lines.
 */
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDate(value: number | Date) {
  return DATE_FORMAT.format(value)
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 20 })

export function formatNumber(value: number) {
  return NUMBER_FORMAT.format(value).replace(/,/g, ' ')
}
