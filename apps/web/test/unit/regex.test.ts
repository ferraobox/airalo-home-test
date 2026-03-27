import { toRegExp, isSerializedRegex, toMatcher } from '../../src/lib/regex'

// ── toRegExp ────────────────────────────────────────────────

describe('toRegExp', () => {
  it('parses simple pattern without flags', () => {
    expect(toRegExp('/hello/')).toEqual(/hello/)
  })

  it('parses pattern with single flag', () => {
    expect(toRegExp('/search/i')).toEqual(/search/i)
  })

  it('parses pattern with multiple flags', () => {
    expect(toRegExp('/test/gi')).toEqual(/test/gi)
  })

  it('handles special regex characters', () => {
    const re = toRegExp(String.raw`/^\d+$/`)
    expect(re).toEqual(/^\d+$/)
    expect(re.test('123')).toBe(true)
    expect(re.test('abc')).toBe(false)
  })

  it('handles pattern with inner slashes', () => {
    const re = toRegExp(String.raw`/a\/b/`)
    expect(re.source).toBe(String.raw`a\/b`)
  })

  it('throws for string without leading slash', () => {
    expect(() => toRegExp('hello')).toThrow(/Invalid regex pattern/)
  })

  it('throws for empty string', () => {
    expect(() => toRegExp('')).toThrow(/Invalid regex pattern/)
  })

  it('throws for empty pattern (double slash)', () => {
    expect(() => toRegExp('//')).toThrow(/Invalid regex pattern/)
  })
})

// ── isSerializedRegex ───────────────────────────────────────

describe('isSerializedRegex', () => {
  it.each([
    ['/search/i', true],
    [String.raw`/^\d+$/`, true],
    ['/test/', true],
    ['/multi/gi', true],
    ['Unlimited', false],
    ['hello', false],
    ['', false],
    ['5', false],
    ['//', false],
  ])('"%s" → %s', (input, expected) => {
    expect(isSerializedRegex(input)).toBe(expected)
  })
})

// ── toMatcher ───────────────────────────────────────────────

describe('toMatcher', () => {
  it('returns a RegExp as-is', () => {
    const re = /^\d+$/
    expect(toMatcher(re)).toBe(re)
  })

  it('wraps a plain string in ^…$ for exact matching', () => {
    const matcher = toMatcher('Unlimited')
    expect(matcher).toEqual(/^Unlimited$/)
    expect(matcher.test('Unlimited')).toBe(true)
    expect(matcher.test('Not Unlimited')).toBe(false)
  })

  it('escapes regex special characters in strings', () => {
    const matcher = toMatcher('US$4.50')
    expect(matcher.test('US$4.50')).toBe(true)
    expect(matcher.test('US$4X50')).toBe(false)
  })

  it('converts undefined to a matcher for the empty string', () => {
    const matcher = toMatcher(undefined)
    expect(matcher).toEqual(/^$/)
    expect(matcher.test('')).toBe(true)
    expect(matcher.test('anything')).toBe(false)
  })

  it('converts empty string to an exact empty-string matcher', () => {
    const matcher = toMatcher('')
    expect(matcher.test('')).toBe(true)
    expect(matcher.test('x')).toBe(false)
  })
})
