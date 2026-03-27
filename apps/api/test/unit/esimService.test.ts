/**
 * Unit tests for createEsimService — GET /sims/{iccid}
 *
 * Tests: happy path, URL construction, auth header, Zod validation,
 * HTTP error propagation (EC-A3), and edge-case iccid values.
 * All network I/O is mocked via a fake AxiosInstance.
 */
import { jest } from '@jest/globals'
import type { AxiosInstance } from 'axios'
import { createEsimService } from '../../src/services/esimService'
import { fixture } from '../../src/lib/fixture'
import { buildAxiosError } from '../helpers/factory'

// ── Mock HTTP factory ───────────────────────────────────────

function mockHttpGet(data: unknown) {
  return {
    get: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data }),
  } as unknown as AxiosInstance
}

function mockHttpGetReject(err: unknown) {
  return {
    get: jest.fn<() => Promise<never>>().mockRejectedValue(err),
  } as unknown as AxiosInstance
}

const TOKEN = 'test-bearer-token'
const ICCID = '8901234567890000001'

// ── Tests ───────────────────────────────────────────────────

describe('createEsimService — get', () => {
  describe('happy path', () => {
    it('returns iccid from response', async () => {
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      const result = await svc.get(TOKEN, ICCID)

      expect(result.iccid).toBe(ICCID)
    })

    it('returns message from meta', async () => {
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      const result = await svc.get(TOKEN, ICCID)

      expect(result.message).toMatch(/success/i)
    })

    it('attaches raw eSIM data', async () => {
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      const result = await svc.get(TOKEN, ICCID)

      expect(result.raw.lpa).toBeTruthy()
      expect(result.raw.qrcode).toBeTruthy()
      expect(typeof result.raw.is_roaming).toBe('boolean')
    })

    it('attaches simable reference to parent order', async () => {
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      const result = await svc.get(TOKEN, ICCID)

      expect(result.raw.simable).toBeDefined()
      expect(result.raw.simable?.package_id).toBe('moshi-moshi-7days-1gb')
    })
  })

  describe('URL construction', () => {
    it('sends GET to /sims/{iccid}', async () => {
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      await svc.get(TOKEN, ICCID)

      const [url] = (http.get as jest.Mock).mock.calls[0] as [string, unknown]
      expect(url).toBe(`/sims/${ICCID}`)
    })

    it('interpolates iccid into the URL path', async () => {
      const iccid = '8901999000000456789'
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      await svc.get(TOKEN, iccid)

      const [url] = (http.get as jest.Mock).mock.calls[0] as [string, unknown]
      expect(url).toBe(`/sims/${iccid}`)
    })

    it('sends Authorization: Bearer token header', async () => {
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      await svc.get('my-access-token', ICCID)

      const [, opts] = (http.get as jest.Mock).mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ]
      expect(opts.headers['Authorization']).toBe('Bearer my-access-token')
    })
  })

  describe('Zod response validation', () => {
    it('throws when iccid is missing from response', async () => {
      const bad = fixture('esim-response.json')
      delete bad.data.iccid
      const http = mockHttpGet(bad)
      const svc = createEsimService(http)

      await expect(svc.get(TOKEN, ICCID)).rejects.toThrow()
    })

    it('throws when response is completely wrong shape', async () => {
      const http = mockHttpGet({ status: 'error' })
      const svc = createEsimService(http)

      await expect(svc.get(TOKEN, ICCID)).rejects.toThrow()
    })

    it('throws when id field is not a number', async () => {
      const bad = fixture('esim-response.json')
      bad.data.id = 'not-a-number'
      const http = mockHttpGet(bad)
      const svc = createEsimService(http)

      await expect(svc.get(TOKEN, ICCID)).rejects.toThrow()
    })
  })

  describe('HTTP error propagation — EC-A3', () => {
    it('propagates 404 for invalid iccid', async () => {
      const err = buildAxiosError(404, 'Not Found', {
        data: { message: 'Resource not found.' },
      })
      const http = mockHttpGetReject(err)
      const svc = createEsimService(http)

      await expect(svc.get(TOKEN, 'invalid-iccid')).rejects.toMatchObject({
        response: { status: 404 },
      })
    })

    it('propagates 401 for invalid token', async () => {
      const err = buildAxiosError(401, 'Unauthorized', {
        data: { message: 'Unauthenticated.' },
      })
      const http = mockHttpGetReject(err)
      const svc = createEsimService(http)

      await expect(svc.get('bad-token', ICCID)).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it('propagates 422 for malformed iccid', async () => {
      const err = buildAxiosError(422, 'Unprocessable Entity', {
        data: { message: 'The given data was invalid.' },
      })
      const http = mockHttpGetReject(err)
      const svc = createEsimService(http)

      await expect(svc.get(TOKEN, 'bad-format')).rejects.toMatchObject({
        response: { status: 422 },
      })
    })

    it('propagates 500 Server Error', async () => {
      const err = buildAxiosError(500, 'Internal Server Error')
      const http = mockHttpGetReject(err)
      const svc = createEsimService(http)

      await expect(svc.get(TOKEN, ICCID)).rejects.toMatchObject({
        response: { status: 500 },
      })
    })
  })

  describe('edge cases — iccid values', () => {
    it('handles numeric-only iccid', async () => {
      const numericIccid = '89012345678900000019'
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      await svc.get(TOKEN, numericIccid)

      const [url] = (http.get as jest.Mock).mock.calls[0] as [string, unknown]
      expect(url).toBe(`/sims/${numericIccid}`)
    })

    it('makes exactly one HTTP request per call', async () => {
      const http = mockHttpGet(fixture('esim-response.json'))
      const svc = createEsimService(http)

      await svc.get(TOKEN, ICCID)

      expect(http.get).toHaveBeenCalledTimes(1)
    })
  })
})
