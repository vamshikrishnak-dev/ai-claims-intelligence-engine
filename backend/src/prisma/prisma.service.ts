import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client';
import { createPrismaClient } from './create-prisma-client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma?: PrismaClient;

  get client(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Set DATABASE_URL to enable database access.');
    }
    return this.prisma;
  }

  async onModuleInit(): Promise<void> {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) return;

    let client: PrismaClient | undefined;
    try {
      client = createPrismaClient(connectionString);
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      this.prisma = client;
    } catch {
      await client?.$disconnect().catch(() => undefined);
      throw new Error('Database connection failed. Check DATABASE_URL and PostgreSQL availability.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.$disconnect();
  }
}
