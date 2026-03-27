/**
 * Centralised Web Vitals helpers for Playwright performance tests.
 *
 * Responsibilities:
 *   - Inject Google's `web-vitals` IIFE into the page before navigation
 *   - Collect metric results exposed on `window.__WEB_VITALS__`
 *   - Finalise metrics by simulating a visibility change
 *   - Provide "Good" thresholds sourced from https://web.dev/articles/vitals
 *
 * @see https://www.npmjs.com/package/web-vitals
 * @see https://github.com/GoogleChrome/web-vitals
 */

import type { Page, TestInfo } from '@playwright/test'
import type { Metric } from 'web-vitals'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Metric names recognised by the collector — sourced from web-vitals SDK. */
export type MetricName = Metric['name']

/** Shape of a metric result stored by the injected collector script. */
export interface VitalResult {
  value: number
  rating: Metric['rating']
}

/** Shape of the `window.__WEB_VITALS__` store set up by the collector. */
type VitalStore = Partial<Record<MetricName, Pick<Metric, 'value' | 'rating'>>>

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/**
 * Google "Good" thresholds for each Web Vital.
 * @see https://web.dev/articles/vitals#defining_thresholds
 */
export const THRESHOLDS = {
  FCP_MS: 1800,
  TTFB_MS: 800,
  LCP_MS: 2500,
  CLS: 0.1,
  INP_MS: 200,
} as const

/** Resolved path to the web-vitals IIFE bundle inside node_modules. */
const esmRequire = createRequire(import.meta.url)
const webVitalsPkgDir = esmRequire.resolve('web-vitals').replace(/\/dist\/.*$/, '')
export const WEB_VITALS_IIFE_PATH: string = `${webVitalsPkgDir}/dist/web-vitals.iife.js`

/** Pre-read IIFE source so addInitScript works regardless of CWD / path resolution. */
const WEB_VITALS_IIFE_SOURCE: string = readFileSync(WEB_VITALS_IIFE_PATH, 'utf-8')

/* ------------------------------------------------------------------ */
/*  Page injection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Inject the `web-vitals` IIFE library and set up metric collectors on the
 * page.  Must be called **before** any navigation (e.g. in `beforeEach`).
 *
 * Collectors store `{ value, rating }` for each metric on
 * `window.__WEB_VITALS__[name]`.
 *
 * `reportAllChanges: true` is used for LCP, CLS and INP so that
 * intermediate values are available before the page is hidden.
 *
 * @see https://www.npmjs.com/package/web-vitals#report-the-value-on-every-change
 */
export async function injectWebVitals(page: Page): Promise<void> {
  // Combine IIFE + collector into a single addInitScript to guarantee
  // execution order (Playwright does NOT guarantee order across multiple
  // addInitScript calls).
  // The IIFE declares `var webVitals = …` which may be local if Playwright
  // wraps addInitScript content in a function scope.  Pass it directly to the
  // collector IIFE so we never rely on globalThis lookup.
  const collectorScript = `
    ;(function(wv) {
      var g = globalThis;
      g.__WEB_VITALS__ = {};
      if (!wv) return;
      var s = g.__WEB_VITALS__;
      wv.onFCP(function(m)  { s.FCP  = { value: m.value, rating: m.rating }; });
      wv.onTTFB(function(m) { s.TTFB = { value: m.value, rating: m.rating }; });
      wv.onLCP(function(m)  { s.LCP  = { value: m.value, rating: m.rating }; }, { reportAllChanges: true });
      wv.onCLS(function(m)  { s.CLS  = { value: m.value, rating: m.rating }; }, { reportAllChanges: true });
      wv.onINP(function(m)  { s.INP  = { value: m.value, rating: m.rating }; }, { reportAllChanges: true });
    })(typeof webVitals !== 'undefined' ? webVitals : undefined);
  `
  await page.addInitScript(WEB_VITALS_IIFE_SOURCE + '\n' + collectorScript)
}

/* ------------------------------------------------------------------ */
/*  Metric retrieval                                                  */
/* ------------------------------------------------------------------ */

/**
 * Simulate a visibility change to `hidden` so that `web-vitals` finalises
 * LCP, CLS and INP.  The library only reports final values for these
 * metrics when the page is backgrounded.
 *
 * @see https://www.npmjs.com/package/web-vitals#basic-usage
 */
export async function finalizeMetrics(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })
    Object.defineProperty(document, 'hidden', {
      value: true,
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  })
}

/**
 * Wait for a specific metric to appear on `window.__WEB_VITALS__`.
 * Uses Playwright's `waitForFunction` (raf-based polling).
 *
 * Returns `null` when the metric is not reported within `timeoutMs`
 * (e.g. INP when no interaction occurred, or CLS with zero shifts).
 */
export async function getMetric(
  page: Page,
  name: MetricName,
  timeoutMs = 10_000
): Promise<VitalResult | null> {
  try {
    const handle = await page.waitForFunction(
      (n: string) => {
        const g = globalThis as unknown as { __WEB_VITALS__?: VitalStore }
        return g.__WEB_VITALS__?.[n as MetricName] ?? null
      },
      name,
      { timeout: timeoutMs }
    )
    return (await handle.jsonValue()) as VitalResult
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Reporting                                                         */
/* ------------------------------------------------------------------ */

/**
 * Attach a metric value and its rating to the Allure report via Playwright
 * test annotations.
 */
export function attachMetric(
  testInfo: TestInfo,
  name: string,
  value: number,
  unit: string
): void {
  testInfo.annotations.push({ type: name, description: `${value.toFixed(2)} ${unit}` })
}

/**
 * Convenience: attach both the numeric value and the web-vitals rating.
 */
export function attachVital(
  testInfo: TestInfo,
  name: MetricName,
  result: VitalResult,
  unit: string
): void {
  attachMetric(testInfo, name, result.value, unit)
  attachMetric(testInfo, `${name}_rating`, 0, result.rating)
}
