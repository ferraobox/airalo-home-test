// ── Services ─────────────────────────────────────────────────
export { createAiraloService } from './services/airaloService'
export type { IAiraloService } from './services/airaloService'
export { createAuthService } from './services/authService'
export type { IAuthService } from './services/authService'
export { createOrderService } from './services/orderService'
export type { IOrderService, OrderInput } from './services/orderService'
export { createEsimService } from './services/esimService'
export type { IEsimService } from './services/esimService'
export { createHttpClient } from './lib/httpClient'

// ── Orchestration ────────────────────────────────────────────
export { runAiraloOrderFlow } from './services/flowService'
export type { AiraloFlowService, AiraloFlowResult } from './services/flowService'

// ── Types ────────────────────────────────────────────────────
export type { AiraloOrderResult, AiraloEsimResult } from './types/airalo'
export type { MutableFixture, MutableErrorFixture } from './types/fixture'

// ── Config ───────────────────────────────────────────────────
export { loadApiEnv } from './config/env'

// ── Lib ──────────────────────────────────────────────────────
export { fixture } from './lib/fixture'
export { retryOnTransient, isTransient } from './lib/retry'
export {
  tokenMachine,
  initialTokenCtx,
  MAX_TOKEN_RETRIES,
  orderMachine,
  initialOrderCtx,
  esimMachine,
  initialEsimCtx,
  flowMachine,
  initialFlowCtx,
} from './lib/stateMachines'
export type {
  TokenState,
  TokenEvent,
  TokenContext,
  OrderState,
  OrderEvent,
  OrderContext,
  EsimState,
  EsimEvent,
  EsimContext,
  FlowState,
  FlowEvent,
  FlowContext,
} from './lib/stateMachines'
