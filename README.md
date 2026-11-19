# AI Claims Intelligence Engine

The AI Claims Intelligence Engine helps research teams check whether a clinical study substantiates the exact wording of a proposed cosmetic product claim. Teams can record a claim decision, submit a formula and its study evidence, evaluate the evidence, and revisit saved results.

- [Technical proposal](TECHNICAL_PROPOSAL.md)
- [Requirements checklist](REQUIREMENTS_CHECKLIST.md)
- [Demonstration guide](DEMO_GUIDE.md)

## Business workflow

1. The business team proposes the claim and supplies its exact wording.
2. The claim manager records applicability, feasibility, and review notes. Both decisions must be positive to approve the claim.
3. The scientist submits a formula and its ingredient composition.
4. The evaluator records clinical study results for the tested formula and adds source excerpts.
5. The assessment compares the submitted evidence with the claim and saves a verdict, confidence score, reasoning, cited excerpt IDs, evidence gaps, and an input snapshot. The dashboard reloads those results from PostgreSQL.

## Stack and architecture

The frontend uses React, TypeScript, Vite, and CSS. The NestJS backend uses TypeScript, class-validator for requests, Zod for assessment output, and Prisma ORM 7.10.1 with the PostgreSQL driver adapter. PostgreSQL 17 stores workflow records. The live provider uses the official OpenAI SDK.

The browser calls relative `/api` paths through Vite's local proxy. Nest controllers accept DTOs, services enforce workflow rules, and repositories encapsulate Prisma operations. The assessment service selects a provider through dependency injection. Provider calls run outside database transactions. A global exception filter returns public HTTP errors.

| Model | Relationships and purpose |
| --- | --- |
| `Claim` | Parent of reviews, formulas, studies, and assessments. Stores exact wording and workflow status. |
| `ClaimReview` | Belongs to a claim. One final review is enforced by an atomic status transition in the API. |
| `Formula` | Belongs to a claim. Ingredients are stored as JSON. |
| `ClinicalStudy` | Belongs to the same claim as its tested formula. Optional measurements and source excerpts are retained as submitted, with server-assigned excerpt IDs. |
| `Assessment` | References the claim, tested formula, and clinical study as a consistent combination. Stores the verdict, references, gaps, and exact input snapshot. |

Composite foreign keys enforce relationship consistency. The initial migration also enforces confidence in the inclusive range `0–1`, agreement between `supported` and any recorded verdict, and positivity for study sample size and duration when supplied.

## Local installation on Windows

Use **Node.js 24** with npm, a running **PostgreSQL 17** instance, and a browser. The project was verified using Node.js 24.22.1 and PostgreSQL 17.12. Run the following from the project root. If NVM for Windows already has that Node version, you can select it for each PowerShell session:

```powershell
$lormentNode = Join-Path $env:NVM_HOME 'v24.22.1'
$env:Path = "$lormentNode;$env:Path"
node --version
npm.cmd --version
```

### PostgreSQL

Use a dedicated local database. If the workspace's per-user PostgreSQL instance is already provisioned, start it only if stopped. For a standard PostgreSQL Windows installation, start its registered service instead.

```powershell
$lormentPg = Join-Path $env:LOCALAPPDATA 'LormentPostgreSQL'
& (Join-Path $lormentPg 'pgsql/bin/pg_ctl.exe') -D (Join-Path $lormentPg 'data') -l (Join-Path $lormentPg 'postgres.log') -o '-h 127.0.0.1 -p 5432' -w start
```

On a fresh PostgreSQL installation, connect as the database administrator using `psql -h 127.0.0.1 -U postgres -d postgres` (or the installed full path to `psql.exe`) and provision the local role and database:

```sql
CREATE ROLE lorment LOGIN;
\password lorment
CREATE DATABASE lorment OWNER lorment;
```

Copy the environment template only if the backend environment file does not already exist. Set `DATABASE_URL` there using your own credential, URL-encoding reserved password characters.

```powershell
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

| Backend variable | Value |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. The database role must be able to apply migrations. |
| `ASSESSMENT_PROVIDER` | `mock` (default) or `openai`. |
| `OPENAI_API_KEY` | Required in OpenAI mode. Keep it in the private backend environment. |
| `OPENAI_MODEL` | Required in OpenAI mode. Use a model available to the project with Responses API Structured Outputs support. |
| `OPENAI_TIMEOUT_MS` | Optional in OpenAI mode. Defaults to `30000`. |

### Backend terminal

```powershell
Set-Location backend
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
$env:ASSESSMENT_PROVIDER = 'mock'
npm.cmd run start:dev
```

The migration applies checked-in SQL. The seed is repeatable and adds a fictional claim, review, formula, and study with stable IDs. The health response is a liveness check. Nest verifies PostgreSQL connectivity on startup when `DATABASE_URL` is configured.

### Frontend terminal

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

Open [the dashboard](http://127.0.0.1:5173/). Confirm the proxy via [the health endpoint](http://127.0.0.1:5173/api/health), which returns `{"status":"ok"}`.

## REST API

| Method and path | Request and result |
| --- | --- |
| `GET /api/health` | Liveness check. |
| `POST /api/claims` | `title`, `claimText`. Creates a proposed claim. |
| `GET /api/claims` | Lists claims newest first. |
| `GET /api/claims/:id` | Returns a claim, reviews, formulas, and studies. |
| `POST /api/claims/:id/reviews` | Boolean `applicable` and `feasible`, plus `reviewNotes`. Records the final decision. |
| `POST /api/claims/:id/formulas` | `formulaName`, `description`, and `ingredients` objects with `name` and optional `amount`. Requires an approved claim. |
| `POST /api/claims/:id/studies` | `formulaId` and `studyTitle`. Optionally accepts `studyDesign`, `sampleSize`, `population`, `measuredEffect`, `effectUnit`, `durationWeeks`, `comparator`, and `sourceExcerpts` objects with `text`. |
| `POST /api/claims/assess` | `claimId` and `clinicalStudyId`. Saves and returns a validated assessment. |
| `GET /api/claims/:id/assessments` | Returns saved assessments, with snapshots, newest first or `[]`. |

POST requests use JSON and return HTTP `201` on successful persistence. GET requests return `200`. Errors use `{ "statusCode": 400, "message": "..." }`. Validation can return an array of messages. Missing records return `404`, workflow conflicts `409`, provider failures or invalid output `502`, provider timeouts `504`, and unexpected server errors `500`.

For the fictional seed, call `POST /api/claims/assess` with:

```json
{
  "claimId": "10000000-0000-4000-8000-000000000001",
  "clinicalStudyId": "10000000-0000-4000-8000-000000000004"
}
```

The response contains `id`, `supported`, `confidence`, `verdict`, `reasoning`, `evidenceReferences`, `evidenceGaps`, `provider`, and `createdAt`. Only `SUPPORTED` maps to `supported: true`; `PARTIALLY_SUPPORTED` and `UNSUPPORTED` both display **No**. Providers paraphrase evidence and cite submitted IDs. The service rejects unknown IDs, marked quotations, malformed output, and inconsistent verdicts before writing.

## Mock and live evaluation

**Mock** is deterministic and needs no API key. It handles explicit wrinkle-reduction claims with a percentage and week count. The fictional study reports a 12% reduction at four weeks against a 20% claim, yielding `PARTIALLY_SUPPORTED`. Mock confidence is an uncalibrated demonstration heuristic.

**OpenAI** uses strict structured output and sends the selected claim, formula, and study to the Responses API with response storage disabled. To opt in outside the assessment demo, configure the backend variables above, remove any session-level mock override, and restart Nest. Live calls can incur costs. Use data approved for transmission to the provider. [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)

## Testing

From the repository root with both dependency sets installed and PostgreSQL running:

```powershell
Push-Location backend
npm.cmd run db:generate
npm.cmd run build
npm.cmd test
Pop-Location
Push-Location frontend
npm.cmd run build
Pop-Location
```

The HTTP suite uses a migrated, seeded development database and requires permission to create schemas. It applies migrations and seeds a temporary test schema, removes the schema at teardown, and compares the development seed before and after. The tests force mock mode and stub OpenAI calls. The [demo guide](DEMO_GUIDE.md) contains the browser verification checklist.

## Known limitations

- The local assessment build has no authentication or role enforcement. Study evidence is entered as structured fields and excerpts. File ingestion is outside the current scope.
- The mock evaluator handles a narrow claim format. Model confidence indicates certainty in the verdict. Clinical or regulatory decisions require independent review.
- Excerpt validation checks citation membership and output format. Assessing whether a cited excerpt semantically supports every model statement still requires expert review.
- Each successful evaluation creates a new history entry. Claim and history lists currently return full result sets.
- Live OpenAI credentials and network behavior have not been verified. The submission demo uses mock mode.
