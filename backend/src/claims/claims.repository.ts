import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClaimsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ClaimCreateInput) {
    return this.prisma.client.claim.create({ data });
  }

  list() {
    return this.prisma.client.claim.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  }

  findById(id: string) {
    return this.prisma.client.claim.findUnique({ where: { id } });
  }

  findDetail(id: string) {
    return this.prisma.client.claim.findUnique({
      where: { id },
      include: {
        reviews: { orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }] },
        formulas: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
        studies: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
      },
    });
  }

  async finalizeReview(
    claimId: string,
    status: 'APPROVED' | 'REJECTED',
    data: Omit<Prisma.ClaimReviewUncheckedCreateInput, 'claimId'>,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      // A conditional update lets only one concurrent request finalize the claim.
      const { count } = await tx.claim.updateMany({
        where: { id: claimId, status: 'PROPOSED', reviews: { none: {} } },
        data: { status },
      });
      if (count === 0) return null;

      return tx.claimReview.create({ data: { ...data, claimId } });
    });
  }

  findApprovedClaim(id: string) {
    return this.prisma.client.claim.findFirst({
      where: { id, status: 'APPROVED', reviews: { some: { applicable: true, feasible: true } } },
      select: { id: true },
    });
  }

  createFormula(data: Prisma.FormulaUncheckedCreateInput) {
    return this.prisma.client.formula.create({ data });
  }

  findFormula(id: string) {
    return this.prisma.client.formula.findUnique({ where: { id }, select: { claimId: true } });
  }

  createStudy(data: Prisma.ClinicalStudyUncheckedCreateInput) {
    return this.prisma.client.clinicalStudy.create({ data });
  }

  listAssessments(claimId: string) {
    return this.prisma.client.assessment.findMany({
      where: { claimId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}
