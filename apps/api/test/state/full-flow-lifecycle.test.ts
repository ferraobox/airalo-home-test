import { flowMachine, initialFlowCtx } from '../../src/lib/stateMachines'

describe('Full Flow State Machine', () => {
  describe('INIT → AUTHENTICATED', () => {
    it('transitions on successful authentication', () => {
      const result = flowMachine(
        'INIT',
        { type: 'AUTHENTICATE_SUCCESS', token: 'tok123' },
        initialFlowCtx()
      )
      expect(result.state).toBe('AUTHENTICATED')
      expect(result.ctx.token).toBe('tok123')
    })
  })

  describe('INIT → FAILED', () => {
    it('transitions on auth failure', () => {
      const result = flowMachine(
        'INIT',
        { type: 'AUTH_FAILED', error: 'Invalid credentials' },
        initialFlowCtx()
      )
      expect(result.state).toBe('FAILED')
      expect(result.ctx.error).toBe('Invalid credentials')
    })
  })

  describe('AUTHENTICATED → ORDER_SUBMITTED', () => {
    it('transitions on successful order', () => {
      const ctx = { ...initialFlowCtx(), token: 'tok' }
      const result = flowMachine(
        'AUTHENTICATED',
        { type: 'SUBMIT_ORDER_SUCCESS', orderId: 9666, simCount: 6 },
        ctx
      )
      expect(result.state).toBe('ORDER_SUBMITTED')
      expect(result.ctx.orderId).toBe(9666)
      expect(result.ctx.simCount).toBe(6)
    })
  })

  describe('AUTHENTICATED → FAILED', () => {
    it('transitions on order failure', () => {
      const ctx = { ...initialFlowCtx(), token: 'tok' }
      const result = flowMachine(
        'AUTHENTICATED',
        { type: 'ORDER_FAILED', error: '422 Validation' },
        ctx
      )
      expect(result.state).toBe('FAILED')
    })
  })

  describe('AUTHENTICATED → RE_AUTH_REQUIRED', () => {
    it('transitions when token expires', () => {
      const ctx = { ...initialFlowCtx(), token: 'tok' }
      const result = flowMachine('AUTHENTICATED', { type: 'TOKEN_EXPIRED' }, ctx)
      expect(result.state).toBe('RE_AUTH_REQUIRED')
      expect(result.ctx.token).toBeNull()
    })
  })

  describe('RE_AUTH_REQUIRED → AUTHENTICATED', () => {
    it('transitions on re-authentication', () => {
      const ctx = { ...initialFlowCtx(), token: null }
      const result = flowMachine(
        'RE_AUTH_REQUIRED',
        { type: 'RE_AUTHENTICATED', token: 'newtok' },
        ctx
      )
      expect(result.state).toBe('AUTHENTICATED')
      expect(result.ctx.token).toBe('newtok')
    })
  })

  describe('RE_AUTH_REQUIRED → FAILED', () => {
    it('transitions on re-auth failure', () => {
      const result = flowMachine(
        'RE_AUTH_REQUIRED',
        { type: 'AUTH_FAILED', error: 'still bad' },
        initialFlowCtx()
      )
      expect(result.state).toBe('FAILED')
    })
  })

  describe('ORDER_SUBMITTED → ESIMS_FETCHING', () => {
    it('transitions on fetch start', () => {
      const ctx = { ...initialFlowCtx(), orderId: 9666, simCount: 6 }
      const result = flowMachine('ORDER_SUBMITTED', { type: 'FETCH_ESIMS' }, ctx)
      expect(result.state).toBe('ESIMS_FETCHING')
    })
  })

  describe('ESIMS_FETCHING → COMPLETE', () => {
    it('transitions when all eSIMs resolved', () => {
      const ctx = { ...initialFlowCtx(), orderId: 9666, simCount: 6 }
      const result = flowMachine(
        'ESIMS_FETCHING',
        { type: 'ALL_RESOLVED', count: 6 },
        ctx
      )
      expect(result.state).toBe('COMPLETE')
      expect(result.ctx.resolvedCount).toBe(6)
    })
  })

  describe('ESIMS_FETCHING → FAILED', () => {
    it('transitions when any eSIM fetch fails', () => {
      const ctx = { ...initialFlowCtx(), orderId: 9666, simCount: 6 }
      const result = flowMachine(
        'ESIMS_FETCHING',
        { type: 'ANY_FAILED', error: 'SIM 3 not found' },
        ctx
      )
      expect(result.state).toBe('FAILED')
      expect(result.ctx.error).toBe('SIM 3 not found')
    })
  })

  describe('Terminal states', () => {
    it('COMPLETE does not transition', () => {
      const ctx = { ...initialFlowCtx(), resolvedCount: 6 }
      const result = flowMachine('COMPLETE', { type: 'FETCH_ESIMS' }, ctx)
      expect(result.state).toBe('COMPLETE')
    })

    it('FAILED does not transition', () => {
      const ctx = { ...initialFlowCtx(), error: 'bad' }
      const result = flowMachine(
        'FAILED',
        { type: 'AUTHENTICATE_SUCCESS', token: 'tok' },
        ctx
      )
      expect(result.state).toBe('FAILED')
    })
  })

  describe('Full happy-path lifecycle', () => {
    it('INIT → AUTHENTICATED → ORDER_SUBMITTED → ESIMS_FETCHING → COMPLETE', () => {
      let { state, ctx } = flowMachine(
        'INIT',
        { type: 'AUTHENTICATE_SUCCESS', token: 'tok' },
        initialFlowCtx()
      )
      expect(state).toBe('AUTHENTICATED')
      ;({ state, ctx } = flowMachine(
        state,
        { type: 'SUBMIT_ORDER_SUCCESS', orderId: 9666, simCount: 6 },
        ctx
      ))
      expect(state).toBe('ORDER_SUBMITTED')
      ;({ state, ctx } = flowMachine(state, { type: 'FETCH_ESIMS' }, ctx))
      expect(state).toBe('ESIMS_FETCHING')
      ;({ state, ctx } = flowMachine(state, { type: 'ALL_RESOLVED', count: 6 }, ctx))
      expect(state).toBe('COMPLETE')
      expect(ctx.resolvedCount).toBe(6)
    })
  })

  describe('Token expiry during flow', () => {
    it('AUTHENTICATED → RE_AUTH → AUTHENTICATED → ORDER_SUBMITTED → COMPLETE', () => {
      let { state, ctx } = flowMachine(
        'INIT',
        { type: 'AUTHENTICATE_SUCCESS', token: 'tok1' },
        initialFlowCtx()
      )
      ;({ state, ctx } = flowMachine(state, { type: 'TOKEN_EXPIRED' }, ctx))
      expect(state).toBe('RE_AUTH_REQUIRED')
      ;({ state, ctx } = flowMachine(
        state,
        { type: 'RE_AUTHENTICATED', token: 'tok2' },
        ctx
      ))
      expect(state).toBe('AUTHENTICATED')
      ;({ state, ctx } = flowMachine(
        state,
        { type: 'SUBMIT_ORDER_SUCCESS', orderId: 1, simCount: 1 },
        ctx
      ))
      ;({ state, ctx } = flowMachine(state, { type: 'FETCH_ESIMS' }, ctx))
      ;({ state, ctx } = flowMachine(state, { type: 'ALL_RESOLVED', count: 1 }, ctx))
      expect(state).toBe('COMPLETE')
    })
  })
})
