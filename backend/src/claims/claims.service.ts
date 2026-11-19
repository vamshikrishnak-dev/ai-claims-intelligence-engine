import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateClaimDto, ReviewClaimDto, SubmitFormulaDto, SubmitStudyDto } from './claim.dto';
import { ClaimsRepository } from './claims.repository';

@Injectable()
export class ClaimsService {
  constructor(private readonly claims: ClaimsRepository) {}

  create(dto: CreateClaimDto) {
    return this.claims.create(dto);
  }

  list() {
    return this.claims.list();
  }

  async detail(id: string) {
    const claim = await this.claims.findDetail(id);
    if (!claim) throw new NotFoundException('Claim not found.');
    return claim;
  }

  async review(claimId: string, dto: ReviewClaimDto) {
    const status = dto.applicable && dto.feasible ? 'APPROVED' : 'REJECTED';
    const review = await this.claims.finalizeReview(claimId, status, dto);

    if (!review) {
      await this.requireClaim(claimId);
      throw new ConflictException('This claim already has a final review.');
    }

    return { ...review, claimStatus: status };
  }

  async submitFormula(claimId: string, dto: SubmitFormulaDto) {
    if (!await this.claims.findApprovedClaim(claimId)) {
      await this.requireClaim(claimId);
      throw new ConflictException('Formula submission requires an approved claim review.');
    }

    const ingredients = dto.ingredients.map(({ name, amount }) =>
      amount === undefined ? { name } : { name, amount },
    );
    return this.claims.createFormula({ ...dto, claimId, ingredients });
  }

  async submitStudy(claimId: string, dto: SubmitStudyDto) {
    await this.requireClaim(claimId);
    const formula = await this.claims.findFormula(dto.formulaId);
    if (!formula) throw new NotFoundException('Formula not found.');
    if (formula.claimId !== claimId.toLowerCase()) {
      throw new ConflictException('The formula belongs to another claim.');
    }

    const sourceExcerpts = (dto.sourceExcerpts ?? []).map(({ text }) => ({ id: randomUUID(), text }));
    return this.claims.createStudy({ ...dto, claimId, sourceExcerpts });
  }

  async assessmentHistory(claimId: string) {
    await this.requireClaim(claimId);
    return this.claims.listAssessments(claimId);
  }

  private async requireClaim(id: string): Promise<void> {
    if (!await this.claims.findById(id)) throw new NotFoundException('Claim not found.');
  }
}
