import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export function createPrismaClient(connectionString: string): PrismaClient {
  const schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
}
