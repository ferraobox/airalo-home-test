# AGENTS.md

## Goal
Build the Airalo QA take-home with a spec-anchored, test-first workflow.

## Methodology
Spec-Driven Development (spec-anchored): specs are written first and kept as living artifacts.
Workflow: Requirements → Design → Tasks → Implementation → Verification.

## Repo layout
- `apps/api`: Node.js + TypeScript API client, services, and test tooling
- `apps/web`: browser automation, Page Object Model, Playwright E2E + accessibility
- `packages/shared`: shared Zod schemas, types, constants, and fixtures
- `docs/`: exercise specs, testing plan, and AI workflow notes
- `docs/specs/`: SDD spec artifacts (requirements, design, tasks, edge-cases)
- `.github/workflows/`: CI/CD for API and Web tests with Allure reporting

## Testing layers

### API (`apps/api/test/`)
- `unit/`: Pure functions, validators, flow orchestration, race conditions (Jest, fully mocked)
- `integration/`: Live API tests — token, order, eSIM endpoints (Jest, real HTTP)
- `spec/`: Response contract validation (Jest + Zod, fixtures + live)
- `state/`: OAuth, Order, eSIM state machine transitions (Jest, service stubs)

### Web (`apps/web/test/`)
- `unit/`: Helpers, formatters, constants (Jest)
- `e2e/`: Full browser journey + accessibility tests on live site (Playwright + axe-core)

## Rules
- Never commit secrets; load Airalo credentials from environment variables.
- Prefer schema-first contracts with Zod.
- Keep tests deterministic and isolated.
- Use Jest for unit, live API integration, schema, and state machine tests.
- Use Playwright for browser E2E and accessibility tests.
- Use axe-core for WCAG 2.1 AA compliance scanning.
- Reference `docs/specs/requirements.md` for acceptance criteria.
- Reference `docs/specs/edge-cases.md` for boundary conditions.
- Reference `docs/specs/design.md` for state machines and data models.

## Suggested workflow
1. Read `docs/specs/requirements.md` and `docs/specs/design.md`.
2. Implement shared schemas first (`packages/shared`).
3. Build API client + service layer.
4. Write unit, live integration, schema, and state machine tests.
5. Add Playwright E2E and accessibility tests for the UI flow.
6. Run lint and the relevant test suites before finishing.
7. Verify against `docs/specs/tasks.md` for completeness.

## Environment
- `AIRALO_CLIENT_ID`
- `AIRALO_CLIENT_SECRET`
- `AIRALO_BASE_URL`
- `AIRALO_WEB_URL`

## Quality bar
- Prefer explicit assertions over snapshots.
- Mock external HTTP in unit and state machine tests only.
- Live API integration tests run against real endpoints (conditionally skipped without credentials).
- Accessibility tests use axe-core to enforce WCAG 2.1 AA.
- Allure generates HTML reports for both Jest and Playwright suites.
- Cover happy path, invalid input, and edge cases.
- State machine tests validate all transitions and error paths.
- Document any intentional skips or manual steps.
- Specs are the source of truth, code implements them.
