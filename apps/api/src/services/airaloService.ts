import { loadApiEnv } from '../config/env'
import { createHttpClient } from '../lib/httpClient'
import { createAuthService } from './authService'
import { createOrderService, type OrderInput } from './orderService'
import { createEsimService } from './esimService'
import type { AiraloFlowService } from './flowService'
import type { AiraloOrderResult, AiraloEsimResult } from '../types/airalo'

/** Public interface for the composite Airalo service. */
export interface IAiraloService extends AiraloFlowService {
  invalidateToken(): void
}

/**
 * Composite service that wires together AuthService, OrderService, and
 * EsimService and manages an in-process token cache.
 *
 * Implements AiraloFlowService so it can be passed directly to runAiraloOrderFlow.
 *
 * @param overrides - Optional partial config to override loaded env values.
 */
export function createAiraloService(
  overrides?: Partial<ReturnType<typeof loadApiEnv>>
): IAiraloService {
  const env = { ...loadApiEnv(), ...overrides }
  const http = createHttpClient(env.baseUrl)
  const auth = createAuthService(http)
  const orders = createOrderService(http)
  const esims = createEsimService(http)
  let cachedToken: string | null = null

  async function ensureToken(): Promise<string> {
    if (!cachedToken) {
      cachedToken = await auth.getToken(env.clientId, env.clientSecret)
    }
    return cachedToken
  }

  return {
    async createOrder(input: OrderInput): Promise<AiraloOrderResult> {
      const token = await ensureToken()
      return orders.submit(token, input)
    },

    async fetchEsim(iccid: string): Promise<AiraloEsimResult> {
      const token = await ensureToken()
      return esims.get(token, iccid)
    },

    invalidateToken() {
      cachedToken = null
    },
  }
}
