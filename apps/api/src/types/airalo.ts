import type { AiraloOrderResponse, AiraloEsimResponse, AiraloSim } from '@airalo/shared'

export interface AiraloOrderResult {
  orderId: number
  message: string
  sims: Array<Pick<AiraloSim, 'iccid' | 'id'>>
  raw: AiraloOrderResponse['data']
}

export interface AiraloEsimResult {
  iccid: string
  message: string
  raw: AiraloEsimResponse['data']
}
