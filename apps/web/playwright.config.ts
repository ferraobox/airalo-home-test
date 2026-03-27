import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'
import * as os from 'node:os'

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  retries: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        outputFolder: 'allure-results',
        environmentInfo: {
          os_platform: os.platform(),
          os_release: os.release(),
          os_version: os.version(),
          node_version: process.version,
        },
      },
    ],
  ],
  use: {
    baseURL: process.env.AIRALO_WEB_URL || 'https://www.airalo.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
