import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CreateClaimDto, ReviewClaimDto, SubmitFormulaDto, SubmitStudyDto } from './claim.dto';
import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post()
  create(@Body() dto: CreateClaimDto) {
    return this.claims.create(dto);
  }

  @Get()
  list() {
    return this.claims.list();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.claims.detail(id);
  }

  @Post(':id/reviews')
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewClaimDto) {
    return this.claims.review(id, dto);
  }

  @Post(':id/formulas')
  submitFormula(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitFormulaDto) {
    return this.claims.submitFormula(id, dto);
  }

  @Post(':id/studies')
  submitStudy(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitStudyDto) {
    return this.claims.submitStudy(id, dto);
  }

  @Get(':id/assessments')
  assessmentHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.claims.assessmentHistory(id);
  }
}
