export type ClaimStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED';
export type Verdict = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED';
export type Provider = 'MOCK' | 'OPENAI';

export interface ClaimInput {
  title: string;
  claimText: string;
}

export interface Claim extends ClaimInput {
  id: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInput {
  applicable: boolean;
  feasible: boolean;
  reviewNotes: string;
}

export interface ClaimReview extends Omit<ReviewInput, 'reviewNotes'> {
  id: string;
  claimId: string;
  reviewNotes: string | null;
  reviewedAt: string;
}

export interface Ingredient {
  name: string;
  amount?: string;
}

export interface FormulaInput {
  formulaName: string;
  description: string;
  ingredients: Ingredient[];
}

export interface Formula extends FormulaInput {
  id: string;
  claimId: string;
  createdAt: string;
}

export interface StudyInput {
  formulaId: string;
  studyTitle: string;
  studyDesign?: string;
  sampleSize?: number;
  population?: string;
  measuredEffect?: number;
  effectUnit?: string;
  durationWeeks?: number;
  comparator?: string;
  sourceExcerpts?: { text: string }[];
}

export interface EvidenceExcerpt {
  id: string;
  text: string;
}

export interface ClinicalStudy {
  id: string;
  claimId: string;
  formulaId: string;
  studyTitle: string;
  studyDesign: string | null;
  sampleSize: number | null;
  population: string | null;
  measuredEffect: number | null;
  effectUnit: string | null;
  durationWeeks: number | null;
  comparator: string | null;
  sourceExcerpts: EvidenceExcerpt[];
  createdAt: string;
}

export interface ClaimDetail extends Claim {
  reviews: ClaimReview[];
  formulas: Formula[];
  studies: ClinicalStudy[];
}

export interface Assessment {
  id: string;
  supported: boolean;
  confidence: number;
  verdict: Verdict | null;
  reasoning: string;
  evidenceReferences: string[];
  evidenceGaps: string[];
  provider: Provider;
  createdAt: string;
}

export interface AssessmentHistoryItem extends Assessment {
  claimId: string;
  formulaId: string;
  clinicalStudyId: string;
}
