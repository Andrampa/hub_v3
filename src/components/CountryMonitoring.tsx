import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatDate } from '../lib/catalog'
import type { CountryMonitoringCoverage } from '../services/monitoring'
import { monitoringCountryPath } from '../services/monitoringEmbed'

interface CountryMonitoringProps {
  countryName: string
  coverage: CountryMonitoringCoverage
}

function publishedLabel(value?: number) {
  return value ? `Published ${formatDate(value)}` : 'Most recent round'
}

export function CountryMonitoring({ countryName, coverage }: CountryMonitoringProps) {
  const auth = useAuth()
  const { latest, rounds } = coverage
  const recentRounds = rounds.slice(0, 5).reverse()
  const capabilities = auth.user?.capabilities

  return (
    <section className="country-monitoring section-wrap" aria-labelledby="country-monitoring-heading">
      <article className="country-monitoring-card">
        <div className="country-monitoring-signal" aria-hidden="true">
          <span>DIEM</span>
          <div className="country-monitoring-pulse">
            {recentRounds.map((round, index) => (
              <i
                key={round.id}
                className={round.id === latest.id ? 'is-latest' : ''}
                style={{ '--pulse-index': index } as CSSProperties}
              />
            ))}
          </div>
          <small>Published survey series</small>
        </div>

        <div className="country-monitoring-copy">
          <span className="kicker">Household monitoring</span>
          <h2 id="country-monitoring-heading">Household monitoring system in {countryName}</h2>
          <p>
            Explore recent survey findings and follow how household conditions have changed
            across monitoring rounds.
          </p>
          <div className="country-monitoring-facts">
            <div><strong>{rounds.length}</strong><span>published {rounds.length === 1 ? 'round' : 'rounds'}</span></div>
            <div><strong>{latest.round}</strong><span>{publishedLabel(latest.publicationDate)}</span></div>
          </div>
        </div>

        <div className="country-monitoring-actions">
          <span>Latest survey</span>
          <Link className="country-monitoring-primary" to={monitoringCountryPath(coverage.iso3, latest.roundValue)}>
            Explore latest survey <span aria-hidden="true">→</span>
          </Link>
          {capabilities?.contributor && rounds.length > 1 && (
            <Link className="country-monitoring-secondary" to={monitoringCountryPath(coverage.iso3, latest.roundValue, 'trends')}>
              Trends analysis
            </Link>
          )}
          {capabilities?.contributor && (
            <Link className="country-monitoring-secondary" to={monitoringCountryPath(coverage.iso3, latest.roundValue, 'anomalies')}>
              Anomaly detection
            </Link>
          )}
          {capabilities?.aggregatedData && (
            <Link className="country-monitoring-secondary" to="/data#aggregated">
              Download aggregated data
            </Link>
          )}
          {capabilities?.householdData && (
            <Link className="country-monitoring-secondary" to="/data#microdata">
              Download household microdata
            </Link>
          )}
        </div>
      </article>
    </section>
  )
}
