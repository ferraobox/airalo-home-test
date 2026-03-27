import axios from 'axios'

/**
 * Extract the HTTP status code from an Axios error.
 * Returns `undefined` for network-level errors that never received a response.
 */
export function getAxiosStatus(err: unknown): number | undefined {
  if (axios.isAxiosError(err)) return err.response?.status
  return undefined
}

export interface RetryOptions {
  /** Max number of attempts (default 3) */
  attempts?: number
  /** Initial delay in ms between retries (default 2000) */
  delayMs?: number
  /** Whether to apply exponential backoff (default true) */
  backoff?: boolean
}

/**
 * Retry an async operation when it fails with a transient error (5xx or timeout).
 * Designed for live API integration tests where the upstream may be flaky.
 */
export async function retryOnTransient<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, delayMs = 2_000, backoff = true } = opts
  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isTransient(err) || i === attempts - 1) throw err
      const wait = backoff ? delayMs * 2 ** i : delayMs
      await sleep(wait)
    }
  }

  throw lastError
}

/** Returns true for 5xx status codes and network/timeout errors. */
export function isTransient(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  const status = err.response?.status
  if (status !== undefined && status >= 500) return true
  return (
    err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET'
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
