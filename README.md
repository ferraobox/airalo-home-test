# Airalo QA Take-Home

Monorepo for automated testing of the **Airalo Partner API** and **Airalo website** — covering API contract validation, state machine lifecycle testing, browser E2E flows, accessibility compliance, and performance benchmarking.

**Live Reporting:** [https://ferraobox.github.io/testing-example/](https://ferraobox.github.io/testing-example/)

---

## Table of Contents

- [Approach & Methodology](#approach--methodology)
- [Repository Layout](#repository-layout)
- [Setup Instructions](#setup-instructions)
- [Running Tests](#running-tests)
- [Test Overview & Approach](#test-overview--approach)
- [Strategies & Design Decisions](#strategies--design-decisions)
- [CI/CD & Reporting](#cicd--reporting)
- [Spec Documentation](#spec-documentation)

---

## Approach & Methodology

This project follows **Spec-Driven Development (SDD)** — specs are written first as living artifacts, and code implements them. This approach is inspired by [Martin Fowler's SDD article](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html).

**Workflow:** Requirements → Design → Tasks → Implementation → Verification

1. **Requirements are defined first** in `docs/specs/requirements.md` with unique IDs (R1–R8).
2. **Architecture is documented** in `docs/specs/design.md` — state machines, data models, service interfaces.
3. **Edge cases are cataloged** in `docs/specs/edge-cases.md` before writing tests.
4. **Every test traces back** to a requirement ID — see `docs/specs/tasks.md` for the full traceability matrix.
5. **Schemas are the contract** — Zod schemas in `packages/shared` are the executable form of the API specification.

---

## Repository Layout

```
testing-example/
├── apps/
│   ├── api/                     # API automation
│   │   ├── src/
│   │   │   ├── services/        # Auth, Order, eSIM, Flow, Airalo (composite)
│   │   │   ├── lib/             # HTTP client, retry logic, state machines, env config
│   │   │   ├── helpers/         # Test data builders, assertion helpers
│   │   │   └── types/           # TypeScript interfaces (service results, fixtures)
│   │   └── test/
│   │       ├── unit/            # Mocked service + flow tests (72 tests)
│   │       ├── spec/            # Schema contract tests — fixtures + live (69 tests)
│   │       ├── state/           # State machine lifecycle tests (157 tests)
│   │       └── integration/     # Live API end-to-end tests (14 tests)
│   │
│   └── web/                     # Browser automation
│       ├── src/
│       │   ├── pages/           # Page Object Model (HomePage, CountryPackagesPage)
│       │   └── lib/             # Country/language configs, formatters, a11y, perf
│       └── test/
│           ├── unit/            # Config, formatter, regex utility tests (85 tests)
│           ├── e2e/             # Full purchase-path E2E tests (Playwright)
│           ├── a11y/            # WCAG 2.1 AA compliance tests (axe-core)
│           └── perf/            # Core Web Vitals benchmarks (web-vitals)
│
├── packages/
│   └── shared/                  # Shared Zod schemas, inferred types, constants
│       └── src/schemas/         # airalo-api.ts — all API contract schemas
│
├── docs/
│   └── specs/                   # SDD specification artifacts
│       ├── requirements.md      # R1–R8 requirement IDs + acceptance criteria
│       ├── design.md            # Architecture, state machines, data models
│       ├── tasks.md             # Traceability matrix (requirements → test files)
│       ├── edge-cases.md        # 70+ boundary conditions and failure modes
│       └── contracts.md         # Zod schema documentation and design decisions
│
├── .github/workflows/           # CI/CD pipelines
│   ├── api-tests.yml            # API: lint → unit → spec → state → integration → Allure
│   └── web-tests.yml            # Web: lint → unit → E2E → a11y → perf → Allure
│
├── eslint.config.mjs            # Flat ESLint config (type-checked, jest & playwright plugins)
├── tsconfig.base.json           # Shared TypeScript strict config
└── pnpm-workspace.yaml          # Monorepo workspace definition
```

---

## Setup Instructions

### Prerequisites

- **Node.js** ≥ 22.x
- **pnpm** ≥ 10.6.0 (via corepack)

### Installation

```bash
# 1. Enable corepack for pnpm
corepack enable

# 2. Install all dependencies
pnpm install

# 3. Install Playwright browsers (required for E2E, a11y, and perf tests)
pnpm --filter @airalo/web exec playwright install --with-deps chromium
```

### Environment Variables

Create a `.env` file at the repository root or export the variables:

```bash
export AIRALO_CLIENT_ID="<your_client_id>"
export AIRALO_CLIENT_SECRET="<your_client_secret>"
export AIRALO_BASE_URL="https://partners-api.airalo.com/v2"    # optional, this is the default
export AIRALO_WEB_URL="https://www.airalo.com"                  # optional, this is the default
```

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `AIRALO_CLIENT_ID` | Yes (live & integration tests) | — | OAuth2 client credentials |
| `AIRALO_CLIENT_SECRET` | Yes (live & integration tests) | — | OAuth2 client credentials |
| `AIRALO_BASE_URL` | No | `https://partners-api.airalo.com/v2` | API base URL |
| `AIRALO_WEB_URL` | No | `https://www.airalo.com` | Website URL for Playwright tests |

> **Note:** Unit, contract (fixture), and state machine tests run without credentials. Only live API and integration tests require them.

---

## Running Tests

### Quick Start

```bash
# Run everything (unit + spec + state across all packages)
pnpm test
```

### API Tests

```bash
# Unit tests — mocked services, flow orchestration (72 tests)
pnpm test:unit

# Schema contract tests — Zod validation against fixtures (62 tests)
pnpm test:spec

# Live contract tests — Zod validation against real API responses (7 tests)
pnpm --filter @airalo/api test:live

# State machine tests — OAuth, Order, eSIM, Flow lifecycles (157 tests)
pnpm test:state

# Integration tests — full E2E through live API (14 tests)
pnpm test:integration
```

### Web Tests

```bash
# Unit tests — country/language configs, formatters, regex utilities (85 tests)
pnpm --filter @airalo/web test

# E2E tests — full purchase-path browser flow (Playwright)
pnpm test:e2e

# E2E with headed browser (for local debugging)
pnpm test:e2e:local

# E2E with Playwright Inspector
pnpm test:e2e:debug

# Accessibility tests — WCAG 2.1 AA (axe-core)
pnpm test:a11y

# Performance tests — Core Web Vitals (web-vitals)
pnpm test:perf
```

### Quality Checks

```bash
# Lint all packages (ESLint with type-checked rules)
pnpm lint

# Format check (Prettier)
pnpm format:check

# Type check (TypeScript strict mode)
npx tsc --noEmit
```

---

## Test Overview & Approach

### 1. API Unit Tests (`apps/api/test/unit/`) — 72 tests

Tests each service in isolation with mocked Axios instances. The factory pattern (`createAuthService(http)`, `createOrderService(http)`, `createEsimService(http)`) makes dependency injection trivial.

**What is tested:**
- **AuthService** — `POST /token` request construction (FormData fields, grant_type), Zod response validation (empty token, negative TTL), HTTP error propagation (401, 422, 500).
- **OrderService** — `POST /orders` request construction (package_id, quantity, Authorization header), response parsing, empty sims rejection, error propagation.
- **EsimService** — `GET /sims/{iccid}` URL interpolation, Bearer token header, response parsing with simable reference, error propagation (404, 401, 422, 500).
- **Flow Orchestration** — `runAiraloOrderFlow()` happy path (1, 6, 50 SIMs), concurrent eSIM fetching via `Promise.all`, order-then-fetch sequencing, HTTP error propagation (7 status codes parameterized), network-level errors (ECONNREFUSED, ETIMEDOUT, ECONNRESET, ENOTFOUND), partial eSIM failure, error type preservation (TypeError, string throw).

### 2. Schema Contract Tests (`apps/api/test/spec/`) — 69 tests

Two layers of contract validation using the **same Zod schemas**:

- **Fixture contracts** (`api-contract.test.ts`, 62 tests) — Validate that JSON fixture files parse correctly against schemas. Also test backward compatibility (extra unknown fields stripped), minimum viable payloads, breaking change detection (removed/changed fields), cross-fixture consistency (eSIM iccids belong to order sims), and negative cross-validation (token payload rejects against order schema).

- **Live contracts** (`live-contract.test.ts`, 7 tests) — Validate that **real API responses** from the live Airalo Partner API parse against the same schemas. Tests both success and error paths. Skipped automatically when credentials are unavailable.

### 3. State Machine Tests (`apps/api/test/state/`) — 157 tests

Pure function state machines model every domain lifecycle with zero I/O:

- **OAuth Token** (42 tests) — `NO_TOKEN → REQUESTING → VALID_TOKEN → EXPIRED` cycle, retry with max attempts, missing credentials guard, exhaustive 5×5 state×event transition matrix.
- **Order** (53 tests) — `IDLE → CREATING → CREATED → COMPLETE` lifecycle, validation/auth failure guards, terminal state reset, exhaustive 6×6 matrix.
- **eSIM** (41 tests) — `UNRESOLVED → FETCHING → RESOLVED` lifecycle, empty iccid guard, retry from NOT_FOUND/ERROR, exhaustive 5×5 matrix.
- **Full Flow** (21 tests) — End-to-end flow composition, token expiry mid-flow with re-authentication, terminal state enforcement.

Every state machine test validates that **invalid transitions are no-ops** (state remains unchanged).

### 4. Integration Tests (`apps/api/test/integration/`) — 14 tests

End-to-end tests against the **live Airalo Partner API** via real HTTP:

- Obtain OAuth2 token → submit 6-eSIM order → fetch each eSIM by iccid.
- Negative tests: invalid credentials, expired token, invalid package_id, zero/negative quantity, invalid iccid, missing auth.
- Uses **exponential backoff retry** (2s → 4s → 8s) for transient 429/5xx errors from the sandbox API.

### 5. Web Unit Tests (`apps/web/test/unit/`) — 85 tests

- **Country config** — JSON fixture hydration, `getCountryConfig()` with env var / explicit ID / case-insensitive lookup, `resolveCountryConfig()` merging with language data, tab configuration, fixture integrity.
- **Language config** — `getLanguageConfig()` resolution, registry integrity, regex hydration from JSON strings.
- **Price formatting** — `normalisePrice()` currency symbol stripping (8 currencies parameterized), decimal/thousand separators, whitespace handling, boundary values, idempotency, comparison correctness, numeric conversion safety.
- **Regex utilities** — `toRegExp()` parsing with flags, `isSerializedRegex()` detection, `toMatcher()` RegExp passthrough vs string wrapping.

### 6. E2E Tests (`apps/web/test/e2e/`) — Playwright

Full browser journey parameterized by country (default: Japan):

1. Open homepage → dismiss cookie banner → verify search input visible.
2. Search for country → select from dropdown → navigate to eSIM packages page.
3. Verify heading, operator, breadcrumb, package tabs.
4. Click tab → verify packages load → find target package by duration.
5. Select package → verify URL slug update → verify cart dialog appears.
6. **Assert price on package card matches price next to Buy Now button** (the primary verification).

Uses **Page Object Model** pattern with `AiraloHomePage` and `CountryPackagesPage` classes.

### 7. Accessibility Tests (`apps/web/test/a11y/`) — Playwright + axe-core

WCAG 2.1 AA compliance scanning on two pages:

- **Homepage** — No critical violations, search input accessibility, keyboard navigation, image alt text coverage, color contrast, page landmarks, ARIA attributes.
- **Country eSIM page** — No critical violations, package card accessibility, interactive element focusability.

Results are formatted and attached to Allure reports for audit trail.

### 8. Performance Tests (`apps/web/test/perf/`) — Playwright + web-vitals

Core Web Vitals measurement using the `web-vitals` library injected into the page:

| Metric | Threshold |
|--------|-----------|
| FCP (First Contentful Paint) | ≤ 1800 ms |
| TTFB (Time to First Byte) | ≤ 800 ms |
| LCP (Largest Contentful Paint) | ≤ 2500 ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 |
| INP (Interaction to Next Paint) | ≤ 200 ms |

---

## Strategies & Design Decisions

### Schema-First Contracts (Zod)

Every API response shape is defined as a Zod schema in `packages/shared`. These schemas serve three purposes:
1. **Fixture validation** — ensure test fixtures are realistic.
2. **Live response validation** — assert the real API matches the contract.
3. **Runtime parsing** — services parse through schemas, making type safety end-to-end.

Zod's default strip mode drops unknown fields, making schemas **forward-compatible** — new API fields don't break consumers.

### State Machine Purity

All state machines are pure functions `(state, event, context) → { state, context }` with zero I/O. This lets us:
- Test every valid transition and verify every invalid transition is a no-op.
- Use exhaustive N×N state×event matrices to catch missing transitions.
- Model error recovery (retry counts, re-authentication) as context updates.

### Factory Pattern for Testability

Services are created via factory functions: `createAuthService(http)`. The HTTP client is injected, enabling full mocking in unit tests while sharing real implementations in integration tests. No global state, no singletons.

### Page Object Model (POM)

Playwright locators are encapsulated in page object classes. Tests read like business scenarios (`page.searchCountry("Japan")`) rather than DOM manipulation. Locators use semantic selectors (ARIA roles, test IDs) for stability.

### Data-Driven Configuration

Countries and languages are JSON fixtures hydrated at import time. RegExp patterns are serialized as strings in JSON (`"/Japan/i"`) and deserialized by `toRegExp()`. Environment variables (`AIRALO_COUNTRY`, `AIRALO_LANGUAGE`) control which configuration is active, enabling **parameterized CI matrix runs**.

### Retry with Exponential Backoff

`retryOnTransient(fn, opts)` handles transient errors (HTTP 429 rate-limit, 5xx, network errors) with exponential backoff (2s → 4s → 8s, 3 attempts). Non-transient 4xx errors fail immediately.

### TypeScript Strict Mode

The entire codebase uses strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `strict: true`). Test code is held to the same standard as production code — all `@typescript-eslint/no-unsafe-*` rules are enforced everywhere.

### Monorepo with pnpm Workspaces

Three packages share schemas, types, and tooling. `packages/shared` is the single source of truth for API shapes. Workspace protocol (`workspace:*`) ensures version consistency.

---

## CI/CD & Reporting

### GitHub Actions

Two parallel pipelines run on every push and PR:

**API Pipeline** (`api-tests.yml`):
```
Lint → Unit + Schema → State Machine → Integration + Live Contract → Allure Report
```

**Web Pipeline** (`web-tests.yml`):
```
Lint → Unit → E2E (matrix) → Accessibility (matrix) → Performance (matrix) → Allure Report
```

### Live Reporting

Allure HTML reports are published to GitHub Pages after every CI run:

**[https://ferraobox.github.io/testing-example/](https://ferraobox.github.io/testing-example/)**

- API results: `api-allure/` subdirectory
- Web results: `web-allure/` subdirectory
- Landing page links to both suites

### Report Features (Allure)

- Test execution timeline with pass/fail/skip
- Test case grouping by suite (unit, spec, state, integration, e2e, a11y, perf)
- Detailed error messages and stack traces on failure
- Accessibility violation attachments (from axe-core)
- Performance metric results (from web-vitals)

---

## Spec Documentation

| Document | Purpose |
|----------|---------|
| [requirements.md](docs/specs/requirements.md) | R1–R8 requirement IDs with acceptance criteria |
| [design.md](docs/specs/design.md) | Architecture, state machines, data models, service design |
| [tasks.md](docs/specs/tasks.md) | Traceability matrix — every requirement mapped to test files |
| [edge-cases.md](docs/specs/edge-cases.md) | 70+ boundary conditions: API errors, network failures, schema evolution, state machine guards |
| [contracts.md](docs/specs/contracts.md) | Zod schema documentation with design rationale |

---

## Test Count Summary

| Layer | Files | Tests | Tool |
|-------|-------|-------|------|
| API Unit | 4 | 72 | Jest (mocked) |
| API Contract (fixture) | 1 | 62 | Jest + Zod |
| API Contract (live) | 1 | 7 | Jest + Zod + live HTTP |
| API State Machine | 4 | 157 | Jest (pure functions) |
| API Integration | 1 | 14 | Jest + live HTTP |
| Web Unit | 4 | 85 | Jest |
| Web E2E | 1 | 17 steps | Playwright |
| Web Accessibility | 1 | 10 steps | Playwright + axe-core |
| Web Performance | 1 | 6 steps | Playwright + web-vitals |
| **Total** | **18** | **430+** | |
