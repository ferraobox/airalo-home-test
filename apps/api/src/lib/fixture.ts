import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Load and parse a JSON fixture by name from src/fixtures/ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fixture = (name: string): any =>
  JSON.parse(readFileSync(join(__dirname, '../fixtures', name), 'utf8'))
