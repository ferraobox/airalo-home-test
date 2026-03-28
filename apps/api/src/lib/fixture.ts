import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Load a raw JSON fixture by name from src/fixtures/ */
export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, '../fixtures', name), 'utf8')) as unknown
}
