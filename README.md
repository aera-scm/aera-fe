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

```
pnpm install
pnpm dev
```

API types are generated from the backend schemas and committed as `src/api/types.generated.ts`.

Built for the AWS / SAP Agentic AI Hackathon, track: Intelligent Supply Chain.
