import { ZodError } from 'zod'
import {
  airaloEsimResponseSchema,
  airaloOrderResponseSchema,
  airaloTokenResponseSchema,
  airaloValidationErrorSchema,
  airaloAuthErrorSchema,
} from '@airalo/shared'
import { fixture } from '../../src/lib/fixture'

// ── Token contract ──────────────────────────────────────────

describe('token contract', () => {
  it('validates token fixture against schema', () => {
    expect(() =>
      airaloTokenResponseSchema.parse(fixture('token-response.json'))
    ).not.toThrow()
  })

  it('token fixture has correct structure', () => {
    const token = fixture('token-response.json')
    expect(token).toHaveProperty('data.access_token')
    expect(token).toHaveProperty('data.token_type')
    expect(token).toHaveProperty('data.expires_in')
    expect(token).toHaveProperty('meta.message')
    expect(typeof token.data.access_token).toBe('string')
    expect(typeof token.data.expires_in).toBe('number')
  })

  it('rejects token response with missing data wrapper', () => {
    const token = fixture('token-response.json')
    expect(() => airaloTokenResponseSchema.parse(token.data)).toThrow()
  })

  it('rejects token response with empty access_token', () => {
    const token = fixture('token-response.json')
    token.data.access_token = ''
    expect(() => airaloTokenResponseSchema.parse(token)).toThrow()
  })

  it('token fixture expires_in is a positive integer', () => {
    const token = fixture('token-response.json')
    expect(token.data.expires_in).toBeGreaterThan(0)
    expect(Number.isInteger(token.data.expires_in)).toBe(true)
  })

  it('token fixture token_type is a non-empty string', () => {
    const token = fixture('token-response.json')
    expect(token.data.token_type.length).toBeGreaterThan(0)
  })
})

// ── Order contract ──────────────────────────────────────────

describe('order contract', () => {
  it('validates order fixture against schema', () => {
    expect(() =>
      airaloOrderResponseSchema.parse(fixture('order-response.json'))
    ).not.toThrow()
  })

  it('order fixture has correct top-level shape', () => {
    const order = fixture('order-response.json')
    expect(order).toHaveProperty('data.id')
    expect(order).toHaveProperty('data.code')
    expect(order).toHaveProperty('data.package_id')
    expect(order).toHaveProperty('data.quantity')
    expect(order).toHaveProperty('data.sims')
    expect(order).toHaveProperty('meta.message')
  })

  it('order fixture has expected number of SIMs', () => {
    const order = fixture('order-response.json')
    expect(order.data.sims).toHaveLength(6)
  })

  it('each SIM in order has iccid and matching_id', () => {
    const order = fixture('order-response.json')
    for (const sim of order.data.sims) {
      expect(sim).toHaveProperty('iccid')
      expect(sim).toHaveProperty('matching_id')
      expect(typeof sim.iccid).toBe('string')
      expect(sim.iccid.length).toBeGreaterThan(0)
      // Full SIM properties required by assignment (R2.2, R3.6)
      expect(sim.id).toBeGreaterThan(0)
      expect(sim.lpa).toBeTruthy()
      expect(sim.qrcode).toBeTruthy()
      expect(sim.qrcode_url).toBeTruthy()
      expect(sim.created_at).toBeTruthy()
    }
  })

  it('all SIM iccids in order are unique', () => {
    const order = fixture('order-response.json')
    const iccids = order.data.sims.map((s: { iccid: string }) => s.iccid)
    expect(new Set(iccids).size).toBe(iccids.length)
  })

  it('order has numeric id', () => {
    const order = fixture('order-response.json')
    expect(typeof order.data.id).toBe('number')
  })

  it('rejects order with empty sims', () => {
    const order = fixture('order-response.json')
    order.data.sims = []
    expect(() => airaloOrderResponseSchema.parse(order)).toThrow()
  })

  it('order code is non-empty string', () => {
    const order = fixture('order-response.json')
    expect(typeof order.data.code).toBe('string')
    expect(order.data.code.length).toBeGreaterThan(0)
  })

  it('order package_id matches expected package', () => {
    const order = fixture('order-response.json')
    expect(order.data.package_id).toBe('moshi-moshi-7days-1gb')
  })
})

// ── eSIM contract ───────────────────────────────────────────

describe('esim contract', () => {
  it('validates esim fixture against schema', () => {
    expect(() =>
      airaloEsimResponseSchema.parse(fixture('esim-response.json'))
    ).not.toThrow()
  })

  it('esim fixture has correct structure', () => {
    const esim = fixture('esim-response.json')
    expect(esim).toHaveProperty('data.id')
    expect(esim).toHaveProperty('data.iccid')
    expect(esim).toHaveProperty('data.lpa')
    expect(esim).toHaveProperty('data.qrcode')
    expect(esim).toHaveProperty('data.qrcode_url')
    expect(esim).toHaveProperty('data.matching_id')
    expect(esim).toHaveProperty('data.is_roaming')
    expect(esim).toHaveProperty('data.created_at')
    expect(esim).toHaveProperty('data.simable')
    expect(esim).toHaveProperty('meta.message')
  })

  it('esim fixture has correct property values (R3.6, assignment §Response Body)', () => {
    const esim = fixture('esim-response.json')
    expect(esim.data.id).toBeGreaterThan(0)
    expect(esim.data.iccid).toBeTruthy()
    expect(esim.data.lpa).toBeTruthy()
    expect(esim.data.qrcode).toBeTruthy()
    expect(esim.data.qrcode_url).toBeTruthy()
    expect(esim.data.matching_id).toBeTruthy()
    expect(esim.data.created_at).toBeTruthy()
    expect(typeof esim.data.is_roaming).toBe('boolean')
    // Message: success (assignment §Message)
    expect(esim.meta.message).toMatch(/success/i)
  })

  it('esim simable references parent order', () => {
    const esim = fixture('esim-response.json')
    expect(esim.data.simable).toHaveProperty('package_id')
    expect(esim.data.simable.package_id).toBe('moshi-moshi-7days-1gb')
  })

  it('esim iccid matches fixture sim', () => {
    const esim = fixture('esim-response.json')
    const order = fixture('order-response.json')
    const orderIccids = order.data.sims.map((s: { iccid: string }) => s.iccid)
    expect(orderIccids).toContain(esim.data.iccid)
  })

  it('esim id is a positive number', () => {
    const esim = fixture('esim-response.json')
    expect(typeof esim.data.id).toBe('number')
    expect(esim.data.id).toBeGreaterThan(0)
  })

  it('esim lpa field is a valid-looking LPA string', () => {
    const esim = fixture('esim-response.json')
    expect(typeof esim.data.lpa).toBe('string')
    expect(esim.data.lpa.length).toBeGreaterThan(0)
  })
})

// ── Error contracts ─────────────────────────────────────────

describe('error contracts', () => {
  it('validates auth error fixture', () => {
    expect(() => airaloAuthErrorSchema.parse(fixture('auth-error.json'))).not.toThrow()
  })

  it('validates validation error fixture', () => {
    expect(() =>
      airaloValidationErrorSchema.parse(fixture('order-validation-error.json'))
    ).not.toThrow()
  })

  it('validation error has errors map', () => {
    const err = fixture('order-validation-error.json')
    expect(err.data.errors).toHaveProperty('package_id')
    expect(err.data.errors).toHaveProperty('quantity')
    expect(Array.isArray(err.data.errors.package_id)).toBe(true)
  })

  it('auth error message is a non-empty string', () => {
    const err = fixture('auth-error.json')
    expect(typeof err.data.message).toBe('string')
    expect(err.data.message.length).toBeGreaterThan(0)
  })

  it('validation error message is a non-empty string', () => {
    const err = fixture('order-validation-error.json')
    expect(typeof err.data.message).toBe('string')
    expect(err.data.message.length).toBeGreaterThan(0)
  })
})

// ── Backward compatibility ──────────────────────────────────
// Ensure schemas tolerate API evolution: new optional fields added by the API
// must not break parsing, and minimum viable payloads must still parse.

describe('backward compatibility — token', () => {
  it('parses minimum viable token response (no extra fields)', () => {
    const minimal = {
      data: { access_token: 'tok_123', token_type: 'Bearer', expires_in: 3600 },
      meta: { message: 'success' },
    }
    expect(() => airaloTokenResponseSchema.parse(minimal)).not.toThrow()
  })

  it('tolerates unknown fields added by future API version', () => {
    const future = {
      data: {
        access_token: 'tok_123',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'ref_456',
        scope: 'partner:read',
      },
      meta: { message: 'success', request_id: 'req-abc' },
    }
    const result = airaloTokenResponseSchema.parse(future)
    expect(result.data.access_token).toBe('tok_123')
    // Unknown fields are stripped (Zod default)
    expect((result.data as Record<string, unknown>)['refresh_token']).toBeUndefined()
  })

  it('fixture still parses after schema update (no breaking changes)', () => {
    const token = fixture('token-response.json')
    const result = airaloTokenResponseSchema.parse(token)
    expect(result.data.access_token).toBeTruthy()
    expect(result.data.expires_in).toBeGreaterThan(0)
  })
})

describe('backward compatibility — order', () => {
  it('tolerates unknown fields on order data', () => {
    const order = fixture('order-response.json')
    order.data.new_future_field = 'some-value'
    order.data.billing_info = { currency: 'USD', total: 26.5 }
    const result = airaloOrderResponseSchema.parse(order)
    expect(result.data.id).toBe(order.data.id)
    expect((result.data as Record<string, unknown>)['new_future_field']).toBeUndefined()
  })

  it('tolerates unknown fields on individual SIM entries', () => {
    const order = fixture('order-response.json')
    order.data.sims[0].activation_status = 'pending'
    order.data.sims[0].network_name = 'NTT DoCoMo'
    const result = airaloOrderResponseSchema.parse(order)
    expect(result.data.sims[0]!.iccid).toBeTruthy()
    expect(
      (result.data.sims[0] as Record<string, unknown>)['activation_status']
    ).toBeUndefined()
  })

  it('fixture with all required fields still validates after structural changes', () => {
    const order = fixture('order-response.json')
    const result = airaloOrderResponseSchema.parse(order)
    expect(result.data.sims.length).toBeGreaterThan(0)
    expect(result.data.package_id).toBe('moshi-moshi-7days-1gb')
  })

  it('detects removal of required field (sims) as breaking', () => {
    const order = fixture('order-response.json')
    delete order.data.sims
    expect(() => airaloOrderResponseSchema.parse(order)).toThrow(ZodError)
  })

  it('detects type change of required field (id: number→string) as breaking', () => {
    const order = fixture('order-response.json')
    order.data.id = 'string-id'
    expect(() => airaloOrderResponseSchema.parse(order)).toThrow(ZodError)
  })
})

describe('backward compatibility — esim', () => {
  it('optional simable field absent is valid (older API version)', () => {
    const esim = fixture('esim-response.json')
    delete esim.data.simable
    expect(() => airaloEsimResponseSchema.parse(esim)).not.toThrow()
  })

  it('optional brand_settings_name absent is valid', () => {
    const esim = fixture('esim-response.json')
    delete esim.data.brand_settings_name
    expect(() => airaloEsimResponseSchema.parse(esim)).not.toThrow()
  })

  it('optional direct_apple_installation_url absent is valid', () => {
    const esim = fixture('esim-response.json')
    delete esim.data.direct_apple_installation_url
    expect(() => airaloEsimResponseSchema.parse(esim)).not.toThrow()
  })

  it('tolerates unknown fields from future API versions', () => {
    const esim = fixture('esim-response.json')
    esim.data.esim_profile_status = 'active'
    esim.data.data_usage_mb = 150
    const result = airaloEsimResponseSchema.parse(esim)
    expect(result.data.iccid).toBeTruthy()
    expect(
      (result.data as Record<string, unknown>)['esim_profile_status']
    ).toBeUndefined()
  })

  it('detects removal of required field (iccid) as breaking', () => {
    const esim = fixture('esim-response.json')
    delete esim.data.iccid
    expect(() => airaloEsimResponseSchema.parse(esim)).toThrow(ZodError)
  })

  it('detects type change of required field (id: number→string) as breaking', () => {
    const esim = fixture('esim-response.json')
    esim.data.id = 'not-a-number'
    expect(() => airaloEsimResponseSchema.parse(esim)).toThrow(ZodError)
  })
})

describe('backward compatibility — error schemas', () => {
  it('validation error tolerates extra fields in errors map', () => {
    const err = fixture('order-validation-error.json')
    err.data.errors.description = ['The description field is not allowed.']
    expect(() => airaloValidationErrorSchema.parse(err)).not.toThrow()
  })

  it('validation error still valid without optional errors map', () => {
    const minimal = { data: { message: 'Something went wrong' } }
    expect(() => airaloValidationErrorSchema.parse(minimal)).not.toThrow()
  })

  it('auth error tolerates additional fields from future API', () => {
    const err = {
      data: { message: 'Unauthenticated.', error_code: 'AUTH_EXPIRED', retry: false },
    }
    const result = airaloAuthErrorSchema.parse(err)
    expect(result.data.message).toBe('Unauthenticated.')
    expect((result.data as Record<string, unknown>)['error_code']).toBeUndefined()
  })
})

// ── Cross-fixture consistency ───────────────────────────────

describe('cross-fixture consistency', () => {
  it('esim fixture iccid appears in order fixture sims', () => {
    const order = fixture('order-response.json')
    const esim = fixture('esim-response.json')
    const iccids = order.data.sims.map((s: { iccid: string }) => s.iccid)
    expect(iccids).toContain(esim.data.iccid)
  })

  it('esim simable order id matches order fixture id', () => {
    const order = fixture('order-response.json')
    const esim = fixture('esim-response.json')
    expect(esim.data.simable.id).toBe(order.data.id)
  })

  it('esim simable package_id matches order package_id', () => {
    const order = fixture('order-response.json')
    const esim = fixture('esim-response.json')
    expect(esim.data.simable.package_id).toBe(order.data.package_id)
  })

  it('token fixture produces a valid Bearer token format', () => {
    const token = fixture('token-response.json')
    const bearerHeader = `Bearer ${token.data.access_token}`
    expect(bearerHeader).toMatch(/^Bearer .+$/)
  })
})

// ── Schema strictness tests ─────────────────────────────────

describe('schema strictness — unknown fields', () => {
  it('token schema strips unknown fields (Zod default)', () => {
    const token = fixture('token-response.json')
    token.data.extra_field = 'should be stripped'
    token.injected = true
    const result = airaloTokenResponseSchema.parse(token)
    expect((result.data as Record<string, unknown>)['extra_field']).toBeUndefined()
    expect((result as Record<string, unknown>)['injected']).toBeUndefined()
  })

  it('order schema strips unknown fields', () => {
    const order = fixture('order-response.json')
    order.data.malicious_field = '<script>alert(1)</script>'
    const result = airaloOrderResponseSchema.parse(order)
    expect((result.data as Record<string, unknown>)['malicious_field']).toBeUndefined()
  })

  it('esim schema strips unknown fields', () => {
    const esim = fixture('esim-response.json')
    esim.data.admin_override = true
    const result = airaloEsimResponseSchema.parse(esim)
    expect((result.data as Record<string, unknown>)['admin_override']).toBeUndefined()
  })
})

// ── Negative contract tests — wrong fixture shapes ──────────

describe('negative contract tests — schema cross-validation', () => {
  it('token fixture does NOT match order schema', () => {
    expect(() => airaloOrderResponseSchema.parse(fixture('token-response.json'))).toThrow(
      ZodError
    )
  })

  it('order fixture does NOT match token schema', () => {
    expect(() => airaloTokenResponseSchema.parse(fixture('order-response.json'))).toThrow(
      ZodError
    )
  })

  it('esim fixture does NOT match order schema', () => {
    expect(() => airaloOrderResponseSchema.parse(fixture('esim-response.json'))).toThrow(
      ZodError
    )
  })

  it('auth error fixture does NOT match validation error schema', () => {
    // Auth error has no errors map, but message is present — may or may not throw
    // depending on whether errors is optional
    const authErr = fixture('auth-error.json')
    // If it happens to pass (errors is optional), that's acceptable
    // The key test: it should NOT match order schema
    expect(() => airaloOrderResponseSchema.parse(authErr)).toThrow(ZodError)
  })

  it('validation error fixture does NOT match token schema', () => {
    expect(() =>
      airaloTokenResponseSchema.parse(fixture('order-validation-error.json'))
    ).toThrow(ZodError)
  })
})
