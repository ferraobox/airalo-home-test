import { orderMachine, initialOrderCtx } from '../../src/lib/stateMachines'
import type { OrderState, OrderEvent } from '../../src/lib/stateMachines'

describe('Order Lifecycle State Machine', () => {
  describe('IDLE → CREATING', () => {
    it('transitions to CREATING with valid input', () => {
      const result = orderMachine(
        'IDLE',
        {
          type: 'SUBMIT_ORDER',
          token: 'tok',
          packageId: 'moshi-moshi-7days-1gb',
          quantity: 6,
        },
        initialOrderCtx()
      )
      expect(result.state).toBe('CREATING')
    })

    it('transitions to AUTH_FAILED when token is empty', () => {
      const result = orderMachine(
        'IDLE',
        { type: 'SUBMIT_ORDER', token: '', packageId: 'pkg', quantity: 6 },
        initialOrderCtx()
      )
      expect(result.state).toBe('AUTH_FAILED')
      expect(result.ctx.authError).toBe('No token provided')
    })

    it('transitions to VALIDATION_FAILED when packageId is empty', () => {
      const result = orderMachine(
        'IDLE',
        { type: 'SUBMIT_ORDER', token: 'tok', packageId: '', quantity: 6 },
        initialOrderCtx()
      )
      expect(result.state).toBe('VALIDATION_FAILED')
    })

    it('transitions to VALIDATION_FAILED when quantity <= 0', () => {
      const result = orderMachine(
        'IDLE',
        { type: 'SUBMIT_ORDER', token: 'tok', packageId: 'pkg', quantity: 0 },
        initialOrderCtx()
      )
      expect(result.state).toBe('VALIDATION_FAILED')
    })

    it('transitions to VALIDATION_FAILED when quantity is negative', () => {
      const result = orderMachine(
        'IDLE',
        { type: 'SUBMIT_ORDER', token: 'tok', packageId: 'pkg', quantity: -1 },
        initialOrderCtx()
      )
      expect(result.state).toBe('VALIDATION_FAILED')
    })
  })

  describe('CREATING → CREATED', () => {
    it('transitions to CREATED on success', () => {
      const result = orderMachine(
        'CREATING',
        { type: 'ORDER_SUCCESS', orderId: 9666, simCount: 6 },
        initialOrderCtx()
      )
      expect(result.state).toBe('CREATED')
      expect(result.ctx.orderId).toBe(9666)
      expect(result.ctx.simCount).toBe(6)
    })
  })

  describe('CREATING → VALIDATION_FAILED', () => {
    it('transitions to VALIDATION_FAILED on 422', () => {
      const errors = { package_id: ['The package id field is required.'] }
      const result = orderMachine(
        'CREATING',
        { type: 'VALIDATION_ERROR', errors },
        initialOrderCtx()
      )
      expect(result.state).toBe('VALIDATION_FAILED')
      expect(result.ctx.errors).toStrictEqual(errors)
    })
  })

  describe('CREATING → AUTH_FAILED', () => {
    it('transitions to AUTH_FAILED on 401', () => {
      const result = orderMachine(
        'CREATING',
        { type: 'AUTH_ERROR', message: 'Unauthenticated' },
        initialOrderCtx()
      )
      expect(result.state).toBe('AUTH_FAILED')
      expect(result.ctx.authError).toBe('Unauthenticated')
    })
  })

  describe('CREATED → COMPLETE', () => {
    it('transitions to COMPLETE when all eSIMs fetched', () => {
      const ctx = { ...initialOrderCtx(), orderId: 9666, simCount: 6 }
      const result = orderMachine('CREATED', { type: 'ALL_ESIMS_FETCHED' }, ctx)
      expect(result.state).toBe('COMPLETE')
    })
  })

  describe('Terminal states support RESET', () => {
    it.each<OrderState>(['VALIDATION_FAILED', 'AUTH_FAILED', 'COMPLETE'])(
      '%s resets to IDLE',
      (terminal) => {
        const result = orderMachine(terminal, { type: 'RESET' }, initialOrderCtx())
        expect(result.state).toBe('IDLE')
      }
    )
  })

  describe('Full order lifecycle', () => {
    it('IDLE → CREATING → CREATED → COMPLETE', () => {
      let { state, ctx } = orderMachine(
        'IDLE',
        {
          type: 'SUBMIT_ORDER',
          token: 'tok',
          packageId: 'moshi-moshi-7days-1gb',
          quantity: 6,
        },
        initialOrderCtx()
      )
      expect(state).toBe('CREATING')
      ;({ state, ctx } = orderMachine(
        state,
        { type: 'ORDER_SUCCESS', orderId: 9666, simCount: 6 },
        ctx
      ))
      expect(state).toBe('CREATED')
      expect(ctx.orderId).toBe(9666)
      ;({ state, ctx } = orderMachine(state, { type: 'ALL_ESIMS_FETCHED' }, ctx))
      expect(state).toBe('COMPLETE')
    })

    it('IDLE → CREATING → VALIDATION_FAILED → RESET → IDLE', () => {
      let { state, ctx } = orderMachine(
        'IDLE',
        { type: 'SUBMIT_ORDER', token: 'tok', packageId: 'pkg', quantity: 6 },
        initialOrderCtx()
      )
      ;({ state, ctx } = orderMachine(
        state,
        { type: 'VALIDATION_ERROR', errors: { package_id: ['bad'] } },
        ctx
      ))
      expect(state).toBe('VALIDATION_FAILED')
      ;({ state, ctx } = orderMachine(state, { type: 'RESET' }, ctx))
      expect(state).toBe('IDLE')
      expect(ctx.orderId).toBeNull()
    })
  })

  // ── Exhaustive state × event transition matrix ──────────

  describe('exhaustive state × event transition matrix', () => {
    const SUBMIT_EVENT: OrderEvent = {
      type: 'SUBMIT_ORDER',
      token: 'tok',
      packageId: 'pkg',
      quantity: 6,
    }
    const SUCCESS_EVENT: OrderEvent = {
      type: 'ORDER_SUCCESS',
      orderId: 9666,
      simCount: 6,
    }
    const VAL_ERROR_EVENT: OrderEvent = {
      type: 'VALIDATION_ERROR',
      errors: { pkg: ['bad'] },
    }
    const AUTH_ERROR_EVENT: OrderEvent = { type: 'AUTH_ERROR', message: 'Unauth' }
    const FETCHED_EVENT: OrderEvent = { type: 'ALL_ESIMS_FETCHED' }
    const RESET_EVENT: OrderEvent = { type: 'RESET' }

    const allEvents: Array<[string, OrderEvent]> = [
      ['SUBMIT_ORDER', SUBMIT_EVENT],
      ['ORDER_SUCCESS', SUCCESS_EVENT],
      ['VALIDATION_ERROR', VAL_ERROR_EVENT],
      ['AUTH_ERROR', AUTH_ERROR_EVENT],
      ['ALL_ESIMS_FETCHED', FETCHED_EVENT],
      ['RESET', RESET_EVENT],
    ]

    const allStates: OrderState[] = [
      'IDLE',
      'CREATING',
      'CREATED',
      'VALIDATION_FAILED',
      'AUTH_FAILED',
      'COMPLETE',
    ]

    const expectedTransitions: Record<string, OrderState> = {
      'IDLE+SUBMIT_ORDER': 'CREATING',
      'IDLE+ORDER_SUCCESS': 'IDLE',
      'IDLE+VALIDATION_ERROR': 'IDLE',
      'IDLE+AUTH_ERROR': 'IDLE',
      'IDLE+ALL_ESIMS_FETCHED': 'IDLE',
      'IDLE+RESET': 'IDLE',
      'CREATING+SUBMIT_ORDER': 'CREATING',
      'CREATING+ORDER_SUCCESS': 'CREATED',
      'CREATING+VALIDATION_ERROR': 'VALIDATION_FAILED',
      'CREATING+AUTH_ERROR': 'AUTH_FAILED',
      'CREATING+ALL_ESIMS_FETCHED': 'CREATING',
      'CREATING+RESET': 'CREATING',
      'CREATED+SUBMIT_ORDER': 'CREATED',
      'CREATED+ORDER_SUCCESS': 'CREATED',
      'CREATED+VALIDATION_ERROR': 'CREATED',
      'CREATED+AUTH_ERROR': 'CREATED',
      'CREATED+ALL_ESIMS_FETCHED': 'COMPLETE',
      'CREATED+RESET': 'CREATED',
      'VALIDATION_FAILED+SUBMIT_ORDER': 'VALIDATION_FAILED',
      'VALIDATION_FAILED+ORDER_SUCCESS': 'VALIDATION_FAILED',
      'VALIDATION_FAILED+VALIDATION_ERROR': 'VALIDATION_FAILED',
      'VALIDATION_FAILED+AUTH_ERROR': 'VALIDATION_FAILED',
      'VALIDATION_FAILED+ALL_ESIMS_FETCHED': 'VALIDATION_FAILED',
      'VALIDATION_FAILED+RESET': 'IDLE',
      'AUTH_FAILED+SUBMIT_ORDER': 'AUTH_FAILED',
      'AUTH_FAILED+ORDER_SUCCESS': 'AUTH_FAILED',
      'AUTH_FAILED+VALIDATION_ERROR': 'AUTH_FAILED',
      'AUTH_FAILED+AUTH_ERROR': 'AUTH_FAILED',
      'AUTH_FAILED+ALL_ESIMS_FETCHED': 'AUTH_FAILED',
      'AUTH_FAILED+RESET': 'IDLE',
      'COMPLETE+SUBMIT_ORDER': 'COMPLETE',
      'COMPLETE+ORDER_SUCCESS': 'COMPLETE',
      'COMPLETE+VALIDATION_ERROR': 'COMPLETE',
      'COMPLETE+AUTH_ERROR': 'COMPLETE',
      'COMPLETE+ALL_ESIMS_FETCHED': 'COMPLETE',
      'COMPLETE+RESET': 'IDLE',
    }

    for (const currentState of allStates) {
      for (const [eventName, event] of allEvents) {
        const key = `${currentState}+${eventName}`
        const expected = expectedTransitions[key]

        it(`${currentState} + ${eventName} → ${expected}`, () => {
          const result = orderMachine(currentState, event, initialOrderCtx())
          expect(result.state).toBe(expected)
        })
      }
    }
  })

  // ── Context invariants ──────────────────────────────────

  describe('context invariants', () => {
    it('CREATED always has non-null orderId', () => {
      const result = orderMachine(
        'CREATING',
        { type: 'ORDER_SUCCESS', orderId: 9666, simCount: 6 },
        initialOrderCtx()
      )
      expect(result.state).toBe('CREATED')
      expect(result.ctx.orderId).not.toBeNull()
    })

    it('CREATED clears errors on success', () => {
      const ctx = { ...initialOrderCtx(), errors: { pkg: ['bad'] } }
      const result = orderMachine(
        'CREATING',
        { type: 'ORDER_SUCCESS', orderId: 9666, simCount: 6 },
        ctx
      )
      expect(result.ctx.errors).toBeNull()
      expect(result.ctx.authError).toBeNull()
    })

    it('VALIDATION_FAILED always has non-null errors', () => {
      const result = orderMachine(
        'CREATING',
        { type: 'VALIDATION_ERROR', errors: { qty: ['bad'] } },
        initialOrderCtx()
      )
      expect(result.ctx.errors).not.toBeNull()
    })

    it('AUTH_FAILED always has non-null authError', () => {
      const result = orderMachine(
        'CREATING',
        { type: 'AUTH_ERROR', message: 'Unauthenticated' },
        initialOrderCtx()
      )
      expect(result.ctx.authError).not.toBeNull()
    })

    it('RESET clears all context', () => {
      const ctx = {
        orderId: 9666,
        simCount: 6,
        errors: { pkg: ['bad'] },
        authError: 'err',
      }
      const result = orderMachine('COMPLETE', { type: 'RESET' }, ctx)
      expect(result.ctx).toStrictEqual(initialOrderCtx())
    })
  })
})
