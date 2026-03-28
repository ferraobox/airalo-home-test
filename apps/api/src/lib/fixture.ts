import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { ZodType, z } from 'zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Load a raw JSON fixture by name from src/fixtures/ */
export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, '../fixtures', name), 'utf8')) as unknown
}

/** Load a JSON fixture and validate it through a Zod schema */
export function typedFixture<T extends ZodType>(name: string, schema: T): z.infer<T> {
  return schema.parse(fixture(name)) as z.infer<T>
}
