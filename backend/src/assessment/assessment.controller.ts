import { Body, Controller, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { AssessmentService } from './assessment.service';

class CreateAssessmentDto {
  @IsUUID()
  claimId!: string;

  @IsUUID()
  clinicalStudyId!: string;
}

@Controller('claims')
export class AssessmentController {
  constructor(private readonly assessments: AssessmentService) {}

  @Post('assess')
  assess(@Body() { claimId, clinicalStudyId }: CreateAssessmentDto) {
    return this.assessments.assess(claimId, clinicalStudyId);
  }
}
