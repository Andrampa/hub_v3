import { useState, type MouseEvent, type ReactNode } from 'react'
import { downloadPublicItem, itemPortalPage, publicItemDataUrl, usesAnonymousDownload } from '../services/arcgis'
import type { ArcGISItem } from '../types'

type Props = {
  item: Pick<ArcGISItem, 'id' | 'title' | 'type' | 'access' | 'url'> & { name?: string }
  className?: string
  children: ReactNode
}

/**
 * A file download that never depends on the viewer's ArcGIS session. Public
 * items are fetched without cookies on every click, including middle and
 * modified clicks; other items keep a plain link to the ArcGIS item page.
 */
export function AnonymousDownloadLink({ item, className, children }: Props) {
  const [busy, setBusy] = useState(false)
  if (!usesAnonymousDownload(item)) {
    return <a className={className} href={itemPortalPage(item.id)} target="_blank" rel="noreferrer">{children}</a>
  }
  const start = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button > 1) return
    event.preventDefault()
    if (busy) return
    setBusy(true)
    void downloadPublicItem(item).finally(() => setBusy(false))
  }
  return (
    <a
      className={className}
      href={publicItemDataUrl(item.id)}
      rel="noreferrer"
      referrerPolicy="no-referrer"
      aria-busy={busy || undefined}
      onClick={start}
      onAuxClick={start}
    >
      {children}
    </a>
  )
}
