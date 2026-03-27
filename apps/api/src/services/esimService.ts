import type { AxiosInstance } from 'axios'
import { airaloEsimResponseSchema } from '@airalo/shared'
import type { AiraloEsimResult } from '../types/airalo'

/**
 * Handles eSIM detail retrieval against GET /sims/{iccid}.
 * Validates the response with Zod and maps it to a domain result.
 */
export interface IEsimService {
  get(token: string, iccid: string): Promise<AiraloEsimResult>
}

export function createEsimService(http: AxiosInstance): IEsimService {
  return {
    async get(token, iccid) {
      const { data } = await http.get<unknown>(`/sims/${iccid}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const parsed = airaloEsimResponseSchema.parse(data)
      return {
        iccid: parsed.data.iccid,
        message: parsed.meta.message,
        raw: parsed.data,
      }
    },
  }
}
