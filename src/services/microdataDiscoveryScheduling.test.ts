import { expect, it, vi } from 'vitest'
const master = vi.fn()
const register = vi.fn()
vi.mock('./monitoring', () => ({ fetchValidatedSurveyKeys: register }))
vi.mock('./surveyAccess', async () => ({ ...await vi.importActual<typeof import('./surveyAccess')>('./surveyAccess'), discoverMicrodataMasterSurveys: master }))
const { discoverMicrodataAccess } = await import('./microdataSurveyAccess')
it('starts register and master discovery without waiting for grant discovery', async () => {
  let finishGrants!: (value: []) => void
  const grants = new Promise<[]>((resolve) => { finishGrants = resolve })
  register.mockResolvedValue(new Set())
  master.mockResolvedValue({ status: 'complete', surveys: [], sources: [], pendingSourceCount: 0, unavailableSourceCount: 0, warningSourceCount: 0, checkedAt: 0 })
  const run = discoverMicrodataAccess(vi.fn(), grants, { contributor: false, householdData: true, includeTestData: false })
  await vi.waitFor(() => expect(master).toHaveBeenCalledTimes(1))
  expect(register).toHaveBeenCalledTimes(1)
  finishGrants([])
  expect((await run).surveys).toEqual([])
})
