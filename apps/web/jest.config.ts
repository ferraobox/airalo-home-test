import type { Config } from 'jest'
import os from 'node:os'

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'allure-jest/jsdom',
  testEnvironmentOptions: {
    environmentInfo: {
      os_platform: os.platform(),
      os_release: os.release(),
      os_version: os.version(),
      node_version: process.version,
    },
    resultsDir: 'allure-results',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\.tsx?$': ['ts-jest', { useESM: true }],
  },

  setupFiles: ['dotenv/config'],
  testMatch: ['<rootDir>/test/unit/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
}

export default config
