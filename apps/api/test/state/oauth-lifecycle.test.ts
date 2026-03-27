import {
  tokenMachine,
  initialTokenCtx as initialCtx,
  MAX_TOKEN_RETRIES as MAX_RETRIES,
} from '../../src/lib/stateMachines'
import type { TokenState, TokenEvent, TokenContext } from '../../src/lib/stateMachines'

describe('OAuth2 Token State Machine', () => {
  describe('NO_TOKEN → REQUESTING', () => {
    it('transitions to REQUESTING on valid authenticate', () => {
      const result = tokenMachine(
        'NO_TOKEN',
        { type: 'AUTHENTICATE', clientId: 'id', clientSecret: 'sec' },
        initialCtx()
      )
      expect(result.state).toBe('REQUESTING')
    })

    it('transitions to FAILED when clientId is empty', () => {
      const result = tokenMachine(
        'NO_TOKEN',
        { type: 'AUTHENTICATE', clientId: '', clientSecret: 'sec' },
        initialCtx()
      )
      expect(result.state).toBe('FAILED')
      expect(result.ctx.error).toBe('Missing credentials')
    })

    it('transitions to FAILED when clientSecret is empty', () => {
      const result = tokenMachine(
        'NO_TOKEN',
        { type: 'AUTHENTICATE', clientId: 'id', clientSecret: '' },
        initialCtx()
      )
      expect(result.state).toBe('FAILED')
      expect(result.ctx.error).toBe('Missing credentials')
    })

    it('ignores unrelated events', () => {
      const result = tokenMachine(
        'NO_TOKEN',
        { type: 'SUCCESS', accessToken: 'tok', expiresIn: 3600 },
        initialCtx()
      )
      expect(result.state).toBe('NO_TOKEN')
    })
  })

  describe('REQUESTING → VALID_TOKEN', () => {
    it('transitions to VALID_TOKEN on success', () => {
      const result = tokenMachine(
        'REQUESTING',
        { type: 'SUCCESS', accessToken: 'abc123', expiresIn: 31622400 },
        initialCtx()
      )
      expect(result.state).toBe('VALID_TOKEN')
      expect(result.ctx.accessToken).toBe('abc123')
      expect(result.ctx.expiresIn).toBe(31622400)
      expect(result.ctx.error).toBeNull()
      expect(result.ctx.retryCount).toBe(0)
    })
  })

  describe('REQUESTING → FAILED', () => {
    it('transitions to FAILED on authentication failure', () => {
      const result = tokenMachine(
        'REQUESTING',
        { type: 'FAILURE', error: '401 Unauthorized' },
        initialCtx()
      )
      expect(result.state).toBe('FAILED')
      expect(result.ctx.error).toBe('401 Unauthorized')
    })

    it('transitions to FAILED on network error', () => {
      const result = tokenMachine(
        'REQUESTING',
        { type: 'FAILURE', error: 'Network timeout' },
        initialCtx()
      )
      expect(result.state).toBe('FAILED')
      expect(result.ctx.error).toBe('Network timeout')
    })
  })

  describe('VALID_TOKEN → EXPIRED', () => {
    it('transitions to EXPIRED when TTL expires', () => {
      const ctx = {
        ...initialCtx(),
        accessToken: 'tok',
        expiresIn: 3600,
        issuedAt: Date.now() - 4000000,
      }
      const result = tokenMachine('VALID_TOKEN', { type: 'TTL_EXPIRED' }, ctx)
      expect(result.state).toBe('EXPIRED')
      expect(result.ctx.accessToken).toBeNull()
    })

    it('stays VALID_TOKEN for unrelated events', () => {
      const ctx = {
        ...initialCtx(),
        accessToken: 'tok',
        expiresIn: 3600,
        issuedAt: Date.now(),
      }
      const result = tokenMachine('VALID_TOKEN', { type: 'RETRY' }, ctx)
      expect(result.state).toBe('VALID_TOKEN')
    })
  })

  describe('EXPIRED → REQUESTING (re-authentication)', () => {
    it('transitions to REQUESTING on re-authenticate', () => {
      const result = tokenMachine(
        'EXPIRED',
        { type: 'AUTHENTICATE', clientId: 'id', clientSecret: 'sec' },
        initialCtx()
      )
      expect(result.state).toBe('REQUESTING')
    })
  })

  describe('FAILED → REQUESTING (retry)', () => {
    it('retries when under max retries', () => {
      const ctx = { ...initialCtx(), retryCount: 0, error: 'Network error' }
      const result = tokenMachine('FAILED', { type: 'RETRY' }, ctx)
      expect(result.state).toBe('REQUESTING')
      expect(result.ctx.retryCount).toBe(1)
    })

    it('stays FAILED when max retries exceeded', () => {
      const ctx = { ...initialCtx(), retryCount: MAX_RETRIES, error: 'Network error' }
      const result = tokenMachine('FAILED', { type: 'RETRY' }, ctx)
      expect(result.state).toBe('FAILED')
      expect(result.ctx.error).toBe('Max retries exceeded')
    })

    it('increments retry count on each retry', () => {
      let ctx: TokenContext = { ...initialCtx(), retryCount: 0, error: 'err' }
      for (let i = 0; i < MAX_RETRIES; i++) {
        const result = tokenMachine('FAILED', { type: 'RETRY' }, ctx)
        expect(result.ctx.retryCount).toBe(i + 1)
        ctx = { ...result.ctx, error: 'err' }
        // Simulate failure again
        const failed = tokenMachine('REQUESTING', { type: 'FAILURE', error: 'err' }, ctx)
        ctx = failed.ctx
      }
      // Now should be stuck
      const final = tokenMachine('FAILED', { type: 'RETRY' }, ctx)
      expect(final.state).toBe('FAILED')
      expect(final.ctx.error).toBe('Max retries exceeded')
    })
  })

  describe('Full lifecycle', () => {
    it('NO_TOKEN → REQUESTING → VALID_TOKEN → EXPIRED → REQUESTING → VALID_TOKEN', () => {
      let { state, ctx } = tokenMachine(
        'NO_TOKEN',
        { type: 'AUTHENTICATE', clientId: 'id', clientSecret: 'sec' },
        initialCtx()
      )
      expect(state).toBe('REQUESTING')
      ;({ state, ctx } = tokenMachine(
        state,
        { type: 'SUCCESS', accessToken: 'tok1', expiresIn: 3600 },
        ctx
      ))
      expect(state).toBe('VALID_TOKEN')
      expect(ctx.accessToken).toBe('tok1')
      ;({ state, ctx } = tokenMachine(state, { type: 'TTL_EXPIRED' }, ctx))
      expect(state).toBe('EXPIRED')
      ;({ state, ctx } = tokenMachine(
        state,
        { type: 'AUTHENTICATE', clientId: 'id', clientSecret: 'sec' },
        ctx
      ))
      expect(state).toBe('REQUESTING')
      ;({ state, ctx } = tokenMachine(
        state,
        { type: 'SUCCESS', accessToken: 'tok2', expiresIn: 3600 },
        ctx
      ))
      expect(state).toBe('VALID_TOKEN')
      expect(ctx.accessToken).toBe('tok2')
    })

    it('NO_TOKEN → REQUESTING → FAILED → RETRY → REQUESTING → VALID_TOKEN', () => {
      let { state, ctx } = tokenMachine(
        'NO_TOKEN',
        { type: 'AUTHENTICATE', clientId: 'id', clientSecret: 'sec' },
        initialCtx()
      )
      expect(state).toBe('REQUESTING')
      ;({ state, ctx } = tokenMachine(
        state,
        { type: 'FAILURE', error: 'Network error' },
        ctx
      ))
      expect(state).toBe('FAILED')
      ;({ state, ctx } = tokenMachine(state, { type: 'RETRY' }, ctx))
      expect(state).toBe('REQUESTING')
      ;({ state, ctx } = tokenMachine(
        state,
        { type: 'SUCCESS', accessToken: 'tok', expiresIn: 3600 },
        ctx
      ))
      expect(state).toBe('VALID_TOKEN')
    })
  })

  // ── Exhaustive state × event transition matrix ──────────

  describe('exhaustive state × event transition matrix', () => {
    const AUTH_EVENT: TokenEvent = {
      type: 'AUTHENTICATE',
      clientId: 'id',
      clientSecret: 'sec',
    }
    const SUCCESS_EVENT: TokenEvent = {
      type: 'SUCCESS',
      accessToken: 'tok',
      expiresIn: 3600,
    }
    const FAILURE_EVENT: TokenEvent = { type: 'FAILURE', error: 'err' }
    const TTL_EVENT: TokenEvent = { type: 'TTL_EXPIRED' }
    const RETRY_EVENT: TokenEvent = { type: 'RETRY' }

    const allEvents: Array<[string, TokenEvent]> = [
      ['AUTHENTICATE', AUTH_EVENT],
      ['SUCCESS', SUCCESS_EVENT],
      ['FAILURE', FAILURE_EVENT],
      ['TTL_EXPIRED', TTL_EVENT],
      ['RETRY', RETRY_EVENT],
    ]

    const allStates: TokenState[] = [
      'NO_TOKEN',
      'REQUESTING',
      'VALID_TOKEN',
      'EXPIRED',
      'FAILED',
    ]

    // Expected next state for each [state, event] pair
    const expectedTransitions: Record<string, TokenState> = {
      'NO_TOKEN+AUTHENTICATE': 'REQUESTING',
      'NO_TOKEN+SUCCESS': 'NO_TOKEN',
      'NO_TOKEN+FAILURE': 'NO_TOKEN',
      'NO_TOKEN+TTL_EXPIRED': 'NO_TOKEN',
      'NO_TOKEN+RETRY': 'NO_TOKEN',
      'REQUESTING+AUTHENTICATE': 'REQUESTING',
      'REQUESTING+SUCCESS': 'VALID_TOKEN',
      'REQUESTING+FAILURE': 'FAILED',
      'REQUESTING+TTL_EXPIRED': 'REQUESTING',
      'REQUESTING+RETRY': 'REQUESTING',
      'VALID_TOKEN+AUTHENTICATE': 'VALID_TOKEN',
      'VALID_TOKEN+SUCCESS': 'VALID_TOKEN',
      'VALID_TOKEN+FAILURE': 'VALID_TOKEN',
      'VALID_TOKEN+TTL_EXPIRED': 'EXPIRED',
      'VALID_TOKEN+RETRY': 'VALID_TOKEN',
      'EXPIRED+AUTHENTICATE': 'REQUESTING',
      'EXPIRED+SUCCESS': 'EXPIRED',
      'EXPIRED+FAILURE': 'EXPIRED',
      'EXPIRED+TTL_EXPIRED': 'EXPIRED',
      'EXPIRED+RETRY': 'EXPIRED',
      'FAILED+AUTHENTICATE': 'FAILED',
      'FAILED+SUCCESS': 'FAILED',
      'FAILED+FAILURE': 'FAILED',
      'FAILED+TTL_EXPIRED': 'FAILED',
      'FAILED+RETRY': 'REQUESTING', // when retryCount < MAX_RETRIES
    }

    for (const currentState of allStates) {
      for (const [eventName, event] of allEvents) {
        const key = `${currentState}+${eventName}`
        const expected = expectedTransitions[key]

        it(`${currentState} + ${eventName} → ${expected}`, () => {
          const ctx = { ...initialCtx(), retryCount: 0 }
          const result = tokenMachine(currentState, event, ctx)
          expect(result.state).toBe(expected)
        })
      }
    }
  })

  // ── Context invariants ──────────────────────────────────

  describe('context invariants', () => {
    it('VALID_TOKEN always has non-null accessToken', () => {
      const result = tokenMachine(
        'REQUESTING',
        { type: 'SUCCESS', accessToken: 'tok_valid', expiresIn: 3600 },
        initialCtx()
      )
      expect(result.state).toBe('VALID_TOKEN')
      expect(result.ctx.accessToken).not.toBeNull()
      expect(result.ctx.accessToken!.length).toBeGreaterThan(0)
    })

    it('EXPIRED always has null accessToken', () => {
      const ctx = { ...initialCtx(), accessToken: 'tok', expiresIn: 3600 }
      const result = tokenMachine('VALID_TOKEN', { type: 'TTL_EXPIRED' }, ctx)
      expect(result.state).toBe('EXPIRED')
      expect(result.ctx.accessToken).toBeNull()
    })

    it('FAILED always has non-null error', () => {
      const result = tokenMachine(
        'REQUESTING',
        { type: 'FAILURE', error: 'bad creds' },
        initialCtx()
      )
      expect(result.state).toBe('FAILED')
      expect(result.ctx.error).not.toBeNull()
    })

    it('retryCount never exceeds MAX_RETRIES', () => {
      const ctx = { ...initialCtx(), retryCount: MAX_RETRIES, error: 'err' }
      const result = tokenMachine('FAILED', { type: 'RETRY' }, ctx)
      expect(result.ctx.retryCount).toBeLessThanOrEqual(MAX_RETRIES)
    })

    it('success resets retryCount to 0', () => {
      const ctx = { ...initialCtx(), retryCount: 2 }
      const result = tokenMachine(
        'REQUESTING',
        { type: 'SUCCESS', accessToken: 'tok', expiresIn: 3600 },
        ctx
      )
      expect(result.ctx.retryCount).toBe(0)
    })
  })
})
