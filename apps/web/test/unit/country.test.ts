import { getLanguageConfig, LANGUAGES, type LanguageConfig } from '../../src/lib/language'
import {
  getCountryConfig,
  resolveCountryConfig,
  resolveFirstCardSpec,
  COUNTRIES,
} from '../../src/lib/country'

// ── Fixture references — all expected values derived from registries ─

const DEFAULT_COUNTRY = 'japan'
const DEFAULT_LANG = 'en'
const lang = getLanguageConfig(DEFAULT_LANG)
const japan = COUNTRIES.get(DEFAULT_COUNTRY)!
const japanTexts = japan.localized[DEFAULT_LANG]!

// ── getCountryConfig ────────────────────────────────────────

describe('getCountryConfig', () => {
  const originalEnv = process.env.AIRALO_COUNTRY

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AIRALO_COUNTRY
    else process.env.AIRALO_COUNTRY = originalEnv
  })

  it('returns default country config when no env/arg given', () => {
    delete process.env.AIRALO_COUNTRY
    const country = getCountryConfig()
    expect(country.id).toBe(japan.id)
    expect(country.name).toBe(japanTexts.name)
  })

  it('resolves via explicit id argument', () => {
    const country = getCountryConfig(DEFAULT_COUNTRY)
    expect(country.id).toBe(japan.id)
  })

  it('resolves via AIRALO_COUNTRY env var', () => {
    process.env.AIRALO_COUNTRY = DEFAULT_COUNTRY
    const country = getCountryConfig()
    expect(country.id).toBe(japan.id)
  })

  it('is case-insensitive', () => {
    const country = getCountryConfig(DEFAULT_COUNTRY.toUpperCase())
    expect(country.id).toBe(japan.id)
  })

  it('throws for unknown country', () => {
    expect(() => getCountryConfig('atlantis')).toThrow(/Unknown country "atlantis"/)
  })

  it('explicit id takes precedence over env var', () => {
    process.env.AIRALO_COUNTRY = 'atlantis'
    const country = getCountryConfig(DEFAULT_COUNTRY)
    expect(country.id).toBe(japan.id)
  })
})

// ── resolveCountryConfig ────────────────────────────────────

describe('resolveCountryConfig', () => {
  it('merges country and language into a resolved config', () => {
    const resolved = resolveCountryConfig(japan, lang)
    expect(resolved.id).toBe(japan.id)
    expect(resolved.name).toBe(japanTexts.name)
    expect(resolved.searchTerm).toBe(japanTexts.searchTerm)
    expect(resolved.urlSlug).toBe(japan.urlSlug)
    expect(resolved.operator).toBe(japan.operator)
  })

  it('resolves target package with duration text', () => {
    const resolved = resolveCountryConfig(japan, lang)
    const expectedDuration = lang.packageData.durations[japan.targetPackage.durationKey]
    expect(resolved.targetPackage.duration).toBe(expectedDuration)
    expect(resolved.targetPackage.tab).toBe(japan.targetPackage.tab)
    expect(resolved.targetPackage.specValue).toBe(lang.packageData.unlimitedLabel)
    expect(resolved.targetPackage.specUnit).toBe(lang.packageData.dataUnit)
  })

  it('resolves tabs with language labels', () => {
    const resolved = resolveCountryConfig(japan, lang)
    expect(resolved.tabs).toHaveLength(japan.tabs.length)
    expect(resolved.tabs[0]!.id).toBe(japan.tabs[0]!.id)
    expect(resolved.tabs[0]!.label).toEqual(lang.packageTabs[japan.tabs[0]!.id])
    expect(resolved.tabs[1]!.id).toBe(japan.tabs[1]!.id)
  })

  it('resolves plan-details with language-specific policies', () => {
    const resolved = resolveCountryConfig(japan, lang)
    expect(resolved.planDetails.minPolicies).toBe(japan.planDetails.minPolicies)
    expect(resolved.planDetails.requiredPolicies).toEqual(lang.planPolicies.required)
    expect(resolved.planDetails.fairUsagePattern).toBe(
      lang.planPolicies.fairUsageDescPattern
    )
  })

  it('throws when country has no localized texts for given language', () => {
    const fakeLang = { ...lang, id: 'zz' }
    expect(() => resolveCountryConfig(japan, fakeLang)).toThrow(
      /no localized texts for language "zz"/
    )
  })

  it('throws when duration key is missing from language', () => {
    const fakeLang: LanguageConfig = {
      ...lang,
      packageData: { ...lang.packageData, durations: {} },
    }
    expect(() => resolveCountryConfig(japan, fakeLang)).toThrow(
      new RegExp(`Duration key "${japan.targetPackage.durationKey}" not found`)
    )
  })
})

// ── resolveFirstCardSpec ────────────────────────────────────

describe('resolveFirstCardSpec', () => {
  it('passes through RegExp as-is', () => {
    const re = /^\d+$/
    expect(resolveFirstCardSpec(re, lang)).toBe(re)
  })

  it('replaces "Unlimited" with localised label', () => {
    expect(resolveFirstCardSpec('Unlimited', lang)).toBe(lang.packageData.unlimitedLabel)
  })

  it('is case-insensitive for "unlimited" matching', () => {
    expect(resolveFirstCardSpec('unlimited', lang)).toBe(lang.packageData.unlimitedLabel)
    expect(resolveFirstCardSpec('UNLIMITED', lang)).toBe(lang.packageData.unlimitedLabel)
  })

  it('passes through other strings as-is', () => {
    expect(resolveFirstCardSpec('5', lang)).toBe('5')
  })
})

// ── Fixture data integrity ──────────────────────────────────

describe('fixture data integrity', () => {
  it('COUNTRIES registry contains at least one entry', () => {
    expect(COUNTRIES.size).toBeGreaterThanOrEqual(1)
  })

  it('LANGUAGES registry contains at least one entry', () => {
    expect(LANGUAGES.size).toBeGreaterThanOrEqual(1)
  })

  it('every country has localized texts matching a registered language', () => {
    for (const [, country] of COUNTRIES) {
      for (const langId of Object.keys(country.localized)) {
        expect(LANGUAGES.get(langId)).toBeDefined()
      }
    }
  })

  it('hydrates firstCardSpec regex from serialized strings', () => {
    const standardTab = japan.tabs.find((t) => t.id === 'standard')!
    expect(standardTab.firstCardSpec).toBeInstanceOf(RegExp)
  })
})
