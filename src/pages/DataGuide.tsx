import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '../data-access.css'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { ARCHIVE_GENERATIONS, GENERATIONS, REFERENCE_GENERATION, REFERENCE_RESOURCES } from '../services/protectedData'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { CitationText } from '../components/CitationText'
import { CITATION_LANGUAGES, citationText, collectionCitationModel, type CitationLanguage } from '../lib/citation'

/**
 * The Hub's own catalogue, filtered to questionnaires. This replaces a tag
 * search on the previous site, whose `/search` route the Hub does not serve.
 */
const QUESTIONNAIRES_PATH = '/catalog?product=Questionnaires'
const FAM_URL = 'https://microdata.fao.org/index.php/catalog/Emergencies-Monitoring-Surveys/?page=1&sort_by=popularity&sort_order=desc&ps=15&repo=Emergencies-Monitoring-Surveys'
const FAM_POLICY_URL = 'https://www.fao.org/food-agriculture-microdata/en/'

const SECTIONS = [
  { id: 'about', title: 'What DIEM is' },
  { id: 'generations', title: 'Three data generations' },
  { id: 'accessibility', title: 'Who can access what' },
  { id: 'aggregated', title: 'Aggregated data' },
  { id: 'microdata', title: 'Microdata' },
  { id: 'documentation', title: 'Documentation and metadata' },
  { id: 'boundaries', title: 'Administrative boundaries' },
  { id: 'methodology', title: 'Methodology notes' },
  { id: 'api', title: 'Data API' },
  { id: 'citation', title: 'How to cite' },
  { id: 'licensing', title: 'Licensing' },
]

export default function DataGuide() {
  usePageMetadata({
    title: 'Data access guide',
    description: 'How to find, download, interpret and cite DIEM monitoring data: what is published, which questionnaire generation produced it, how access is granted, and the required citation. Public guide; the data itself needs a DIEM community account.',
  })
  const [activeSection, setActiveSection] = useState('about')
  const [citationLanguage, setCitationLanguage] = useState<CitationLanguage>('English')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const citationModel = collectionCitationModel(citationLanguage)

  async function copyCitation() {
    try {
      await navigator.clipboard.writeText(citationText(citationModel))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiveSection(visible.target.id)
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    )
    SECTIONS.forEach((section) => {
      const node = document.getElementById(section.id)
      if (node) observer.observe(node)
    })
    return () => observer.disconnect()
  }, [])

  const reference = GENERATIONS[REFERENCE_GENERATION]

  return (
    <>
      <SiteHeader />
      <main id="top" className="guide-page">
        <section className="guide-hero">
          <div className="section-wrap">
            <span className="eyebrow"><span/> Data access guide</span>
            <h1>Finding, downloading and citing DIEM data</h1>
            <p>Everything needed to explore, download and interpret DIEM monitoring data: what is published, which questionnaire generation produced it, how access is granted, and how to reference it correctly. This guide is public; the data itself requires a DIEM community account.</p>
            <div className="guide-hero-actions">
              <Link to="/data/surveys">See surveys available for download</Link>
              <a href={FAM_URL} target="_blank" rel="noreferrer">Browse microdata in FAM</a>
            </div>
          </div>
        </section>

        <div className="guide-layout-shell section-wrap">
          <nav className="guide-toc" aria-label="Guide contents">
            <span>Contents</span>
            <ol>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a className={activeSection === section.id ? 'active' : ''} href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="guide-body">
            <section id="about">
              <h2>What DIEM is</h2>
              <p>FAO established Data in Emergencies (DIEM) in 2020 to understand how shocks affect agricultural livelihoods in food-crisis contexts. At its centre is the DIEM-Monitoring System, which runs regular, standardized household surveys in the most food-insecure countries. Surveys have been completed in over 30 countries, reaching roughly 150 000 households per year.</p>
              <p>Data are collected at household level through computer-assisted telephone interviews or face-to-face surveys. Semi-automatic cleaning, aggregation, analysis and validation keep the results timely enough to inform decisions. DIEM-Monitoring data is open, accessible and reusable, and DIEM is committed to supporting researchers and programme designers who work with it.</p>
            </section>

            <section id="generations">
              <h2>Three data generations</h2>
              <p>DIEM data is organized around three questionnaire generations. Each revision changed fields, definitions, codebooks and data structures, so every generation keeps its own documentation and archived rounds stay reproducible. Comparisons across generations may be limited or impossible for some variables and should be approached with caution.</p>
              <div className="guide-generation-list">
                <article className="guide-generation guide-generation--reference">
                  <div><span className="generation-badge">{reference.label}</span><strong>Current standard</strong></div>
                  <h3>{reference.name}</h3>
                  <p className="guide-generation-period">{reference.period}</p>
                  <p>{reference.summary}</p>
                </article>
                {ARCHIVE_GENERATIONS.map((id) => {
                  const generation = GENERATIONS[id]
                  return (
                    <article className="guide-generation" key={id}>
                      <div><span className="generation-badge generation-badge--muted">{generation.label}</span><strong>Archived</strong></div>
                      <h3>{generation.name}</h3>
                      <p className="guide-generation-period">{generation.period}</p>
                      <p>{generation.summary}</p>
                      <p className="guide-generation-caution">{generation.comparability}</p>
                    </article>
                  )
                })}
              </div>
              <p>You do not need to choose a generation. <Link to="/data/surveys">Your surveys</Link> lists surveys by country and round and works out which generation holds each one. Every package links the relevant generation's field descriptions and metadata, reference boundaries and source services, so archived rounds stay reproducible and one generation's codebook is never applied to another's data.</p>
            </section>

            <section id="accessibility">
              <h2>Who can access what</h2>
              <p>There are three levels of access, and signing in is not the same thing as being authorized. Signing in opens the workspace; what you can download is decided by the permissions attached to your account.</p>
              <ol className="guide-steps">
                <li><strong>Without an account.</strong> This guide, and a description of everything DIEM publishes and how to obtain it.</li>
                <li><strong>With a DIEM community account.</strong> Aggregated survey data at the lowest administrative level each survey supports, administrative reference boundaries, all technical documentation, the data API, and the microdata request form.</li>
                <li><strong>With approved microdata access.</strong> Anonymized household-level records for the surveys covered by your approval, valid for a week and renewable.</li>
              </ol>
              <p>Accounts are free and can be created from the sign-in prompt on <Link to="/data/surveys">Your surveys</Link>. Privileges are assigned by an automated procedure: allow up to 15 minutes from account creation before full access activates. If the workspace reports no aggregated surveys immediately after you register, that is the provisioning window rather than a problem with your account.</p>
            </section>

            <section id="aggregated">
              <h2>Aggregated data</h2>
              <p>All DIEM users with an account can download survey data aggregated at the lowest administrative level each survey supports — administrative level 1 or 2, depending on the sample design of that specific survey. Aggregated datasets become available roughly three weeks after data collection ends.</p>
              <p>Data is organized by thematic area. In the current generation those are income and shocks, crop production, livestock and fisheries, food security and needs, and a set of optional indicators asked only in selected surveys. Earlier generations grouped the same material into four thematic datasets.</p>
              <h3>Downloading</h3>
              <ol className="guide-steps">
                <li>Sign in and open <Link to="/data/surveys">Your surveys</Link>.</li>
                <li>Choose the surveys you need, by country and round. A standard account can put up to ten surveys in one package. Contributor accounts are not limited by survey count; their packages are bounded instead by larger limits on records, data files and survey-theme combinations, which the review step checks before anything is downloaded.</li>
                <li>Choose all available themes, or pick specific ones. Each theme says how many of your surveys carry it.</li>
                <li>Review the package. Count the records first: the review names every file, the record total and any survey and theme combination that will be missing, and why.</li>
                <li>Download. Choose separate survey folders or, for multiple surveys, combine compatible surveys into one CSV per theme and questionnaire generation. The zip includes documentation, a README and a manifest recording the source queries and each survey's contribution.</li>
              </ol>
              <p>Each dataset can still be opened on its own, with a map, filters and further formats, from <em>Technical resources and source datasets</em> at the foot of the workspace. That is also the route for extractions beyond the 20 000 records a browser download can build, through the generated Python and R scripts.</p>
              <p>Before analysing, read the field descriptions and the questionnaire for the generation you are working in. Several fields are only interpretable alongside them.</p>
            </section>

            <section id="microdata">
              <h2>Microdata</h2>
              <p>Household-level DIEM data is fully anonymized: personal information is removed and a number of fields are withheld to reduce the risk of identifying individuals and groups. There are two routes to it.</p>
              <h3>1. The FAO Microdata Catalogue (FAM)</h3>
              <p>FAM is the default route and the one-stop catalogue for FAO farm and household survey microdata, covering agriculture, forests, food security and nutrition. It holds datasets collected directly by FAO and datasets whose collection FAO supported. Anonymized DIEM microdata is published there within about six months of the aggregated data being released on this Hub. That window is used for final editing, polishing and additional disclosure control before permanent open release.</p>
              <p><a href={FAM_URL} target="_blank" rel="noreferrer">Browse DIEM collections in FAM</a></p>
              <h3>2. Direct access by request</h3>
              <p>If your research or operational work needs household-level data from a survey that has not reached FAM yet, submit a request after creating a DIEM account. Requests are evaluated within about two working days. Access is granted in justified cases, exclusively to users with institutional email addresses, and is valid for a week with the possibility of extension.</p>
              <p><Link to="/data/microdata-request">Open the microdata request form</Link></p>
              <h3>Coded values and labelling</h3>
              <p>Microdata is disseminated in coded form, in line with good practice for data protection, standardization and analytical consistency across countries and survey rounds. Coded values keep files small, keep processing harmonized, and limit the risk of misinterpretation or unintended disclosure. The codebook maps every code to its label.</p>
              <p>To make that easier, DIEM publishes Python and R tools that detect the questionnaire generation automatically and apply the official value labels, producing an analysis-ready dataset while preserving the original structure and file format. They are available in the <a href="https://github.com/Andrampa/diem-microdata-labelling" target="_blank" rel="noreferrer">public microdata labelling repository</a>.</p>
              <h3>Reading empty fields</h3>
              <p>The questionnaire has its own internal logic with skip patterns, and not every question is asked of every household. If a question was not asked, the corresponding field for that household is empty. An empty field therefore means the household was not eligible for that question — it is not a missing value to be imputed.</p>
            </section>

            <section id="documentation">
              <h2>Documentation and metadata</h2>
              <p><strong>{reference.label} documentation is still being produced.</strong> The field descriptions, codebook and detailed metadata are written alongside the questionnaire itself and are published with the first {reference.label} survey. Older-generation documentation describes a different field set and different codes, so use it for orientation only, never to interpret {reference.label} values.</p>
              <p>Each generation carries its own documentation set. Every downloaded package links the set for its surveys' generation, and the full list is under technical resources in the workspace:</p>
              <ul className="guide-list">
                <li><strong>Field descriptions</strong> explaining the content of every field, for microdata and for aggregated data.</li>
                <li><strong>Codebooks</strong> mapping coded values to labels.</li>
                <li><strong>Detailed metadata</strong> following the SDMX metadata framework for the aggregated thematic datasets.</li>
                <li><strong>Questionnaires</strong> — the template in Kobo and GeoPoll formats, plus the survey-specific versions used in each country and round. <Link to={QUESTIONNAIRES_PATH}>Browse the questionnaire catalogue</Link>.</li>
                <li><strong>Survey-specific methodologies</strong> describing sample design decisions for individual rounds.</li>
              </ul>
              <p>DIEM surveys use a common questionnaire within each generation, so data structures and domains stay consistent across countries and over time. That is what allows every survey in a generation to be combined into a single table from which specific country and round slices can be extracted.</p>
            </section>

            <section id="boundaries">
              <h2>Administrative boundaries</h2>
              <p>DIEM publishes operational administrative reference boundaries at levels 1 and 2. They are compiled from operational sources, primarily datasets distributed through the OCHA Humanitarian Data Exchange, and validated with FAO country offices. Because DIEM surveys are designed and implemented within individual countries, no cross-country harmonization is applied: the priority is boundary references that humanitarian actors accept and that are current for field implementation, even where these differ from officially endorsed national versions whose formal adoption takes longer.</p>
              <p>The current reference dataset is updated as operational configurations change. When a boundary changes at country level, the previous configuration for the affected units moves to the archived reference dataset, so historical survey data stays traceable to the boundaries in use at the time of collection. If a pcode cannot be found in the current dataset, look for it in the archive.</p>
              <p>Both layers open in the dataset explorer, where they can be filtered by country and downloaded:</p>
              <ul className="guide-list">
                {REFERENCE_RESOURCES.map((resource) => (
                  <li key={resource.id}><Link to={`/data/${resource.id}`}>{resource.fallbackTitle}</Link> &mdash; {resource.description}</li>
                ))}
              </ul>
              <p>They are also listed under &ldquo;Technical resources and source datasets&rdquo; at the foot of <Link to="/data/surveys">Your surveys</Link>.</p>
            </section>

            <section id="methodology">
              <h2>Methodology notes</h2>
              <p>The DIEM-Monitoring System is built on a template questionnaire developed through consultation with experts across food security, crop, livestock, and fisheries and aquaculture sectors. For each survey the template is adjusted for country and seasonal specifics — local currency, administrative division names, the current crop season, timing relative to the main harvest, and the main local crops and livestock.</p>
              <h3>Sampling and precision</h3>
              <p>The target population is typically agricultural producers of all kinds and farm labourers; in practice the entire rural population of countries with high food insecurity is targeted. Stratification usually occurs at administrative level 1, with a growing number of surveys representative at level 2. The system operates at a precision level of 8.5 percent with 95 percent confidence.</p>
              <h3>Weighting</h3>
              <p>Datasets are weighted so results represent the surveyed population. The weights combine administrative-level population distribution (<code>weight_base</code>), the proportion of agricultural households in a given administrative level (<code>weight_quota</code>), and baseline sociodemographic characteristics for post-stratification (<code>weight_wealth</code>). Administrative-level aggregation uses the combined <code>weight_final</code> field.</p>
              <h3>Thematic coverage</h3>
              <ul className="guide-list">
                <li><strong>Income and shocks</strong> — income change over the recall period for agricultural and non-agricultural sources, and the shocks most likely to affect a household's ability to produce food or generate income.</li>
                <li><strong>Crop production</strong> — constraints faced by crop producers, including input access and marketing, with production measured as relative change in area planted and harvested against a typical year.</li>
                <li><strong>Livestock production</strong> — constraints faced by livestock keepers, including feed, inputs, veterinary services and marketing, with production measured as relative change in herd or flock size year on year.</li>
                <li><strong>Food security outcomes</strong> — standard indicators including the Food Insecurity Experience Scale, household dietary diversity score and livelihood coping strategies index.</li>
                <li><strong>Need for assistance</strong> — short- and mid-term needs relating to agricultural livelihoods, and assistance received during the recall period.</li>
              </ul>
              <h3>Country-specific notes</h3>
              <p>In Yemen, a High Frequency Monitoring system runs alongside the standard surveys. These monthly rounds cover only food security outcomes and income and shocks, giving more timely detail on those variables. Separately, the household sub-sample engaged in aquatic production — fishing or aquaculture — is often too small for administrative aggregation to be meaningful.</p>
            </section>

            <section id="api">
              <h2>Data API</h2>
              <p>Application Programming Interfaces allow system-to-system integration, so DIEM data can move into your own workflows without manual downloads. Using the DIEM API you can access datasets programmatically for dynamic workflows, analysis and integration.</p>
              <p>A <a href="https://github.com/Andrampa/DIEM_API/tree/main" target="_blank" rel="noreferrer">public repository</a> provides a Jupyter Notebook demonstrating automated downloads, with installation instructions and step-by-step guidance you can adapt. A DIEM account is required, and each dataset still resolves against your own permissions. For larger extractions, the dataset explorer generates ready-made Python and R scripts that carry your current filter and read a short-lived token from your environment; tokens are never embedded in generated code.</p>
            </section>

            <section id="citation">
              <h2>How to cite</h2>
              <p>Any product or publication that mentions or includes DIEM data should carry the following citation, replacing the bracketed date with the date you accessed the data.</p>
              {/* All three languages live here now. They were on /data, which no
                  longer carries a citation section; dropping two of three would
                  have been a regression, not a simplification. */}
              <div className="guide-citation-card">
                <div className="guide-citation-head">
                  <div className="guide-citation-languages" role="group" aria-label="Citation language">
                    {CITATION_LANGUAGES.map((language) => (
                      <button
                        key={language}
                        type="button"
                        aria-pressed={language === citationLanguage}
                        onClick={() => { setCitationLanguage(language); setCopyState('idle') }}
                      >
                        {language}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="guide-citation-copy" onClick={() => void copyCitation()}>
                    {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy blocked — select and press Ctrl+C' : 'Copy citation'}
                  </button>
                </div>
                <p className="guide-citation" lang={citationLanguage === 'Français' ? 'fr' : citationLanguage === 'Español' ? 'es' : 'en'}>
                  <CitationText model={citationModel}/>
                </p>
                <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Citation copied to the clipboard.' : ''}</span>
              </div>
              <p>We would be glad to hear about any product based on DIEM data — please let the DIEM Hub team know when you publish.</p>
            </section>

            <section id="licensing">
              <h2>Licensing</h2>
              <h3>Aggregated data</h3>
              <p>DIEM aggregated data is made available under the <a href="https://creativecommons.org/licenses/by/4.0/legalcode.en" target="_blank" rel="noreferrer">Creative Commons Attribution 4.0 International licence (CC BY 4.0)</a>. By using this database you agree to be bound by the terms of that licence and the <a href="https://www.fao.org/contact-us/terms/db-terms-of-use/en" target="_blank" rel="noreferrer">FAO Statistical Database Terms of Use</a>.</p>
              <h3>Microdata</h3>
              <p>Microdata is not released under CC BY 4.0. It carries a separate and stricter set of conditions covering confidentiality and access.</p>
              <p><strong>Confidentiality.</strong> Users shall not take any action with the purpose of identifying any individual entity — person, household or enterprise — in the microdataset. If such a disclosure is made inadvertently, no use will be made of the information and it will be reported immediately to FAO.</p>
              <p><strong>Access conditions.</strong> Microdatasets disseminated by FAO are released for research and statistical purposes only. Users working for a commercial company will not be granted access, regardless of the stated purpose. Users requesting access must agree that:</p>
              <ul className="guide-list">
                <li>the microdataset will be used only for statistical or research purposes;</li>
                <li>any results derived from it will report aggregated information only, never specific individual entities or data subjects;</li>
                <li>no action will be taken with the purpose of identifying any individual entity in the microdataset;</li>
                <li>the microdataset will not be redisseminated, or shared with anyone other than the individuals granted access by FAO.</li>
              </ul>
              <p>On the final point: if colleagues will be working with the data, tell the DIEM Hub team so they can be granted access as well. Further information on FAO microdata dissemination is available on the <a href={FAM_POLICY_URL} target="_blank" rel="noreferrer">FAO microdata pages</a>.</p>
            </section>

            <section className="guide-help">
              <h2>Still stuck?</h2>
              <p>For questions or support relating to DIEM data access and use, <Link to="/contact">contact the DIEM Hub team</Link>.</p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
