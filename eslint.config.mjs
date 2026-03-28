import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import jest from 'eslint-plugin-jest'
import playwright from 'eslint-plugin-playwright'

export default tseslint.config(
  // ── Global ignores ────────────────────────────────────────
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/.playwright/**',
      '**/allure-results/**',
      '**/allure-report/**',
      '**/allure-history/**',
      '**/test-results/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '**/jest.config.ts',
      '**/playwright.config.ts',
      '**/scrape-airalo.spec.ts',
    ],
  },

  // ── Base: JS recommended + TS type-checked ────────────────
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // ── Jest rules for API tests ──────────────────────────────
  {
    files: ['apps/api/test/**/*.test.ts'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      // Every test must contain at least one expect()
      'jest/expect-expect': [
        'error',
        { assertFunctionNames: ['expect', 'expectClientError'] },
      ],
      // No standalone expect() outside of test/it blocks
      'jest/no-standalone-expect': 'error',
      // No expect() inside catch blocks without throwing
      'jest/no-conditional-expect': 'error',
      // No duplicate test names within a describe
      'jest/no-identical-title': 'error',
      // Prefer .toHaveLength(x) over .toBe(x) on .length
      'jest/prefer-to-have-length': 'warn',
      // Prefer .toContain(x) over .toBe(true) on .includes()
      'jest/prefer-to-contain': 'warn',
      // Disallow disabled tests (.skip / xit / xdescribe)
      'jest/no-disabled-tests': 'warn',
      // Disallow focused tests (.only) — prevents CI leaks
      'jest/no-focused-tests': 'error',
      // Require test titles to be descriptive strings
      'jest/valid-title': 'error',
      // Prefer strict equality (.toBe / .toStrictEqual) over loose
      'jest/prefer-strict-equal': 'warn',
      // Warn on test callbacks with done() in async tests
      'jest/no-done-callback': 'error',
      // Disallow jasmine globals (fdescribe, fit, etc.)
      'jest/no-jasmine-globals': 'error',
      // jest.fn() mocks trigger false unbound-method warnings
      '@typescript-eslint/unbound-method': 'off',
      // State machine tests chain destructured {state, ctx} assignments
      'no-useless-assignment': 'off',
    },
  },

  // ── Jest rules for API test helpers (non-test files) ──────
  {
    files: ['apps/api/test/helpers/**/*.ts'],
    rules: {},
  },

  // ── Jest rules for web unit tests ─────────────────────────
  {
    files: ['apps/web/test/unit/**/*.test.ts'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/expect-expect': 'error',
      'jest/no-standalone-expect': 'error',
      'jest/no-conditional-expect': 'error',
      'jest/no-identical-title': 'error',
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/valid-title': 'error',
      'jest/no-done-callback': 'error',
    },
  },

  // ── Playwright rules for web E2E tests ────────────────────
  {
    files: [
      'apps/web/test/e2e/**/*.spec.ts',
      'apps/web/test/a11y/**/*.spec.ts',
      'apps/web/test/perf/**/*.spec.ts',
    ],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Prefer web first assertions (toBeVisible, toHaveText, etc.)
      'playwright/prefer-web-first-assertions': 'error',
      // Prefer locator-based actions over page.$eval / page.evaluate
      'playwright/no-eval': 'error',
      // No page.waitForTimeout() — use auto-waiting or web first assertions
      'playwright/no-wait-for-timeout': 'error',
      // No conditional logic in tests (if/else around assertions)
      'playwright/no-conditional-in-test': 'warn',
      // Prefer role/label locators over CSS/XPath
      'playwright/prefer-to-be': 'warn',
      'playwright/prefer-to-have-length': 'warn',
      'playwright/prefer-to-have-count': 'warn',
      // Disallow focused tests (test.only)
      'playwright/no-focused-test': 'error',
      // Disallow skipped tests
      'playwright/no-skipped-test': 'warn',
      // Every test must have at least one expect/assertion
      'playwright/expect-expect': 'error',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },

  // ── Page Object Model files — relaxed TS ──────────────────
  {
    files: ['apps/web/src/pages/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  }
)
