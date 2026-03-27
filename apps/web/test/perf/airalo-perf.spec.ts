import { test, expect } from '@playwright/test'
import { epic, feature, story } from 'allure-js-commons'
import {
  injectWebVitals,
  finalizeMetrics,
  getMetric,
  attachMetric,
} from '../../src/lib/web-vitals'
import { AiraloHomePage } from '../../src/pages/airaloHomePage'
import { fmtMetric } from '../../src/lib/format'
import { getCountryConfig } from '../../src/lib/country'
import { getLanguageConfig, buildLangPath } from '../../src/lib/language'

const lang = getLanguageConfig()
const country = getCountryConfig()

test('Core Web Vitals — Airalo Homepage', async ({ page }, testInfo) => {
  const home = new AiraloHomePage(page, lang)
  const t = AiraloHomePage.PERF_THRESHOLDS

  await epic('Performance')
  await feature('Core Web Vitals')
  await story('Homepage')

  await injectWebVitals(page)

  const start = Date.now()
  await home.page.goto(buildLangPath(lang), { waitUntil: 'load' })
  const navTime = Date.now() - start

  await test.step('FCP — First Contentful Paint', async () => {
    const m = await getMetric(page, 'FCP')
    expect(m, 'FCP was not reported by web-vitals').not.toBeNull()
    attachMetric(testInfo, 'FCP', m!.value, 'ms')
    expect(
      m!.value,
      `FCP: ${fmtMetric(m!.value, 'ms')} exceeded threshold of ${fmtMetric(t.FCP, 'ms')}`
    ).toBeLessThanOrEqual(t.FCP)
  })

  await test.step('TTFB — Time to First Byte', async () => {
    const m = await getMetric(page, 'TTFB')
    expect(m, 'TTFB was not reported by web-vitals').not.toBeNull()
    attachMetric(testInfo, 'TTFB', m!.value, 'ms')
    expect(
      m!.value,
      `TTFB: ${fmtMetric(m!.value, 'ms')} exceeded threshold of ${fmtMetric(t.TTFB, 'ms')}`
    ).toBeLessThanOrEqual(t.TTFB)
  })

  await test.step('LCP — Largest Contentful Paint', async () => {
    await finalizeMetrics(page)
    const m = await getMetric(page, 'LCP')
    expect(m, 'LCP was not reported by web-vitals').not.toBeNull()
    attachMetric(testInfo, 'LCP', m!.value, 'ms')
    expect(
      m!.value,
      `LCP: ${fmtMetric(m!.value, 'ms')} exceeded threshold of ${fmtMetric(t.LCP, 'ms')}`
    ).toBeLessThanOrEqual(t.LCP)
  })

  await test.step('CLS — Cumulative Layout Shift', async () => {
    const m = await getMetric(page, 'CLS', 5_000)
    const value = m?.value ?? 0
    attachMetric(testInfo, 'CLS', value, '')
    expect(
      value,
      `CLS: ${fmtMetric(value, '')} exceeded threshold of ${fmtMetric(t.CLS, '')}`
    ).toBeLessThanOrEqual(t.CLS)
  })

  await test.step('INP — Interaction to Next Paint', async () => {
    await home.triggerSearchInteraction(country.searchTerm)
    await finalizeMetrics(page)
    const m = await getMetric(page, 'INP', 5_000)
    const value = m?.value ?? 0
    attachMetric(testInfo, 'INP', value, 'ms')
    expect(
      value,
      `INP: ${fmtMetric(value, 'ms')} exceeded threshold of ${fmtMetric(t.INP, 'ms')}`
    ).toBeLessThanOrEqual(t.INP)
  })

  await test.step('Navigation completes within threshold', () => {
    attachMetric(testInfo, 'Navigation', navTime, 'ms')
    expect(
      navTime,
      `Navigation: ${fmtMetric(navTime, 'ms')} exceeded threshold of ${fmtMetric(t.navigation, 'ms')}`
    ).toBeLessThan(t.navigation)
  })
})
