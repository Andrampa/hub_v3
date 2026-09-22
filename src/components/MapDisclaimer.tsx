import { WORLD_GEOMETRY_SOURCE } from '../lib/unGeometry'

const DISCLAIMER = 'The designations employed and the presentation of material in this information product do not imply the expression of any opinion whatsoever on the part of FAO concerning the legal or development status of any country, territory, city or area or of its authorities, or concerning the delimitation of its frontiers or boundaries. The final boundary between the Republic of the Sudan and the Republic of South Sudan has not yet been determined. Final status of the Abyei area is not yet determined. The dotted line represents, approximately, the Line of Control in Jammu and Kashmir agreed upon by India and Pakistan. The final status of Jammu and Kashmir has not yet been agreed upon by the parties.'

export function MapDisclaimer() {
  return (
    <>
      <p className="map-disclaimer">{DISCLAIMER}</p>
      {/* The UN Geodata terms require the United Nations to be credited as the source. */}
      <p className="map-disclaimer map-source">
        Boundaries: {WORLD_GEOMETRY_SOURCE.publisher}, {WORLD_GEOMETRY_SOURCE.name} ({WORLD_GEOMETRY_SOURCE.modified}).
      </p>
    </>
  )
}
