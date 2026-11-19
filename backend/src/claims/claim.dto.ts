import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNumber, IsObject, IsPositive, IsString,
  IsUUID, Length, Max, Min, ValidateIf, ValidateNested,
} from 'class-validator';

function Text(max: number): PropertyDecorator {
  return (target, key) => {
    Transform(({ value }) => typeof value === 'string' ? value.trim() : value)(target, key);
    IsString()(target, key);
    Length(1, max)(target, key);
  };
}

export class CreateClaimDto {
  @Text(200)
  title!: string;

  @Text(4000)
  claimText!: string;
}

export class ReviewClaimDto {
  @IsBoolean()
  applicable!: boolean;

  @IsBoolean()
  feasible!: boolean;

  @Text(4000)
  reviewNotes!: string;
}

class IngredientDto {
  @Text(200)
  name!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Text(1000)
  amount?: string;
}

export class SubmitFormulaDto {
  @Text(200)
  formulaName!: string;

  @Text(4000)
  description!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients!: IngredientDto[];
}

class SourceExcerptDto {
  @Text(8000)
  text!: string;
}

export class SubmitStudyDto {
  @IsUUID()
  formulaId!: string;

  @Text(200)
  studyTitle!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Text(4000)
  studyDesign?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  sampleSize?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Text(4000)
  population?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  measuredEffect?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Text(200)
  effectUnit?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @IsPositive()
  durationWeeks?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Text(4000)
  comparator?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => SourceExcerptDto)
  sourceExcerpts?: SourceExcerptDto[];
}
