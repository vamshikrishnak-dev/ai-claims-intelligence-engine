const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { after, before, test } = require('node:test');

require('dotenv/config');
require('reflect-metadata');

const { NestFactory } = require('@nestjs/core');
const { Client } = require('pg');
const { AppModule } = require('../dist/app.module');
const { ASSESSMENT_PROVIDER } = require('../dist/assessment/assessment-provider');
const { OpenAIAssessmentProvider } = require('../dist/assessment/openai-assessment.provider');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { seedDemoData } = require('../dist/prisma/seed-demo-data');
const OpenAI = require('openai');

const schema = 'workflow_test_' + randomUUID().replaceAll('-', '');
const seedClaimId = '10000000-0000-4000-8000-000000000001';
const seedFormulaId = '10000000-0000-4000-8000-000000000003';
const missingId = '10000000-0000-4000-8000-000000000099';
const claimInput = { title: 'Test claim', claimText: 'Improves appearance in four weeks.' };
const reviewInput = { applicable: true, feasible: true, reviewNotes: 'Approved for study.' };
const formulaInput = {
  formulaName: 'Test serum',
  description: 'Scientist submission.',
  ingredients: [{ name: 'Water' }, { name: 'Glycerin', amount: '2%' }],
};

let database;
let schemaCreated = false;
let app;
let baseUrl;
let originalUrl;
let configurationChanged = false;
let seedBefore;
const originalProvider = process.env.ASSESSMENT_PROVIDER;

function runPrisma(...args) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, 'Prisma command failed: ' + args.join(' '));
}

async function readOriginalSeed() {
  const { rows } = await database.query(
    `SELECT
      (SELECT to_jsonb(c) FROM "Claim" c WHERE id = $1) AS claim,
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM "ClaimReview" r WHERE "claimId" = $1) AS reviews,
      (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM "Formula" f WHERE "claimId" = $1) AS formulas,
      (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM "ClinicalStudy" s WHERE "claimId" = $1) AS studies,
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM "Assessment" a WHERE "claimId" = $1) AS assessments`,
    [seedClaimId],
  );
  return rows[0];
}

before(async () => {
  originalUrl = process.env.DATABASE_URL;
  assert.ok(originalUrl, 'Set DATABASE_URL to a migrated and seeded development database.');
  database = new Client({ connectionString: originalUrl });
  await database.connect();
  const originalSchema = new URL(originalUrl).searchParams.get('schema') ?? 'public';
  await database.query("SELECT set_config('search_path', quote_ident($1), false)", [originalSchema]);

  seedBefore = await readOriginalSeed();
  assert.equal(seedBefore.claim?.id, seedClaimId, 'Run the development seed before testing.');

  await database.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  const isolatedUrl = new URL(originalUrl);
  isolatedUrl.searchParams.set('schema', schema);
  process.env.DATABASE_URL = isolatedUrl.toString();
  configurationChanged = true;

  runPrisma('migrate', 'deploy');
  process.env.ASSESSMENT_PROVIDER = 'mock';
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  await seedDemoData(app.get(PrismaService).client);
  baseUrl = (await app.getUrl()) + '/api';
});

after(async () => {
  try {
    await app?.close();
  } finally {
    if (configurationChanged) process.env.DATABASE_URL = originalUrl;
    if (originalProvider === undefined) delete process.env.ASSESSMENT_PROVIDER;
    else process.env.ASSESSMENT_PROVIDER = originalProvider;
    try {
      if (schemaCreated) {
        await database.query(`DROP SCHEMA "${schema}" CASCADE`);
        assert.deepEqual(await readOriginalSeed(), seedBefore, 'Development seed records changed.');
      }
    } finally {
      await database?.end();
    }
  }
});

async function request(method, path, expectedStatus, payload) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(body));

  if (expectedStatus >= 400) {
    assert.equal(body.statusCode, expectedStatus);
    assert.ok(typeof body.message === 'string' || Array.isArray(body.message));
    assert.deepEqual(Object.keys(body).sort(), ['message', 'statusCode']);
  }
  return body;
}

function createClaim() {
  return request('POST', '/claims', 201, claimInput);
}

test('health returns 200', async () => {
  assert.deepEqual(await request('GET', '/health', 200), { status: 'ok' });
});

test('creates, lists and retrieves a proposed claim', async () => {
  const claim = await request('POST', '/claims', 201, { ...claimInput, title: ' Test claim ' });
  assert.equal(claim.status, 'PROPOSED');
  assert.equal(claim.title, claimInput.title);
  assert.equal(claim.claimText, claimInput.claimText);
  const list = await request('GET', '/claims', 200);
  assert.equal(list[0].id, claim.id);
  const detail = await request('GET', '/claims/' + claim.id, 200);
  assert.deepEqual(detail.reviews, []);
  assert.deepEqual(detail.formulas, []);
  assert.deepEqual(detail.studies, []);
});

test('records an approved review and rejects a conflicting or duplicate review', async () => {
  const claim = await createClaim();
  const path = '/claims/' + claim.id;
  const review = await request('POST', path + '/reviews', 201, reviewInput);
  assert.equal(review.claimId, claim.id);
  assert.equal(review.claimStatus, 'APPROVED');
  await request('POST', path + '/reviews', 409, reviewInput);
  await request('POST', path + '/reviews', 409, { ...reviewInput, feasible: false });
  const detail = await request('GET', path, 200);
  assert.equal(detail.status, 'APPROVED');
  assert.equal(detail.reviews.length, 1);
  assert.equal(detail.reviews[0].id, review.id);
});

test('concurrent reviews allow one final decision', async () => {
  const { id } = await createClaim();
  const path = '/claims/' + id;
  const replies = await Promise.all([reviewInput, { ...reviewInput, feasible: false }].map((body) =>
    fetch(baseUrl + path + '/reviews', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
  ));
  assert.deepEqual(replies.map(({ status }) => status).sort(), [201, 409]);
  const detail = await request('GET', path, 200);
  assert.equal(detail.reviews.length, 1);
  assert.equal(detail.status, detail.reviews[0].feasible ? 'APPROVED' : 'REJECTED');
});

test('allows approved formula and study submissions with stable excerpt IDs', async () => {
  const { id } = await createClaim();
  const path = '/claims/' + id;
  await request('POST', path + '/reviews', 201, reviewInput);
  const formula = await request('POST', path + '/formulas', 201, formulaInput);
  assert.equal(formula.claimId, id);
  assert.deepEqual(formula.ingredients, formulaInput.ingredients);

  const study = await request('POST', path + '/studies', 201, {
    formulaId: formula.id,
    studyTitle: 'Fictional follow-up',
    studyDesign: 'Randomized',
    sampleSize: 25,
    population: 'Simulated adults',
    measuredEffect: 0,
    effectUnit: 'percent',
    durationWeeks: 4,
    comparator: 'Vehicle',
    sourceExcerpts: [{ text: 'Simulated observation.' }, { text: 'No measured change.' }],
  });
  assert.equal(study.claimId, id);
  assert.equal(study.formulaId, formula.id);
  assert.equal(study.measuredEffect, 0);
  assert.equal(study.sampleSize, 25);
  assert.match(study.sourceExcerpts[0].id, /^[a-f0-9-]{36}$/);
  assert.notEqual(study.sourceExcerpts[0].id, study.sourceExcerpts[1].id);
  const detail = await request('GET', path, 200);
  assert.deepEqual(detail.studies[0].sourceExcerpts, study.sourceExcerpts);
  assert.deepEqual(await request('GET', path + '/assessments', 200), []);
});

test('rejects formula submissions before approval and after rejection', async () => {
  const { id } = await createClaim();
  const path = '/claims/' + id;
  await request('POST', path + '/formulas', 409, formulaInput);
  const review = await request('POST', path + '/reviews', 201, { ...reviewInput, feasible: false });
  assert.equal(review.claimStatus, 'REJECTED');
  await request('POST', path + '/formulas', 409, formulaInput);
});

test('rejects another claim’s formula and handles a missing formula', async () => {
  const { id } = await createClaim();
  const path = '/claims/' + id + '/studies';
  await request('POST', path, 409, { studyTitle: 'Wrong claim', formulaId: seedFormulaId });
  await request('POST', path, 404, { studyTitle: 'Missing formula', formulaId: missingId });
  const prisma = app.get(PrismaService).client;
  await assert.rejects(prisma.clinicalStudy.create({
    data: { claimId: id, formulaId: seedFormulaId, studyTitle: 'Mismatched fixture', sourceExcerpts: [] },
  }), { code: 'P2003' });
});

test('validates route params, request bodies and nested evidence', async () => {
  await request('GET', '/claims/invalid', 400);
  await request('POST', '/claims', 400, { title: ' ', status: 'APPROVED' });
  await request('POST', '/claims', 400, []);
  const { id } = await createClaim();
  await request('POST', '/claims/' + id + '/reviews', 400, { ...reviewInput, feasible: 'true' });
  const path = '/claims/' + seedClaimId;
  await request('POST', path + '/formulas', 400, { ...formulaInput, ingredients: [] });
  await request('POST', path + '/formulas', 400, { ...formulaInput, ingredients: [['Water']] });
  await request('POST', path + '/studies', 400, {
    studyTitle: 'Invalid study', formulaId: seedFormulaId, sampleSize: 0,
    measuredEffect: '12', durationWeeks: -4, sourceExcerpts: [{ text: 'Quote', id: 'client-id' }],
  });
});

test('returns 404 for a missing claim on every claim-specific endpoint', async () => {
  const path = '/claims/' + missingId;
  await request('GET', path, 404);
  await request('POST', path + '/reviews', 404, reviewInput);
  await request('POST', path + '/formulas', 404, formulaInput);
  await request('POST', path + '/studies', 404, { studyTitle: 'Missing claim', formulaId: seedFormulaId });
  await request('GET', path + '/assessments', 404);
});

test('uses the seeded workflow and preserves preexisting study evidence', async () => {
  const path = '/claims/' + seedClaimId;
  const detail = await request('GET', path, 200);
  assert.equal(detail.claimText, 'Reduces wrinkles by 20% in 4 weeks.');
  assert.equal(detail.status, 'APPROVED');
  assert.equal(detail.reviews.length, 1);
  assert.equal(detail.formulas[0].id, seedFormulaId);
  assert.equal(detail.studies[0].formulaId, seedFormulaId);
  assert.match(detail.studies[0].studyTitle, /FICTIONAL/);
  assert.deepEqual(await request('GET', path + '/assessments', 200), []);
  await request('POST', path + '/reviews', 409, reviewInput);

  const formula = await request('POST', path + '/formulas', 201, formulaInput);
  const study = await request('POST', path + '/studies', 201, {
    formulaId: formula.id, studyTitle: 'Fictional study with incomplete evidence',
  });
  assert.equal(study.sampleSize, null);
  assert.equal(study.durationWeeks, null);
  assert.deepEqual(study.sourceExcerpts, []);
  const updated = await request('GET', path, 200);
  assert.deepEqual(updated.studies.find(({ id }) => id === detail.studies[0].id), detail.studies[0]);
  assert.deepEqual(await request('GET', path + '/assessments', 200), []);
});

test('returns stored assessments only, newest first', async () => {
  const { id: claimId } = await createClaim();
  const path = '/claims/' + claimId;
  await request('POST', path + '/reviews', 201, reviewInput);
  const { id: formulaId } = await request('POST', path + '/formulas', 201, formulaInput);
  const { id: clinicalStudyId } = await request('POST', path + '/studies', 201, {
    formulaId, studyTitle: 'Fictional history fixture',
  });
  const prisma = app.get(PrismaService).client;
  const fixture = {
    claimId, formulaId, clinicalStudyId, supported: false, confidence: 0.5,
    verdict: 'UNSUPPORTED', reasoning: 'Synthetic history fixture.',
    evidenceReferences: [], evidenceGaps: ['Missing measured effect.'],
    provider: 'MOCK', inputSnapshot: {},
  };
  const earlier = await prisma.assessment.create({ data: { ...fixture, createdAt: new Date(0) } });
  const later = await prisma.assessment.create({ data: { ...fixture, createdAt: new Date(1000) } });
  const history = await request('GET', path + '/assessments', 200);
  assert.deepEqual(history.map(({ id }) => id), [later.id, earlier.id]);
  assert.equal(history[0].reasoning, fixture.reasoning);
  assert.equal(history[0].supported, false);
  assert.equal(history[0].confidence, 0.5);
});

const assessPath = '/claims/assess';
const seedStudyId = '10000000-0000-4000-8000-000000000004';
const seedAssessment = { claimId: seedClaimId, clinicalStudyId: seedStudyId };

function submitSeedStudy(study) {
  return request('POST', '/claims/' + seedClaimId + '/studies', 201, {
    formulaId: seedFormulaId,
    studyTitle: 'Fictional assessment fixture',
    ...study,
  });
}

const studyFields = {
  studyDesign: 'Randomized vehicle-controlled parallel groups.',
  sampleSize: 40,
  population: 'Simulated adults with facial wrinkles.',
  measuredEffect: 21,
  effectUnit: 'percent reduction in wrinkle depth from baseline',
  durationWeeks: 4,
  comparator: 'Vehicle control',
  sourceExcerpts: [{ text: 'The treatment group showed a 21% reduction in wrinkle depth at week four.' }],
};

test('assesses a fully supported claim and persists the exact input snapshot and result', async () => {
  const study = await submitSeedStudy(studyFields);
  const response = await request('POST', assessPath, 201, { ...seedAssessment, clinicalStudyId: study.id });
  assert.equal(response.verdict, 'SUPPORTED');
  assert.equal(response.supported, true);
  assert.equal(response.provider, 'MOCK');
  assert.ok(response.confidence >= 0 && response.confidence <= 1);
  assert.match(response.reasoning, /heuristic/);
  assert.deepEqual(response.evidenceReferences, [study.sourceExcerpts[0].id]);
  assert.deepEqual(response.evidenceGaps, []);

  const claim = await request('GET', '/claims/' + seedClaimId, 200);
  const history = await request('GET', '/claims/' + seedClaimId + '/assessments', 200);
  const saved = history.find(({ id }) => id === response.id);
  for (const key of Object.keys(response)) assert.deepEqual(saved[key], response[key]);
  assert.equal(saved.claimId, seedClaimId);
  assert.equal(saved.formulaId, seedFormulaId);
  assert.equal(saved.clinicalStudyId, study.id);
  const { reviews, formulas, studies, ...claimRow } = claim;
  assert.deepEqual(saved.inputSnapshot, {
    claim: claimRow,
    formula: formulas.find(({ id }) => id === seedFormulaId),
    study,
  });
});

test('assesses the original seeded study as partial support for a lower magnitude', async () => {
  const result = await request('POST', assessPath, 201, seedAssessment);
  assert.equal(result.verdict, 'PARTIALLY_SUPPORTED');
  assert.equal(result.supported, false);
  assert.deepEqual(result.evidenceReferences, ['demo-study-outcome']);
  assert.match(result.reasoning, /12%/);
  assert.match(result.evidenceGaps.join(' '), /below the claimed percentage/);
});

test('identifies an unobserved claim timepoint as partial support', async () => {
  const study = await submitSeedStudy({
    ...studyFields, durationWeeks: 8,
    sourceExcerpts: [{ text: 'The treatment group showed a 21% reduction in wrinkle depth at week eight.' }],
  });
  const result = await request('POST', assessPath, 201, { ...seedAssessment, clinicalStudyId: study.id });
  assert.equal(result.verdict, 'PARTIALLY_SUPPORTED');
  assert.equal(result.supported, false);
  assert.match(result.evidenceGaps.join(' '), /claimed timepoint/);
});

test('returns unsupported with explicit gaps for incomplete study evidence', async () => {
  const study = await submitSeedStudy({});
  const result = await request('POST', assessPath, 201, { ...seedAssessment, clinicalStudyId: study.id });
  assert.equal(result.verdict, 'UNSUPPORTED');
  assert.equal(result.supported, false);
  assert.deepEqual(result.evidenceReferences, []);
  assert.match(result.evidenceGaps.join(' '), /outcome excerpt/);
});

test('does not treat an unrelated percentage or a contradictory outcome as supporting evidence', async () => {
  for (const text of [
    'At week four 21% of participants showed a reduction in wrinkle depth.',
    'At week four the treatment group showed no 21% reduction in wrinkle depth.',
    'At week four the vehicle group showed a 21% reduction in wrinkle depth.',
    'A 21% reduction in wrinkle depth was observed in the placebo group at week four.',
  ]) {
    const study = await submitSeedStudy({ ...studyFields, sourceExcerpts: [{ text }] });
    const result = await request('POST', assessPath, 201, { ...seedAssessment, clinicalStudyId: study.id });
    assert.equal(result.verdict, 'UNSUPPORTED');
    assert.deepEqual(result.evidenceReferences, []);
  }
});

test('validates assessment requests and rejects missing or unrelated workflow records before provider invocation', async (t) => {
  const provider = app.get(ASSESSMENT_PROVIDER);
  const evaluate = t.mock.method(provider, 'evaluate', async () => { throw new Error('Must not execute.'); });

  await request('POST', assessPath, 400, { ...seedAssessment, claimId: 'invalid' });
  await request('POST', assessPath, 404, { ...seedAssessment, claimId: missingId });
  await request('POST', assessPath, 404, { ...seedAssessment, clinicalStudyId: missingId });

  const claim = await createClaim();
  const path = '/claims/' + claim.id;
  const forOtherClaim = { ...seedAssessment, claimId: claim.id };
  await request('POST', assessPath, 409, forOtherClaim);
  await request('POST', path + '/reviews', 201, reviewInput);
  await request('POST', assessPath, 409, forOtherClaim);
  assert.equal(evaluate.mock.callCount(), 0);
});

const validOutput = {
  supported: false, confidence: 0.7, verdict: 'PARTIALLY_SUPPORTED',
  reasoning: 'The measured reduction was lower than the claimed reduction.',
  evidenceReferences: ['demo-study-outcome'], evidenceGaps: ['The claimed magnitude was not observed.'],
};

for (const [label, output] of [
  ['invalid confidence', { ...validOutput, confidence: 1.01 }],
  ['unknown evidence reference', { ...validOutput, evidenceReferences: ['made-up-excerpt'] }],
  ['inconsistent supported and verdict', { ...validOutput, supported: true }],
  ['blank reasoning', { ...validOutput, reasoning: ' ' }],
  ['unverified quotation', { ...validOutput, reasoning: 'The study says “fabricated evidence”.' }],
  ['missing required fields', { supported: true }],
]) {
  test('rejects ' + label + ' with 502 and writes no assessment', async (t) => {
    const prisma = app.get(PrismaService).client;
    const count = await prisma.assessment.count();
    t.mock.method(app.get(ASSESSMENT_PROVIDER), 'evaluate', async () => output);
    await request('POST', assessPath, 502, seedAssessment);
    assert.equal(await prisma.assessment.count(), count);
  });
}

test('uses strict OpenAI structured outputs with separate untrusted data and no live API call', async (t) => {
  let sent;
  const model = new OpenAIAssessmentProvider({
    responses: {
      parse: async (body, options) => {
        sent = { body, options };
        return { status: 'completed', output_parsed: validOutput };
      },
    },
  }, 'fixture-model', 30000);
  t.mock.method(app.get(ASSESSMENT_PROVIDER), 'evaluate', (input) => model.evaluate(input));
  const result = await request('POST', assessPath, 201, seedAssessment);
  assert.equal(result.verdict, 'PARTIALLY_SUPPORTED');
  assert.equal(sent.body.store, false);
  assert.equal(sent.body.text.format.strict, true);
  assert.equal(sent.body.text.format.schema.additionalProperties, false);
  assert.match(sent.body.instructions, /untrusted data/);
  assert.equal(sent.body.input[0].role, 'user');
  assert.equal(JSON.parse(sent.body.input[0].content).study.id, seedStudyId);
  assert.ok(sent.options.signal instanceof AbortSignal);
});

for (const [label, failure, expected] of [
  ['SDK timeout', () => { throw new OpenAI.APIConnectionTimeoutError(); }, 504],
  ['upstream failure', () => { throw new Error('fixture-key and internal prompt'); }, 502],
  ['refused or absent parsed output', () => ({ status: 'completed', output_parsed: null }), 502],
  ['incomplete response', () => ({ status: 'incomplete', output_parsed: validOutput }), 502],
]) {
  test('handles ' + label + ' without leaking provider details or persisting an assessment', async (t) => {
    const prisma = app.get(PrismaService).client;
    const count = await prisma.assessment.count();
    const model = new OpenAIAssessmentProvider({ responses: { parse: async () => failure() } }, 'fixture-model', 30000);
    t.mock.method(app.get(ASSESSMENT_PROVIDER), 'evaluate', (input) => model.evaluate(input));

    const error = await request('POST', assessPath, expected, seedAssessment);
    assert.doesNotMatch(error.message, /fixture-key|internal prompt/);
    assert.equal(await prisma.assessment.count(), count);
  });
}
