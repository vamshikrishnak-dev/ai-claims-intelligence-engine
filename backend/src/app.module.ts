import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter';
import { AssessmentModule } from './assessment/assessment.module';
import { ClaimsModule } from './claims/claims.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, ClaimsModule, AssessmentModule],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    {
      provide: APP_PIPE,
      useFactory: () => new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
