import type { z } from 'zod'
import type {
  airaloOrderResponseSchema,
  airaloEsimResponseSchema,
  airaloSimSchema,
} from '../schemas/airalo-api'

export type AiraloOrderResponse = z.infer<typeof airaloOrderResponseSchema>
export type AiraloEsimResponse = z.infer<typeof airaloEsimResponseSchema>
export type AiraloSim = z.infer<typeof airaloSimSchema>
