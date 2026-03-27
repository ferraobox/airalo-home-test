import { expect, type Locator, type Page } from '@playwright/test'
import { type LanguageConfig } from '../lib/language'

export class CountryPackagesPage {
  readonly page: Page
  private readonly lang: LanguageConfig

  /** CSS selector for axe-core scoping — packages wrapper */
  static readonly AXE_PACKAGES_CONTAINER =
    '[data-testid="store-location_packages-container"]'

  constructor(page: Page, lang: LanguageConfig) {
    this.page = page
    this.lang = lang
  }

  // ── Locators ────────────────────────────────────────────
  // Role/text preferred; testid used only when the third-party site
  // exposes no unique accessible name for custom components.
  // @see https://playwright.dev/docs/locators#quick-guide

  /** Main heading — testid (no unique accessible heading name across pages) */
  get pageHeading(): Locator {
    return this.page.getByTestId('store-location_location-heading')
  }

  /** Country title — testid (generic text element) */
  get locationTitle(): Locator {
    return this.page.getByTestId('package-location-header_title')
  }

  /** Operator name — testid (no accessible role on site) */
  get operatorName(): Locator {
    return this.page.getByTestId('store-operator-details_first-network')
  }

  /** Operator image/flag */
  get operatorImage(): Locator {
    return this.page.getByTestId('package-location-header_operator-image')
  }

  /** Packages container — testid (wrapper div) */
  get packagesContainer(): Locator {
    return this.page.getByTestId('store-location_packages-container')
  }

  /** Package card buttons — testid (custom card component) */
  get packageButtons(): Locator {
    return this.page.getByTestId('package-grouped-packages_package-button')
  }

  /** Duration group titles — testid */
  get durationTitles(): Locator {
    return this.page.getByTestId('package-grouped-packages_duration-title')
  }

  /** Breadcrumb container */
  get breadcrumb(): Locator {
    return this.page.getByTestId('store-location_breadcrumb-container')
  }

  /** "Choose your package" title */
  get productDetailsTitle(): Locator {
    return this.page.getByTestId('store-location_product-details-title')
  }

  // ── Package card detail locators ────────────────────────

  /** Price amount inside a package card at given index */
  packagePriceAmount(index = 0): Locator {
    return this.packageButtons.nth(index).getByTestId('price_amount')
  }

  /** Data spec value (e.g. "1", "Unlimited") inside a package card at given index */
  packageSpecValue(index = 0): Locator {
    return this.packageButtons.nth(index).getByTestId('card-package_spec-value')
  }

  /** Data spec unit (e.g. "GB") inside a package card at given index */
  packageSpecUnit(index = 0): Locator {
    return this.packageButtons.nth(index).getByTestId('card-package_spec-unit')
  }

  /** Description/throttle info on a package card */
  packageDescription(index = 0): Locator {
    return this.packageButtons.nth(index).getByTestId('card-package-description_item')
  }

  // ── Tab locators — use role "tab" with accessible name ──

  /** Tab by accessible name (e.g. lang.packageTabs.standard) */
  tab(name: string | RegExp): Locator {
    return this.page.getByRole('tab', { name })
  }

  get standardTab(): Locator {
    return this.tab(this.lang.packageTabs.standard)
  }

  get unlimitedTab(): Locator {
    return this.tab(this.lang.packageTabs.unlimited)
  }

  get dataTab(): Locator {
    return this.tab(this.lang.packageTabs.dataOnly)
  }

  // ── Cart / Buy-now dialog ───────────────────────────────

  /** Sticky cart-navigation dialog that appears when a package is selected */
  get cartDialog(): Locator {
    return this.page.locator('div[role="dialog"].sticky')
  }

  /** Total price shown in the cart dialog */
  get cartTotalPrice(): Locator {
    return this.cartDialog.getByTestId('price_amount')
  }

  /** "Buy now" call-to-action button */
  get buyNowButton(): Locator {
    return this.cartDialog.getByTestId('cart-navigation_select-package-cta')
  }

  /** "Package details" button in cart dialog */
  get packageDetailsButton(): Locator {
    return this.cartDialog.getByTestId('store-operator-details_plan-details-button')
  }

  // ── Package details panel (p-dialog overlay) ────────────

  /** The detail overlay that opens after clicking "Package details" */
  get planDetailsPanel(): Locator {
    return this.page.locator('.p-dialog')
  }

  /** All detail item containers inside the plan-details panel */
  get planDetailItems(): Locator {
    return this.planDetailsPanel.getByTestId('plan-details_detail')
  }

  /** Detail title inside the plan-details panel at index */
  planDetailTitle(index: number): Locator {
    return this.planDetailItems.nth(index).getByTestId('plan-details_detail-title')
  }

  /** Detail description inside the plan-details panel at index */
  planDetailDescription(index: number): Locator {
    return this.planDetailItems.nth(index).getByTestId('plan-details_detail-description')
  }

  // ── Broader coverage section ────────────────────────────

  /** "Need broader coverage?" section */
  get broaderCoverage(): Locator {
    return this.page.getByTestId('store-broader-coverage_outer-container')
  }

  /** Other networks CTA (+1 other, etc.) */
  get otherNetworksCta(): Locator {
    return this.page.getByTestId('store-operator-details_other-networks-cta').first()
  }

  /** Check compatibility button */
  get checkCompatibilityButton(): Locator {
    return this.page.getByTestId('store-operator-details_check-compatibility-button')
  }

  // ── Actions ─────────────────────────────────────────────

  async verifyPackagesLoaded() {
    await expect(this.packagesContainer).toBeVisible({ timeout: 15000 })
    await expect(this.packageButtons.first()).toBeVisible({ timeout: 10000 })
  }

  async clickTab(name: string | RegExp) {
    await this.tab(name).click()
    await this.packageButtons.first().waitFor({ state: 'visible', timeout: 10000 })
  }

  async selectPackage(index: number) {
    await this.packageButtons.nth(index).click()
    await this.cartDialog.waitFor({ state: 'visible', timeout: 10000 })
  }

  async openPackageDetails() {
    await this.packageDetailsButton.click()
    await this.planDetailsPanel.waitFor({ state: 'visible', timeout: 10000 })
    // Wait for the detail items to render inside the dialog
    await this.planDetailItems.first().waitFor({ state: 'visible', timeout: 10000 })
  }

  async getFirstPackagePrice(): Promise<string> {
    const text = await this.packagePriceAmount().textContent()
    return (text ?? '').trim()
  }

  async getDurationGroups(): Promise<string[]> {
    const count = await this.durationTitles.count()
    const titles: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await this.durationTitles.nth(i).textContent()
      titles.push((text ?? '').trim())
    }
    return titles
  }

  /** Find the index of a package by matching its duration group text */
  async findPackageIndexByDuration(duration: string): Promise<number> {
    const durations = await this.getDurationGroups()
    const idx = durations.findIndex((d) => d.toLowerCase() === duration.toLowerCase())
    if (idx === -1)
      throw new Error(`Duration "${duration}" not found in: ${durations.join(', ')}`)
    return idx
  }

  /** Check if a package card at index has the selected border */
  async isPackageSelected(index: number): Promise<boolean> {
    const cls = await this.packageButtons
      .nth(index)
      .getByTestId('card-package_container')
      .getAttribute('class')
    return (cls ?? '').includes('border-border-selected')
  }

  /** Get all plan detail titles as an array of strings */
  async getPlanDetailTitles(): Promise<string[]> {
    const count = await this.planDetailItems.count()
    const titles: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await this.planDetailTitle(i).textContent()
      titles.push((text ?? '').trim())
    }
    return titles
  }
}
