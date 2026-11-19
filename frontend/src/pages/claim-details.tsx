import { useCallback, useState } from 'react';
import { AssessmentHistory, AssessmentResult } from '../components/assessment-results';
import { DateLabel, LoadingError, Notice, StatusBadge } from '../components/presentation';
import { Workflow, stages } from '../components/workflow';
import { FormulaForm, ReviewForm, StudyForm } from '../components/workflow-forms';
import { FormulaRecords, ReviewRecord, StudyRecords } from '../components/workflow-records';
import { useAction } from '../hooks/use-action';
import { useResource } from '../hooks/use-resource';
import { claimsApi } from '../services/claims-api';
import type { AssessmentHistoryItem } from '../types/claims';

export function ClaimDetailsPage({ claimId }: { claimId: string }) {
  const loadClaim = useCallback((signal: AbortSignal) => claimsApi.detail(claimId, signal), [claimId]);
  const loadHistory = useCallback((signal: AbortSignal) => claimsApi.history(claimId, signal), [claimId]);
  const { data: claim, setData: setClaim, error, retry } = useResource(loadClaim);
  const history = useResource(loadHistory);
  const action = useAction();
  const [stage, setStage] = useState<number>();
  const [studyId, setStudyId] = useState('');
  const [saved, setSaved] = useState<AssessmentHistoryItem[]>([]);
  const [success, setSuccess] = useState('');
  const [formVersion, setFormVersion] = useState(0);

  if (!claim) return <>
    <a className="back-link" href="#claims">All claims</a>
    {error ? <LoadingError message={error} retry={retry} /> : <Notice>Loading claim…</Notice>}
  </>;

  const review = claim.reviews[0];
  const approved = claim.status === 'APPROVED' && claim.reviews.some(({ applicable, feasible }) => applicable && feasible);
  const rejected = claim.status === 'REJECTED';
  const canSubmitStudy = approved && claim.formulas.length > 0;
  const canAssess = canSubmitStudy && claim.studies.length > 0;
  const suggestedStage = !approved ? 1 : !canSubmitStudy ? 2 : !canAssess ? 3 : 4;
  const active = stage ?? suggestedStage;
  const selectedStudy = claim.studies.find(({ id }) => id === studyId) ?? claim.studies[0];
  const savedIds = new Set(saved.map(({ id }) => id));
  const assessments = [...saved, ...(history.data ?? []).filter(({ id }) => !savedIds.has(id))];
  const latest = assessments[0];
  const latestStudy = claim.studies.find(({ id }) => id === latest?.clinicalStudyId);
  const seededDemo = /^fictional demo:/i.test(claim.title);

  function perform(task: () => Promise<void>, message: string, advance = true) {
    return action.run(async () => {
      setSuccess('');
      await task();
      setSuccess(message);
      if (advance) setStage(undefined);
      setFormVersion((version) => version + 1);
    });
  }

  return <>
    <a className="back-link" href="#claims">All claims</a>
    <header className="detail-head">
      <div>
        <h1>{claim.title}</h1>
        <p>{claim.claimText}</p>
        <span className="muted">Proposed <DateLabel value={claim.createdAt} /></span>
      </div>
      <StatusBadge status={claim.status} />
    </header>

    <Workflow active={active} busy={action.pending} rejected={rejected}
      completed={[true, Boolean(review), claim.formulas.length > 0, claim.studies.length > 0, assessments.length > 0]}
      choose={(next) => { setStage(next); setSuccess(''); action.clearError(); }} />

    <div className="detail-grid">
      <section className="panel workflow-panel" aria-labelledby="stage-heading">
        <div className="section-head"><h2 id="stage-heading">{stages[active]}</h2></div>
        {action.error && <Notice kind="error">{action.error}</Notice>}
        {success && <Notice kind="success">{success}</Notice>}

        {active === 0 && <div className="record proposal">
          <span className="muted">Submitted claim</span>
          <p>{claim.claimText}</p>
        </div>}

        {active === 1 && (review ? <ReviewRecord review={review} /> : claim.status === 'PROPOSED'
          ? <ReviewForm pending={action.pending} submit={(input) => perform(async () => {
            const { claimStatus, ...record } = await claimsApi.review(claimId, input);
            setClaim({ ...claim, status: claimStatus, reviews: [record, ...claim.reviews] });
          }, 'Review saved.')} />
          : <p className="muted">This claim already has a final decision.</p>)}

        {active === 2 && <>
          {claim.formulas.length > 0 && <FormulaRecords formulas={claim.formulas} />}
          {approved
            ? <FormulaForm key={formVersion} pending={action.pending} submit={(input) => perform(async () => {
              const formula = await claimsApi.submitFormula(claimId, input);
              setClaim({ ...claim, formulas: [formula, ...claim.formulas] });
            }, 'Formula saved.')} />
            : <p className="muted">An approved review is required before submitting a formula.</p>}
        </>}

        {active === 3 && <>
          {claim.studies.length > 0 && <StudyRecords studies={claim.studies} formulas={claim.formulas} />}
          {canSubmitStudy
            ? <StudyForm key={formVersion} formulas={claim.formulas} pending={action.pending} submit={(input) => perform(async () => {
              const study = await claimsApi.submitStudy(claimId, input);
              setClaim({ ...claim, studies: [study, ...claim.studies] });
              setStudyId(study.id);
            }, 'Study saved.')} />
            : <p className="muted">Submit a formula for an approved claim to record a study.</p>}
        </>}

        {active === 4 && <>
          {canAssess && selectedStudy ? <form className="evaluate-form" onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              const assessment = await claimsApi.assess(claimId, selectedStudy.id);
              setSaved((previous) => [{
                ...assessment, claimId, clinicalStudyId: selectedStudy.id, formulaId: selectedStudy.formulaId,
              }, ...previous]);
            }, 'Assessment saved.', false);
          }}>
            <fieldset className="fields" disabled={action.pending}>
              <label className="field">
                <span>Clinical study</span>
                <select value={selectedStudy.id} onChange={(event) => setStudyId(event.target.value)}>
                  {claim.studies.map((study) => <option value={study.id} key={study.id}>{study.studyTitle}</option>)}
                </select>
              </label>
              <div><button className="button primary" type="submit" disabled={action.pending}>
                {action.pending ? 'Evaluating claim…' : 'Evaluate Claim'}
              </button></div>
            </fieldset>
            {action.pending && <Notice>Evaluation in progress. This can take a moment.</Notice>}
          </form> : <p className="muted">An approved review and a study linked to a formula are required for assessment.</p>}
          {latest && <AssessmentResult assessment={latest} study={latestStudy} />}
        </>}
      </section>

      <aside className="context-panel" aria-label="Claim overview">
        <div className="panel overview">
          <h2>Claim overview</h2>
          <dl>
            <div><dt>Workflow status</dt><dd><StatusBadge status={claim.status} /></dd></div>
            <div><dt>Formulas</dt><dd>{claim.formulas.length}</dd></div>
            <div><dt>Clinical studies</dt><dd>{claim.studies.length}</dd></div>
          </dl>
        </div>
        {seededDemo && <div className="demo-note">
          <strong>Fictional demonstration</strong>
          <p>This seeded claim, formula, and clinical study are synthetic.</p>
        </div>}
      </aside>
    </div>

    <section className="panel history-panel" aria-labelledby="history-heading">
      <header className="section-head">
        <h2 id="history-heading">Assessment history</h2>
        {(history.data || saved.length > 0) && <span className="muted">{assessments.length} {assessments.length === 1 ? 'result' : 'results'}</span>}
      </header>
      {history.error && <LoadingError message={history.error} retry={history.retry} />}
      {!history.data && !history.error && <Notice>Loading assessment history…</Notice>}
      {(history.data || saved.length > 0) && <AssessmentHistory assessments={assessments} studies={claim.studies} />}
    </section>
  </>;
}
