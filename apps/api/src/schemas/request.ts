import { z } from 'zod'

/** Validates the body of a POST /orders request before forwarding to the API. */
export const submitOrderRequestSchema = z.object({
  packageId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
})
