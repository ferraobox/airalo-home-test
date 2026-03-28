import { jest } from '@jest/globals'
import { runAiraloOrderFlow } from '../../src/services/flowService'
import type { AiraloFlowService } from '../../src/services/flowService'
import {
  buildOrderResult,
  buildEsimResult,
  buildAxiosError,
} from '../../src/helpers/factory'

// ── Helper: create mock service ─────────────────────────────

const createMockService = (
  overrides: Partial<AiraloFlowService> = {}
): AiraloFlowService => ({
  createOrder: jest.fn<AiraloFlowService['createOrder']>(),
  fetchEsim: jest.fn<AiraloFlowService['fetchEsim']>(),
  ...overrides,
})

// ── Tests ───────────────────────────────────────────────────

describe('runAiraloOrderFlow', () => {
  // ── Happy path ──────────────────────────────────────────

  describe('happy path', () => {
    it('submits order and fetches all 6 eSIMs by iccid', async () => {
      const orderResult = buildOrderResult(6)
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockResolvedValue(orderResult),
        fetchEsim: jest
          .fn<AiraloFlowService['fetchEsim']>()
          .mockImplementation((iccid: string) => Promise.resolve(buildEsimResult(iccid))),
      })

      const result = await runAiraloOrderFlow(
        { packageId: 'moshi-moshi-7days-1gb', quantity: 6 },
        service
      )

      // Verify order input forwarded correctly
      expect(service.createOrder).toHaveBeenCalledWith({
        packageId: 'moshi-moshi-7days-1gb',
        quantity: 6,
      })
      // Verify each SIM's iccid was fetched
      expect(service.fetchEsim).toHaveBeenCalledTimes(6)
      for (const sim of orderResult.sims) {
        expect(service.fetchEsim).toHaveBeenCalledWith(sim.iccid)
      }
      // Verify output structure
      expect(result.order.orderId).toBe(9666)
      expect(result.esimDetails).toHaveLength(6)
      expect(result.esimDetails[0]!.iccid).toBe('8901234567890000001')
    })

    it('handles an order with a single SIM', async () => {
      const orderResult = buildOrderResult(1)
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockResolvedValue(orderResult),
        fetchEsim: jest
          .fn<AiraloFlowService['fetchEsim']>()
          .mockImplementation((iccid: string) => Promise.resolve(buildEsimResult(iccid))),
      })

      const result = await runAiraloOrderFlow({ packageId: 'pkg', quantity: 1 }, service)

      expect(service.fetchEsim).toHaveBeenCalledTimes(1)
      expect(result.esimDetails).toHaveLength(1)
    })

    it('handles large order with 50 SIMs', async () => {
      const orderResult = buildOrderResult(50)
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockResolvedValue(orderResult),
        fetchEsim: jest
          .fn<AiraloFlowService['fetchEsim']>()
          .mockImplementation((iccid: string) => Promise.resolve(buildEsimResult(iccid))),
      })

      const result = await runAiraloOrderFlow({ packageId: 'pkg', quantity: 50 }, service)

      expect(service.fetchEsim).toHaveBeenCalledTimes(50)
      expect(result.esimDetails).toHaveLength(50)
      // Verify all iccids are unique
      const iccids = result.esimDetails.map((e) => e.iccid)
      expect(new Set(iccids).size).toBe(50)
    })

    it('returns eSIM details in same order as SIMs (Promise.all preserves order)', async () => {
      const orderResult = buildOrderResult(3)
      const delays = [30, 10, 20] // Out-of-order completion
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockResolvedValue(orderResult),
        fetchEsim: jest
          .fn<AiraloFlowService['fetchEsim']>()
          .mockImplementation(async (iccid: string) => {
            const idx = orderResult.sims.findIndex((s) => s.iccid === iccid)
            await new Promise((r) => setTimeout(r, delays[idx]))
            return buildEsimResult(iccid)
          }),
      })

      const result = await runAiraloOrderFlow({ packageId: 'pkg', quantity: 3 }, service)

      // Despite different delays, results maintain original SIM order
      expect(result.esimDetails.map((e) => e.iccid)).toStrictEqual(
        orderResult.sims.map((s) => s.iccid)
      )
    })
  })

  // ── Concurrency ─────────────────────────────────────────

  describe('concurrent eSIM fetching', () => {
    it('fetches eSIMs concurrently via Promise.all', async () => {
      const orderResult = buildOrderResult(3)
      const callOrder: string[] = []
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockResolvedValue(orderResult),
        fetchEsim: jest
          .fn<AiraloFlowService['fetchEsim']>()
          .mockImplementation((iccid: string) => {
            callOrder.push(iccid)
            return Promise.resolve(buildEsimResult(iccid))
          }),
      })

      const result = await runAiraloOrderFlow({ packageId: 'pkg', quantity: 3 }, service)

      expect(callOrder).toHaveLength(3)
      expect(result.esimDetails).toHaveLength(3)
    })

    it('does not call fetchEsim until createOrder resolves', async () => {
      const callSequence: string[] = []
      const orderResult = buildOrderResult(2)
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockImplementation(() => {
            callSequence.push('createOrder')
            return Promise.resolve(orderResult)
          }),
        fetchEsim: jest
          .fn<AiraloFlowService['fetchEsim']>()
          .mockImplementation((iccid: string) => {
            callSequence.push(`fetchEsim:${iccid}`)
            return Promise.resolve(buildEsimResult(iccid))
          }),
      })

      await runAiraloOrderFlow({ packageId: 'pkg', quantity: 2 }, service)

      // createOrder must be first
      expect(callSequence[0]).toBe('createOrder')
      // All fetchEsim calls come after
      expect(callSequence.slice(1).every((c) => c.startsWith('fetchEsim:'))).toBe(true)
    })
  })

  // ── Order creation errors ───────────────────────────────

  describe('order creation errors — HTTP status codes', () => {
    it.each([
      [401, 'Unauthorized', { data: { message: 'Unauthenticated.' } }],
      [403, 'Forbidden', { data: { message: 'Insufficient permissions.' } }],
      [
        422,
        'Unprocessable Entity',
        { data: { message: 'The quantity must be at least 1.' } },
      ],
      [429, 'Too Many Requests', { data: { message: 'Rate limit exceeded.' } }],
      [500, 'Internal Server Error', { data: { message: 'Server error.' } }],
      [502, 'Bad Gateway', {}],
      [503, 'Service Unavailable', { data: { message: 'Maintenance.' } }],
    ] as Array<[number, string, unknown]>)(
      'propagates %i %s from createOrder',
      async (status, statusText, data) => {
        const httpErr = buildAxiosError(status, statusText, data)
        const service = createMockService({
          createOrder: jest
            .fn<AiraloFlowService['createOrder']>()
            .mockRejectedValue(httpErr),
        })

        await expect(
          runAiraloOrderFlow({ packageId: 'pkg', quantity: 1 }, service)
        ).rejects.toThrow(`Request failed with status code ${status}`)

        // fetchEsim must NOT be called when order creation fails
        expect(service.fetchEsim).not.toHaveBeenCalled()
      }
    )

    it('preserves error response metadata on order failure', async () => {
      const httpErr = buildAxiosError(422, 'Unprocessable Entity', {
        data: {
          message: 'Validation failed',
          errors: { package_id: ['The package_id field is required.'] },
        },
      })
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockRejectedValue(httpErr),
      })

      const error = await runAiraloOrderFlow(
        { packageId: '', quantity: 1 },
        service
      ).catch((e: unknown) => e)
      const e = error as Error & { response?: { status: number } }
      expect(e.response?.status).toBe(422)
    })
  })

  // ── eSIM fetch errors ───────────────────────────────────

  describe('eSIM fetch errors — HTTP status codes', () => {
    it.each([
      [404, 'Not Found'],
      [401, 'Unauthorized'],
      [500, 'Internal Server Error'],
      [503, 'Service Unavailable'],
    ] as Array<[number, string]>)(
      'propagates %i %s from fetchEsim',
      async (status, statusText) => {
        const orderResult = buildOrderResult(1)
        const httpErr = buildAxiosError(status, statusText)
        const service = createMockService({
          createOrder: jest
            .fn<AiraloFlowService['createOrder']>()
            .mockResolvedValue(orderResult),
          fetchEsim: jest.fn<AiraloFlowService['fetchEsim']>().mockRejectedValue(httpErr),
        })

        await expect(
          runAiraloOrderFlow({ packageId: 'pkg', quantity: 1 }, service)
        ).rejects.toThrow(`Request failed with status code ${status}`)
      }
    )

    it('propagates partial eSIM failure — one fails, others succeed', async () => {
      const orderResult = buildOrderResult(3)
      let callCount = 0
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockResolvedValue(orderResult),
        fetchEsim: jest
          .fn<AiraloFlowService['fetchEsim']>()
          .mockImplementation((iccid: string) => {
            callCount++
            if (callCount === 2)
              return Promise.reject(buildAxiosError(500, 'Internal Server Error'))
            return Promise.resolve(buildEsimResult(iccid))
          }),
      })

      await expect(
        runAiraloOrderFlow({ packageId: 'pkg', quantity: 3 }, service)
      ).rejects.toThrow('Request failed with status code 500')
    })
  })

  // ── Network-level errors ────────────────────────────────

  describe('network-level errors (no HTTP response)', () => {
    it.each([
      ['ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:443'],
      ['ETIMEDOUT', 'connect ETIMEDOUT'],
      ['ECONNRESET', 'socket hang up'],
      ['ENOTFOUND', 'getaddrinfo ENOTFOUND partners-api.airalo.com'],
    ])('propagates %s network error from createOrder', async (code, message) => {
      const err = new Error(message) as Error & { code?: string }
      err.code = code
      const service = createMockService({
        createOrder: jest.fn<AiraloFlowService['createOrder']>().mockRejectedValue(err),
      })

      await expect(
        runAiraloOrderFlow({ packageId: 'pkg', quantity: 1 }, service)
      ).rejects.toThrow(message)

      expect(service.fetchEsim).not.toHaveBeenCalled()
    })

    it('propagates ETIMEDOUT from fetchEsim after successful order', async () => {
      const orderResult = buildOrderResult(2)
      const err = new Error('connect ETIMEDOUT') as Error & { code?: string }
      err.code = 'ETIMEDOUT'
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockResolvedValue(orderResult),
        fetchEsim: jest.fn<AiraloFlowService['fetchEsim']>().mockRejectedValue(err),
      })

      await expect(
        runAiraloOrderFlow({ packageId: 'pkg', quantity: 2 }, service)
      ).rejects.toThrow('connect ETIMEDOUT')
    })
  })

  // ── Error type preservation ─────────────────────────────

  describe('error type preservation', () => {
    it('preserves TypeError from service', async () => {
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockRejectedValue(new TypeError('Cannot read properties of undefined')),
      })

      await expect(
        runAiraloOrderFlow({ packageId: 'pkg', quantity: 1 }, service)
      ).rejects.toThrow(TypeError)
    })

    it('preserves non-Error rejection (string throw)', async () => {
      const service = createMockService({
        createOrder: jest
          .fn<AiraloFlowService['createOrder']>()
          .mockRejectedValue('unexpected string error'),
      })

      await expect(
        runAiraloOrderFlow({ packageId: 'pkg', quantity: 1 }, service)
      ).rejects.toBe('unexpected string error')
    })
  })
})
