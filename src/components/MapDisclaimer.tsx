const DISCLAIMER = 'The designations employed and the presentation of material in this information product do not imply the expression of any opinion whatsoever on the part of FAO concerning the legal or development status of any country, territory, city or area or of its authorities, or concerning the delimitation of its frontiers or boundaries. The final boundary between the Republic of the Sudan and the Republic of South Sudan has not yet been determined. Final status of the Abyei area is not yet determined. The dotted line represents, approximately, the Line of Control in Jammu and Kashmir agreed upon by India and Pakistan. The final status of Jammu and Kashmir has not yet been agreed upon by the parties. A dispute exists between the Governments of Argentina and the United Kingdom of Great Britain and Northern Ireland concerning sovereignty over the Falkland Islands (Malvinas).'

/**
 * The FAO map disclaimer, with the UN long-form notes the UN basemap requires on
 * any map that can show Israel. Maps drawn from the bundled UN Geodata pass its
 * `source` for the credit line; the dataset map credits its ArcGIS basemap in
 * its own attribution instead. Taking the source as a prop keeps the world
 * geometry out of pages that only need the text.
 */
export function MapDisclaimer({ source }: { source?: { publisher: string; name: string; modified: string } }) {
  return (
    <>
      <p className="map-disclaimer">{DISCLAIMER}</p>
      {/* The UN Geodata terms require the United Nations to be credited as the source. */}
      {source && (
        <p className="map-disclaimer map-source">
          Boundaries: {source.publisher}, {source.name} ({source.modified}).
        </p>
      )}
    </>
  )
}
