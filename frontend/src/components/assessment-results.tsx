import type { Assessment, AssessmentHistoryItem, ClinicalStudy, EvidenceExcerpt } from '../types/claims';
import { DateLabel, StatusBadge } from './presentation';

function AssessmentDetails({ assessment, excerpts }: { assessment: Assessment; excerpts: EvidenceExcerpt[] }) {
  const isSupported = assessment.verdict ? assessment.verdict === 'SUPPORTED' : assessment.supported;
  const confidence = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(assessment.confidence);

  return <div className="assessment-body">
    <dl className="result-metrics">
      <div><dt>Supported</dt><dd>{isSupported ? 'Yes' : 'No'}</dd></div>
      <div><dt>Confidence</dt><dd>{confidence}</dd></div>
      <div><dt>Provider</dt><dd>{assessment.provider}</dd></div>
    </dl>
    <p className="muted confidence-note">{assessment.provider === 'MOCK'
      ? 'Mock confidence is an uncalibrated demonstration heuristic.'
      : 'Model confidence expresses certainty in the verdict.'}</p>
    <h3>Reasoning</h3>
    <p>{assessment.reasoning}</p>
    <h3>Evidence references</h3>
    {assessment.evidenceReferences.length ? <ul className="reference-list">
      {assessment.evidenceReferences.map((id) => {
        const excerpt = excerpts.find((candidate) => candidate.id === id);
        return <li key={id}><code>{id}</code>{excerpt && <p>{excerpt.text}</p>}</li>;
      })}
    </ul> : <p className="muted">No excerpts cited.</p>}
    <h3>Evidence gaps</h3>
    {assessment.evidenceGaps.length ? <ul>{assessment.evidenceGaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
      : <p className="muted">No evidence gaps reported.</p>}
  </div>;
}

export function AssessmentResult({ assessment, study }: { assessment: Assessment; study?: ClinicalStudy }) {
  return <section className="result" aria-labelledby="latest-assessment">
    <header className="section-head">
      <div>
        <h3 id="latest-assessment">Evaluation result</h3>
        <span className="muted"><DateLabel value={assessment.createdAt} withTime /></span>
      </div>
      {assessment.verdict && <StatusBadge status={assessment.verdict} />}
    </header>
    <AssessmentDetails assessment={assessment} excerpts={study?.sourceExcerpts ?? []} />
  </section>;
}

export function AssessmentHistory({ assessments, studies }: { assessments: AssessmentHistoryItem[]; studies: ClinicalStudy[] }) {
  if (assessments.length === 0) return <div className="empty history-empty">
    <p>No assessments yet. Evaluate a study to add a result to this claim’s history.</p>
  </div>;

  return <ul className="history-list">
    {assessments.map((assessment) => {
      const study = studies.find(({ id }) => id === assessment.clinicalStudyId);
      return <li key={assessment.id}><details>
        <summary>
          <span>
            <strong>{study?.studyTitle ?? 'Saved assessment'}</strong>
            <span className="muted"><DateLabel value={assessment.createdAt} withTime /> · {assessment.provider}</span>
          </span>
          {assessment.verdict && <StatusBadge status={assessment.verdict} />}
        </summary>
        <AssessmentDetails assessment={assessment} excerpts={study?.sourceExcerpts ?? []} />
      </details></li>;
    })}
  </ul>;
}
