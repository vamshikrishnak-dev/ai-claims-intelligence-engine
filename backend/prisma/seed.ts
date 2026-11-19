import 'dotenv/config';
import { createPrismaClient } from '../src/prisma/create-prisma-client';
import { seedDemoData } from '../src/prisma/seed-demo-data';

async function seed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Set DATABASE_URL before running the seed.');

  const prisma = createPrismaClient(connectionString);
  try {
    await seedDemoData(prisma);
    console.log('Seeded fictional claim, approved review, formula, and study.');
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch(() => {
  console.error('Seed failed. Verify DATABASE_URL, PostgreSQL availability, and migration status.');
  process.exitCode = 1;
});
