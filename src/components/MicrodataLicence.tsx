import { Link } from 'react-router-dom'
import '../data-access.css'

/**
 * The full microdata licence.
 *
 * Aggregated data is CC BY 4.0; microdata is not, and its conditions must be
 * read wherever microdata download is offered (`docs/data_access_strategy.md`
 * section 8). One component, so the workspace and any later page cannot carry
 * two versions of the terms that drift apart.
 *
 * `access` changes only the framing, never the terms. It names the path the
 * account holds, because the two paths differ in what can truthfully be said:
 * a temporary grant followed a request, so its holder did accept these
 * conditions when asking; membership of the household-data group may never
 * have involved a request at all. It was once a single `householdData` flag,
 * which told a grant holder - whose flag is deliberately false - to go and
 * request the access they already had.
 */
export type MicrodataAccess = 'none' | 'temporaryGrant' | 'householdGroup' | 'temporaryGrantAndHouseholdGroup'

const FRAMING: Record<MicrodataAccess, { heading: string; lede: string }> = {
  none: {
    heading: 'Conditions of use',
    lede: 'Aggregated data is CC BY 4.0. Microdata is not. Submitting a request means agreeing to the conditions below, and they continue to apply for as long as you hold the data.',
  },
  temporaryGrant: {
    heading: 'Your microdata licence',
    lede: 'Your temporary access was granted on these conditions, which you accepted when you made your request. They apply to every dataset in your grant, and continue to apply for as long as you hold the data.',
  },
  householdGroup: {
    heading: 'Your microdata licence',
    lede: 'Your account holds household microdata access. These conditions apply to every collection you open, and continue to apply for as long as you hold the data.',
  },
  // Both paths at once. Neither single framing is true on its own: the grant
  // wording would leave the group collections uncovered, and the group wording
  // would drop the request the grant did follow.
  temporaryGrantAndHouseholdGroup: {
    heading: 'Your microdata licence',
    lede: 'Your account holds household microdata access and a temporary grant issued following your request. These conditions apply to every collection and grant dataset you open, and continue to apply for as long as you hold the data.',
  },
}

export function MicrodataLicence({ access }: { access: MicrodataAccess }) {
  const framing = FRAMING[access]
  return (
    <section className="microdata-licence" aria-labelledby="microdata-licence-heading">
      <div className="microdata-licence-head">
        <span className="kicker">Microdata licence</span>
        <h3 id="microdata-licence-heading">{framing.heading}</h3>
        <p>{framing.lede}</p>
      </div>
      <div className="microdata-licence-body">
        <div>
          <h4>Confidentiality</h4>
          <p>Users shall not take any action with the purpose of identifying any individual entity — person, household or enterprise — in the microdataset. If such a disclosure is made inadvertently, no use will be made of the information and it will be reported immediately to FAO.</p>
        </div>
        <div>
          <h4>Access conditions</h4>
          <p>Microdatasets disseminated by FAO are released for research and statistical purposes only. Users working for a commercial company will not be granted access, regardless of the stated purpose. Users requesting access must agree that:</p>
          <ul>
            <li>the microdataset will be used only for statistical or research purposes;</li>
            <li>any results derived from it will report aggregated information only, never specific individual entities or data subjects;</li>
            <li>no action will be taken with the purpose of identifying any individual entity in the microdataset;</li>
            <li>the microdataset will not be redisseminated, or shared with anyone other than the individuals granted access by FAO.</li>
          </ul>
          <p className="microdata-licence-aside">On that last point: if colleagues will work with the data, tell the DIEM Hub team so they can be granted access too.</p>
        </div>
      </div>
      {/* Whoever holds data is bound to cite it; only someone without access is
          offered the way to request it. */}
      {access !== 'none' ? (
        <div className="microdata-licence-body">
          <div>
            <h4>Citation</h4>
            <p>All products or publications that mention or include DIEM data must include the following citation:</p>
          </div>
          <div>
            <p className="microdata-licence-citation">Source of data: FAO. 2025. <em>Name of the country</em>: DIEM-Monitoring assessments results (<em>Month and Year</em>). In: FAO Data in Emergencies Hub. Rome. <em>Cited date</em>. https://data-in-emergencies.fao.org</p>
            <p>Finally, we would greatly appreciate it if you could inform the DIEM Hub team of the release of any product based on DIEM data.</p>
          </div>
        </div>
      ) : (
        <Link className="microdata-licence-cta" to="/data/microdata-request">
          I accept these conditions — open the request form
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </Link>
      )}
    </section>
  )
}
