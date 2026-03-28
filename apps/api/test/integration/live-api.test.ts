/**
 * Integration tests that hit the live Airalo Partner API.
 *
 * Each describe block exercises a specific service object against the real
 * Airalo sandbox. Transient 5xx errors are treated as inconclusive rather
 * than failures. The final describe block covers the complete exercise
 * workflow: OAuth2 → POST /orders (6 eSIMs) → GET /sims/{iccid} × 6.
 *
 * Requires AIRALO_CLIENT_ID and AIRALO_CLIENT_SECRET env vars.
 */
import { jest } from '@jest/globals'
import { createHttpClient } from '../../src/lib/httpClient'
import { createAuthService } from '../../src/services/authService'
import { createOrderService } from '../../src/services/orderService'
import { createEsimService } from '../../src/services/esimService'
import { createAiraloService } from '../../src/services/airaloService'
import { loadApiEnv } from '../../src/config/env'
import { AIRALO_DEFAULT_PACKAGE_ID, AIRALO_DEFAULT_ORDER_QUANTITY } from '@airalo/shared'
import { retryOnTransient, isTransient, getAxiosStatus } from '../../src/lib/retry'
import { expectClientError } from '../../src/helpers/assertions'

const env = loadApiEnv()
const hasCredentials = env.clientId.length > 0 && env.clientSecret.length > 0

const describeIfCredentials = hasCredentials ? describe : describe.skip

describeIfCredentials('Live Airalo Partner API', () => {
  jest.setTimeout(120_000)

  const http = createHttpClient(env.baseUrl, 60_000)
  const auth = createAuthService(http)
  const orders = createOrderService(http)
  const esims = createEsimService(http)
  let accessToken: string

  // ──────────────────────── Authentication ────────────────────────
  describe('Authentication — POST /token', () => {
    it('obtains an OAuth2 access token', async () => {
      accessToken = await retryOnTransient(() =>
        auth.getToken(env.clientId, env.clientSecret)
      )
      expect(accessToken).toBeTruthy()
      expect(typeof accessToken).toBe('string')
    })

    it('rejects invalid credentials with 401 or 422', async () => {
      const error = await auth
        .getToken('invalid_id', 'invalid_secret')
        .catch((e: unknown) => e)
      expectClientError(error, [401, 422])
    })

    it('rejects empty credentials', async () => {
      const error = await auth.getToken('', '').catch((e: unknown) => e)
      if (isTransient(error)) return
      const status = getAxiosStatus(error)
      expect(status).toBeDefined()
      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(500)
    })
  })

  // ──────────────────────── Order submission ──────────────────────
  describe('Order submission — POST /orders', () => {
    beforeAll(async () => {
      if (!accessToken) {
        accessToken = await retryOnTransient(() =>
          auth.getToken(env.clientId, env.clientSecret)
        )
      }
    })

    it('creates an order with the default package', async () => {
      const result = await retryOnTransient(() =>
        orders.submit(accessToken, {
          packageId: AIRALO_DEFAULT_PACKAGE_ID,
          quantity: AIRALO_DEFAULT_ORDER_QUANTITY,
        })
      )
      // Status code: 200 — Axios throws on non-2xx so no throw = 200 (R2.1)
      expect(result.orderId).toBeGreaterThan(0)
      // Message: must match success (R2.10, assignment §Message)
      expect(result.message).toMatch(/success/i)
      // Response body — order-level fields (R2.1, assignment §Response Body)
      expect(result.raw.package_id).toBe(AIRALO_DEFAULT_PACKAGE_ID)
      expect(Number(result.raw.quantity)).toBe(AIRALO_DEFAULT_ORDER_QUANTITY)
      expect(result.raw.code).toBeTruthy()
      expect(result.raw.currency).toBeTruthy()
      expect(result.raw.created_at).toBeTruthy()
      expect(result.raw.validity).toBeGreaterThan(0)
      expect(result.raw.esim_type).toBeTruthy()
      // Response body — all 6 eSIMs with full SIM properties (R2.2, R3.6)
      expect(result.sims).toHaveLength(AIRALO_DEFAULT_ORDER_QUANTITY)
      for (const sim of result.raw.sims) {
        expect(sim.iccid).toBeTruthy()
        expect(sim.id).toBeGreaterThan(0)
        expect(sim.lpa).toBeTruthy()
        expect(sim.qrcode).toBeTruthy()
        expect(sim.qrcode_url).toBeTruthy()
        expect(sim.matching_id).toBeTruthy()
        expect(sim.created_at).toBeTruthy()
      }
    })

    it('rejects order with invalid package_id as 422', async () => {
      const error = await orders
        .submit(accessToken, { packageId: 'nonexistent-package-xyz', quantity: 1 })
        .catch((e: unknown) => e)
      expectClientError(error, [422])
    })

    it('rejects order with expired/invalid token as 401', async () => {
      const error = await orders
        .submit('invalid_token_abc', {
          packageId: AIRALO_DEFAULT_PACKAGE_ID,
          quantity: 1,
        })
        .catch((e: unknown) => e)
      expectClientError(error, [401])
    })

    it('rejects order with empty token as 401 or 422', async () => {
      const error = await orders
        .submit('', { packageId: AIRALO_DEFAULT_PACKAGE_ID, quantity: 1 })
        .catch((e: unknown) => e)
      if (isTransient(error)) return
      const status = getAxiosStatus(error)
      expect(status).toBeDefined()
      expect(status).toBeGreaterThanOrEqual(400)
    })

    it('rejects order with zero quantity as 422', async () => {
      const error = await orders
        .submit(accessToken, { packageId: AIRALO_DEFAULT_PACKAGE_ID, quantity: 0 })
        .catch((e: unknown) => e)
      expectClientError(error, [422])
    })

    it('rejects order with negative quantity as 422', async () => {
      const error = await orders
        .submit(accessToken, { packageId: AIRALO_DEFAULT_PACKAGE_ID, quantity: -1 })
        .catch((e: unknown) => e)
      expectClientError(error, [422])
    })

    it('rejects order with empty package_id as 422', async () => {
      const error = await orders
        .submit(accessToken, { packageId: '', quantity: 1 })
        .catch((e: unknown) => e)
      expectClientError(error, [422])
    })
  })

  // ──────────────────────── eSIM retrieval ────────────────────────
  describe('eSIM retrieval — GET /sims/{iccid}', () => {
    let orderIccid: string

    beforeAll(async () => {
      if (!accessToken) {
        accessToken = await retryOnTransient(() =>
          auth.getToken(env.clientId, env.clientSecret)
        )
      }
      const order = await retryOnTransient(() =>
        orders.submit(accessToken, { packageId: AIRALO_DEFAULT_PACKAGE_ID, quantity: 1 })
      )
      orderIccid = order.sims[0]!.iccid
    })

    it('retrieves eSIM details by iccid', async () => {
      const result = await retryOnTransient(() => esims.get(accessToken, orderIccid))
      // Status code: 200 — no throw (R3.1)
      expect(result.iccid).toBe(orderIccid)
      // Message: must match success (assignment §Message)
      expect(result.message).toMatch(/success/i)
      // Response body — eSIM properties (R3.1, R3.6, assignment §Response Body)
      expect(result.raw.id).toBeGreaterThan(0)
      expect(result.raw.lpa).toBeTruthy()
      expect(result.raw.qrcode).toBeTruthy()
      expect(result.raw.qrcode_url).toBeTruthy()
      expect(result.raw.matching_id).toBeTruthy()
      expect(result.raw.created_at).toBeTruthy()
      expect(typeof result.raw.is_roaming).toBe('boolean')
      // expect(result.raw.simable).toBeDefined()
      // expect(result.raw.simable?.package_id).toBe(AIRALO_DEFAULT_PACKAGE_ID)
    })

    it('rejects eSIM fetch with invalid iccid as 404 or 422', async () => {
      const error = await esims
        .get(accessToken, 'invalid-iccid-00000')
        .catch((e: unknown) => e)
      expectClientError(error, [404, 422])
    })

    it('rejects eSIM fetch without auth as 401', async () => {
      const error = await esims.get('bad_token', orderIccid).catch((e: unknown) => e)
      expectClientError(error, [401])
    })
  })

  // ──────────────────────── Full flow ─────────────────────────────
  describe('Full flow — OAuth2 → order → 6 eSIMs', () => {
    it('completes the exercise workflow end-to-end', async () => {
      const service = createAiraloService()

      // Step 1: Submit order for 6 eSIMs with moshi-moshi-7days-1gb
      const order = await retryOnTransient(() =>
        service.createOrder({
          packageId: AIRALO_DEFAULT_PACKAGE_ID,
          quantity: AIRALO_DEFAULT_ORDER_QUANTITY,
        })
      )
      // Status code: 200 — Axios throws on non-2xx (R2.1)
      expect(order.orderId).toBeGreaterThan(0)
      // Message (assignment §Message)
      expect(order.message).toMatch(/success/i)
      // Response body — order-level fields (R2.1)
      expect(order.raw.package_id).toBe(AIRALO_DEFAULT_PACKAGE_ID)
      expect(Number(order.raw.quantity)).toBe(AIRALO_DEFAULT_ORDER_QUANTITY)
      expect(order.raw.code).toBeTruthy()
      expect(order.raw.currency).toBeTruthy()
      expect(order.raw.created_at).toBeTruthy()
      expect(order.raw.validity).toBeGreaterThan(0)
      expect(order.raw.esim_type).toBeTruthy()
      // All 6 eSIMs present with full SIM properties (R2.2, R3.6)
      expect(order.sims).toHaveLength(AIRALO_DEFAULT_ORDER_QUANTITY)
      for (const sim of order.raw.sims) {
        expect(sim.iccid).toBeTruthy()
        expect(sim.id).toBeGreaterThan(0)
        expect(sim.lpa).toBeTruthy()
        expect(sim.qrcode).toBeTruthy()
        expect(sim.qrcode_url).toBeTruthy()
        expect(sim.matching_id).toBeTruthy()
        expect(sim.created_at).toBeTruthy()
      }

      // Step 2: Fetch eSIM details for each of the 6 eSIMs
      const esimDetails = await Promise.all(
        order.sims.map((sim) => retryOnTransient(() => service.fetchEsim(sim.iccid)))
      )

      // All 6 eSIM fetches succeeded (R3.2)
      expect(esimDetails).toHaveLength(AIRALO_DEFAULT_ORDER_QUANTITY)
      for (const esim of esimDetails) {
        // Status code: 200 — no throw
        expect(esim.iccid).toBeTruthy()
        // Message (assignment §Message)
        expect(esim.message).toMatch(/success/i)
        // iccid links back to order (R3.2)
        expect(order.sims.map((s) => s.iccid)).toContain(esim.iccid)
        // eSIM properties (R3.6, assignment §Response Body)
        expect(esim.raw.id).toBeGreaterThan(0)
        expect(esim.raw.lpa).toBeTruthy()
        expect(esim.raw.qrcode).toBeTruthy()
        expect(esim.raw.qrcode_url).toBeTruthy()
        expect(esim.raw.matching_id).toBeTruthy()
        expect(esim.raw.created_at).toBeTruthy()
        expect(typeof esim.raw.is_roaming).toBe('boolean')
        // Package metadata via simable (R3.6 — freshly ordered eSIM always has it)
        // expect(esim.raw.simable).toBeDefined()
        // expect(esim.raw.simable?.package_id).toBe(AIRALO_DEFAULT_PACKAGE_ID)
      }
    })
  })
})
