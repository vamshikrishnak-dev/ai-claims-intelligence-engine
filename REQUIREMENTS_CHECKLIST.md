# Assessment requirements checklist

This checklist maps the technical assessment requirements to the AI Claims Intelligence Engine. The working application and documentation are the submission artifacts.

| Brief requirement | Implementation and verification | Status |
| --- | --- | --- |
| Business team proposes a cosmetic claim | The dashboard creates a proposed claim with exact wording, stored by `ClaimsService`. Verified through browser and HTTP. | Verified |
| Claim manager filters for applicability and feasibility | Review form records both decisions and notes. The service approves only when both decisions are true, and the integration suite checks concurrent final reviews. | Verified |
| Scientist submits a tested product formula | Formula form and API record claim-linked composition after approval. Verified through the seeded claim and the new-claim walkthrough. | Verified |
| Evaluator submits a clinical study report | The study form captures structured evidence and excerpts tied to the tested formula. It supports the report's essential results through manual entry. The brief describes attaching results. If attachment means uploading report files, that capability is outside this submission. | Structured entry verified |
| Prisma schema or TypeORM entities for Claim and Assessment | [Prisma schema](backend/prisma/schema.prisma) includes both models plus reviews, formulas, and studies. [Initial migration](backend/prisma/migrations/20261119000000_initial/migration.sql) enforces relationship and assessment checks. | Verified |
| NestJS controller and service expose `POST /api/claims/assess` | [Controller](backend/src/assessment/assessment.controller.ts) accepts claim and clinical study IDs. The [service](backend/src/assessment/assessment.service.ts) resolves the stored claim, formula, and evidence. | Verified |
| Call OpenAI to determine whether the claim is justified | The [OpenAI provider](backend/src/assessment/openai-assessment.provider.ts) uses the Responses API and strict structured output. Mocked SDK tests verify the request, refusal, invalid output, and failure paths. Paid API calls were excluded from verification. | Implemented; live call unverified |
| Persist assessment and return it to the client | The assessment service writes validated results, provider, and input snapshot through Prisma and returns HTTP 201. HTTP tests verify the saved result in history. | Verified |
| React JSX calls the endpoint and displays Yes/No, confidence, and reasoning | The [claim details page](frontend/src/pages/claim-details.tsx) invokes the API. The [result panel](frontend/src/components/assessment-results.tsx) shows Supported Yes/No (the brief's Justified Yes/No), confidence, and reasoning. The browser reads persisted history after reload. | Verified |
| Explain the business process | The [technical proposal](TECHNICAL_PROPOSAL.md) describes each role and separates workflow approval from evidence substantiation. | Delivered |
| Show design research and technical architecture justification | The proposal provides primary references, a Mermaid architecture diagram, database design, API contract, and tradeoffs. | Delivered |
| Propose a product roadmap | The proposal outlines expert validation, role-based access, report ingestion, audit history, and scaling. | Delivered |
| Keep the exercise suitable for one day | The concise proposal and [demo guide](DEMO_GUIDE.md) focus the walkthrough on the core feature. Elapsed implementation time was outside this requirements audit. | Submission scope documented |
