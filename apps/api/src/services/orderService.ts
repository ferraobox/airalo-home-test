import type { AxiosInstance } from 'axios'
import { airaloOrderResponseSchema } from '@airalo/shared'
import type { AiraloOrderResult } from '../types/airalo'

export interface OrderInput {
  packageId: string
  quantity: number
  description?: string
}

/**
 * Handles order submission against POST /orders.
 * Validates the response with Zod and maps it to a domain result.
 */
export interface IOrderService {
  submit(token: string, input: OrderInput): Promise<AiraloOrderResult>
}

export function createOrderService(http: AxiosInstance): IOrderService {
  return {
    async submit(token, input) {
      const form = new FormData()
      form.append('package_id', input.packageId)
      form.append('quantity', String(input.quantity))
      if (input.description) form.append('description', input.description)
      const { data } = await http.post<unknown>('/orders', form, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const parsed = airaloOrderResponseSchema.parse(data)
      return {
        orderId: parsed.data.id,
        message: parsed.meta.message,
        sims: parsed.data.sims.map((s) => ({ iccid: s.iccid, id: s.id })),
        raw: parsed.data,
      }
    },
  }
}
