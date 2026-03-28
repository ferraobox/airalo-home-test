import type { Config } from 'jest'
import os from 'node:os'

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'allure-jest/node',
  testEnvironmentOptions: {
    environmentInfo: {
      os_platform: os.platform(),
      os_release: os.release(),
      os_version: os.version(),
      node_version: process.version,
    },
    resultsDir: 'allure-results',
  },
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\.ts$': ['ts-jest', { useESM: true }],
  },

  moduleNameMapper: {
    '^@airalo/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  setupFiles: ['dotenv/config'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
}

export default config
