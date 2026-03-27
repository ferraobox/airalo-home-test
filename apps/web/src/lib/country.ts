/**
 * Country configuration types and resolver.
 *
 * Types and helper functions live here; raw JSON data lives in
 * `../fixtures/countries.json`.
 */

import { createRequire } from 'node:module'
import { getLanguageConfig, type LanguageConfig } from './language'
import { isSerializedRegex, toRegExp } from './regex'

const esmRequire = createRequire(import.meta.url)

// ── Raw JSON shape ────────────────────────────────────────

interface RawCountryConfig {
  id: string
  urlSlug: string
  operator: string
  localized: Record<string, CountryLocalizedTexts>
  tabs: Array<{ id: 'standard' | 'unlimited'; firstCardSpec: string }>
  targetPackage: {
    tab: 'standard' | 'unlimited'
    durationKey: string
    urlSlugPattern: string
  }
  planDetails: { minPolicies: number }
}

// ── Public types ──────────────────────────────────────────

export interface CountryLocalizedTexts {
  name: string
  searchTerm: string
  pageHeading: string
  locationTitle: string
  breadcrumbText: string
}

export interface PackageTab {
  id: 'standard' | 'unlimited'
  firstCardSpec: string | RegExp
}

export interface TargetPackage {
  tab: 'standard' | 'unlimited'
  durationKey: string
  urlSlugPattern: string
}

export interface PlanDetailExpectation {
  minPolicies: number
}

export interface CountryConfig {
  id: string
  urlSlug: string
  operator: string
  localized: Record<string, CountryLocalizedTexts>
  tabs: PackageTab[]
  targetPackage: TargetPackage
  planDetails: PlanDetailExpectation
}

export interface ResolvedCountryConfig {
  id: string
  name: string
  searchTerm: string
  urlSlug: string
  pageHeading: string
  locationTitle: string
  operator: string
  breadcrumbText: string
  tabs: Array<{
    id: 'standard' | 'unlimited'
    label: RegExp
    firstCardSpec: string | RegExp
  }>
  targetPackage: {
    tab: 'standard' | 'unlimited'
    tabLabel: RegExp
    duration: string
    durationKey: string
    urlSlugPattern: string
    specValue: string
    specUnit: string
  }
  planDetails: {
    minPolicies: number
    requiredPolicies: string[]
    fairUsagePattern: string
  }
}

// ── Hydration ─────────────────────────────────────────────

function hydrateCountryConfig(raw: RawCountryConfig): CountryConfig {
  return {
    ...raw,
    tabs: raw.tabs.map((t) => ({
      id: t.id,
      firstCardSpec: isSerializedRegex(t.firstCardSpec)
        ? toRegExp(t.firstCardSpec)
        : t.firstCardSpec,
    })),
  }
}

// ── Country registry (loaded + hydrated from JSON) ────────

const rawCountries = esmRequire('../fixtures/countries.json') as Record<
  string,
  RawCountryConfig
>

export const COUNTRIES = new Map<string, CountryConfig>(
  Object.entries(rawCountries).map(([key, raw]) => [key, hydrateCountryConfig(raw)])
)

// ── Resolution helpers ────────────────────────────────────

export function resolveFirstCardSpec(
  raw: string | RegExp,
  lang: LanguageConfig
): string | RegExp {
  if (raw instanceof RegExp) return raw
  if (raw.toLowerCase() === 'unlimited') return lang.packageData.unlimitedLabel
  return raw
}

export function resolveCountryConfig(
  country: CountryConfig,
  lang: LanguageConfig
): ResolvedCountryConfig {
  const loc = country.localized[lang.id]
  if (!loc) {
    const available = Object.keys(country.localized).join(', ')
    throw new Error(
      `Country "${country.id}" has no localized texts for language "${lang.id}". Available: ${available}`
    )
  }

  const tabLabel = (id: 'standard' | 'unlimited'): RegExp => lang.packageTabs[id]

  const pkg = country.targetPackage
  const duration = lang.packageData.durations[pkg.durationKey]
  if (!duration) {
    throw new Error(
      `Duration key "${pkg.durationKey}" not found in language "${lang.id}" durations`
    )
  }

  return {
    id: country.id,
    name: loc.name,
    searchTerm: loc.searchTerm,
    urlSlug: country.urlSlug,
    pageHeading: loc.pageHeading,
    locationTitle: loc.locationTitle,
    operator: country.operator,
    breadcrumbText: loc.breadcrumbText,
    tabs: country.tabs.map((t) => ({
      id: t.id,
      label: tabLabel(t.id),
      firstCardSpec: resolveFirstCardSpec(t.firstCardSpec, lang),
    })),
    targetPackage: {
      tab: pkg.tab,
      tabLabel: tabLabel(pkg.tab),
      duration,
      durationKey: pkg.durationKey,
      urlSlugPattern: pkg.urlSlugPattern,
      specValue: lang.packageData.unlimitedLabel,
      specUnit: lang.packageData.dataUnit,
    },
    planDetails: {
      minPolicies: country.planDetails.minPolicies,
      requiredPolicies: lang.planPolicies.required,
      fairUsagePattern: lang.planPolicies.fairUsageDescPattern,
    },
  }
}

/**
 * Resolve the active country config.
 *
 * Resolution order:
 *   1. Explicit `id` argument
 *   2. `AIRALO_COUNTRY` environment variable (e.g. `AIRALO_COUNTRY=japan`)
 *   3. Falls back to `'japan'`
 *
 * The returned config is already merged with the active language.
 */
export function getCountryConfig(id?: string): ResolvedCountryConfig {
  const key = (id ?? process.env.AIRALO_COUNTRY ?? 'japan').toLowerCase()
  const cfg = COUNTRIES.get(key)
  if (!cfg) {
    const available = [...COUNTRIES.keys()].join(', ')
    throw new Error(`Unknown country "${key}". Available: ${available}`)
  }
  return resolveCountryConfig(cfg, getLanguageConfig())
}
