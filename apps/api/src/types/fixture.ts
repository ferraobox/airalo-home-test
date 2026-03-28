/** Mutable raw fixture for schema rejection / backward-compat tests */
export interface MutableFixture {
  data: Record<string, unknown> & { sims?: Array<Record<string, unknown>> }
  meta?: Record<string, unknown>
  [key: string]: unknown
}

/** Mutable error fixture for error schema tests */
export interface MutableErrorFixture {
  data: Record<string, unknown> & { errors?: Record<string, unknown> }
  [key: string]: unknown
}
