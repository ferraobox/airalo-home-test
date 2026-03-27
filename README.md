# Airalo QA Take-Home

Monorepo for automated testing of the Airalo website and Partner API.

## Approach

This project follows **Spec-Driven Development (spec-anchored)**:

1. **Specs are written first** — requirements, design, state machines, and edge cases live in `docs/specs/`.
2. **Specs are kept** — they evolve with the codebase and serve as the source of truth.
3. **Code is verified against specs** — Zod schemas and state machine tests are the executable form of the specifications.

See the full methodology at [SDD article (Fowler)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html).

## Repository Layout

```
├── apps/api/          # API automation: client, services, tests
│   └── test/          # unit/ integration/ spec/ state/ perf/
├── apps/web/          # Browser automation: Page Objects, Playwright tests
│   └── test/          # unit/ e2e/ perf/
├── packages/shared/   # Zod schemas, types, constants, guards
├── .github/workflows/ # CI/CD: api-tests.yml, web-tests.yml
└── docs/              # SDD spec artifacts
    └── specs/         # requirements, design, tasks, edge-cases, contracts
```

## Testing Layers

### API (`apps/api/`)

| Layer | Tool | What it covers |
|-------|------|----------------|
| **Unit** | Jest | Pure functions, validators, flow orchestration, race conditions (mocked) |
| **Integration** | Jest (live API) | Token acquisition, order submission, eSIM retrieval against live endpoints |
| **Schema** | Jest + Zod | Response contracts vs fixtures and live payloads |
| **State Machine** | Jest | OAuth, Order, eSIM lifecycle transitions and error recovery |

### Web (`apps/web/`)

| Layer | Tool | What it covers |
|-------|------|-----------------|
| **Unit** | Jest | Helpers, formatters, constants |
| **E2E** | Playwright | Full browser journey on the live site |
| **Accessibility** | Playwright + axe-core | WCAG 2.1 AA compliance scanning |

## Setup

```bash
# 1. Enable corepack for pnpm
corepack enable

# 2. Install dependencies
pnpm install

# 3. Install Playwright browsers (for web E2E)
pnpm --filter @airalo/web exec playwright install --with-deps chromium

# 4. Set environment variables
export AIRALO_CLIENT_ID="<your_client_id>"
export AIRALO_CLIENT_SECRET="<your_client_secret>"
export AIRALO_BASE_URL="https://partners-api.airalo.com/v2"
export AIRALO_WEB_URL="https://www.airalo.com"
```

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `AIRALO_CLIENT_ID` | Yes (for live tests) | — |
| `AIRALO_CLIENT_SECRET` | Yes (for live tests) | — |
| `AIRALO_BASE_URL` | No | `https://partners-api.airalo.com/v2` |
| `AIRALO_WEB_URL` | No | `https://www.airalo.com` |

## Running Tests

```bash
# All tests
pnpm test

# By layer — API
pnpm test:unit                    # unit tests across all packages
pnpm test:integration             # live API integration tests
pnpm test:spec                    # API schema/contract tests
pnpm test:state                   # API state machine tests

# By layer — Web
pnpm --filter @airalo/web test:unit       # web unit
pnpm test:e2e                              # web E2E (live site)
pnpm test:a11y                             # accessibility (axe-core)

# Utilities
pnpm lint                         # ESLint all packages
pnpm format:check                 # Prettier check
npx tsc --noEmit                  # Type check
```

## Spec Documentation

| Document | Purpose |
|----------|---------|
| [requirements.md](docs/specs/requirements.md) | User stories + GIVEN/WHEN/THEN acceptance criteria |
| [design.md](docs/specs/design.md) | Architecture, state machines, data models |
| [tasks.md](docs/specs/tasks.md) | Implementation tasks traced to requirements |
| [edge-cases.md](docs/specs/edge-cases.md) | 89 boundary conditions and failure modes |
| [api-contracts.md](docs/specs/api-contracts.md) | API endpoint request/response contracts |
| [ui-flow.md](docs/specs/ui-flow.md) | Browser flow, Page Object Model, price verification |
| [test-matrix.md](docs/specs/test-matrix.md) | Layer × scope coverage matrix |

## Implementation Notes

- API flow: authenticate via `POST /token` (multipart/form-data) → submit 6-eSIM order → fetch each eSIM by `iccid`.
- Schema tests: validate fixtures + live responses against Zod schemas.
- State machine tests: verify OAuth, Order, and eSIM lifecycle transitions.
- E2E: Playwright navigates Airalo.com → Japan → verifies packages, tabs, and pricing.
- Accessibility: axe-core scans homepage and Japan page for WCAG 2.1 AA violations.
- Reporting: Allure generates HTML reports for both Jest and Playwright suites.
- CI/CD: GitHub Actions workflows for API and Web tests with Allure artifact upload.
- Keep Airalo credentials in environment variables only, **never committed**.
