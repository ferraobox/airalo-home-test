import { z } from 'zod'

// ── Token ────────────────────────────────────────────────────
export const airaloTokenResponseSchema = z.object({
  data: z.object({
    access_token: z.string().min(1),
    token_type: z.string().min(1),
    expires_in: z.number().int().positive(),
  }),
  meta: z.object({
    message: z.string(),
  }),
})

// ── Sim entry inside an order ────────────────────────────────
export const airaloSimSchema = z.object({
  id: z.number(),
  created_at: z.string().min(1),
  iccid: z.string().min(1),
  lpa: z.string(),
  imsis: z.unknown().nullable(),
  matching_id: z.string(),
  qrcode: z.string(),
  qrcode_url: z.string(),
  direct_apple_installation_url: z.string().optional(),
  airalo_code: z.unknown().nullable(),
  apn_type: z.string(),
  apn_value: z.unknown().nullable(),
  is_roaming: z.boolean(),
  confirmation_code: z.string().nullable(),
})

// ── Order response ───────────────────────────────────────────
export const airaloOrderResponseSchema = z.object({
  data: z.object({
    id: z.number(),
    code: z.string().min(1),
    currency: z.string().min(1),
    package_id: z.string().min(1),
    quantity: z.union([z.number(), z.string()]),
    type: z.string(),
    description: z.string().nullable(),
    esim_type: z.string(),
    validity: z.number(),
    package: z.string(),
    data: z.string(),
    price: z.number(),
    pricing_model: z.string().optional(),
    created_at: z.string().min(1),
    manual_installation: z.string().optional(),
    qrcode_installation: z.string().optional(),
    installation_guides: z.record(z.string()).optional(),
    brand_settings_name: z.string().nullable().optional(),
    sims: z.array(airaloSimSchema).min(1),
  }),
  meta: z.object({
    message: z.string(),
  }),
})

// ── Simable (order info inside eSIM response) ────────────────
export const airaloSimableSchema = z.object({
  id: z.number(),
  created_at: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  package_id: z.string(),
  quantity: z.union([z.number(), z.string()]),
  package: z.string(),
  esim_type: z.string(),
  validity: z.union([z.number(), z.string()]),
  price: z.union([z.number(), z.string()]),
  data: z.string(),
  currency: z.string(),
})

// ── eSIM response ────────────────────────────────────────────
export const airaloEsimResponseSchema = z.object({
  data: z.object({
    id: z.number(),
    created_at: z.string().min(1),
    iccid: z.string().min(1),
    lpa: z.string(),
    imsis: z.unknown().nullable(),
    matching_id: z.string(),
    qrcode: z.string(),
    qrcode_url: z.string(),
    direct_apple_installation_url: z.string().optional(),
    voucher_code: z.unknown().nullable().optional(),
    airalo_code: z.unknown().nullable(),
    apn_type: z.string(),
    apn_value: z.unknown().nullable(),
    is_roaming: z.boolean(),
    confirmation_code: z.string().nullable(),
    brand_settings_name: z.string().nullable().optional(),
    recycled: z.boolean().optional(),
    recycled_at: z.string().nullable().optional(),
    simable: airaloSimableSchema.optional(),
  }),
  meta: z.object({
    message: z.string(),
  }),
})

// ── Error responses (spec / fixture shapes) ──────────────────
// These match the documented API spec and test fixtures.
export const airaloValidationErrorSchema = z.object({
  data: z.object({
    message: z.string(),
    errors: z.record(z.array(z.string())).optional(),
  }),
})

export const airaloAuthErrorSchema = z.object({
  data: z.object({
    message: z.string(),
  }),
})

// ── Real API error shapes (observed from production calls) ────
// The live API sends inconsistent error envelopes across endpoints.

// Token 401 / field-level error:
// { data: { [fieldName]: "error message" }, meta: { message: "..." } }
export const airaloFieldErrorSchema = z.object({
  data: z.record(z.string()),
  meta: z.object({ message: z.string() }),
})

// Orders invalid-package error:
// { code: number, reason: "..." }
export const airaloReasonErrorSchema = z.object({
  code: z.number(),
  reason: z.string(),
})

// eSIM not-found error:
// { data: [], meta: { message: "..." } }
export const airaloNotFoundErrorSchema = z.object({
  data: z.array(z.unknown()),
  meta: z.object({ message: z.string() }),
})
