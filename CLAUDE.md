# Hostel Expense Tracker — project instructions

Cloud Computing OEL. Students manage their own income, expenses and budgets. **No admin role.**

## Stack
React + Vite (`client/`), Express 5 + Mongoose (`server/`, ES modules, MVC), MongoDB Atlas, JWT + bcrypt. npm workspaces at the root.

## Commands (run from repo root)
- `npm run dev` — server (:5000) + client (:5173, proxies `/api`)
- `npm test` — server tests (`node --test`)
- `npm run build` — build client to `client/dist`
- `npm start` — production server; serves `client/dist` and `/api` from one origin when `NODE_ENV=production`

## Rules
- Smallest clean implementation; no features before they are needed; no microservices, Redis or paid services.
- Secrets live only in `.env` / host settings. Never print, commit or ask for them in chat. `.env.example` holds placeholders.
- Every private query is scoped by the authenticated user's id from the JWT, never a client-supplied id.
- Tests must never touch production data.
- Hosting is provider-neutral (cloud provider pending: AWS/Azure requirement unconfirmed). Target $0; no paid plans, domains or payment details without explicit user approval.
- Don't claim backups, autoscaling, HA or email notifications unless implemented and verified.
- Work phase by phase (see the brief); wait for user confirmation between phases.

## MANDATORY future requirement — Expense Reports and exports (Phase 5/6, once transaction APIs exist)
The authenticated dashboard must include an **Expense Reports** page. Each student can:
1. Select a month and year.
2. Select a full calendar year.
3. Select a custom start date and end date.
4. Select All Records.
5. View total income, total expenses, net balance, transaction count and the matching transactions.
6. Export the selected report to **CSV**.
7. Export the selected report to **PDF**.

Exports must contain **every** matching transaction (not just the current page). Date filtering and user-level authorization are enforced on the backend; never expose other students' data. CSV must be protected against spreadsheet formula injection. No fake downloads.

## Institutional wording (use exactly; single source: `client/src/utils/site.js`)
- Department of Software Engineering
- MUET SZAB Campus Khairpur Mirs
- Mehran University Road, Khairpur
- `Developed by : K22SW012,X-50 & 10` (kept separate from the copyright line)
- `© 2026 Department of Software Engineering, MUET SZAB Campus Khairpur Mirs. All rights reserved.`
Do not invent contact details, members, endorsements, testimonials or statistics. Sample figures must be labeled illustrative.

## Frontend conventions
Plain CSS in `client/src/index.css` using CSS variables; theme = `data-theme` on `<html>` (System/Light/Dark, preference in localStorage key `theme`, no-flash script `client/public/theme-init.js`). Reuse `Field`, `Alert`, `useForm`, `Icon`. Previews are decorative and non-interactive.

## Auth architecture (Phase 3)
JWT in an HttpOnly, SameSite=Lax cookie (`token`, Secure in production, 7 days); Origin check on state-changing `/api` requests; bcrypt via bcryptjs; zod validators in `server/src/validators`; `requireAuth` derives the user from the token only; `requireReady` returns 503 when DB/secret unavailable. Client restores the session via `GET /api/auth/me`. Every future private model must filter by `req.user.id`. Secrets live in `server/.env` (git-ignored). `npm test` uses a fake User model (no database); `npm run test:atlas` is opt-in and only runs against a `*_test` database via `MONGODB_TEST_URI`, deleting only its own records. Never drop/clear collections. Details: README.

## Status
Phases 1-5 code complete: public site; auth; dashboard with real totals (`GET /api/transactions/summary`); transaction CRUD (`/api/transactions`, owner always `req.user.id`, PATCH takes the full record; amounts have at most 2 decimals; list is unpaginated so reports/exports can reuse it). Google sign-in and password reset added. Budgets (`/api/budgets`): one recurring monthly limit per expense category per user; spending is computed from this UTC month's expense transactions, never stored. Reports (`/api/reports`, `/export.csv`, `/export.pdf`; pdfkit) built: period = month|year|custom|all, one unpaginated owner-scoped query; calendar-date matching against stored UTC-midnight dates; CSV has formula-injection protection. Cloud provider: pending. Reports page is live-updating with SVG charts (no chart library); `GET /api/reports` also returns `charts` (series/category breakdowns from `services/analytics.js`) and `budgets` (only when the period is the current month). Settings page (`/app/settings`; avatar dropdown in the top bar; preferences + delete account): name, email change (emailed verification), password change, avatar (MongoDB `avatars` collection). PDF report is branded and includes student identity and this-month budget status. Public copy (Home/Features/Previews) matches the implemented features. Next: deployment after user confirmation.
