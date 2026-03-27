import { test, expect } from '@playwright/test'
import { epic, feature, story, parameter, attachment } from 'allure-js-commons'
import { AiraloHomePage } from '../../src/pages/airaloHomePage'
import { CountryPackagesPage } from '../../src/pages/countryPackagesPage'
import { normalisePrice } from '../../src/lib/format'
import { getCountryConfig } from '../../src/lib/country'
import { getLanguageConfig, buildLangPath } from '../../src/lib/language'
import { toMatcher } from '../../src/lib/regex'

const lang = getLanguageConfig()
const country = getCountryConfig()
const pkg = country.targetPackage

// ---------------------------------------------------------------------------
// Test 1 — Full purchase-path E2E (parameterized by COUNTRY env var):
//   1. Open Airalo website
//   2. Search for the country & click the result
//   3. Click target tab → select target duration package
//   4. Verify card price matches the price next to Buy Now
// ---------------------------------------------------------------------------

test(`${country.name} eSIM — search → ${pkg.tab} ${pkg.duration} → verify price at Buy Now`, async ({
  page,
}) => {
  const home = new AiraloHomePage(page, lang)
  const packages = new CountryPackagesPage(page, lang)

  await epic('E2E')
  await feature(`${country.name} eSIM Purchase`)
  await story(`Search → ${pkg.tab} ${pkg.duration} → Price verification at checkout`)
  await parameter('country', country.id)
  await parameter('language', lang.id)

  // ── Step 1: Open Airalo website ─────────────────────────

  await test.step('open Airalo homepage and verify it loaded', async () => {
    await home.goto()
    await home.dismissCookieBanner()
    await home.verifyLoaded()
    await expect(page).toHaveTitle(lang.pageTitle)
    await expect(home.searchInput).toBeVisible()
    await expect(home.searchInput).toBeEnabled()
  })

  await test.step('homepage displays location tabs', async () => {
    await expect(home.locationTab(lang.homeTabs.popular)).toBeVisible()
    await expect(home.locationTab(lang.homeTabs.local)).toBeVisible()
    await expect(home.locationTab(lang.homeTabs.regional)).toBeVisible()
    await expect(home.locationTab(lang.homeTabs.global)).toBeVisible()
  })

  // ── Step 2: Search for the country and click the result ─

  await test.step(`search for "${country.searchTerm}" and select from dropdown`, async () => {
    await home.searchCountry(country.searchTerm)

    // Dropdown is visible with results
    await expect(home.searchDropdown).toBeVisible({ timeout: 10000 })
    await expect(home.searchOptions).not.toHaveCount(0)

    // Country appears as a selectable option
    const countryOption = home.searchResultOption(new RegExp(country.searchTerm, 'i'))
    await expect(countryOption).toBeVisible({ timeout: 5000 })

    // Click the country result link
    await home.selectCountryFromDropdown(country.searchTerm)
    await home.waitForCountryPage(country.urlSlug.replace(/-esim$/, ''))
    await expect(page).toHaveURL(new RegExp(country.urlSlug, 'i'))
  })

  // ── Verify country page content ─────────────────────────

  await test.step('page heading and location title are correct', async () => {
    await expect(packages.pageHeading).toHaveText(new RegExp(country.pageHeading, 'i'))
    await expect(packages.locationTitle).toHaveText(country.locationTitle)
  })

  await test.step(`operator info (${country.operator}) is shown`, async () => {
    await expect(packages.operatorName).toBeVisible()
    await expect(packages.operatorName).toHaveText(new RegExp(country.operator, 'i'))
  })

  await test.step('operator image / flag is shown', async () => {
    await expect(packages.operatorImage).toBeVisible()
    await expect(packages.operatorImage).toHaveAttribute('src', /.+/)
  })

  await test.step('breadcrumb contains navigation context', async () => {
    await expect(packages.breadcrumb).toBeVisible()
    await expect(packages.breadcrumb).toContainText(country.breadcrumbText)
  })

  await test.step('"Choose your package" title is visible', async () => {
    await expect(packages.productDetailsTitle).toBeVisible()
    await expect(packages.productDetailsTitle).toHaveText(lang.packagePage.chooseYourPackage)
  })

  await test.step('check compatibility button is visible', async () => {
    await expect(packages.checkCompatibilityButton).toBeVisible()
  })

  // ── Step 3a: Verify tabs exist ──────────────────────────

  await test.step('package tabs are displayed', async () => {
    await packages.verifyPackagesLoaded()
    for (const tab of country.tabs) {
      await expect(packages.tab(tab.label)).toBeVisible()
    }
  })

  // ── Step 3b: Click target tab ───────────────────────────

  await test.step(`click ${pkg.tab} tab and verify packages load`, async () => {
    await packages.clickTab(pkg.tabLabel)

    await expect(packages.packageButtons.first()).toBeVisible({ timeout: 10000 })

    const firstSpec = (await packages.packageSpecValue(0).textContent())?.trim() ?? ''
    const tabCfg = country.tabs.find((t) => t.id === pkg.tab)
    expect(firstSpec).toMatch(toMatcher(tabCfg?.firstCardSpec))
  })

  await test.step(`${pkg.tab} tab displays multiple duration groups`, async () => {
    const durations = await packages.getDurationGroups()
    expect(durations.length).toBeGreaterThanOrEqual(3)
    expect(durations).toContain(pkg.duration)

    await attachment(
      'Duration Groups',
      Buffer.from(durations.join(', '), 'utf-8'),
      'text/plain'
    )
  })

  // ── Step 3c: Select the target package ──────────────────

  let cardPriceText = ''
  let targetIndex = -1

  await test.step(`find and select the ${pkg.duration} ${pkg.tab} package`, async () => {
    targetIndex = await packages.findPackageIndexByDuration(pkg.duration)

    // Capture card price BEFORE clicking
    cardPriceText = (await packages.packagePriceAmount(targetIndex).textContent()) ?? ''
    expect(cardPriceText.trim()).toBeTruthy()

    // Verify the card shows expected spec value
    const dataVal = await packages.packageSpecValue(targetIndex).textContent()
    expect(dataVal?.trim()).toBe(pkg.specValue)

    // Verify the card shows expected unit
    const unit = await packages.packageSpecUnit(targetIndex).textContent()
    expect(unit?.trim()).toBe(pkg.specUnit)

    await parameter('card_price', cardPriceText.trim())

    // Click the target package
    await packages.selectPackage(targetIndex)
  })

  await test.step('URL updates to the package slug', async () => {
    await expect(page).toHaveURL(new RegExp(pkg.urlSlugPattern, 'i'), { timeout: 10000 })
  })

  await test.step('selected card shows active state', async () => {
    const selected = await packages.isPackageSelected(targetIndex)
    expect(selected).toBe(true)
  })

  // ── Step 4: Verify price matches at Buy Now ─────────────

  await test.step('cart dialog appears with Buy Now button', async () => {
    await expect(packages.cartDialog).toBeVisible()
    await expect(packages.buyNowButton).toBeVisible()
    await expect(packages.buyNowButton).toHaveText(lang.packagePage.buyNow)
    await expect(packages.buyNowButton).toBeEnabled()
  })

  await test.step('price on card matches the price next to Buy Now', async () => {
    // The cart total must show the same price text as the card
    await expect(packages.cartTotalPrice).toHaveText(cardPriceText.trim())

    // Numeric cross-check for robustness
    const cartPriceText = (await packages.cartTotalPrice.textContent()) ?? ''
    const cardNumeric = normalisePrice(cardPriceText)
    const cartNumeric = normalisePrice(cartPriceText)
    expect(cardNumeric).toBe(cartNumeric)
    expect(parseFloat(cartNumeric)).toBeGreaterThan(0)

    await parameter('cart_total_price', cartPriceText.trim())
    await attachment(
      'Price Verification',
      Buffer.from(
        [
          `Card price : ${cardPriceText.trim()}`,
          `Cart price : ${cartPriceText.trim()}`,
          `Card (num) : ${cardNumeric}`,
          `Cart (num) : ${cartNumeric}`,
          `Match      : ✓`,
        ].join('\n'),
        'utf-8'
      ),
      'text/plain'
    )
  })

  // ── Package Details panel ───────────────────────────────

  await test.step('"Package details" button is available', async () => {
    await expect(packages.packageDetailsButton).toBeVisible()
    await expect(packages.packageDetailsButton).toHaveText(lang.packagePage.packageDetails)
  })

  await test.step('open Package details and verify plan information', async () => {
    await packages.openPackageDetails()
    await expect(packages.planDetailsPanel).toBeVisible()

    const titles = await packages.getPlanDetailTitles()
    expect(titles.length).toBeGreaterThanOrEqual(country.planDetails.minPolicies)

    for (const policy of country.planDetails.requiredPolicies) {
      expect(titles.some((t) => new RegExp(policy, 'i').test(t))).toBe(true)
    }

    await attachment(
      'Plan Detail Policies',
      Buffer.from(titles.join('\n'), 'utf-8'),
      'text/plain'
    )
  })

  await test.step('fair usage / throttle policy is documented', async () => {
    const titles = await packages.getPlanDetailTitles()
    const fairIdx = titles.findIndex((t) => lang.packagePage.fairUsage.test(t))
    expect(fairIdx).toBeGreaterThanOrEqual(0)

    await expect(packages.planDetailDescription(fairIdx)).toContainText(
      new RegExp(country.planDetails.fairUsagePattern, 'i')
    )
  })

  // ── Broader coverage / upsell section ───────────────────

  await test.step('broader coverage upsell section is visible', async () => {
    await page.keyboard.press('Escape')
    await expect(packages.broaderCoverage).toBeVisible()
    await expect(packages.broaderCoverage).toContainText(lang.packagePage.broaderCoverage)
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Tab switching & Standard packages (parameterized)
// ---------------------------------------------------------------------------

test(`${country.name} eSIM — Standard tab packages & tab switching`, async ({ page }) => {
  const home = new AiraloHomePage(page, lang)
  const packages = new CountryPackagesPage(page, lang)

  await epic('E2E')
  await feature(`${country.name} eSIM Purchase`)
  await story('Standard packages & tab navigation')
  await parameter('country', country.id)
  await parameter('language', lang.id)

  await test.step(`navigate to ${country.name} packages page`, async () => {
    await home.goto()
    await home.dismissCookieBanner()
    await home.searchCountry(country.searchTerm)
    await home.selectCountryFromDropdown(country.searchTerm)
    await home.waitForCountryPage(country.urlSlug.replace(/-esim$/, ''))
    await packages.verifyPackagesLoaded()
  })

  await test.step('Standard tab shows packages with numeric data values', async () => {
    await packages.clickTab(lang.packageTabs.standard)
    await packages.verifyPackagesLoaded()

    const dataVal = await packages.packageSpecValue(0).textContent()
    expect(dataVal?.trim()).toMatch(/^\d+$/)

    const unit = await packages.packageSpecUnit(0).textContent()
    expect(unit?.trim()).toBe(lang.packageData.dataUnit)
  })

  await test.step('Standard tab packages have valid prices', async () => {
    const price = await packages.getFirstPackagePrice()
    const numericPrice = parseFloat(normalisePrice(price))
    expect(numericPrice).toBeGreaterThan(0)

    await parameter('standard_first_price', price)
  })

  await test.step('Standard tab displays duration groups', async () => {
    const durations = await packages.getDurationGroups()
    expect(durations.length).toBeGreaterThan(0)
    expect(durations).toContain(pkg.duration)
  })

  await test.step('switching from Standard to Unlimited changes packages', async () => {
    const standardPrice = await packages.getFirstPackagePrice()

    await packages.clickTab(lang.packageTabs.unlimited)
    const unlimitedSpec = await packages.packageSpecValue(0).textContent()
    expect(unlimitedSpec?.trim()).toBe(lang.packageData.unlimitedLabel)

    const unlimitedPrice = await packages.getFirstPackagePrice()
    expect(normalisePrice(unlimitedPrice)).not.toBe(normalisePrice(standardPrice))
  })

  await test.step('switching back to Standard restores original content', async () => {
    await packages.clickTab(lang.packageTabs.standard)
    const dataVal = await packages.packageSpecValue(0).textContent()
    expect(dataVal?.trim()).toMatch(/^\d+$/)
  })
})

// ---------------------------------------------------------------------------
// Test 3 — Homepage search UX edge cases (parameterized)
// ---------------------------------------------------------------------------

test(`Homepage search — autocomplete, case-insensitive, invalid input [${country.name}]`, async ({
  page,
}) => {
  const home = new AiraloHomePage(page, lang)

  await epic('E2E')
  await feature('Homepage')
  await story('Search UX & edge cases')
  await parameter('country', country.id)
  await parameter('language', lang.id)

  const term = country.searchTerm
  const termLower = term.toLowerCase()
  const termPartial = term.slice(0, 3)

  await test.step('navigate and dismiss cookie banner', async () => {
    await home.goto()
    await home.dismissCookieBanner()
  })

  await test.step('page title contains Airalo', async () => {
    await expect(page).toHaveTitle(lang.pageTitle)
  })

  await test.step('search is case-insensitive', async () => {
    await home.searchCountry(termLower)
    await expect(home.searchDropdown).toBeVisible({ timeout: 10000 })
    await expect(home.searchResultOption(new RegExp(term, 'i'))).toBeVisible({ timeout: 5000 })
  })

  await test.step('search with partial match shows autocomplete', async () => {
    await home.searchCountry(termPartial)
    await expect(home.searchResultOption(new RegExp(term, 'i'))).toBeVisible({ timeout: 5000 })
  })

  await test.step('search for non-existent country shows empty results', async () => {
    await home.searchInput.click()
    await home.searchInput.fill('Zzyzxland')
    await expect(home.searchResultLinks).toHaveCount(0, { timeout: 5000 })
  })

  await test.step('clearing search input resets dropdown', async () => {
    await home.searchInput.fill('')
    await expect(home.searchResultOption(new RegExp(term, 'i'))).not.toBeVisible({ timeout: 5000 })
  })

  await test.step('page loads within acceptable time', async () => {
    const start = Date.now()
    await page.goto(buildLangPath(lang), { waitUntil: 'domcontentloaded' })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(15000)

    await parameter('page_load_ms', String(elapsed))
  })
})
