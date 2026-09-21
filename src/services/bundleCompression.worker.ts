import { zipSync } from 'fflate'

/**
 * Compresses a survey package off the main thread.
 *
 * fflate's own asynchronous `zip` compresses every file under 160 000 bytes with
 * `deflateSync` on the calling thread, and a survey's CSVs are nearly all that
 * small, so it blocked the page and could not be cancelled once started. Here
 * the whole archive is built in a dedicated worker: the page stays responsive,
 * and cancelling terminates the worker outright rather than asking it to stop.
 */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Record<string, Uint8Array>>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}

scope.onmessage = (event) => {
  try {
    const archive = zipSync(event.data, { level: 6 })
    scope.postMessage({ archive }, [archive.buffer])
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : 'The package could not be compressed.' })
  }
}
