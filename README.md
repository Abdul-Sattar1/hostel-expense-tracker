# Hostel Expense Tracker

A cloud-based web application that lets hostel students record their own income and expenses, set monthly budgets, review reports and charts, and export them to CSV or PDF.

Cloud Computing practical (OEL) project, Department of Software Engineering, MUET SZAB Campus Khairpur Mirs.

## Contents
1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Technology stack and architecture](#3-technology-stack-and-architecture)
4. [Authentication and security](#4-authentication-and-security)
5. [Project structure](#5-project-structure)
6. [Getting started on Windows (VS Code)](#6-getting-started-on-windows-vs-code)
7. [Environment variables](#7-environment-variables)
8. [MongoDB Atlas setup](#8-mongodb-atlas-setup)
9. [Google Sign-In setup](#9-google-sign-in-setup)
10. [Email (password reset and email change)](#10-email-password-reset-and-email-change)
11. [Using the application](#11-using-the-application)
12. [API reference](#12-api-reference)
13. [Testing](#13-testing)
14. [Deploying on GitHub and Render (free)](#14-deploying-on-github-and-render-free)
15. [Free-tier limitations](#15-free-tier-limitations)
16. [Troubleshooting](#16-troubleshooting)
17. [Security notes](#17-security-notes)
18. [Screenshots](#18-screenshots)
19. [License](#19-license)
20. [Credits](#20-credits)

## 1. Overview

**Problem.** Hostel life means many small payments: an allowance, mess bills, fares, printing, snacks. Because each amount is small, it is easy to lose track of where the month's money went.

**Objectives**
- Let each student keep a private record of income and expenses.
- Warn the student when spending approaches or passes a monthly budget.
- Turn the records into clear totals, charts and exportable reports.
- Run as a cloud application: React front end, Express API, MongoDB Atlas database, one deployable service.

There is no administrator role. Every account is an individual student and can only see its own data.

## 2. Features

Everything below exists in the code. Features that depend on an external service are marked; they have automated tests with mocks but have **not** been verified against the real service in this repository's test suite (see [Testing](#13-testing)).

- **Accounts:** register, log in, log out, session restore on reload, and "Continue with Google" (needs Google configuration).
- **Password reset:** request a link by email, choose a new password (link valid 20 minutes, single use; needs an email provider).
- **Dashboard:** total income, total expenses, remaining balance and the five most recent transactions.
- **Transactions:** add, edit and delete income and expenses with amount, category, date and optional description. Newest first.
- **Budgets:** one monthly limit per expense category, with spending calculated from your transactions, a progress bar, and Normal / Warning (80%+) / Exceeded status.
- **Budget notifications:** after you add or edit an expense, an in-app banner tells you if it pushed a budget to 80% or more (warning) or over 100% (exceeded, with the excess amount).
- **Reports:** monthly, yearly, custom range or all time. Summary cards (income, expenses, balance, savings percentage, count), income-vs-expense bar chart, category bars for income and expenses, an expense doughnut, current-month budget progress, and the full transaction table. Everything updates when you change the period.
- **Exports:** CSV (with spreadsheet-formula protection) and a branded PDF for the selected period, containing every matching transaction.
- **Contact form:** public feedback form; messages are stored in MongoDB (nothing is emailed).
- **Settings:** profile picture (upload with preview, replace, remove), name, email change (confirmed through a link sent to the new address), password change, Google status, theme (System / Light / Dark), preferences (default report period, page after login), data overview, export of all data, and permanent account deletion.
- **Interface:** responsive layout, System / Light / Dark themes, avatar account menu.

Currency is Pakistani rupees (Rs). There is no currency conversion.

## 3. Technology stack and architecture

| Layer | Technology |
|---|---|
| Front end | React 19, React Router 7, Vite 8, plain CSS with CSS variables (no UI or chart library) |
| Back end | Node.js (ES modules), Express 5, MVC layout, Zod validation, Helmet, express-rate-limit |
| Database | MongoDB Atlas through Mongoose 9 |
| Authentication | JWT in an HttpOnly cookie, bcrypt (bcryptjs), Google Identity Services, `google-auth-library` |
| Email | Nodemailer (SMTP) or the Brevo HTTPS API |
| PDF | PDFKit (server side) |
| Tests | Node's built-in test runner |

**How the pieces communicate**

```
Browser (React app)
   |  fetch('/api/...') with the session cookie, same origin
   v
Express server  --  serves client/dist (the built React app) for every non-API path
   |  Mongoose
   v
MongoDB Atlas   (users, transactions, budgets, avatars, feedbacks)
```

In production a **single Node service** serves both the built React files and the JSON API from one origin, so no CORS and no separate front-end host are needed. In development the Vite server (port 5173) proxies `/api` to Express (port 5000).

## 4. Authentication and security

- Login sets a signed JWT in an **HttpOnly, SameSite=Lax** cookie (`Secure` in production, 7 days). JavaScript cannot read it. The browser stores no tokens.
- **CSRF:** SameSite=Lax plus a server check that rejects state-changing `/api` requests whose `Origin` is not this site.
- Passwords are hashed with bcrypt (cost 12). Policy: 8–72 bytes with at least one letter and one number.
- Every private query is scoped by the user id taken from the verified token; ids sent by the browser are never trusted. Another student's records behave as if they do not exist (404).
- Login, registration, Google sign-in, password reset, email/password re-checks and the contact form are **rate limited** per IP.
- Google ID tokens are verified on the server (signature, expiry, audience). A Google account is never auto-linked to an existing password account with the same email.
- Reset and email-change tokens are 256-bit random values; only their SHA-256 hash is stored, they expire, and they work once.
- Profile pictures are checked by file signature (JPEG, PNG, WebP), limited to 2 MB, stored per owner, and served only to their owner.
- Helmet security headers apply; the content-security policy allows only the app itself and Google sign-in.
- Known limitation: logging out or changing a password does not revoke tokens already issued (they are stateless and expire after 7 days).

## 5. Project structure

```
hostel-expense-tracker/
├─ package.json            npm workspaces (client, server) and root scripts
├─ .env.example            variable names with placeholders (copy to server/.env)
├─ client/                 React + Vite front end
│  ├─ public/              favicon, theme-init.js (prevents a theme flash)
│  └─ src/
│     ├─ api/              API client (fetch wrapper, downloads, uploads)
│     ├─ components/       shared UI (forms, alerts, charts, menus, tables)
│     ├─ context/          authentication and theme state
│     ├─ hooks/  layouts/  utils/
│     └─ pages/            public pages, auth pages, pages/app/ (signed-in area)
└─ server/                 Express API
   ├─ src/
   │  ├─ config/           environment and database connection
   │  ├─ controllers/ routes/ models/ validators/ middleware/
   │  ├─ services/         exports (CSV/PDF), analytics, mailer, Google, tokens, totals
   │  ├─ app.js            Express app (also serves client/dist in production)
   │  └─ server.js         entry point
   └─ test/                automated tests (fake database, no network)
```

## 6. Getting started on Windows (VS Code)

**Prerequisites**
- [Node.js](https://nodejs.org) **22.12 or newer** (`node -v`) with npm
- [Git](https://git-scm.com)
- [VS Code](https://code.visualstudio.com) (any editor works)
- A free [MongoDB Atlas](#8-mongodb-atlas-setup) cluster

**Install and run** (PowerShell or the VS Code terminal, from the project folder)

```powershell
npm install
copy .env.example server\.env      # then open server\.env and fill in the values
npm run dev                        # API http://localhost:5000, app http://localhost:5173
```

If PowerShell blocks `npm`, use `npm.cmd` instead (for example `npm.cmd install`).

Without database settings the public pages still work; login and registration answer "service unavailable".

**Scripts (run from the project root)**

| Command | What it does |
|---|---|
| `npm run dev` | API (port 5000) and Vite (port 5173) together |
| `npm test` | all automated tests (no database or network needed) |
| `npm run test:atlas` | opt-in integration test against a separate `*_test` Atlas database |
| `npm run build` | builds the front end into `client/dist` |
| `npm start` | production server; serves `client/dist` and `/api` when `NODE_ENV=production` |

## 7. Environment variables

Real values go **only** in `server/.env` (local) or the host's environment settings (Render). `.env` files are git-ignored; `.env.example` contains placeholders only.

| Variable | Used by | Purpose |
|---|---|---|
| `NODE_ENV` | server | `development` locally; **`production`** on Render (turns on Secure cookies and static serving) |
| `PORT` | server | HTTP port. Render sets it; locally defaults to 5000 |
| `MONGODB_URI` | server | Atlas connection string, with the database name in the path |
| `MONGODB_TEST_URI` | tests | only for `npm run test:atlas`; database name must end in `_test` |
| `JWT_SECRET` | server | signs login cookies; at least 32 random characters |
| `CLIENT_ORIGIN` | server (dev) | origin of the Vite dev server for CORS; defaults to `http://localhost:5173` |
| `APP_URL` | server | public site URL used in emailed links; defaults to Render's URL when deployed there |
| `GOOGLE_CLIENT_ID` | server | public Google OAuth client id; the button is hidden when empty |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | server | email through an SMTP server (option A) |
| `BREVO_API_KEY` | server | email through Brevo's HTTPS API (option B, for hosts that block SMTP) |
| `MAIL_FROM` | server | sender address, e.g. `Hostel Expense Tracker <verified-sender@example.com>` |
| `AUTH_RATE_LIMIT` | server | optional attempts per IP per 15 minutes (default 10) |
| `VITE_API_URL` | client (build time) | optional API base URL if the API is on another origin; leave unset for the normal same-origin setup |

Generate a secret locally:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Never put secrets in `VITE_*` variables: they are embedded in the public JavaScript.

## 8. MongoDB Atlas setup

The free tier needs no payment card. Screens change occasionally; names may differ slightly.

1. Sign up at https://www.mongodb.com/cloud/atlas/register. If any page asks for payment details, skip it.
2. **Create a cluster:** choose the free **M0** option and a nearby region.
3. **Database user** (Security > Database Access > Add New Database User): password authentication, a long password with letters and numbers only (avoids URL-encoding), and `readWrite` on the `hostel_expense_tracker` database only.
4. **Network access** (Security > Network Access): for local work add your current IP. **For Render see [section 14](#14-deploying-on-github-and-render-free): free Render services have no fixed IP.**
5. **Connection string:** Database > Connect > *Drivers* > copy the `mongodb+srv://...` string. Replace `<db_password>`, and add the database name before the `?`, for example `.../hostel_expense_tracker?retryWrites=true&w=majority`.
6. Put it in `server\.env` as `MONGODB_URI`. Never paste it into chat, issues or code.
7. Run `npm run dev`. The server log says `MongoDB connected (database: hostel_expense_tracker)`, and http://localhost:5000/api/health shows `"database":"connected"`.

**Test database (optional):** grant your database user `readWrite` on `hostel_expense_tracker_test`, set `MONGODB_TEST_URI` to a string ending in `/hostel_expense_tracker_test`, then `npm run test:atlas`. It refuses to run against any other database name and only deletes the records it created.

**Connection troubleshooting:** see [Troubleshooting](#16-troubleshooting).

## 9. Google Sign-In setup

1. Open https://console.cloud.google.com, create or pick a project.
2. *APIs & Services > OAuth consent screen*: choose External, enter an app name and your email. While the app is in *Testing*, add the Google accounts that may sign in as test users, or choose *Publish app* so any Google user can (the basic `openid email profile` scopes do not need Google's review).
3. *Credentials > Create credentials > OAuth client ID*, type **Web application**.
4. **Authorized JavaScript origins:** add `http://localhost:5173` for development and, once known, your live address, for example `https://your-service.onrender.com` (https, no trailing slash, no path). No redirect URIs are needed.
5. Copy the **Client ID** into `GOOGLE_CLIENT_ID` (local `server\.env`, and Render). Do **not** use or store the client secret; the app does not need it.
6. Restart the server. "Continue with Google" appears on Login and Register.

After deploying, add the live origin in step 4; changes can take a few minutes to apply.

## 10. Email (password reset and email change)

The app sends two kinds of email: password-reset links and email-change confirmation links. Choose one provider.

- **Option A, SMTP** (local development, or hosts that allow SMTP): set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. For Gmail, turn on 2-Step Verification, create an *App password*, use host `smtp.gmail.com`, port `587`.
- **Option B, Brevo HTTPS API** (for Render's free plan): create a free Brevo account, verify a sender address, create an API key, then set `BREVO_API_KEY` and `MAIL_FROM` (the verified sender). If both are set, Brevo is used.
- **No provider, local development:** the link is printed in the server terminal so you can still try the flow. In production without a provider the request fails with a clear error and nothing is reported as sent.

**Free-hosting limitation.** Render's free web services currently block outbound SMTP ports (check Render's documentation, as this can change), so Option A will not work there; use Option B. Brevo's free plan has a daily sending limit. The Brevo integration is covered by a mocked-HTTP test only; it has not been tried against the live Brevo service.

## 11. Using the application

- **Register / log in:** with email and password, or "Continue with Google". "Forgot password?" on the login page emails a reset link.
- **Dashboard:** your totals and recent activity. A new account shows zeros and a prompt to add the first transaction.
- **Transactions:** *Add transaction*, then Edit or Delete on any row (deleting asks for confirmation). Income categories: Allowance, Salary, Scholarship, Other income. Expense categories: Food, Hostel dues, Transport, Study, Health, Entertainment, Other. After saving an expense you may see a budget banner.
- **Budgets:** *Add budget* picks an expense category and a monthly limit. Spending is the current month's expenses in that category. One budget per category.
- **Reports:** choose Monthly (month and year), Yearly, Custom range (start and end date), or All time. Charts, cards and the table refresh together. *Export CSV* and *Export PDF* use the period on screen and include every matching transaction. Budget progress is shown only for the current month, because budgets are monthly limits.
- **Settings** (avatar menu, top right): Account (picture, name, email), Security (password, reset link by email, Google status), Appearance (theme), Preferences (default report period, page after login), Data & privacy (counts, export everything, delete account).
- **Contact Us:** public form with name, email, optional subject and a message. Messages are stored in the `feedbacks` collection in MongoDB and can be read in Atlas; the app has no screen for reading them.

## 12. API reference

JSON in and out. Errors look like `{ "message": "...", "errors": { "field": "..." } }`. All routes except those marked *public* need the session cookie. Database-backed routes return 503 when the database is unavailable.

| Area | Endpoints |
|---|---|
| Health | `GET /api/health` (*public*; 503 when the database is disconnected) |
| Auth | `GET /api/auth/config` (*public*), `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/google`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (all *public*), `POST /api/auth/logout`, `GET /api/auth/me` |
| Transactions | `GET /api/transactions`, `GET /api/transactions/summary`, `GET /api/transactions/:id`, `POST /api/transactions`, `PATCH /api/transactions/:id`, `DELETE /api/transactions/:id` |
| Budgets | `GET /api/budgets`, `GET /api/budgets/:id`, `POST /api/budgets`, `PATCH /api/budgets/:id`, `DELETE /api/budgets/:id` |
| Reports | `GET /api/reports`, `GET /api/reports/export.csv`, `GET /api/reports/export.pdf` with `period=month&month=YYYY-MM`, `period=year&year=YYYY`, `period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`, or `period=all` |
| Profile | `PATCH /api/profile`, `POST /api/profile/email`, `POST /api/profile/email/verify` (*public*, token), `POST /api/profile/password`, `PUT /api/profile/preferences`, `GET`/`PUT`/`DELETE /api/profile/avatar`, `POST /api/profile/delete` |
| Contact | `POST /api/contact` (*public*, rate limited) |

**Date handling.** A transaction date is the calendar day the student entered, stored as UTC midnight of that day. Reports compare calendar days directly (start inclusive, the day after the end exclusive), so there is no time-zone shifting at month or year boundaries. The "Generated" date on exports uses Asia/Karachi time.

**Money.** Amounts are positive numbers with at most two decimals. Totals, category shares and budget status are calculated in whole paisa to avoid floating-point drift.

## 13. Testing

```powershell
npm test
```

The suite uses Node's test runner with an in-memory fake of the database models, so it needs no network, no Atlas and no `.env`. It exercises the real routes, validation, bcrypt, JWT, cookies, rate limits, report maths, CSV and PDF generation. Because the database, Google and email are replaced by fakes, **passing tests do not prove the live integrations**; check those manually (see the smoke-test list below). A few tests serve the built client and are skipped when `client/dist` does not exist, so run `npm run build` first.

`npm run test:atlas` is an opt-in check against a separate `*_test` Atlas database for the original account flow only.

The first time Atlas is used, Mongoose creates the collections and indexes it needs (`users`, `transactions`, `budgets`, `avatars`, `feedbacks`).

## 14. Deploying on GitHub and Render (free)

The app is designed to run as **one Render Web Service**: Express serves the built React app and the API from the same origin. A separate front-end service is not needed.

### 14.1 Before you publish: check nothing secret is staged

```powershell
git status
git check-ignore -v server\.env        # must print a .gitignore rule
git add -A
git status                              # .env must NOT appear in the list
git diff --cached --name-only | findstr /i ".env"   # should list only .env.example
```

If `server\.env` appears in the staged list, stop and do not commit.

### 14.2 Create the GitHub repository and push

1. On https://github.com click **New repository**. Name it, choose **Private**, and do **not** add a README, .gitignore or license (the project already has files).
2. In the project folder:

```powershell
git add -A
git commit -m "Hostel Expense Tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

GitHub may ask you to sign in through the browser or to use a personal access token as the password. Never paste a token into a file in the project.

### 14.3 Create the Render web service

1. https://render.com > **New + > Web Service** > connect your GitHub account and select the repository (a private repository works on the free plan).
2. Settings:

| Setting | Value |
|---|---|
| Runtime / Language | Node |
| Branch | `main` |
| Root directory | leave empty (repository root) |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Instance type | Free |

`--include=dev` matters: the build needs Vite, a dev dependency, and with `NODE_ENV=production` set (as this guide requires) npm would otherwise skip dev dependencies.

3. **Environment variables** (Render > Environment). Use your own values; the ones below are placeholders:

```
NODE_ENV=production
NODE_VERSION=22
MONGODB_URI=<your Atlas connection string>
JWT_SECRET=<48+ random characters>
GOOGLE_CLIENT_ID=<your Google client id>        # optional
BREVO_API_KEY=<your Brevo API key>               # optional, for email
MAIL_FROM=Hostel Expense Tracker <verified-sender@example.com>
APP_URL=https://<your-service>.onrender.com      # optional; Render's own URL is used if unset
```

Do not set `PORT` (Render provides it) and do not set `CLIENT_ORIGIN` (development only).

4. Click **Create Web Service**. Render builds and starts it. Open the `https://<your-service>.onrender.com` address it shows.

### 14.4 MongoDB Atlas checks for Render

- **Database user:** exists, password matches, `readWrite` on `hostel_expense_tracker`.
- **Network access:** free Render services do not have a fixed outgoing IP, so Atlas must accept connections from anywhere: add `0.0.0.0/0` (Security > Network Access). This is a trade-off: protection then rests on the long database password, least-privilege user and TLS. Remove it again if you move to a host with a fixed IP.
- **Connection string:** the database name is in the path, the password is URL-safe.

### 14.5 Google settings after the live URL exists

In Google Cloud Console > Credentials > your OAuth client > **Authorized JavaScript origins**, add `https://<your-service>.onrender.com` (exactly, https, no trailing slash). Make sure the consent screen allows your users (test users, or published). Allow a few minutes.

### 14.6 Email on the free plan

Use **Brevo's HTTPS API** (option B in section 10). Verify a sender in Brevo, create an API key, and set `BREVO_API_KEY` and `MAIL_FROM` in Render. Do not rely on SMTP on Render's free plan: outbound SMTP is blocked. If you prefer SMTP, use a paid Render instance or another host.

### 14.7 Profile pictures and persistent storage

No persistent disk is needed. Pictures are stored as binary data in MongoDB (`avatars` collection, max 2 MB each), and Render's free plan has no persistent disk anyway. They count against the 512 MB Atlas free-tier quota.

### 14.8 Live-site smoke test

Work through these on the deployed URL. Tick each only after you have seen it work.

- [ ] `/api/health` shows `"status":"ok"` and `"database":"connected"`
- [ ] Home, Features, About, Contact open; refresh on `/features` still works
- [ ] Register a new account; you land on the dashboard; refresh keeps you signed in
- [ ] Log out; opening `/app` sends you to Login
- [ ] Log in again with the same account
- [ ] Wrong password shows an error and no stack trace
- [ ] Add an income and an expense; edit one; delete one
- [ ] Create a budget; add an expense that crosses 80% and check the banner
- [ ] Reports: Monthly, Yearly, Custom, All time; charts and table update
- [ ] Export CSV and PDF; open both and check the figures and footer
- [ ] Settings: upload a picture, refresh, picture persists; remove it
- [ ] Settings: change theme to Dark and reload
- [ ] Contact form submits and a document appears in the `feedbacks` collection in Atlas
- [ ] Forgot password: the email arrives, the link works once, the old password stops working
- [ ] Google sign-in works from the live origin (if configured)
- [ ] Change email: the confirmation arrives at the new address and the change applies only after opening it
- [ ] Check the site on a phone-sized window (320px) in Light and Dark

## 15. Free-tier limitations

- **Render free web service** sleeps after about 15 minutes without traffic; the next visit waits roughly a minute while it starts. It has limited monthly instance hours and no persistent disk. First visit after sleep may also fail health checks briefly.
- **MongoDB Atlas M0:** 512 MB storage and shared resources. Profile pictures are stored there.
- **Email:** SMTP is blocked on Render free; the Brevo free plan has a daily sending cap. Without a working provider, password reset and email change cannot deliver emails.
- **Rate limits** are held in server memory and reset when the service restarts or sleeps.

These limits change over time; check each provider's current terms.

## 16. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `npm` is blocked in PowerShell | use `npm.cmd`, or run the terminal as a command prompt |
| "service unavailable" on login | `MONGODB_URI` or `JWT_SECRET` missing in `server\.env`; restart `npm run dev` |
| `MongoDB connection failed` / timeout | your IP (or `0.0.0.0/0` on Render) is not in Atlas Network Access; wrong password; special characters in the password need URL-encoding |
| `Invalid configuration: JWT_SECRET must be at least 32 characters` | use a longer random secret |
| Blank page or HTML where JSON is expected | the server is not in production mode or the client is not built: run `npm run build`, set `NODE_ENV=production` |
| Build fails on Render with "vite: not found" | build command must be `npm ci --include=dev && npm run build` |
| Login works locally but not on Render | `NODE_ENV=production` makes cookies `Secure`, so use the `https://` address |
| Google button missing | `GOOGLE_CLIENT_ID` not set on the server |
| Google error `origin_mismatch` | the exact site origin is not listed under Authorized JavaScript origins |
| Google popup blocked or blank | allow popups; confirm the consent screen includes your account (test users) |
| Reset or confirmation email never arrives | no provider configured, SMTP blocked on Render (use Brevo), sender not verified, or check the spam folder; check Render logs for "Reset email failed" |
| Emailed links point to `localhost` | `APP_URL` is not set and Render's URL was not detected: set `APP_URL` |
| "Too many attempts" | rate limit hit; wait 15 minutes |
| First request after idle is very slow | Render free service was asleep |
| Tests crash with "out of memory" | the machine is low on memory; close other programs and run `npm test` again |

## 17. Security notes

- **Never commit secrets.** `.env` files are git-ignored; only `.env.example` (placeholders) is committed. Keep `MONGODB_URI`, `JWT_SECRET`, `SMTP_PASS` and `BREVO_API_KEY` in `server\.env` and Render's environment settings.
- If a secret is ever committed, **rotate it** (new database password, new `JWT_SECRET`, new API key): deleting the file in a later commit does not remove it from Git history.
- Serve the site over **HTTPS** only (Render does this). Production cookies are `Secure` and `HttpOnly`.
- Use a long random `JWT_SECRET` and a strong database password; give the database user access to this one database only.
- `0.0.0.0/0` in Atlas is required on Render's free plan but widens exposure; keep the other protections in place.
- Back up anything important yourself: this project does not implement automatic backups.

## 18. Screenshots

Add your own screenshots here after running the app. These are placeholders; no screenshots are included.

- Home page: _placeholder_
- Dashboard: _placeholder_
- Transactions: _placeholder_
- Budgets: _placeholder_
- Reports and charts: _placeholder_
- Exported PDF: _placeholder_
- Settings: _placeholder_
- Dark theme: _placeholder_

## 19. License

No license file is included in this repository, so no open-source license is granted. Add a `LICENSE` file if you choose one.

## 20. Credits

Developed by : K22SW012,X-50 & 10

Department of Software Engineering, MUET SZAB Campus Khairpur Mirs, Mehran University Road, Khairpur.

Built with React, Vite, Express, MongoDB, Mongoose, Zod, Helmet, PDFKit, Nodemailer and Google Identity Services. Thanks to the authors of these open-source projects.

© 2026 Department of Software Engineering, MUET SZAB Campus Khairpur Mirs. All rights reserved.
