/**
 * Unit tests for createOrderService — POST /orders
 *
 * Tests: happy path, quantity/package validation, FormData construction,
 * auth header, Zod validation, HTTP error propagation, and edge cases.
 * All network I/O is mocked via a fake AxiosInstance.
 */
import { jest } from '@jest/globals'
import type { AxiosInstance } from 'axios'
import { createOrderService } from '../../src/services/orderService'
import { fixture } from '../../src/lib/fixture'
import { buildAxiosError } from '../helpers/factory'
import { AIRALO_DEFAULT_PACKAGE_ID, AIRALO_DEFAULT_ORDER_QUANTITY } from '@airalo/shared'

// ── Mock HTTP factory ───────────────────────────────────────

function mockHttpPost(data: unknown) {
  return {
    post: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data }),
  } as unknown as AxiosInstance
}

function mockHttpPostReject(err: unknown) {
  return {
    post: jest.fn<() => Promise<never>>().mockRejectedValue(err),
  } as unknown as AxiosInstance
}

const TOKEN = 'test-bearer-token'

// ── Tests ───────────────────────────────────────────────────

describe('createOrderService — submit', () => {
  describe('happy path', () => {
    it('returns orderId from response', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      const result = await svc.submit(TOKEN, {
        packageId: AIRALO_DEFAULT_PACKAGE_ID,
        quantity: AIRALO_DEFAULT_ORDER_QUANTITY,
      })

      expect(result.orderId).toBe(9666)
    })

    it('returns message from meta', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      const result = await svc.submit(TOKEN, {
        packageId: AIRALO_DEFAULT_PACKAGE_ID,
        quantity: AIRALO_DEFAULT_ORDER_QUANTITY,
      })

      expect(result.message).toMatch(/success/i)
    })

    it('returns sims array with correct iccids', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      const result = await svc.submit(TOKEN, {
        packageId: AIRALO_DEFAULT_PACKAGE_ID,
        quantity: AIRALO_DEFAULT_ORDER_QUANTITY,
      })

      expect(result.sims).toHaveLength(AIRALO_DEFAULT_ORDER_QUANTITY)
      for (const sim of result.sims) {
        expect(sim.iccid).toBeTruthy()
        expect(typeof sim.id).toBe('number')
      }
    })

    it('attaches raw order data', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      const result = await svc.submit(TOKEN, {
        packageId: AIRALO_DEFAULT_PACKAGE_ID,
        quantity: AIRALO_DEFAULT_ORDER_QUANTITY,
      })

      expect(result.raw.package_id).toBe(AIRALO_DEFAULT_PACKAGE_ID)
      expect(result.raw.quantity).toBe(AIRALO_DEFAULT_ORDER_QUANTITY)
    })

    it('includes optional description in FormData when provided', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      await svc.submit(TOKEN, {
        packageId: AIRALO_DEFAULT_PACKAGE_ID,
        quantity: 1,
        description: 'test order',
      })

      const [, body] = (http.post as jest.Mock).mock.calls[0] as [
        string,
        FormData,
        unknown,
      ]
      expect(body.get('description')).toBe('test order')
    })

    it('omits description field when not provided', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      await svc.submit(TOKEN, { packageId: AIRALO_DEFAULT_PACKAGE_ID, quantity: 1 })

      const [, body] = (http.post as jest.Mock).mock.calls[0] as [
        string,
        FormData,
        unknown,
      ]
      expect(body.get('description')).toBeNull()
    })
  })

  describe('FormData request construction', () => {
    it('sends POST to /orders', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      await svc.submit(TOKEN, { packageId: 'pkg-id', quantity: 1 })

      const [url] = (http.post as jest.Mock).mock.calls[0] as [string, FormData, unknown]
      expect(url).toBe('/orders')
    })

    it('sends package_id in FormData', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      await svc.submit(TOKEN, { packageId: 'moshi-moshi-7days-1gb', quantity: 1 })

      const [, body] = (http.post as jest.Mock).mock.calls[0] as [
        string,
        FormData,
        unknown,
      ]
      expect(body.get('package_id')).toBe('moshi-moshi-7days-1gb')
    })

    it('sends quantity as string in FormData', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      await svc.submit(TOKEN, { packageId: 'pkg', quantity: 6 })

      const [, body] = (http.post as jest.Mock).mock.calls[0] as [
        string,
        FormData,
        unknown,
      ]
      expect(body.get('quantity')).toBe('6')
    })

    it('sends Authorization: Bearer token header', async () => {
      const http = mockHttpPost(fixture('order-response.json'))
      const svc = createOrderService(http)

      await svc.submit('my-token-xyz', { packageId: 'pkg', quantity: 1 })

      const [, , opts] = (http.post as jest.Mock).mock.calls[0] as [
        string,
        FormData,
        { headers: Record<string, string> },
      ]
      expect(opts.headers['Authorization']).toBe('Bearer my-token-xyz')
    })
  })

  describe('Zod response validation', () => {
    it('throws when sims array is empty (min:1 constraint)', async () => {
      const bad = fixture('order-response.json') as {
        data: Record<string, unknown> & { sims?: unknown[] }
      }
      bad.data.sims = []
      const http = mockHttpPost(bad)
      const svc = createOrderService(http)

      await expect(svc.submit(TOKEN, { packageId: 'pkg', quantity: 1 })).rejects.toThrow()
    })

    it('throws when response is completely wrong shape', async () => {
      const http = mockHttpPost({ error: 'malformed' })
      const svc = createOrderService(http)

      await expect(svc.submit(TOKEN, { packageId: 'pkg', quantity: 1 })).rejects.toThrow()
    })

    it('throws when package_id is missing', async () => {
      const bad = fixture('order-response.json') as { data: Record<string, unknown> }
      delete bad.data.package_id
      const http = mockHttpPost(bad)
      const svc = createOrderService(http)

      await expect(svc.submit(TOKEN, { packageId: 'pkg', quantity: 1 })).rejects.toThrow()
    })
  })

  describe('HTTP error propagation — EC-A2', () => {
    it('propagates 422 for invalid package_id', async () => {
      const err = buildAxiosError(422, 'Unprocessable Entity', {
        data: {
          message: 'The given data was invalid.',
          errors: { package_id: ['The selected package id is invalid.'] },
        },
      })
      const http = mockHttpPostReject(err)
      const svc = createOrderService(http)

      await expect(
        svc.submit(TOKEN, { packageId: 'nonexistent', quantity: 1 })
      ).rejects.toMatchObject({ response: { status: 422 } })
    })

    it('propagates 401 for invalid token', async () => {
      const err = buildAxiosError(401, 'Unauthorized', {
        data: { message: 'Unauthenticated.' },
      })
      const http = mockHttpPostReject(err)
      const svc = createOrderService(http)

      await expect(
        svc.submit('bad-token', { packageId: 'pkg', quantity: 1 })
      ).rejects.toMatchObject({ response: { status: 401 } })
    })

    it('propagates 422 for zero quantity', async () => {
      const err = buildAxiosError(422, 'Unprocessable Entity', {
        data: {
          message: 'The given data was invalid.',
          errors: { quantity: ['The quantity must be at least 1.'] },
        },
      })
      const http = mockHttpPostReject(err)
      const svc = createOrderService(http)

      await expect(
        svc.submit(TOKEN, { packageId: 'pkg', quantity: 0 })
      ).rejects.toMatchObject({ response: { status: 422 } })
    })

    it('propagates 500 Server Error', async () => {
      const err = buildAxiosError(500, 'Internal Server Error')
      const http = mockHttpPostReject(err)
      const svc = createOrderService(http)

      await expect(
        svc.submit(TOKEN, { packageId: 'pkg', quantity: 1 })
      ).rejects.toMatchObject({ response: { status: 500 } })
    })
  })
})
