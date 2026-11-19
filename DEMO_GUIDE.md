# Technical assessment demo

## Prerequisites

Use Windows PowerShell, Node.js 24, npm, PostgreSQL 17, and a browser. The demonstration uses the fictional seed and mock assessment, with no OpenAI credentials required. Follow the [README](README.md) to provision a database and configure `backend/.env` on a fresh machine.

## Start the application

In each application terminal, verify that `node --version` reports v24. If using the Node 24.22.1 installation managed by NVM for Windows, run:

```powershell
$lormentNode = Join-Path $env:NVM_HOME 'v24.22.1'
$env:Path = "$lormentNode;$env:Path"
node --version
```

If the provisioned per-user PostgreSQL instance is stopped, start it:

```powershell
$lormentPg = Join-Path $env:LOCALAPPDATA 'LormentPostgreSQL'
& (Join-Path $lormentPg 'pgsql/bin/pg_ctl.exe') -D (Join-Path $lormentPg 'data') -l (Join-Path $lormentPg 'postgres.log') -o '-h 127.0.0.1 -p 5432' -w start
```

Run each application block from the project root in its own terminal.

**Backend**

```powershell
Set-Location backend
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
$env:ASSESSMENT_PROVIDER = 'mock'
npm.cmd run start:dev
```

**Frontend**

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

Open [the dashboard](http://127.0.0.1:5173/) and confirm [the proxied health check](http://127.0.0.1:5173/api/health) shows `{"status":"ok"}`.

## Interview walkthrough

1. Open **Fictional demo: Four-week wrinkle reduction**. Read the claim, **Reduces wrinkles by 20% in 4 weeks.**
2. Open **Claim Manager Review**. Show that the claim is applicable and feasible and that the review approved it for study.
3. Open **Scientist Formula**. Show the fictional serum and its ingredient composition.
4. Open **Clinical Study** and expand the fictional study. Show the tested formula, four-week duration, reported 12% reduction, and `demo-study-outcome` excerpt.
5. Open **AI Assessment**, select the fictional study, and click **Evaluate Claim** once. Wait for **Assessment saved**.
6. Show the expected result below. Expand the history entry, then refresh and expand the same entry again. Match its timestamp, provider, and cited excerpt to the displayed result.

| Field | Expected value |
| --- | --- |
| Verdict | **PARTIALLY SUPPORTED** |
| Supported | **No** |
| Confidence | **70%**, labeled as an uncalibrated demonstration heuristic |
| Provider | **MOCK** |
| Reasoning | 12% reduction at four weeks compared with the 20% claim |
| Reference | `demo-study-outcome` |
| Gap | Observed reduction is below the claimed percentage |

For a longer demo, create a new fictional claim, show that formula submission is blocked before review, approve it, submit a formula, add a study with one or more excerpts, and evaluate it. Each evaluation creates a new history entry, so use the evaluation timestamp to distinguish repeated runs.

## Explain the two providers

Mock mode compares the exact wrinkle claim with the supplied result and excerpt using deterministic rules. It is repeatable and makes no network call. The live OpenAI provider uses the same input, validation, and persistence path, requests a structured response, and supplies a paraphrased rationale with excerpt IDs and gaps. Neither confidence display represents a clinical statistical measure.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Unsupported Node version or PowerShell blocks npm scripts | Select Node 24 and invoke `npm.cmd`. |
| Backend startup reports database connection failure | Check that PostgreSQL is running and that the private `backend/.env` has a usable `DATABASE_URL`. Avoid printing the connection string. |
| Prisma client import cannot be resolved | From `backend/`, run `npm.cmd ci` and `npm.cmd run db:generate`. |
| Seeded claim is missing | Apply `npm.cmd run db:migrate` and rerun `npm.cmd run db:seed` in the same database the backend uses. |
| Homepage loads but claims fail | Open the proxied health path. Confirm Nest is listening on `127.0.0.1:3000` and Vite on `127.0.0.1:5173`. |
| Evaluation returns a provider error or times out | Confirm that `$env:ASSESSMENT_PROVIDER = 'mock'` was set before starting Nest. Failed evaluations leave history unchanged. |
| Expected seed verdict differs | Confirm the selected study is the fictional four-week study and the result shows provider **MOCK**. |
