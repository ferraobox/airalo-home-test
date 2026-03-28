/**
 * Unit tests for createAuthService — POST /token
 *
 * Tests: happy path, FormData field construction, Zod validation,
 * HTTP error propagation, and edge-case credential inputs.
 * All network I/O is mocked via a fake AxiosInstance.
 */
import { jest } from '@jest/globals'
import type { AxiosInstance } from 'axios'
import { createAuthService } from '../../src/services/authService'
import { fixture } from '../../src/lib/fixture'
import { airaloTokenResponseSchema } from '@airalo/shared'
import { buildAxiosError } from '../helpers/factory'

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

// ── Tests ───────────────────────────────────────────────────

describe('createAuthService — getToken', () => {
  describe('happy path', () => {
    it('returns access_token string on valid response', async () => {
      const http = mockHttpPost(fixture('token-response.json'))
      const auth = createAuthService(http)

      const token = await auth.getToken('client_id', 'client_secret')

      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('returns the exact access_token from fixture', async () => {
      const tokenFixture = airaloTokenResponseSchema.parse(fixture('token-response.json'))
      const http = mockHttpPost(tokenFixture)
      const auth = createAuthService(http)

      const token = await auth.getToken('id', 'secret')

      expect(token).toBe(tokenFixture.data.access_token)
    })
  })

  describe('FormData request construction', () => {
    it('sends POST to /token', async () => {
      const http = mockHttpPost(fixture('token-response.json'))
      const auth = createAuthService(http)

      await auth.getToken('my_id', 'my_secret')

      expect(http.post).toHaveBeenCalledTimes(1)
      const [url] = (http.post as jest.Mock).mock.calls[0] as [string, FormData]
      expect(url).toBe('/token')
    })

    it('sends client_id in FormData', async () => {
      const http = mockHttpPost(fixture('token-response.json'))
      const auth = createAuthService(http)

      await auth.getToken('my_client_id', 'my_secret')

      const [, body] = (http.post as jest.Mock).mock.calls[0] as [string, FormData]
      expect(body.get('client_id')).toBe('my_client_id')
    })

    it('sends client_secret in FormData', async () => {
      const http = mockHttpPost(fixture('token-response.json'))
      const auth = createAuthService(http)

      await auth.getToken('id', 'DDpoEo76i3S0kH7')

      const [, body] = (http.post as jest.Mock).mock.calls[0] as [string, FormData]
      expect(body.get('client_secret')).toBe('DDpoEo76i3S0kH7')
    })

    it('always sends grant_type = client_credentials', async () => {
      const http = mockHttpPost(fixture('token-response.json'))
      const auth = createAuthService(http)

      await auth.getToken('id', 'secret')

      const [, body] = (http.post as jest.Mock).mock.calls[0] as [string, FormData]
      expect(body.get('grant_type')).toBe('client_credentials')
    })
  })

  describe('Zod response validation', () => {
    it('throws on response missing data wrapper', async () => {
      const http = mockHttpPost({ access_token: 'tok', token_type: 'Bearer' })
      const auth = createAuthService(http)

      await expect(auth.getToken('id', 'secret')).rejects.toThrow()
    })

    it('throws when access_token is empty string', async () => {
      const bad = {
        data: { access_token: '', token_type: 'Bearer', expires_in: 3600 },
        meta: { message: 'success' },
      }
      const http = mockHttpPost(bad)
      const auth = createAuthService(http)

      await expect(auth.getToken('id', 'secret')).rejects.toThrow()
    })

    it('throws when response is completely wrong shape', async () => {
      const http = mockHttpPost({ wrong: 'totally wrong' })
      const auth = createAuthService(http)

      await expect(auth.getToken('id', 'secret')).rejects.toThrow()
    })

    it('throws when expires_in is negative', async () => {
      const bad = {
        data: { access_token: 'tok', token_type: 'Bearer', expires_in: -1 },
        meta: { message: 'success' },
      }
      const http = mockHttpPost(bad)
      const auth = createAuthService(http)

      await expect(auth.getToken('id', 'secret')).rejects.toThrow()
    })
  })

  describe('HTTP error propagation — EC-A1', () => {
    it('propagates 401 Unauthorized', async () => {
      const err = buildAxiosError(401, 'Unauthorized', {
        data: { message: 'Unauthenticated.' },
      })
      const http = mockHttpPostReject(err)
      const auth = createAuthService(http)

      await expect(auth.getToken('bad_id', 'bad_secret')).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it('propagates 422 Validation Error', async () => {
      const err = buildAxiosError(422, 'Unprocessable Entity', {
        data: { message: 'The given data was invalid.', errors: {} },
      })
      const http = mockHttpPostReject(err)
      const auth = createAuthService(http)

      await expect(auth.getToken('', '')).rejects.toMatchObject({
        response: { status: 422 },
      })
    })

    it('propagates 500 Server Error', async () => {
      const err = buildAxiosError(500, 'Internal Server Error')
      const http = mockHttpPostReject(err)
      const auth = createAuthService(http)

      await expect(auth.getToken('id', 'secret')).rejects.toMatchObject({
        response: { status: 500 },
      })
    })
  })
})
