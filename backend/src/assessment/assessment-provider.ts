import type { AssessmentProvider as ProviderName, Claim, ClinicalStudy, Formula } from '../generated/prisma/client';

type Snapshot<T> = {
  [Key in keyof T]: T[Key] extends Date ? string : T[Key];
};

export interface AssessmentInput {
  claim: Snapshot<Claim>;
  formula: Snapshot<Formula>;
  study: Omit<Snapshot<ClinicalStudy>, 'sourceExcerpts'> & {
    sourceExcerpts: { id: string; text: string }[];
  };
}

export const ASSESSMENT_PROVIDER = Symbol('ASSESSMENT_PROVIDER');

export interface AssessmentProvider {
  readonly name: ProviderName;
  evaluate(input: AssessmentInput): Promise<unknown>;
}

export class AssessmentProviderTimeout extends Error {}
