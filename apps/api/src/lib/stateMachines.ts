/**
 * Domain state machine definitions for the Airalo order flow.
 *
 * Each machine is a pure function: (state, event, ctx) → { state, ctx }.
 * No I/O, no side-effects — safe to unit-test in isolation.
 *
 * State diagrams match docs/specs/design.md §3.1–§3.4
 */

// ── OAuth2 Token Machine (§3.1) ───────────────────────────────────────────────

export type TokenState = 'NO_TOKEN' | 'REQUESTING' | 'VALID_TOKEN' | 'EXPIRED' | 'FAILED'

export type TokenEvent =
  | { type: 'AUTHENTICATE'; clientId: string; clientSecret: string }
  | { type: 'SUCCESS'; accessToken: string; expiresIn: number }
  | { type: 'FAILURE'; error: string }
  | { type: 'TTL_EXPIRED' }
  | { type: 'RETRY' }

export type TokenContext = {
  accessToken: string | null
  expiresIn: number
  issuedAt: number
  error: string | null
  retryCount: number
}

export const MAX_TOKEN_RETRIES = 3

export const initialTokenCtx = (): TokenContext => ({
  accessToken: null,
  expiresIn: 0,
  issuedAt: 0,
  error: null,
  retryCount: 0,
})

export function tokenMachine(
  state: TokenState,
  event: TokenEvent,
  ctx: TokenContext
): { state: TokenState; ctx: TokenContext } {
  switch (state) {
    case 'NO_TOKEN':
      if (event.type === 'AUTHENTICATE') {
        if (!event.clientId || !event.clientSecret) {
          return { state: 'FAILED', ctx: { ...ctx, error: 'Missing credentials' } }
        }
        return { state: 'REQUESTING', ctx }
      }
      return { state, ctx }

    case 'REQUESTING':
      if (event.type === 'SUCCESS') {
        return {
          state: 'VALID_TOKEN',
          ctx: {
            ...ctx,
            accessToken: event.accessToken,
            expiresIn: event.expiresIn,
            issuedAt: Date.now(),
            error: null,
            retryCount: 0,
          },
        }
      }
      if (event.type === 'FAILURE') {
        return { state: 'FAILED', ctx: { ...ctx, error: event.error } }
      }
      return { state, ctx }

    case 'VALID_TOKEN':
      if (event.type === 'TTL_EXPIRED') {
        return { state: 'EXPIRED', ctx: { ...ctx, accessToken: null } }
      }
      return { state, ctx }

    case 'EXPIRED':
      if (event.type === 'AUTHENTICATE') {
        return { state: 'REQUESTING', ctx }
      }
      return { state, ctx }

    case 'FAILED':
      if (event.type === 'RETRY') {
        if (ctx.retryCount < MAX_TOKEN_RETRIES) {
          return { state: 'REQUESTING', ctx: { ...ctx, retryCount: ctx.retryCount + 1 } }
        }
        return { state: 'FAILED', ctx: { ...ctx, error: 'Max retries exceeded' } }
      }
      return { state, ctx }
  }
}

// ── Order Machine (§3.2) ──────────────────────────────────────────────────────

export type OrderState =
  | 'IDLE'
  | 'CREATING'
  | 'CREATED'
  | 'VALIDATION_FAILED'
  | 'AUTH_FAILED'
  | 'COMPLETE'

export type OrderEvent =
  | { type: 'SUBMIT_ORDER'; token: string; packageId: string; quantity: number }
  | { type: 'ORDER_SUCCESS'; orderId: number; simCount: number }
  | { type: 'VALIDATION_ERROR'; errors: Record<string, string[]> }
  | { type: 'AUTH_ERROR'; message: string }
  | { type: 'ALL_ESIMS_FETCHED' }
  | { type: 'RESET' }

export type OrderContext = {
  orderId: number | null
  simCount: number
  errors: Record<string, string[]> | null
  authError: string | null
}

export const initialOrderCtx = (): OrderContext => ({
  orderId: null,
  simCount: 0,
  errors: null,
  authError: null,
})

export function orderMachine(
  state: OrderState,
  event: OrderEvent,
  ctx: OrderContext
): { state: OrderState; ctx: OrderContext } {
  switch (state) {
    case 'IDLE':
      if (event.type === 'SUBMIT_ORDER') {
        if (!event.token)
          return { state: 'AUTH_FAILED', ctx: { ...ctx, authError: 'No token provided' } }
        if (!event.packageId || event.quantity <= 0) {
          return {
            state: 'VALIDATION_FAILED',
            ctx: { ...ctx, errors: { input: ['Invalid input'] } },
          }
        }
        return { state: 'CREATING', ctx }
      }
      return { state, ctx }

    case 'CREATING':
      if (event.type === 'ORDER_SUCCESS') {
        return {
          state: 'CREATED',
          ctx: {
            ...ctx,
            orderId: event.orderId,
            simCount: event.simCount,
            errors: null,
            authError: null,
          },
        }
      }
      if (event.type === 'VALIDATION_ERROR') {
        return { state: 'VALIDATION_FAILED', ctx: { ...ctx, errors: event.errors } }
      }
      if (event.type === 'AUTH_ERROR') {
        return { state: 'AUTH_FAILED', ctx: { ...ctx, authError: event.message } }
      }
      return { state, ctx }

    case 'CREATED':
      if (event.type === 'ALL_ESIMS_FETCHED') {
        return { state: 'COMPLETE', ctx }
      }
      return { state, ctx }

    case 'VALIDATION_FAILED':
    case 'AUTH_FAILED':
    case 'COMPLETE':
      if (event.type === 'RESET') {
        return { state: 'IDLE', ctx: initialOrderCtx() }
      }
      return { state, ctx }
  }
}

// ── eSIM Machine (§3.3) ───────────────────────────────────────────────────────

export type EsimState = 'UNRESOLVED' | 'FETCHING' | 'RESOLVED' | 'NOT_FOUND' | 'ERROR'

export type EsimEvent =
  | { type: 'FETCH'; iccid: string }
  | { type: 'SUCCESS'; iccid: string; data: Record<string, unknown> }
  | { type: 'NOT_FOUND'; iccid: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }

export type EsimContext = {
  iccid: string | null
  data: Record<string, unknown> | null
  error: string | null
}

export const initialEsimCtx = (): EsimContext => ({
  iccid: null,
  data: null,
  error: null,
})

export function esimMachine(
  state: EsimState,
  event: EsimEvent,
  ctx: EsimContext
): { state: EsimState; ctx: EsimContext } {
  switch (state) {
    case 'UNRESOLVED':
      if (event.type === 'FETCH') {
        if (!event.iccid) return { state: 'ERROR', ctx: { ...ctx, error: 'Empty iccid' } }
        return { state: 'FETCHING', ctx: { ...ctx, iccid: event.iccid } }
      }
      return { state, ctx }

    case 'FETCHING':
      if (event.type === 'SUCCESS') {
        return { state: 'RESOLVED', ctx: { ...ctx, data: event.data, error: null } }
      }
      if (event.type === 'NOT_FOUND') {
        return {
          state: 'NOT_FOUND',
          ctx: { ...ctx, error: `eSIM ${event.iccid} not found` },
        }
      }
      if (event.type === 'ERROR') {
        return { state: 'ERROR', ctx: { ...ctx, error: event.message } }
      }
      return { state, ctx }

    case 'RESOLVED':
      return { state, ctx }

    case 'NOT_FOUND':
      if (event.type === 'RETRY') {
        return { state: 'FETCHING', ctx: { ...ctx, error: null } }
      }
      return { state, ctx }

    case 'ERROR':
      if (event.type === 'RETRY') {
        return { state: 'FETCHING', ctx: { ...ctx, error: null } }
      }
      return { state, ctx }
  }
}

// ── Full Flow Machine (§3.4) ──────────────────────────────────────────────────

export type FlowState =
  | 'INIT'
  | 'AUTHENTICATED'
  | 'ORDER_SUBMITTED'
  | 'ESIMS_FETCHING'
  | 'COMPLETE'
  | 'FAILED'
  | 'RE_AUTH_REQUIRED'

export type FlowEvent =
  | { type: 'AUTHENTICATE_SUCCESS'; token: string }
  | { type: 'AUTH_FAILED'; error: string }
  | { type: 'SUBMIT_ORDER_SUCCESS'; orderId: number; simCount: number }
  | { type: 'ORDER_FAILED'; error: string }
  | { type: 'TOKEN_EXPIRED' }
  | { type: 'FETCH_ESIMS' }
  | { type: 'ALL_RESOLVED'; count: number }
  | { type: 'ANY_FAILED'; error: string }
  | { type: 'RE_AUTHENTICATED'; token: string }

export type FlowContext = {
  token: string | null
  orderId: number | null
  simCount: number
  resolvedCount: number
  error: string | null
}

export const initialFlowCtx = (): FlowContext => ({
  token: null,
  orderId: null,
  simCount: 0,
  resolvedCount: 0,
  error: null,
})

export function flowMachine(
  state: FlowState,
  event: FlowEvent,
  ctx: FlowContext
): { state: FlowState; ctx: FlowContext } {
  switch (state) {
    case 'INIT':
      if (event.type === 'AUTHENTICATE_SUCCESS') {
        return {
          state: 'AUTHENTICATED',
          ctx: { ...ctx, token: event.token, error: null },
        }
      }
      if (event.type === 'AUTH_FAILED') {
        return { state: 'FAILED', ctx: { ...ctx, error: event.error } }
      }
      return { state, ctx }

    case 'AUTHENTICATED':
      if (event.type === 'SUBMIT_ORDER_SUCCESS') {
        return {
          state: 'ORDER_SUBMITTED',
          ctx: { ...ctx, orderId: event.orderId, simCount: event.simCount },
        }
      }
      if (event.type === 'ORDER_FAILED') {
        return { state: 'FAILED', ctx: { ...ctx, error: event.error } }
      }
      if (event.type === 'TOKEN_EXPIRED') {
        return { state: 'RE_AUTH_REQUIRED', ctx: { ...ctx, token: null } }
      }
      return { state, ctx }

    case 'RE_AUTH_REQUIRED':
      if (event.type === 'RE_AUTHENTICATED') {
        return { state: 'AUTHENTICATED', ctx: { ...ctx, token: event.token } }
      }
      if (event.type === 'AUTH_FAILED') {
        return { state: 'FAILED', ctx: { ...ctx, error: event.error } }
      }
      return { state, ctx }

    case 'ORDER_SUBMITTED':
      if (event.type === 'FETCH_ESIMS') {
        return { state: 'ESIMS_FETCHING', ctx }
      }
      return { state, ctx }

    case 'ESIMS_FETCHING':
      if (event.type === 'ALL_RESOLVED') {
        return { state: 'COMPLETE', ctx: { ...ctx, resolvedCount: event.count } }
      }
      if (event.type === 'ANY_FAILED') {
        return { state: 'FAILED', ctx: { ...ctx, error: event.error } }
      }
      return { state, ctx }

    case 'COMPLETE':
    case 'FAILED':
      return { state, ctx }
  }
}
