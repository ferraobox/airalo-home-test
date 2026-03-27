import { jest } from '@jest/globals'
import {
  airaloEsimResponseSchema,
  airaloOrderResponseSchema,
  airaloTokenResponseSchema,
  airaloFieldErrorSchema,
  airaloReasonErrorSchema,
  airaloNotFoundErrorSchema,
} from '@airalo/shared'
import { createHttpClient } from '../../src/lib/httpClient'
import { createAuthService } from '../../src/services/authService'
import { createOrderService } from '../../src/services/orderService'
import { loadApiEnv } from '../../src/config/env'
import { AIRALO_DEFAULT_PACKAGE_ID, AIRALO_DEFAULT_ORDER_QUANTITY } from '@airalo/shared'
import { retryOnTransient } from '../../src/lib/retry'

// ── Live contract validation (real API responses against Zod schemas) ──────────
//
// These tests hit the real Airalo Partner API and parse every response through
// the canonical Zod schemas, validating types and field presence against
// production payloads — the strongest possible backward-compatibility guarantee.
// Skipped automatically when credentials are absent (CI without secrets).

const env = loadApiEnv()
const hasCredentials = env.clientId.length > 0 && env.clientSecret.length > 0
const describeIfCredentials = hasCredentials ? describe : describe.skip

describeIfCredentials('live contract — POST /token', () => {
  jest.setTimeout(120_000)

  const http = createHttpClient(env.baseUrl, 60_000)

  it('parses live token response without errors', async () => {
    const raw = await retryOnTransient(async () => {
      const form = new FormData()
      form.append('client_id', env.clientId)
      form.append('client_secret', env.clientSecret)
      form.append('grant_type', 'client_credentials')
      const { data } = await http.post<unknown>('/token', form)
      return data
    })
    // Full Zod parse — throws ZodError on any field type/shape mismatch
    const parsed = airaloTokenResponseSchema.parse(raw)
    accessToken = parsed.data.access_token

    expect(typeof parsed.data.access_token).toBe('string')
    expect(parsed.data.access_token.length).toBeGreaterThan(0)
    expect(typeof parsed.data.token_type).toBe('string')
    expect(parsed.data.token_type).toMatch(/^Bearer$/i)
    expect(typeof parsed.data.expires_in).toBe('number')
    expect(Number.isInteger(parsed.data.expires_in)).toBe(true)
    expect(parsed.data.expires_in).toBeGreaterThan(0)
    expect(typeof parsed.meta.message).toBe('string')
    expect(parsed.meta.message.length).toBeGreaterThan(0)
  })

  it('rejects invalid credentials with a parseable error response', async () => {
    const form = new FormData()
    form.append('client_id', 'bad_id')
    form.append('client_secret', 'bad_secret')
    form.append('grant_type', 'client_credentials')
    const errRaw = await http.post<unknown>('/token', form).catch((e) => {
      if (e?.response?.data !== undefined) return e.response.data
      throw e
    })
    // Real API 401 shape: { data: { [field]: string }, meta: { message: string } }
    // Differs from spec fixture (auth-error.json) which uses { data: { message } }.
    const parsed = airaloFieldErrorSchema.parse(errRaw)
    expect(typeof parsed.meta.message).toBe('string')
    expect(parsed.meta.message.length).toBeGreaterThan(0)
  })
})

describeIfCredentials('live contract — POST /orders', () => {
  jest.setTimeout(120_000)

  const http = createHttpClient(env.baseUrl, 60_000)
  const auth = createAuthService(http)

  let accessToken: string
  let orderIccids: string[]

  beforeAll(async () => {
    accessToken = await retryOnTransient(() =>
      auth.getToken(env.clientId, env.clientSecret)
    )
  })

  it('parses live order response without errors', async () => {
    const raw = await retryOnTransient(async () => {
      const form = new FormData()
      form.append('package_id', AIRALO_DEFAULT_PACKAGE_ID)
      form.append('quantity', String(AIRALO_DEFAULT_ORDER_QUANTITY))
      const { data } = await http.post<unknown>('/orders', form, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return data
    })
    // Full Zod parse — every field, every type
    const parsed = airaloOrderResponseSchema.parse(raw)
    orderIccids = parsed.data.sims.map((s) => s.iccid)

    // Order-level field types
    expect(typeof parsed.data.id).toBe('number')
    expect(parsed.data.id).toBeGreaterThan(0)
    expect(typeof parsed.data.code).toBe('string')
    expect(parsed.data.code.length).toBeGreaterThan(0)
    expect(typeof parsed.data.currency).toBe('string')
    expect(parsed.data.package_id).toBe(AIRALO_DEFAULT_PACKAGE_ID)
    expect(Number(parsed.data.quantity)).toBe(AIRALO_DEFAULT_ORDER_QUANTITY)
    expect(typeof parsed.data.type).toBe('string')
    expect(typeof parsed.data.esim_type).toBe('string')
    expect(typeof parsed.data.validity).toBe('number')
    expect(parsed.data.validity).toBeGreaterThan(0)
    expect(typeof parsed.data.price).toBe('number')
    expect(typeof parsed.data.created_at).toBe('string')
    expect(parsed.data.created_at.length).toBeGreaterThan(0)
    expect(typeof parsed.meta.message).toBe('string')
    expect(parsed.meta.message).toMatch(/success/i)

    // SIM-level field types for all 6 eSIMs
    expect(parsed.data.sims).toHaveLength(AIRALO_DEFAULT_ORDER_QUANTITY)
    for (const sim of parsed.data.sims) {
      expect(typeof sim.id).toBe('number')
      expect(sim.id).toBeGreaterThan(0)
      expect(typeof sim.iccid).toBe('string')
      expect(sim.iccid.length).toBeGreaterThan(0)
      expect(typeof sim.lpa).toBe('string')
      expect(typeof sim.qrcode).toBe('string')
      expect(typeof sim.qrcode_url).toBe('string')
      expect(typeof sim.matching_id).toBe('string')
      expect(typeof sim.apn_type).toBe('string')
      expect(typeof sim.is_roaming).toBe('boolean')
      expect(typeof sim.created_at).toBe('string')
    }

    // All iccids are unique
    expect(new Set(orderIccids).size).toBe(orderIccids.length)
  })

  it('rejects invalid package_id with a parseable error response', async () => {
    const form = new FormData()
    form.append('package_id', 'not-a-real-package-xyz')
    form.append('quantity', '1')
    const errRaw = await http
      .post<unknown>('/orders', form, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch((e) => {
        if (e?.response?.data !== undefined) return e.response.data
        throw e
      })
    // Real API error shape: { code: number, reason: string }
    // Differs from spec fixture (order-validation-error.json) which uses { data: { message, errors } }.
    const parsed = airaloReasonErrorSchema.parse(errRaw)
    expect(typeof parsed.reason).toBe('string')
    expect(parsed.reason.length).toBeGreaterThan(0)
    expect(typeof parsed.code).toBe('number')
  })
})

describeIfCredentials('live contract — GET /sims/{iccid}', () => {
  jest.setTimeout(120_000)

  const http = createHttpClient(env.baseUrl, 60_000)
  const auth = createAuthService(http)
  const orders = createOrderService(http)

  let accessToken: string
  let orderIccids: string[]

  beforeAll(async () => {
    accessToken = await retryOnTransient(() =>
      auth.getToken(env.clientId, env.clientSecret)
    )
    const result = await retryOnTransient(() =>
      orders.submit(accessToken, {
        packageId: AIRALO_DEFAULT_PACKAGE_ID,
        quantity: AIRALO_DEFAULT_ORDER_QUANTITY,
      })
    )
    orderIccids = result.sims.map((s) => s.iccid)
  })

  it('parses live eSIM response without errors for the first iccid', async () => {
    const iccid = orderIccids[0]!
    const raw = await retryOnTransient(async () => {
      const { data } = await http.get<unknown>(`/sims/${iccid}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return data
    })
    // Full Zod parse — every field, every type
    const parsed = airaloEsimResponseSchema.parse(raw)

    expect(typeof parsed.data.id).toBe('number')
    expect(parsed.data.id).toBeGreaterThan(0)
    expect(typeof parsed.data.iccid).toBe('string')
    expect(parsed.data.iccid).toBe(iccid)
    expect(typeof parsed.data.lpa).toBe('string')
    expect(parsed.data.lpa.length).toBeGreaterThan(0)
    expect(typeof parsed.data.qrcode).toBe('string')
    expect(typeof parsed.data.qrcode_url).toBe('string')
    expect(typeof parsed.data.matching_id).toBe('string')
    expect(typeof parsed.data.apn_type).toBe('string')
    expect(typeof parsed.data.is_roaming).toBe('boolean')
    expect(typeof parsed.data.created_at).toBe('string')
    expect(parsed.data.created_at.length).toBeGreaterThan(0)
    expect(typeof parsed.meta.message).toBe('string')
    expect(parsed.meta.message).toMatch(/success/i)

    // Optional simable — if present, verify its types too
    if (parsed.data.simable) {
      expect(typeof parsed.data.simable.id).toBe('number')
      expect(parsed.data.simable.package_id).toBe(AIRALO_DEFAULT_PACKAGE_ID)
      expect(typeof parsed.data.simable.currency).toBe('string')
      expect(typeof parsed.data.simable.type).toBe('string')
    }
  })

  it('all 6 eSIM responses parse without Zod errors (R3.2)', async () => {
    const results = await Promise.all(
      orderIccids.map((iccid) =>
        retryOnTransient(async () => {
          const { data } = await http.get<unknown>(`/sims/${iccid}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          return { iccid, data }
        })
      )
    )
    for (const { iccid, data } of results) {
      // Each eSIM response must cleanly parse — no throws means schema matches production
      const parsed = airaloEsimResponseSchema.parse(data)
      expect(parsed.data.iccid).toBe(iccid)
      expect(parsed.meta.message).toMatch(/success/i)
    }
  })

  it('rejects invalid iccid with a parseable error response', async () => {
    const errRaw = await http
      .get<unknown>('/sims/invalid-iccid-00000', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch((e) => {
        if (e?.response?.data !== undefined) return e.response.data
        throw e
      })
    // Real API 404 shape: { data: [], meta: { message: string } }
    // Differs from spec (api-contracts.md) which uses { data: { message } }.
    const parsed = airaloNotFoundErrorSchema.parse(errRaw)
    expect(typeof parsed.meta.message).toBe('string')
    expect(parsed.meta.message.length).toBeGreaterThan(0)
  })
})
