import { z } from 'zod';

export const assessmentOutputSchema = z.strictObject({
  supported: z.boolean(),
  confidence: z.number(),
  verdict: z.enum(['SUPPORTED', 'PARTIALLY_SUPPORTED', 'UNSUPPORTED']),
  reasoning: z.string(),
  evidenceReferences: z.array(z.string()),
  evidenceGaps: z.array(z.string()),
});

export type AssessmentOutput = z.infer<typeof assessmentOutputSchema>;

export const sourceExcerptsSchema = z.array(z.strictObject({
  id: z.string().refine((id) => id.length > 0 && id === id.trim()),
  text: z.string().refine((text) => text.trim().length > 0),
})).refine((excerpts) => new Set(excerpts.map(({ id }) => id)).size === excerpts.length);

// Phase 4 accepts paraphrases and excerpt IDs. Reject marked quotations in all free text.
const paraphrase = z.string().trim().min(1).max(4000)
  .refine((text) => !/["“”„‟«»‹›「」『』〝〞`]|^\s*>|(^|\s)[‘']\S[^\r\n]*?[’'](?=\s|[.,;:!?)]|$)/mu.test(text));

export function validateAssessmentOutput(value: unknown, excerptIds: readonly string[]): AssessmentOutput | null {
  const allowedIds = new Set(excerptIds);
  const schema = assessmentOutputSchema.extend({
    confidence: z.number().min(0).max(1),
    reasoning: paraphrase,
    evidenceReferences: z.array(z.string().refine((id) => allowedIds.has(id))).max(50),
    evidenceGaps: z.array(paraphrase).max(32),
  }).refine(({ supported, verdict, evidenceReferences, evidenceGaps }) =>
    supported === (verdict === 'SUPPORTED')
    && (verdict === 'UNSUPPORTED' || evidenceReferences.length > 0)
    && (verdict === 'SUPPORTED' || evidenceGaps.length > 0)
    && new Set(evidenceReferences).size === evidenceReferences.length,
  );

  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
