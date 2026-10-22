import { useEffect, useRef, type ReactNode } from 'react'
import { FLOW_STEP_LABELS, type FlowStep } from '../lib/surveyFlow'

/**
 * One ordered step list for a guided flow.
 *
 * Finished steps are ordinary buttons, so going back is one click and needs no
 * special keyboard handling; the current step is marked `aria-current="step"`;
 * steps not yet reachable are plain text, not disabled controls nobody can
 * explain.
 */
export function FlowStepList({ id, steps, current, done, reachable, onSelect, labels = FLOW_STEP_LABELS }: {
  id: string
  steps: FlowStep[]
  current: FlowStep
  done: (step: FlowStep) => boolean
  reachable: (step: FlowStep) => boolean
  onSelect: (step: FlowStep) => void
  labels?: Record<FlowStep, string>
}) {
  return (
    <nav className="flow-steps" aria-label="Steps">
      <ol>
        {steps.map((step, index) => {
          const isCurrent = step === current
          const finished = !isCurrent && done(step)
          const label = <><span className="flow-step-number" aria-hidden="true">{finished ? '✓' : index + 1}</span><span>{labels[step]}</span></>
          return (
            <li key={step} className={isCurrent ? 'is-current' : finished ? 'is-done' : undefined}>
              {isCurrent
                ? <span id={`${id}-current`} aria-current="step">{label}</span>
                : reachable(step)
                  ? <button type="button" onClick={() => onSelect(step)}>{label}{finished && <span className="sr-only"> (done)</span>}</button>
                  : <span className="flow-step-locked">{label}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * A step's panel. Every step stays mounted and only the current one is shown,
 * so a selection, a finished check or a prepared download survives moving
 * between steps.
 */
export function FlowStepPanel({ id, step, current, title, children }: {
  id: string
  step: FlowStep
  current: FlowStep
  title: ReactNode
  children: ReactNode
}) {
  return (
    <section className="workspace-step flow-step" id={`${id}-${step}`} aria-labelledby={`${id}-${step}-heading`} hidden={step !== current}>
      <h2 id={`${id}-${step}-heading`} tabIndex={-1}>{title}</h2>
      {children}
    </section>
  )
}

/**
 * Moves focus to the new step's heading after a step change, including one
 * made with the browser's Back button; never on first render, where it would
 * pull focus away from the page's own start.
 */
export function useStepHeadingFocus(id: string, current: FlowStep) {
  const previous = useRef<FlowStep | undefined>(undefined)
  useEffect(() => {
    if (previous.current !== undefined && previous.current !== current) {
      const heading = document.getElementById(`${id}-${current}-heading`)
      // The step list is scrolled into view rather than the heading, so the
      // person still sees where they are in the flow.
      const steps = heading?.closest('.workspace-panel, .microdata-flow')?.querySelector('.flow-steps')
      heading?.focus({ preventScroll: true })
      ;(steps || heading)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    }
    previous.current = current
  }, [current, id])
}

export function FlowActions({ id, onBack, backLabel = 'Back', onNext, nextLabel = 'Next', nextDisabled, hint }: {
  id: string
  onBack?: () => void
  backLabel?: string
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  hint?: string
}) {
  return (
    <div className="flow-actions">
      {onBack && <button type="button" className="flow-back" onClick={onBack}>{backLabel}</button>}
      {onNext && (
        <button type="button" className="flow-next" onClick={onNext} disabled={nextDisabled} aria-describedby={hint ? `${id}-hint` : undefined}>
          {nextLabel}
        </button>
      )}
      {hint && <p id={`${id}-hint`} className="flow-hint">{hint}</p>}
    </div>
  )
}
