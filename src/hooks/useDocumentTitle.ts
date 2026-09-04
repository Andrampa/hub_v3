import { usePageMetadata } from './usePageMetadata'

/**
 * Sets the browser tab title for a route, and with it the canonical URL and the
 * social preview tags every route needs. Pages with a description or structured
 * data of their own call `usePageMetadata` directly.
 *
 * Pass `undefined` while a page is still resolving its subject, so a country
 * page does not flash the ISO code before the country name is known.
 */
export function useDocumentTitle(title: string | undefined) {
  usePageMetadata({ title })
}
