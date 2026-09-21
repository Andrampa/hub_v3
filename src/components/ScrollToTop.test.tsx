// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScrollToTop from './ScrollToTop'

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root
const scrollTo = vi.fn()

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  scrollTo.mockReset()
  vi.stubGlobal('scrollTo', scrollTo)
  container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function renderAt(path: string) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}><ScrollToTop /></MemoryRouter>)
  })
}

describe('route scrolling', () => {
  it('scrolls ordinary navigation to the top', async () => {
    await renderAt('/data')

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  })

  it('scrolls to an anchor that already exists', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/data#microdata']}>
          <ScrollToTop />
          <section id="microdata" ref={(target) => {
            if (target) target.getBoundingClientRect = () => ({ top: 640 } as DOMRect)
          }} />
        </MemoryRouter>,
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'instant' })
  })

  it('waits for an anchor inside lazy route content', async () => {
    await renderAt('/data#microdata')
    expect(scrollTo).not.toHaveBeenCalled()

    const target = document.createElement('section')
    target.id = 'microdata'
    target.getBoundingClientRect = () => ({ top: 640 } as DOMRect)
    await act(async () => {
      container.append(target)
      await Promise.resolve()
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'instant' })
  })
})
