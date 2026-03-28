import type { AiraloOrderResult, AiraloEsimResult } from '../types/airalo'
import { AxiosError, type AxiosResponse } from 'axios'

// ── Type helpers ────────────────────────────────────────────

/** AxiosError guaranteed to have an HTTP response (i.e. server replied). */
export type AxiosErrorWithResponse = AxiosError & { response: AxiosResponse }

// ── Order / eSIM result builders ────────────────────────────
export const buildOrderResult = (simCount: number): AiraloOrderResult => ({
  orderId: 9666,
  message: 'success',
  sims: Array.from({ length: simCount }, (_, i) => ({
    iccid: `890123456789000000${i + 1}`,
    id: 11001 + i,
  })),
  raw: {} as AiraloOrderResult['raw'],
})

export const buildEsimResult = (iccid: string): AiraloEsimResult => ({
  iccid,
  message: 'success',
  raw: {} as AiraloEsimResult['raw'],
})

// ── HTTP / Axios error builders ─────────────────────────────

/** Simulate an AxiosError with HTTP status and response body. */
export const buildAxiosError = (
  status: number,
  statusText: string,
  data: unknown = {},
  headers: Record<string, string> = {}
): AxiosErrorWithResponse => {
  const response = {
    status,
    statusText,
    data,
    headers,
    config: { headers: {} },
  } as AxiosResponse
  const err = new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    response
  )
  return err as AxiosErrorWithResponse
}

/** Simulate a network-level error (no HTTP response — e.g. ECONNREFUSED, ETIMEDOUT). */
export const buildNetworkError = (code: string, message: string): AxiosError =>
  new AxiosError(message, code)
