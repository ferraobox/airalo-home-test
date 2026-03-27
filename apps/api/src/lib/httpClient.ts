import axios, { type AxiosInstance } from 'axios'

/** Create a pre-configured Axios instance for the Airalo Partner API. */
export function createHttpClient(baseUrl: string, timeoutMs = 30_000): AxiosInstance {
  return axios.create({ baseURL: baseUrl, timeout: timeoutMs })
}
