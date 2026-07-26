import { useEffect, useState } from 'react'
import type { HubCampaign, PromotionChannel } from '../services/hubPromotions'

const DWELL_TIME_MS = 4500
const STORAGE_PREFIX = 'diem-hub-promotion-dismissed'

function storageKey(campaign: HubCampaign, channel: PromotionChannel) {
  return `${STORAGE_PREFIX}:${channel}:${campaign.id}`
}

function wasDismissed(campaign: HubCampaign, channel: PromotionChannel) {
  try {
    const storedAt = Number(localStorage.getItem(storageKey(campaign, channel)))
    if (!Number.isFinite(storedAt)) return false
    const duration = campaign.dismissDays * 24 * 60 * 60 * 1000
    return duration > 0 && Date.now() - storedAt < duration
  } catch {
    return false
  }
}

function rememberDismissal(campaign: HubCampaign, channel: PromotionChannel) {
  try {
    localStorage.setItem(storageKey(campaign, channel), String(Date.now()))
  } catch {
    // Storage can be unavailable in private browsing; closing still works for this render.
  }
}

export function EditorialPopup({
  campaign,
  channel,
  triggerId = 'promotion-trigger',
}: {
  campaign?: HubCampaign
  channel: PromotionChannel
  triggerId?: string
}) {
  const [dwellComplete, setDwellComplete] = useState(false)
  const [scrollComplete, setScrollComplete] = useState(false)
  const [dismissed, setDismissed] = useState(() => campaign ? wasDismissed(campaign, channel) : true)

  useEffect(() => {
    setDismissed(campaign ? wasDismissed(campaign, channel) : true)
    setDwellComplete(false)
    setScrollComplete(false)
  }, [campaign, channel])

  useEffect(() => {
    if (!campaign || dismissed) return
    const timer = window.setTimeout(() => setDwellComplete(true), DWELL_TIME_MS)
    return () => window.clearTimeout(timer)
  }, [campaign, dismissed])

  useEffect(() => {
    if (!campaign || dismissed) return
    const trigger = document.getElementById(triggerId)
    if (!trigger) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setScrollComplete(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -55% 0px', threshold: 0.01 },
    )
    observer.observe(trigger)
    return () => observer.disconnect()
  }, [campaign, dismissed, triggerId])

  if (!campaign || dismissed || !dwellComplete || !scrollComplete) return null

  const external = /^https?:\/\//i.test(campaign.destination)
  const close = () => {
    rememberDismissal(campaign, channel)
    setDismissed(true)
  }

  return (
    <aside className="editorial-popup" aria-label="Featured DIEM update">
      <button type="button" className="editorial-popup-close" onClick={close} aria-label="Dismiss featured update">
        <span aria-hidden="true">×</span>
      </button>
      {campaign.imageUrl && (
        <div className="editorial-popup-image">
          <img src={campaign.imageUrl} alt="" />
        </div>
      )}
      <div className="editorial-popup-content">
        <span>Featured update</span>
        <h2>{campaign.title}</h2>
        <p>{campaign.description}</p>
        <a
          href={campaign.destination}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
        >
          {campaign.ctaLabel}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </aside>
  )
}
