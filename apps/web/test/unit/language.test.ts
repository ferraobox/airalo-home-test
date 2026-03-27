import { getLanguageConfig, LANGUAGES } from '../../src/lib/language'

// ── Fixture references — all expected values derived from the registry ─

const DEFAULT_LANG = 'en'
const en = LANGUAGES.get(DEFAULT_LANG)!

// ── getLanguageConfig ───────────────────────────────────────

describe('getLanguageConfig', () => {
  const originalEnv = process.env.AIRALO_LANGUAGE

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AIRALO_LANGUAGE
    else process.env.AIRALO_LANGUAGE = originalEnv
  })

  it('returns default language config when no env/arg given', () => {
    delete process.env.AIRALO_LANGUAGE
    const lang = getLanguageConfig()
    expect(lang.id).toBe(en.id)
    expect(lang.name).toBe(en.name)
  })

  it('resolves via explicit id argument', () => {
    const lang = getLanguageConfig(DEFAULT_LANG)
    expect(lang.id).toBe(en.id)
  })

  it('resolves via AIRALO_LANGUAGE env var', () => {
    process.env.AIRALO_LANGUAGE = DEFAULT_LANG
    const lang = getLanguageConfig()
    expect(lang.id).toBe(en.id)
  })

  it('is case-insensitive', () => {
    const lang = getLanguageConfig(DEFAULT_LANG.toUpperCase())
    expect(lang.id).toBe(en.id)
  })

  it('throws for unknown language', () => {
    expect(() => getLanguageConfig('xx')).toThrow(/Unknown language "xx"/)
  })

  it('explicit id takes precedence over env var', () => {
    process.env.AIRALO_LANGUAGE = 'xx'
    const lang = getLanguageConfig(DEFAULT_LANG)
    expect(lang.id).toBe(en.id)
  })
})

// ── LANGUAGES registry integrity ────────────────────────────

describe('LANGUAGES registry', () => {
  it('contains at least one entry', () => {
    expect(LANGUAGES.size).toBeGreaterThanOrEqual(1)
  })

  it('hydrates regex fields from serialized strings', () => {
    expect(en.searchInputName).toBeInstanceOf(RegExp)
    expect(en.cookieAcceptButton).toBeInstanceOf(RegExp)
    expect(en.pageTitle).toBeInstanceOf(RegExp)
    expect(en.homeTabs.popular).toBeInstanceOf(RegExp)
    expect(en.packagePage.buyNow).toBeInstanceOf(RegExp)
    expect(en.packageTabs.standard).toBeInstanceOf(RegExp)
  })
})
