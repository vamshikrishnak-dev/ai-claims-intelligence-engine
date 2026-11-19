import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { assessmentOutputSchema } from './assessment-output';
import { assessmentInstructions, buildAssessmentPrompt } from './assessment-prompt';
import { AssessmentInput, AssessmentProvider, AssessmentProviderTimeout } from './assessment-provider';

export class OpenAIAssessmentProvider implements AssessmentProvider {
  readonly name = 'OPENAI';

  constructor(
    private readonly client: Pick<OpenAI, 'responses'>,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async evaluate(input: AssessmentInput): Promise<unknown> {
    const signal = AbortSignal.timeout(this.timeoutMs);

    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: assessmentInstructions,
        input: [{ role: 'user', content: buildAssessmentPrompt(input) }],
        text: { format: zodTextFormat(assessmentOutputSchema, 'claim_assessment') },
        store: false,
      }, { signal });

      if (response.status !== 'completed') return null;
      return response.output_parsed;
    } catch (error) {
      if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError ||
          (error instanceof OpenAI.APIError && [408, 504].includes(error.status ?? 0))) {
        throw new AssessmentProviderTimeout();
      }
      throw error;
    }
  }
}
