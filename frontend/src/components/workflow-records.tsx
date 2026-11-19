import type { ClaimReview, ClinicalStudy, Formula } from '../types/claims';
import { DateLabel } from './presentation';

export function ReviewRecord({ review }: { review: ClaimReview }) {
  return <article className="record">
    <dl className="record-data">
      <div><dt>Applicable</dt><dd>{review.applicable ? 'Yes' : 'No'}</dd></div>
      <div><dt>Feasible</dt><dd>{review.feasible ? 'Yes' : 'No'}</dd></div>
      <div><dt>Reviewed</dt><dd><DateLabel value={review.reviewedAt} withTime /></dd></div>
    </dl>
    <p>{review.reviewNotes ?? 'No review notes.'}</p>
  </article>;
}

export function FormulaRecords({ formulas }: { formulas: Formula[] }) {
  return <ul className="record-list">
    {formulas.map((formula) => <li className="record" key={formula.id}>
      <strong>{formula.formulaName}</strong>
      <p>{formula.description}</p>
      {Array.isArray(formula.ingredients) && <ul className="ingredients">
        {formula.ingredients.map(({ name, amount }, index) => <li key={index}>{name}{amount && ` · ${amount}`}</li>)}
      </ul>}
    </li>)}
  </ul>;
}

export function StudyRecords({ studies, formulas }: { studies: ClinicalStudy[]; formulas: Formula[] }) {
  return <ul className="record-list">
    {studies.map((study) => <li className="record" key={study.id}>
      <details>
        <summary>
          <strong>{study.studyTitle}</strong>
          <span className="muted">{formulas.find(({ id }) => id === study.formulaId)?.formulaName}</span>
        </summary>
        <dl className="record-data">
          <div><dt>Study design</dt><dd>{study.studyDesign ?? 'Missing'}</dd></div>
          <div><dt>Sample size</dt><dd>{study.sampleSize ?? 'Missing'}</dd></div>
          <div><dt>Population</dt><dd>{study.population ?? 'Missing'}</dd></div>
          <div><dt>Measured effect</dt><dd>{study.measuredEffect ?? 'Missing'} {study.effectUnit}</dd></div>
          <div><dt>Duration</dt><dd>{study.durationWeeks === null ? 'Missing' : `${study.durationWeeks} weeks`}</dd></div>
          <div><dt>Comparator</dt><dd>{study.comparator ?? 'Missing'}</dd></div>
        </dl>
        {!!study.sourceExcerpts.length && <ul className="reference-list">
          {study.sourceExcerpts.map((excerpt) => <li key={excerpt.id}><code>{excerpt.id}</code><p>{excerpt.text}</p></li>)}
        </ul>}
      </details>
    </li>)}
  </ul>;
}
