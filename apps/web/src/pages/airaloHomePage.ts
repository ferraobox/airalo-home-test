import { expect, type Locator, type Page } from '@playwright/test'
import { type LanguageConfig } from '../lib/language'

export class AiraloHomePage {
  readonly page: Page
  private readonly lang: LanguageConfig

  /** CSS selector for axe-core scoping — search input container */
  static readonly AXE_SEARCH_INPUT = '[data-testid="search-input_text-field"]'

  /**
   * "Good" performance thresholds for the homepage.
   * @see https://web.dev/articles/vitals#defining_thresholds
   */
  static readonly PERF_THRESHOLDS = {
    FCP: 1800,
    TTFB: 800,
    LCP: 2500,
    CLS: 0.1,
    INP: 200,
    navigation: 10_000,
  } as const

  constructor(page: Page, lang: LanguageConfig) {
    this.page = page
    this.lang = lang
  }

  // ── Locators ────────────────────────────────────────────
  // Priority: getByRole > getByText > getByLabel > getByPlaceholder > getByTestId
  // @see https://playwright.dev/docs/locators#quick-guide

  /** Search input — accessible textbox role */
  get searchInput(): Locator {
    return this.page.getByRole('textbox', { name: this.lang.searchInputName })
  }

  /** Autocomplete dropdown — ARIA listbox role */
  get searchDropdown(): Locator {
    return this.page.getByRole('listbox')
  }

  /** All options inside the search dropdown */
  get searchOptions(): Locator {
    return this.searchDropdown.getByRole('option')
  }

  /** All links inside search result options (useful for count assertions) */
  get searchResultLinks(): Locator {
    return this.searchOptions.getByRole('link')
  }

  /** Clear search button — testid fallback (no accessible name on site) */
  get searchClearButton(): Locator {
    return this.page.getByTestId('search-input_clear-button')
  }

  /** Cookie-banner accept button — role + accessible name */
  get cookieAcceptButton(): Locator {
    return this.page.getByRole('button', { name: this.lang.cookieAcceptButton })
  }

  /** All images on the page — img role */
  get images(): Locator {
    return this.page.getByRole('img')
  }

  /** Homepage location tab by accessible name (e.g. /popular/i, /local/i) */
  locationTab(name: string | RegExp): Locator {
    return this.page.getByRole('tab', { name })
  }

  /** Search result option filtered by country link name */
  searchResultOption(name: string | RegExp): Locator {
    return this.searchOptions
      .filter({ has: this.page.getByRole('link', { name }) })
      .first()
  }

  // ── Actions ─────────────────────────────────────────────

  async goto() {
    // Block CleverTap / WizRocket push-notification scripts before navigation so
    // the #wzrk_wrapper overlay never appears and cannot intercept pointer events
    // in headed mode (the overlay is suppressed in headless Chrome automatically).
    await this.page.route(/wzrk|clevertap/i, (route) => route.abort())
    const prefix = this.lang.urlPrefix
    await this.page.goto(prefix ? `${prefix}/` : '/', { waitUntil: 'domcontentloaded' })
  }

  async verifyLoaded() {
    await expect(this.page).toHaveTitle(this.lang.pageTitle)
    await expect(this.searchInput).toBeVisible()
  }

  async dismissCookieBanner() {
    // Dismiss both the cookie banner and the CleverTap push-notification overlay
    // (fallback for cases where the route-block in goto() doesn't catch it).
    await Promise.allSettled([
      this.cookieAcceptButton.first().click({ timeout: 5000 }),
      this.page
        .locator('#wzrk_wrapper')
        .getByRole('button', { name: this.lang.notificationDenyButton })
        .click({ timeout: 3000 }),
    ])
  }

  async searchCountry(term: string) {
    await this.searchInput.click()
    await this.searchInput.fill(term)
    await this.searchDropdown.waitFor({ state: 'visible', timeout: 10000 })
  }

  async selectCountryFromDropdown(name: string) {
    await this.searchResultOption(new RegExp(name, 'i')).getByRole('link').click()
  }

  async waitForCountryPage(slug: string) {
    const prefix = this.lang.urlPrefix ? `${this.lang.urlPrefix}/` : ''
    await this.page.waitForURL(new RegExp(`${prefix}${slug}-esim`, 'i'), {
      timeout: 15000,
    })
  }

  async triggerSearchInteraction(term: string) {
    await this.searchInput.click()
    await this.searchInput.fill(term)
  }
}
