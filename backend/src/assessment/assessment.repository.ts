import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssessmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findClaim(id: string) {
    return this.prisma.client.claim.findUnique({
      where: { id },
      include: {
        reviews: { where: { applicable: true, feasible: true }, select: { id: true }, take: 1 },
      },
    });
  }

  findStudy(id: string) {
    return this.prisma.client.clinicalStudy.findUnique({ where: { id }, include: { formula: true } });
  }

  create(data: Prisma.AssessmentUncheckedCreateInput) {
    return this.prisma.client.assessment.create({ data });
  }
}
