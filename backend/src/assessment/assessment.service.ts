import {
  BadGatewayException, ConflictException, GatewayTimeoutException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import { sourceExcerptsSchema, validateAssessmentOutput } from './assessment-output';
import {
  ASSESSMENT_PROVIDER, AssessmentInput, AssessmentProvider, AssessmentProviderTimeout,
} from './assessment-provider';
import { AssessmentRepository } from './assessment.repository';

@Injectable()
export class AssessmentService {
  constructor(
    private readonly repository: AssessmentRepository,
    @Inject(ASSESSMENT_PROVIDER) private readonly provider: AssessmentProvider,
  ) {}

  async assess(claimId: string, clinicalStudyId: string) {
    const claimed = await this.repository.findClaim(claimId);
    if (!claimed) throw new NotFoundException('Claim not found.');
    const { reviews, ...claim } = claimed;
    if (claim.status !== 'APPROVED' || reviews.length === 0) {
      throw new ConflictException('Assessment requires an approved claim review.');
    }

    const clinicalStudy = await this.repository.findStudy(clinicalStudyId);
    if (!clinicalStudy) throw new NotFoundException('Clinical study not found.');
    const { formula, ...study } = clinicalStudy;
    if (study.claimId !== claim.id || !formula || formula.claimId !== claim.id || formula.id !== study.formulaId) {
      throw new ConflictException('The clinical study and its formula must belong to the claim.');
    }
    const excerpts = sourceExcerptsSchema.safeParse(study.sourceExcerpts);
    if (!excerpts.success) throw new ConflictException('The clinical study has invalid evidence excerpts.');

    const input: AssessmentInput = {
      claim: { ...claim, createdAt: claim.createdAt.toISOString(), updatedAt: claim.updatedAt.toISOString() },
      formula: { ...formula, createdAt: formula.createdAt.toISOString() },
      study: { ...study, createdAt: study.createdAt.toISOString(), sourceExcerpts: excerpts.data },
    };

    let output: unknown;
    try {
      output = await this.provider.evaluate(input);
    } catch (error) {
      if (error instanceof AssessmentProviderTimeout) {
        throw new GatewayTimeoutException('The assessment provider timed out.');
      }
      throw new BadGatewayException('The assessment provider request failed.');
    }

    const result = validateAssessmentOutput(output, excerpts.data.map(({ id }) => id));
    if (!result) throw new BadGatewayException('The assessment provider returned invalid output.');

    const saved = await this.repository.create({
      ...result,
      claimId: claim.id,
      formulaId: formula.id,
      clinicalStudyId: study.id,
      provider: this.provider.name,
      inputSnapshot: { ...input },
    });

    return {
      id: saved.id,
      supported: saved.supported,
      confidence: saved.confidence,
      verdict: saved.verdict,
      reasoning: saved.reasoning,
      evidenceReferences: saved.evidenceReferences,
      evidenceGaps: saved.evidenceGaps,
      provider: saved.provider,
      createdAt: saved.createdAt,
    };
  }
}
