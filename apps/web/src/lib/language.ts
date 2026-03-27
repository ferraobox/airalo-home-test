/**
 * Language configuration types and resolver.
 *
 * Types and helper functions live here; raw JSON data lives in
 * `../fixtures/languages.json`.
 */

import { createRequire } from 'node:module'
import { toRegExp } from './regex'

const esmRequire = createRequire(import.meta.url)

// ── Raw JSON shape (all regex serialized as strings) ──────

interface RawLanguageConfig {
  id: string
  name: string
  urlPrefix: string
  searchInputName: string
  cookieAcceptButton: string
  notificationDenyButton: string
  pageTitle: string
  homeTabs: {
    popular: string
    local: string
    regional: string
    global: string
  }
  packagePage: {
    chooseYourPackage: string
    buyNow: string
    packageDetails: string
    broaderCoverage: string
    fairUsage: string
  }
  packageTabs: {
    standard: string
    unlimited: string
    dataOnly: string
  }
  packageData: {
    unlimitedLabel: string
    dataUnit: string
    durations: Record<string, string>
  }
  planPolicies: {
    required: string[]
    fairUsageDescPattern: string
  }
}

// ── Public types ──────────────────────────────────────────

export interface LanguageConfig {
  id: string
  name: string
  urlPrefix: string
  searchInputName: RegExp
  cookieAcceptButton: RegExp
  notificationDenyButton: RegExp
  pageTitle: RegExp
  homeTabs: {
    popular: RegExp
    local: RegExp
    regional: RegExp
    global: RegExp
  }
  packagePage: {
    chooseYourPackage: RegExp
    buyNow: RegExp
    packageDetails: RegExp
    broaderCoverage: RegExp
    fairUsage: RegExp
  }
  packageTabs: {
    standard: RegExp
    unlimited: RegExp
    dataOnly: RegExp
  }
  packageData: {
    unlimitedLabel: string
    dataUnit: string
    durations: Record<string, string>
  }
  planPolicies: {
    required: string[]
    fairUsageDescPattern: string
  }
}

// ── Hydration ─────────────────────────────────────────────

function hydrateLanguageConfig(raw: RawLanguageConfig): LanguageConfig {
  return {
    id: raw.id,
    name: raw.name,
    urlPrefix: raw.urlPrefix,
    searchInputName: toRegExp(raw.searchInputName),
    cookieAcceptButton: toRegExp(raw.cookieAcceptButton),
    notificationDenyButton: toRegExp(raw.notificationDenyButton),
    pageTitle: toRegExp(raw.pageTitle),
    homeTabs: {
      popular: toRegExp(raw.homeTabs.popular),
      local: toRegExp(raw.homeTabs.local),
      regional: toRegExp(raw.homeTabs.regional),
      global: toRegExp(raw.homeTabs.global),
    },
    packagePage: {
      chooseYourPackage: toRegExp(raw.packagePage.chooseYourPackage),
      buyNow: toRegExp(raw.packagePage.buyNow),
      packageDetails: toRegExp(raw.packagePage.packageDetails),
      broaderCoverage: toRegExp(raw.packagePage.broaderCoverage),
      fairUsage: toRegExp(raw.packagePage.fairUsage),
    },
    packageTabs: {
      standard: toRegExp(raw.packageTabs.standard),
      unlimited: toRegExp(raw.packageTabs.unlimited),
      dataOnly: toRegExp(raw.packageTabs.dataOnly),
    },
    packageData: raw.packageData,
    planPolicies: raw.planPolicies,
  }
}

// ── Language registry (loaded + hydrated from JSON) ───────

const rawLanguages = esmRequire('../fixtures/languages.json') as Record<
  string,
  RawLanguageConfig
>

export const LANGUAGES = new Map<string, LanguageConfig>(
  Object.entries(rawLanguages).map(([key, raw]) => [key, hydrateLanguageConfig(raw)])
)

// ── Resolver ──────────────────────────────────────────────

/**
 * Resolve the active language config.
 *
 * Resolution order:
 *   1. Explicit `id` argument
 *   2. `AIRALO_LANGUAGE` environment variable (e.g. `AIRALO_LANGUAGE=en`)
 *   3. Falls back to `'en'`
 */
export function getLanguageConfig(id?: string): LanguageConfig {
  const key = (id ?? process.env.AIRALO_LANGUAGE ?? 'en').toLowerCase()
  const cfg = LANGUAGES.get(key)
  if (!cfg) {
    const available = [...LANGUAGES.keys()].join(', ')
    throw new Error(`Unknown language "${key}". Available: ${available}`)
  }
  return cfg
}

/** Build a URL path with the language prefix. */
export function buildLangPath(lang: LanguageConfig, path = '/'): string {
  return lang.urlPrefix ? `${lang.urlPrefix}${path}` : path
}
