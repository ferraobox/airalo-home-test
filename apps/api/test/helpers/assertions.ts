import { expect } from '@jest/globals'
import { getAxiosStatus, isTransient } from '../../src/lib/retry'

/**
 * Assert that a caught error carries one of the expected HTTP statuses.
 * Transient 5xx/timeout responses are logged and skipped instead of failing,
 * since the live Airalo sandbox can be flaky.
 *
 * Usage:
 *   const error = await someApiCall().catch((e) => e)
 *   expectClientError(error, [401, 422])
 */
export function expectClientError(err: unknown, expected: number | number[]): void {
  if (isTransient(err)) {
    const code = getAxiosStatus(err) ?? 'timeout'
    console.warn(`⚠ Skipping assertion — transient API error (${code})`)
    return
  }
  const status = getAxiosStatus(err)
  expect(status).toBeDefined()
  const allowed = Array.isArray(expected) ? expected : [expected]
  expect(allowed).toContain(status)
}
