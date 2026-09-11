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
  'afghanistan-f2f-smartphone-interview-2024': {
    text: 'Photo: ©FAO',
    href: 'https://www.flickr.com/photos/faoemergencies/53755244075/in/album-72177720317415994',
  },
  'afghanistan-household-visit-round-10-2025': {
    text: 'Photo: ©FAO',
    href: 'https://www.flickr.com/photos/faoemergencies/54500018762/in/album-72177720325914781',
  },
  'drc-field-mission-team-2025': {
    text: 'Photo: ©FAO',
    href: 'https://www.flickr.com/photos/faoemergencies/54773563750/in/album-72177720328904503',
  },
  'bangladesh-haor-flood-2024': {
    text: 'Photo: ©FAO',
    href: 'https://www.flickr.com/photos/faoemergencies/54236461672/in/album-72177720322869120',
  },
  'guatemala-maize-field-interview-2022': {
    text: 'Photo: ©FAO',
    href: 'https://www.flickr.com/photos/faoemergencies/52535263796/in/album-72177720304128573',
  },
  'syria-earthquake-impact-2023': {
    text: 'Photo: ©FAO',
    href: 'https://www.flickr.com/photos/faoemergencies/52845070578/in/album-72177720307762521',
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
