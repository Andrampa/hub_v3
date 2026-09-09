import type { HeroName } from './HeroImage'

/**
 * Photo credit overlaid on a full-bleed hero, kept next to the photograph it
 * belongs to rather than repeated at each call site: the same hero is used on
 * several pages and the attribution must not drift between them.
 */
const CREDITS: Partial<Record<HeroName, { text: string; href: string }>> = {
  'drc-ndjili-market-gardens-2025': {
    text: 'Photo: ©FAO/Cécile Barrière',
    href: 'https://www.flickr.com/photos/faoemergencies/54773463623/in/album-72177720328904503',
  },
  'drc-ndjili-field-team-2025': {
    text: 'Photo: ©FAO/Cécile Barrière',
    href: 'https://www.flickr.com/photos/faoemergencies/54773460703/in/album-72177720328904503',
  },
  'afghanistan-daikundi-survey-2023': {
    text: 'Photo: ©FAO',
    href: 'https://www.flickr.com/photos/faoemergencies/52829806979/in/album-72177720307634439',
  },
}

export function HeroCredit({ name }: { name: HeroName }) {
  const credit = CREDITS[name]
  if (!credit) return null
  return (
    <a className="hero-photo-credit" href={credit.href} target="_blank" rel="noreferrer">
      {credit.text}
    </a>
  )
}
