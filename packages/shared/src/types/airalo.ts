import type { z } from 'zod'
import type {
  airaloTokenResponseSchema,
  airaloOrderResponseSchema,
  airaloEsimResponseSchema,
  airaloSimSchema,
} from '../schemas/airalo-api'

export type AiraloOrderInput = {
  packageId: string
  quantity: number
  description?: string
}

export type AiraloTokenResponse = z.infer<typeof airaloTokenResponseSchema>
export type AiraloOrderResponse = z.infer<typeof airaloOrderResponseSchema>
export type AiraloEsimResponse = z.infer<typeof airaloEsimResponseSchema>
export type AiraloSim = z.infer<typeof airaloSimSchema>
