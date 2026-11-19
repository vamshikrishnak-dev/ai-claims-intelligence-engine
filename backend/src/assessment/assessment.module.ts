import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaModule } from '../prisma/prisma.module';
import { AssessmentController } from './assessment.controller';
import { ASSESSMENT_PROVIDER, AssessmentProvider } from './assessment-provider';
import { AssessmentRepository } from './assessment.repository';
import { AssessmentService } from './assessment.service';
import { MockAssessmentProvider } from './mock-assessment.provider';
import { OpenAIAssessmentProvider } from './openai-assessment.provider';

function createAssessmentProvider(): AssessmentProvider {
  const provider = process.env.ASSESSMENT_PROVIDER?.trim() || 'mock';
  if (provider === 'mock') return new MockAssessmentProvider();
  if (provider !== 'openai') throw new Error('ASSESSMENT_PROVIDER must be mock or openai.');

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS?.trim() || '30000');
  if (!apiKey || !model) throw new Error('OpenAI mode requires OPENAI_API_KEY and OPENAI_MODEL.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647) {
    throw new Error('OPENAI_TIMEOUT_MS must be an integer between 1 and 2147483647.');
  }

  const client = new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
    logLevel: 'off',
  });
  return new OpenAIAssessmentProvider(client, model, timeoutMs);
}

@Module({
  imports: [PrismaModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentService,
    AssessmentRepository,
    { provide: ASSESSMENT_PROVIDER, useFactory: createAssessmentProvider },
  ],
})
export class AssessmentModule {}
