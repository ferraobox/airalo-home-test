import type { AxiosInstance } from 'axios'
import { airaloTokenResponseSchema } from '@airalo/shared'

/**
 * Handles OAuth2 client-credentials authentication against POST /token.
 * Each call always fetches a fresh token — caching belongs in the
 * composite AiraloService layer.
 */
export interface IAuthService {
  getToken(clientId: string, clientSecret: string): Promise<string>
}

export function createAuthService(http: AxiosInstance): IAuthService {
  return {
    async getToken(clientId, clientSecret) {
      const form = new FormData()
      form.append('client_id', clientId)
      form.append('client_secret', clientSecret)
      form.append('grant_type', 'client_credentials')
      const { data } = await http.post<unknown>('/token', form)
      const parsed = airaloTokenResponseSchema.parse(data)
      return parsed.data.access_token
    },
  }
}
