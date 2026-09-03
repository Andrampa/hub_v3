import { buildEveCountryOverviewUrl } from '../services/eve'

interface CountryEveOverviewProps {
  countryName: string
  iso3: string
}

export function CountryEveOverview({ countryName, iso3 }: CountryEveOverviewProps) {
  const destination = buildEveCountryOverviewUrl(iso3)

  return (
    <section className="country-eve section-wrap" aria-labelledby="country-eve-heading">
      <article className="country-eve-card">
        <div className="country-eve-identity" aria-hidden="true">
          <strong>EVE</strong>
          <span>Regular monitoring active</span>
        </div>
        <div className="country-eve-copy">
          <span className="kicker">Flood monitoring</span>
          <h2 id="country-eve-heading">Explore conditions in {countryName}</h2>
          <p>Open the EVE overview for regular flood monitoring indicators and recent country conditions.</p>
        </div>
        <a
          className="country-eve-action"
          href={destination}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open the EVE overview for ${countryName} in a new tab`}
        >
          Open EVE overview <span aria-hidden="true">↗</span>
        </a>
      </article>
    </section>
  )
}
