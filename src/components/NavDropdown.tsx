import { useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'

/**
 * The menus previously opened on `:hover`/`:focus-within` alone, with
 * `aria-haspopup` and no `aria-expanded`, so there was no open state to
 * announce and no way to close one from the keyboard: a screen reader was told
 * a menu existed but never that it had opened, and Escape did nothing.
 *
 * Open state now lives in React and drives both the class and `aria-expanded`.
 * The CSS hover rule is kept, so a mouse user sees no change in behaviour, but
 * the `:focus-within` rule had to go: it held the menu visibly open after
 * Escape, because Escape returns focus to the trigger, which sits inside it.
 * Focus alone therefore no longer opens a menu - the trigger is a button and
 * Enter or Space opens it, which is what this pattern expects anyway.
 */
export function NavDropdown({ label, active, align, children }: {
  label: string
  active: boolean
  align?: 'end'
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  /**
   * Focus moving to a link inside the menu must not close it, so the container
   * closes only when focus lands outside it entirely. `relatedTarget` is null
   * when focus leaves the document, which should also close.
   */
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (!next || !event.currentTarget.contains(next)) setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div
      className={`nav-dropdown${active ? ' active' : ''}${open ? ' is-open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        ref={buttonRef}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <span aria-hidden="true" />
      </button>
      <div className={`nav-dropdown-menu${align === 'end' ? ' nav-dropdown-menu--end' : ''}`} id={menuId}>
        {children}
      </div>
    </div>
  )
}
