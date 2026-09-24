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

Run `pnpm dev` for the explicitly labelled synthetic demo and `pnpm build` for
the production bundle. Demo decisions, field confirmations and settings stay local
and never execute SAP writes. Refreshing the page resets them.

`pnpm test` runs API boundary, trace/reconnect and console interaction tests.
`pnpm test:e2e` checks offline navigation and approval at 1366x768, 1920x1080
and 375x812. First install Chromium with `pnpm exec playwright install chromium`.
To use installed Edge locally, set `E2E_BROWSER_CHANNEL=msedge`. Browser artifacts
remain ignored under `test-results/`. These tests do not establish live acceptance.

The board, six-stage reference workspace, explicit demo approval/rejection, trace,
chat guide and local admin controls are implemented. Projection, portfolio and
Scenario Lab remain future screens; insights currently show case counts only.
English/Indonesian shell labels exist; full content translation is not complete.

## Live configuration and boundaries

Set public Vite build variables in the build environment (never secret values):

- `VITE_DATA_MODE=live`
- `VITE_API_URL`: HTTPS console API base URL
- `VITE_WS_URL`: optional secure WebSocket URL
- `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_COGNITO_DOMAIN`

Unset mode defaults to the labelled demo; only explicit `demo` also enables it.
Other mode values fail closed through the live configuration path. Live API
failures never substitute fixtures. Auth uses the Cognito public code-flow client.
Register callback and logout URLs for the exact browser origin, including host
and port; the console uses `/callback` and `/` respectively.

Live integration currently reads cases and traces. A one-use ticket connects the
board or selected case subscription; disconnects enable two-second polling, and
reconnect refreshes cached data. Detailed plan views, guarded chat, approval,
workflow/rollback, admin writes and live end-to-end acceptance remain backend/dev
integration work. Demo role controls are not server authorization.

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

## Foundation deployment boundary

CI remains read-only for pushes and pull requests (NFR-SEC-03/06). The backend
owns the Cognito pool, public code-flow client, dev Hosted UI domain and private
encrypted web bucket. Its optional OIDC deployment runs only after successful
main-branch CI and a live budget check. There is no frontend deployment role or
bundle upload configured yet. The console must use
PKCE S256 and the provisioned public client; dev callback/logout URLs currently
use `http://localhost:5173/callback` and `http://localhost:5173/`.
