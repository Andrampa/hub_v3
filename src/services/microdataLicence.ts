/** One source for the conditions displayed in the workspace and shipped with every archive. */
export const MICRODATA_LICENCE_TERMS = {
  confidentiality: 'Users shall not take any action with the purpose of identifying any individual entity — person, household or enterprise — in the microdataset. If such a disclosure is made inadvertently, no use will be made of the information and it will be reported immediately to FAO.',
  purpose: 'Microdatasets disseminated by FAO are released for research and statistical purposes only. Users working for a commercial company will not be granted access, regardless of the stated purpose. Users requesting access must agree that:',
  conditions: [
    'the microdataset will be used only for statistical or research purposes;',
    'any results derived from it will report aggregated information only, never specific individual entities or data subjects;',
    'no action will be taken with the purpose of identifying any individual entity in the microdataset;',
    'the microdataset will not be redisseminated, or shared with anyone other than the individuals granted access by FAO.',
  ],
  colleagues: 'On that last point: if colleagues will work with the data, tell the DIEM Hub team so they can be granted access too.',
  citationIntro: 'All products or publications that mention or include DIEM data must include the following citation:',
  citation: 'Source of data: FAO. 2025. Name of the country: DIEM-Monitoring assessments results (Month and Year). In: FAO Data in Emergencies Hub. Rome. Cited date. https://data-in-emergencies.fao.org',
  releaseNotice: 'Finally, we would greatly appreciate it if you could inform the DIEM Hub team of the release of any product based on DIEM data.',
} as const

export function microdataLicenceText() {
  const terms = MICRODATA_LICENCE_TERMS
  return [
    'DIEM household microdata — conditions of use',
    '', 'Confidentiality', terms.confidentiality,
    '', 'Access conditions', terms.purpose,
    ...terms.conditions.map((condition) => `- ${condition}`),
    terms.colleagues,
    '', 'Citation', terms.citationIntro, terms.citation, terms.releaseNotice,
    '', 'This microdata is NOT licensed under the aggregated-data CC BY 4.0 terms.',
    '',
  ].join('\n')
}
