import type { PrismaClient } from '../generated/prisma/client';

const ids = {
  claim: '10000000-0000-4000-8000-000000000001',
  review: '10000000-0000-4000-8000-000000000002',
  formula: '10000000-0000-4000-8000-000000000003',
  study: '10000000-0000-4000-8000-000000000004',
};

export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.claim.upsert({
      where: { id: ids.claim },
      update: {},
      create: {
        id: ids.claim,
        title: 'Fictional demo: Four-week wrinkle reduction',
        claimText: 'Reduces wrinkles by 20% in 4 weeks.',
        status: 'APPROVED',
      },
    }),
    prisma.claimReview.upsert({
      where: { id: ids.review },
      update: {},
      create: {
        id: ids.review,
        claimId: ids.claim,
        applicable: true,
        feasible: true,
        reviewNotes: 'Fictional review approving the proposed claim for study.',
      },
    }),
    prisma.formula.upsert({
      where: { id: ids.formula },
      update: {},
      create: {
        id: ids.formula,
        claimId: ids.claim,
        formulaName: 'Fictional demo serum',
        description: 'Illustrative scientist submission for the workflow demo.',
        ingredients: [{ name: 'Water' }, { name: 'Glycerin' }],
      },
    }),
    prisma.clinicalStudy.upsert({
      where: { id: ids.study },
      update: {},
      create: {
        id: ids.study,
        claimId: ids.claim,
        formulaId: ids.formula,
        studyTitle: 'FICTIONAL DEMONSTRATION ONLY: Four-week wrinkle study',
        studyDesign: 'Fictional randomized parallel-group study',
        sampleSize: 40,
        population: 'Simulated adults with visible facial wrinkles',
        measuredEffect: 12,
        effectUnit: 'percent reduction in wrinkle depth from baseline',
        durationWeeks: 4,
        comparator: 'Fictional vehicle-control group',
        sourceExcerpts: [
          {
            id: 'demo-study-methods',
            text: 'Fictional methods: 40 simulated participants were assigned to serum or vehicle for four weeks.',
          },
          {
            id: 'demo-study-outcome',
            text: 'Fictional result: serum users showed a 12% mean reduction in wrinkle depth from baseline at week four.',
          },
        ],
      },
    }),
  ]);
}
