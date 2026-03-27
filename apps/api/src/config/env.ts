import { config } from 'dotenv'
import { AIRALO_BASE_URL } from '@airalo/shared'

config({ path: ['.env', '../../.env'] })

export const loadApiEnv = () => ({
  clientId: process.env.AIRALO_CLIENT_ID ?? '',
  clientSecret: process.env.AIRALO_CLIENT_SECRET ?? '',
  baseUrl: process.env.AIRALO_BASE_URL ?? AIRALO_BASE_URL,
})
