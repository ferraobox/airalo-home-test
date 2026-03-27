/**
 * Regex serialization utilities.
 *
 * JSON fixtures store RegExp patterns as "/pattern/flags" strings.
 * These helpers convert between serialized and native RegExp forms,
 * and provide safe RegExp construction from mixed string/RegExp inputs.
 */

/**
 * Parse a serialized regex string into a RegExp instance.
 *
 * @param serialized — string in "/pattern/flags" format
 * @throws {Error} if the string does not match the expected format
 *
 * @example
 * toRegExp('/search/i')   // → /search/i
 * toRegExp('/^\\d+$/')    // → /^\d+$/
 */
export function toRegExp(serialized: string): RegExp {
  const match = /^\/(.+)\/([gimsuy]*)$/.exec(serialized)
  if (!match) {
    throw new Error(`Invalid regex pattern: "${serialized}"`)
  }
  return new RegExp(match[1]!, match[2])
}

/**
 * Check whether a string looks like a serialized regex ("/pattern/flags").
 */
export function isSerializedRegex(value: string): boolean {
  return /^\/.+\/[gimsuy]*$/.test(value)
}

/**
 * Convert a string, RegExp, or undefined value into a RegExp matcher.
 *
 * - RegExp values are returned as-is.
 * - Strings are escaped and wrapped in `^...$` for exact matching.
 * - `undefined` matches the empty string.
 *
 * This is useful for building assertion matchers from fixture data that
 * may be either a literal string or a regex pattern.
 *
 * @example
 * toMatcher(/^\d+$/)      // → /^\d+$/
 * toMatcher('Unlimited')  // → /^Unlimited$/
 * toMatcher(undefined)    // → /^$/
 */
export function toMatcher(expected: string | RegExp | undefined): RegExp {
  if (expected instanceof RegExp) return expected
  return new RegExp(`^${(expected ?? '').replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}
