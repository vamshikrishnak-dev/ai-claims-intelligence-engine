import type { AssessmentOutput } from './assessment-output';
import type { AssessmentInput, AssessmentProvider } from './assessment-provider';

const wrinkleClaim = /^reduces? wrinkles by (\d+(?:\.\d+)?)\s*% in (\d+(?:\.\d+)?)\s+weeks?\.?$/i;
const wrinkleReductionUnit = /^(?:(?:%|percent(?:age)?)\s+(?:mean\s+)?(?:reduction|decrease)\s+in\s+wrinkle\s+(?:depth|severity|count))(?:\s+(?:from baseline|versus (?:vehicle|control)))?\.?$/i;
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const heuristic = 0.7;
const comparatorOutcome = /\b(?:vehicle|placebo|control)\s+(?:group|arm|users|participants)\s+(?:showed|had|experienced|reported)\b|\b(?:in|among|for|by)\s+(?:the\s+)?(?:vehicle|placebo|control)\s+(?:group|arm|users|participants)\b/i;

function unsupported(reason: string, gaps: string[], evidenceReferences: string[] = []): AssessmentOutput {
  return {
    supported: false,
    confidence: heuristic,
    verdict: 'UNSUPPORTED',
    reasoning: reason + ' Mock confidence is a demonstration heuristic.',
    evidenceReferences,
    evidenceGaps: gaps,
  };
}

function findWrinkleResults(study: AssessmentInput['study']) {
  return study.sourceExcerpts.flatMap(({ id, text }) =>
    text.split(/(?<=[.!?])\s+|[\r\n;]+/).flatMap((sentence) => {
      if (!/wrinkle\s+(?:depth|severity|count)/i.test(sentence)
        || !/\b(?:showed|observed|measured|result(?:s|ed)?|decreased|reduced)\b/i.test(sentence)
        || !/\b(?:reduction|decrease|decreased|reduced)\b/i.test(sentence)
        || /\b(?:no|not|without|could|would|may|hypothetical|expected|increas\w*)\b/i.test(sentence)
        || comparatorOutcome.test(sentence)) {
        return [];
      }

      const percentages = [...sentence.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:%|percent\b)/gi)];
      const outcome = /(-?\d+(?:\.\d+)?)\s*(?:%|percent\b)\s+(?:mean\s+)?(?:reduction|decrease)\s+in\s+wrinkle\s+(depth|severity|count)\b|\bwrinkle\s+(depth|severity|count)\s+(?:decreased|was reduced)\s+by\s+(-?\d+(?:\.\d+)?)\s*(?:%|percent\b)/i.exec(sentence);
      const timepoint = /\b(?:at|after|by|in)\s+(?:week\s+(\d+(?:\.\d+)?|[a-z]+)\b|(\d+(?:\.\d+)?)\s+weeks?\b)/i.exec(sentence);
      if (percentages.length !== 1 || !outcome || !timepoint) return [];

      const time = (timepoint[1] ?? timepoint[2]).toLowerCase();
      const weeks = /^\d/.test(time) ? Number(time) : numberWords.indexOf(time);
      if (weeks !== study.durationWeeks) return [];
      const endpoint = (outcome[2] ?? outcome[3]).toLowerCase();
      if (!study.effectUnit?.toLowerCase().includes('wrinkle ' + endpoint)) return [];

      return [{ id, effect: Number(outcome[1] ?? outcome[4]) }];
    }),
  );
}

export class MockAssessmentProvider implements AssessmentProvider {
  readonly name = 'MOCK';

  async evaluate({ claim, study }: AssessmentInput): Promise<AssessmentOutput> {
    const match = wrinkleClaim.exec(claim.claimText.trim());
    const targetEffect = Number(match?.[1]);
    const targetWeeks = Number(match?.[2]);
    if (!match || targetEffect <= 0 || targetEffect > 100 || !Number.isFinite(targetWeeks) || targetWeeks <= 0) {
      return unsupported('The mock evaluator could not interpret the claim.', [
        'The mock requires an explicit positive wrinkle reduction percentage and a timeframe in weeks.',
      ]);
    }

    const gaps: string[] = [];
    if (study.measuredEffect === null || !Number.isFinite(study.measuredEffect) || Math.abs(study.measuredEffect) > 100) {
      gaps.push('Supply an observed percentage reduction within the valid range.');
    }
    if (!study.effectUnit || !wrinkleReductionUnit.test(study.effectUnit.trim())) {
      gaps.push('Supply a percentage reduction for wrinkle depth, severity, or count.');
    }
    if (study.durationWeeks === null) gaps.push('Supply the study duration in weeks.');
    if (!study.studyDesign?.trim()) gaps.push('Supply the study design.');
    if (study.sampleSize === null) gaps.push('Supply the sample size.');
    if (!study.population?.trim()) gaps.push('Supply the study population.');
    if (!study.comparator?.trim()) gaps.push('Describe the comparator or state that there was none.');
    if (gaps.length || study.measuredEffect === null || study.durationWeeks === null) {
      if (study.sourceExcerpts.length === 0) gaps.push('Supply an outcome excerpt.');
      return unsupported('The study lacks the information required by the mock rules.', gaps);
    }

    const results = findWrinkleResults(study);
    const matching = results.filter(({ effect }) => effect === study.measuredEffect);
    if (matching.length === 0 || matching.length !== results.length) {
      return unsupported('The study excerpts do not corroborate a consistent wrinkle outcome at the reported timepoint.', [
        'Supply a result excerpt linking the treated group to the reported wrinkle endpoint, percentage, and timepoint.',
      ]);
    }

    const evidenceReferences = [...new Set(matching.map(({ id }) => id))];
    const reasoning = `The study reports a ${study.measuredEffect}% reduction at ${study.durationWeeks} weeks. The claim requires ${targetEffect}% by ${targetWeeks} weeks.`;
    if (study.measuredEffect <= 0) {
      return unsupported(reasoning + ' The result does not show a positive reduction.', [
        'The reported outcome does not substantiate the claimed direction of change.',
      ], evidenceReferences);
    }

    if (study.measuredEffect < targetEffect) {
      gaps.push('The observed reduction is below the claimed percentage.');
    }
    if (study.durationWeeks !== targetWeeks) {
      gaps.push('The supplied outcome does not establish the effect at the claimed timepoint.');
    }
    if (/\b(?:uncontrolled|single[- ]arm)\b/i.test(study.studyDesign ?? '') ||
        /\b(?:none|no (?:control|comparator)|not applicable)\b/i.test(study.comparator ?? '')) {
      gaps.push('The reported improvement has no comparator to isolate the formula effect.');
    }

    // A demo rule for a like-for-like outcome, rather than a clinical quality assessment.
    const supported = gaps.length === 0;
    return {
      supported,
      confidence: heuristic,
      verdict: supported ? 'SUPPORTED' : 'PARTIALLY_SUPPORTED',
      reasoning: reasoning + ' Mock confidence is a demonstration heuristic.',
      evidenceReferences,
      evidenceGaps: gaps,
    };
  }
}
