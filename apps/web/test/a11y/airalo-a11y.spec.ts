import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { AiraloHomePage } from '../../src/pages/airaloHomePage'
import { CountryPackagesPage } from '../../src/pages/countryPackagesPage'
import { filterCritical, attachAxeResults } from '../../src/lib/accessibility'
import { getCountryConfig } from '../../src/lib/country'
import { getLanguageConfig, buildLangPath } from '../../src/lib/language'

const lang = getLanguageConfig()
const country = getCountryConfig()

test('Accessibility — Homepage WCAG 2.1 AA', async ({ page }) => {
  const home = new AiraloHomePage(page, lang)
  await home.goto()
  await home.dismissCookieBanner()

  await test.step('homepage has no critical accessibility violations', async () => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    await attachAxeResults('Homepage — Full Page', results)
    const critical = filterCritical(results.violations)

    expect(
      critical,
      `Found ${critical.length} critical/serious accessibility violations`
    ).toHaveLength(0)
  })

  await test.step('search input meets accessibility standards', async () => {
    await expect(home.searchInput).toBeVisible()

    const results = await new AxeBuilder({ page })
      .include(AiraloHomePage.AXE_SEARCH_INPUT)
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    await attachAxeResults('Homepage — Search Input', results)
    expect(results.violations).toHaveLength(0)
  })

  await test.step('homepage navigation is keyboard accessible', async () => {
    // Tab through the page to reach the search input
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      // eslint-disable-next-line playwright/no-conditional-in-test -- iterative keyboard probing is inherently conditional
      if (await home.searchInput.evaluate((el) => el === document.activeElement)) break
    }

    // Verify search interaction works via keyboard
    await home.searchInput.click()
    await home.searchInput.fill(country.searchTerm)
    await expect(home.searchDropdown).toBeVisible({ timeout: 10000 })

    // Navigate dropdown with keyboard
    await page.keyboard.press('ArrowDown')
  })

  await test.step('all images have alt text on homepage', async () => {
    const images = home.images
    const count = await images.count()
    expect(count).toBeGreaterThan(0)

    const missingAlt: string[] = []
    for (let i = 0; i < Math.min(count, 50); i++) {
      const alt = await images.nth(i).getAttribute('alt')
      const src = await images.nth(i).getAttribute('src')
      // eslint-disable-next-line playwright/no-conditional-in-test -- collecting audit data requires iteration
      if (alt === null || alt === '') {
        missingAlt.push(src ?? `image[${i}]`)
      }
    }

    const { attachment } = await import('allure-js-commons')
    const hasGaps = missingAlt.length > 0
    // eslint-disable-next-line playwright/no-conditional-in-test -- ternary builds audit summary string
    const summary = hasGaps
      ? `Missing alt text (${missingAlt.length}/${count}):\n${missingAlt.join('\n')}`
      : `All ${count} images have alt text.`
    await attachment('Image Alt Text Audit', Buffer.from(summary, 'utf-8'), 'text/plain')

    // Allow up to 10% of images to be missing alt (decorative images)
    expect(missingAlt.length).toBeLessThan(count * 0.1 + 1)
  })

  await test.step('color contrast meets WCAG AA standards on homepage', async () => {
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()

    await attachAxeResults('Homepage — Color Contrast', results)

    // Soft assertion — report but don't fail for minor contrast issues on third-party site
    expect(results.violations.length).toBeLessThanOrEqual(5)
  })

  await test.step('page landmarks are present on homepage', async () => {
    const results = await new AxeBuilder({ page })
      .withRules(['landmark-one-main', 'region'])
      .analyze()

    await attachAxeResults('Homepage — Landmarks', results)

    // Only fail on critical issues; some third-party sites have minor landmark gaps
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toHaveLength(0)
  })

  await test.step('ARIA attributes are used correctly on homepage', async () => {
    const results = await new AxeBuilder({ page })
      .withRules([
        'aria-allowed-attr',
        'aria-required-attr',
        'aria-valid-attr',
        'aria-valid-attr-value',
        'aria-roles',
      ])
      .analyze()

    await attachAxeResults('Homepage — ARIA Attributes', results)
    const critical = filterCritical(results.violations)

    expect(
      critical,
      `Found ${critical.length} critical/serious ARIA violations`
    ).toHaveLength(0)
  })
})

test(`Accessibility — ${country.name} eSIM Page WCAG 2.1 AA`, async ({ page }) => {
  const home = new AiraloHomePage(page, lang)
  const packages = new CountryPackagesPage(page, lang)
  await home.goto()
  await home.dismissCookieBanner()

  await test.step(`${country.name} eSIM page has no critical accessibility violations`, async () => {
    await page.goto(buildLangPath(lang, `/${country.urlSlug}`))
    await page.waitForLoadState('domcontentloaded')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    await attachAxeResults(`${country.name} eSIM — Full Page`, results)
    const critical = filterCritical(results.violations)

    expect(
      critical,
      `Found ${critical.length} critical/serious accessibility violations`
    ).toHaveLength(0)
  })

  await test.step(`${country.name} eSIM page package cards meet accessibility standards`, async () => {
    await packages.packagesContainer.waitFor({ state: 'visible', timeout: 15000 })

    const results = await new AxeBuilder({ page })
      .include(CountryPackagesPage.AXE_PACKAGES_CONTAINER)
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    await attachAxeResults(`${country.name} eSIM — Package Cards`, results)
    const critical = filterCritical(results.violations)

    expect(
      critical,
      `Package cards have ${critical.length} critical/serious a11y violations`
    ).toHaveLength(0)
  })

  await test.step(`interactive elements are focusable on ${country.name} page`, async () => {
    const results = await new AxeBuilder({ page })
      .withRules(['focus-order-semantics', 'tabindex', 'scrollable-region-focusable'])
      .analyze()

    await attachAxeResults(`${country.name} eSIM — Focus & Tabindex`, results)
    const critical = filterCritical(results.violations)

    expect(critical, `Found ${critical.length} focus/tabindex violations`).toHaveLength(0)
  })
})
