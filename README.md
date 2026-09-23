# AERA — planner console

The web console for AERA (Autonomous Exception Resolution Agent). Planners triage supply chain exceptions here, see the impact and the options with the SAP source behind every number, follow the agent's reasoning live, and approve the actions that need a human. Approvals work on a phone browser.

The backend and the agent live in `aera-be`.

## Screens

- **Case board** — open exceptions ranked by revenue at risk and time until the line stops.
- **Case workspace** — six stages: signal, triage, impact, options, approve, execute, with a live trace of every step.
- **Projection and what-if** — stock over time per plant for each option.
- **Portfolio** — competing cases resolved jointly.
- **Approvals** — phone-first screens with the full evidence behind each decision.
- **KPI dashboard** and **Scenario Lab**.

## Stack

React 18, TypeScript, Vite, Cloudscape Design System, TanStack Query, Recharts, react-i18next (English and Bahasa Indonesia), Amazon Cognito for sign-in. Hosted on Amazon S3 behind CloudFront.

## Getting started

Use Node 24.21.0, pnpm 12.5.1, Python 3.12.14 and uv 0.12.18. Python is used only
for repository security and pre-commit tooling; the console remains TypeScript.

```sh
pnpm install --frozen-lockfile
uv sync --locked
pnpm check
uv run --locked yamllint --strict .
uv run --locked pip-audit --local
uv run --locked pre-commit run --all-files
```

These commands work on Windows and Linux. Keep existing Git hooks: run pre-commit
explicitly rather than replacing an existing `core.hooksPath`.

ESLint and strict TypeScript currently check the tooling scripts. `pnpm test`
explicitly reports that there are no application tests; when test files are added,
Vitest runs and failures or empty collection fail the command. No console screens,
dev server or application build exist yet. React and application dependencies will
be introduced with their implementing work package.

`pnpm-lock.yaml` and `uv.lock` pin direct and transitive tooling dependencies
(NFR-SEC-06). CI runs lint, strict type checks, available tests, YAML validation,
secret scanning and vulnerability audits for both dependency sets. CI has read-only
repository permissions and no AWS credentials or deployment steps.

`pnpm scan` checks tracked and non-ignored candidate files, refuses credential file
paths without reading their contents, and never verifies credentials over the
network (NFR-SEC-03). Lockfiles are excluded from secret detection because they
contain integrity digests; they remain covered by dependency audits. Initial
installation and audits require public registry access. Installed lint, types,
tests and secret checks require no cloud account.

API types are generated from the backend schemas and committed as `src/api/types.generated.ts`.

Built for the AWS / SAP Agentic AI Hackathon, track: Intelligent Supply Chain.
