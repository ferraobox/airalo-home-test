import { esimMachine, initialEsimCtx } from '../../src/lib/stateMachines'
import type { EsimState, EsimEvent } from '../../src/lib/stateMachines'

describe('eSIM Fetch Lifecycle State Machine', () => {
  describe('UNRESOLVED → FETCHING', () => {
    it('transitions to FETCHING with valid iccid', () => {
      const result = esimMachine(
        'UNRESOLVED',
        { type: 'FETCH', iccid: '8901234567890000001' },
        initialEsimCtx()
      )
      expect(result.state).toBe('FETCHING')
      expect(result.ctx.iccid).toBe('8901234567890000001')
    })

    it('transitions to ERROR with empty iccid', () => {
      const result = esimMachine(
        'UNRESOLVED',
        { type: 'FETCH', iccid: '' },
        initialEsimCtx()
      )
      expect(result.state).toBe('ERROR')
      expect(result.ctx.error).toBe('Empty iccid')
    })

    it('ignores unrelated events', () => {
      const result = esimMachine(
        'UNRESOLVED',
        { type: 'SUCCESS', iccid: 'x', data: {} },
        initialEsimCtx()
      )
      expect(result.state).toBe('UNRESOLVED')
    })
  })

  describe('FETCHING → RESOLVED', () => {
    it('transitions to RESOLVED on success', () => {
      const ctx = { ...initialEsimCtx(), iccid: '8901234567890000001' }
      const result = esimMachine(
        'FETCHING',
        { type: 'SUCCESS', iccid: '8901234567890000001', data: { id: 1 } },
        ctx
      )
      expect(result.state).toBe('RESOLVED')
      expect(result.ctx.data).toStrictEqual({ id: 1 })
      expect(result.ctx.error).toBeNull()
    })
  })

  describe('FETCHING → NOT_FOUND', () => {
    it('transitions to NOT_FOUND on 404', () => {
      const ctx = { ...initialEsimCtx(), iccid: '0000000000000000000' }
      const result = esimMachine(
        'FETCHING',
        { type: 'NOT_FOUND', iccid: '0000000000000000000' },
        ctx
      )
      expect(result.state).toBe('NOT_FOUND')
      expect(result.ctx.error).toContain('not found')
    })
  })

  describe('FETCHING → ERROR', () => {
    it('transitions to ERROR on network failure', () => {
      const ctx = { ...initialEsimCtx(), iccid: '8901234567890000001' }
      const result = esimMachine(
        'FETCHING',
        { type: 'ERROR', message: 'Network timeout' },
        ctx
      )
      expect(result.state).toBe('ERROR')
      expect(result.ctx.error).toBe('Network timeout')
    })

    it('transitions to ERROR on 500', () => {
      const ctx = { ...initialEsimCtx(), iccid: '8901234567890000001' }
      const result = esimMachine(
        'FETCHING',
        { type: 'ERROR', message: '500 Internal Server Error' },
        ctx
      )
      expect(result.state).toBe('ERROR')
    })
  })

  describe('RESOLVED is terminal', () => {
    it('stays in RESOLVED for any event', () => {
      const ctx = { ...initialEsimCtx(), iccid: 'x', data: { id: 1 } }
      expect(esimMachine('RESOLVED', { type: 'RETRY' }, ctx).state).toBe('RESOLVED')
      expect(esimMachine('RESOLVED', { type: 'FETCH', iccid: 'y' }, ctx).state).toBe(
        'RESOLVED'
      )
    })
  })

  describe('NOT_FOUND supports retry', () => {
    it('retries from NOT_FOUND', () => {
      const ctx = { ...initialEsimCtx(), iccid: '000', error: 'not found' }
      const result = esimMachine('NOT_FOUND', { type: 'RETRY' }, ctx)
      expect(result.state).toBe('FETCHING')
      expect(result.ctx.error).toBeNull()
    })
  })

  describe('ERROR supports retry', () => {
    it('retries from ERROR', () => {
      const ctx = { ...initialEsimCtx(), iccid: '000', error: 'timeout' }
      const result = esimMachine('ERROR', { type: 'RETRY' }, ctx)
      expect(result.state).toBe('FETCHING')
      expect(result.ctx.error).toBeNull()
    })
  })

  describe('Full lifecycle', () => {
    it('UNRESOLVED → FETCHING → RESOLVED', () => {
      let { state, ctx } = esimMachine(
        'UNRESOLVED',
        { type: 'FETCH', iccid: '890123' },
        initialEsimCtx()
      )
      expect(state).toBe('FETCHING')
      ;({ state, ctx } = esimMachine(
        state,
        { type: 'SUCCESS', iccid: '890123', data: { lpa: 'lpa.test' } },
        ctx
      ))
      expect(state).toBe('RESOLVED')
      expect(ctx.data).toStrictEqual({ lpa: 'lpa.test' })
    })

    it('UNRESOLVED → FETCHING → ERROR → RETRY → FETCHING → RESOLVED', () => {
      let { state, ctx } = esimMachine(
        'UNRESOLVED',
        { type: 'FETCH', iccid: '890123' },
        initialEsimCtx()
      )
      ;({ state, ctx } = esimMachine(state, { type: 'ERROR', message: 'timeout' }, ctx))
      expect(state).toBe('ERROR')
      ;({ state, ctx } = esimMachine(state, { type: 'RETRY' }, ctx))
      expect(state).toBe('FETCHING')
      ;({ state, ctx } = esimMachine(
        state,
        { type: 'SUCCESS', iccid: '890123', data: { ok: true } },
        ctx
      ))
      expect(state).toBe('RESOLVED')
    })
  })

  // ── Exhaustive state × event transition matrix ──────────

  describe('exhaustive state × event transition matrix', () => {
    const FETCH_EVENT: EsimEvent = { type: 'FETCH', iccid: '890123' }
    const SUCCESS_EVENT: EsimEvent = { type: 'SUCCESS', iccid: '890123', data: { id: 1 } }
    const NOT_FOUND_EVENT: EsimEvent = { type: 'NOT_FOUND', iccid: '890123' }
    const ERROR_EVENT: EsimEvent = { type: 'ERROR', message: 'Network error' }
    const RETRY_EVENT: EsimEvent = { type: 'RETRY' }

    const allEvents: Array<[string, EsimEvent]> = [
      ['FETCH', FETCH_EVENT],
      ['SUCCESS', SUCCESS_EVENT],
      ['NOT_FOUND', NOT_FOUND_EVENT],
      ['ERROR', ERROR_EVENT],
      ['RETRY', RETRY_EVENT],
    ]

    const allStates: EsimState[] = [
      'UNRESOLVED',
      'FETCHING',
      'RESOLVED',
      'NOT_FOUND',
      'ERROR',
    ]

    const expectedTransitions: Record<string, EsimState> = {
      'UNRESOLVED+FETCH': 'FETCHING',
      'UNRESOLVED+SUCCESS': 'UNRESOLVED',
      'UNRESOLVED+NOT_FOUND': 'UNRESOLVED',
      'UNRESOLVED+ERROR': 'UNRESOLVED',
      'UNRESOLVED+RETRY': 'UNRESOLVED',
      'FETCHING+FETCH': 'FETCHING',
      'FETCHING+SUCCESS': 'RESOLVED',
      'FETCHING+NOT_FOUND': 'NOT_FOUND',
      'FETCHING+ERROR': 'ERROR',
      'FETCHING+RETRY': 'FETCHING',
      'RESOLVED+FETCH': 'RESOLVED',
      'RESOLVED+SUCCESS': 'RESOLVED',
      'RESOLVED+NOT_FOUND': 'RESOLVED',
      'RESOLVED+ERROR': 'RESOLVED',
      'RESOLVED+RETRY': 'RESOLVED',
      'NOT_FOUND+FETCH': 'NOT_FOUND',
      'NOT_FOUND+SUCCESS': 'NOT_FOUND',
      'NOT_FOUND+NOT_FOUND': 'NOT_FOUND',
      'NOT_FOUND+ERROR': 'NOT_FOUND',
      'NOT_FOUND+RETRY': 'FETCHING',
      'ERROR+FETCH': 'ERROR',
      'ERROR+SUCCESS': 'ERROR',
      'ERROR+NOT_FOUND': 'ERROR',
      'ERROR+ERROR': 'ERROR',
      'ERROR+RETRY': 'FETCHING',
    }

    for (const currentState of allStates) {
      for (const [eventName, event] of allEvents) {
        const key = `${currentState}+${eventName}`
        const expected = expectedTransitions[key]

        it(`${currentState} + ${eventName} → ${expected}`, () => {
          const ctx = { ...initialEsimCtx(), iccid: '890123' }
          const result = esimMachine(currentState, event, ctx)
          expect(result.state).toBe(expected)
        })
      }
    }
  })

  // ── Context invariants ──────────────────────────────────

  describe('context invariants', () => {
    it('RESOLVED always has non-null data', () => {
      const ctx = { ...initialEsimCtx(), iccid: '890123' }
      const result = esimMachine(
        'FETCHING',
        { type: 'SUCCESS', iccid: '890123', data: { lpa: 'test' } },
        ctx
      )
      expect(result.state).toBe('RESOLVED')
      expect(result.ctx.data).not.toBeNull()
    })

    it('RESOLVED has null error', () => {
      const ctx = { ...initialEsimCtx(), iccid: '890123', error: 'previous err' }
      const result = esimMachine(
        'FETCHING',
        { type: 'SUCCESS', iccid: '890123', data: { id: 1 } },
        ctx
      )
      expect(result.ctx.error).toBeNull()
    })

    it('NOT_FOUND always has non-null error', () => {
      const ctx = { ...initialEsimCtx(), iccid: '000' }
      const result = esimMachine('FETCHING', { type: 'NOT_FOUND', iccid: '000' }, ctx)
      expect(result.ctx.error).not.toBeNull()
      expect(result.ctx.error).toContain('not found')
    })

    it('ERROR always has non-null error', () => {
      const ctx = { ...initialEsimCtx(), iccid: '890123' }
      const result = esimMachine(
        'FETCHING',
        { type: 'ERROR', message: '500 Internal Server Error' },
        ctx
      )
      expect(result.ctx.error).toBe('500 Internal Server Error')
    })

    it('RETRY clears error in context', () => {
      const ctx = { ...initialEsimCtx(), iccid: '890123', error: 'timeout' }
      const result = esimMachine('ERROR', { type: 'RETRY' }, ctx)
      expect(result.ctx.error).toBeNull()
    })

    it('iccid is preserved across transitions', () => {
      let { state, ctx } = esimMachine(
        'UNRESOLVED',
        { type: 'FETCH', iccid: '890123' },
        initialEsimCtx()
      )
      expect(ctx.iccid).toBe('890123')
      ;({ state, ctx } = esimMachine(state, { type: 'ERROR', message: 'err' }, ctx))
      expect(ctx.iccid).toBe('890123')
      ;({ state, ctx } = esimMachine(state, { type: 'RETRY' }, ctx))
      expect(ctx.iccid).toBe('890123')
    })
  })
})
