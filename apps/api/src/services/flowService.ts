import type { AiraloOrderResult, AiraloEsimResult } from '../types/airalo'

/**
 * Service interface for the order+eSIM orchestration flow.
 * Depends on an abstraction, not a concrete HTTP implementation (DIP).
 */
export interface AiraloFlowService {
  createOrder(input: { packageId: string; quantity: number }): Promise<AiraloOrderResult>
  fetchEsim(iccid: string): Promise<AiraloEsimResult>
}

export interface AiraloFlowResult {
  order: AiraloOrderResult
  esimDetails: AiraloEsimResult[]
}

/**
 * Orchestrate the complete Airalo order flow:
 *   1. Submit an order for the given package + quantity.
 *   2. Concurrently fetch eSIM details for every SIM in the order.
 *
 * eSIM fetches run in parallel via Promise.all — order is preserved,
 * and a single failure fast-fails the whole batch.
 */
export async function runAiraloOrderFlow(
  input: { packageId: string; quantity: number },
  service: AiraloFlowService
): Promise<AiraloFlowResult> {
  const order = await service.createOrder(input)
  const esimDetails = await Promise.all(
    order.sims.map(({ iccid }) => service.fetchEsim(iccid))
  )
  return { order, esimDetails }
}
