import { useEffect, useState } from 'react'

/**
 * Whether a CSS media query currently matches.
 *
 * Used where a layout difference is also a *structural* difference and CSS
 * alone would lie to assistive technology: the catalogue's mobile filter panel
 * is a disclosure with `aria-expanded` and a hidden panel, and the desktop bar
 * is six always-visible controls. Rendering both and hiding one with CSS would
 * leave a collapsed `aria-expanded="false"` control announcing a panel that is
 * permanently on screen, or six controls inside a panel that says it is closed.
 *
 * Everything that is only presentation stays in the stylesheet.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  ))

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = (event: MediaQueryListEvent) => setMatches(event.matches)
    // Re-read on subscribe: the width can have changed between the initial
    // state and this effect, and on a resize across the breakpoint the
    // structure has to follow immediately.
    setMatches(list.matches)
    list.addEventListener('change', update)
    // Some embedded webviews and device emulators resize the layout viewport
    // without dispatching the MediaQueryList change event, which would leave
    // the structure frozen at whatever the width was on mount.
    const reread = () => setMatches(window.matchMedia(query).matches)
    window.addEventListener('resize', reread)
    return () => {
      list.removeEventListener('change', update)
      window.removeEventListener('resize', reread)
    }
  }, [query])

  return matches
}
