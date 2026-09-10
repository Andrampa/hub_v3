import { citationSegments, type CitationModel } from '../lib/citation'

/**
 * A citation as rendered text. The emphasised run - a publication's title, or
 * the Hub's name in a living product's citation - is a <cite>, which browsers
 * italicise, so the page shows the typography FAO asks for while the copied
 * text stays the same characters without it.
 */
export function CitationText({ model }: { model: CitationModel }) {
  return (
    <>
      {citationSegments(model).map((segment, index) => (
        segment.emphasis ? <cite key={index}>{segment.text}</cite> : <span key={index}>{segment.text}</span>
      ))}
    </>
  )
}
