-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('SUPPORTED', 'PARTIALLY_SUPPORTED', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "AssessmentProvider" AS ENUM ('MOCK', 'OPENAI');

-- CreateTable
CREATE TABLE "Claim" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimReview" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "applicable" BOOLEAN NOT NULL,
    "feasible" BOOLEAN NOT NULL,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formula" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "formulaName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ingredients" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Formula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalStudy" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "formulaId" UUID NOT NULL,
    "studyTitle" TEXT NOT NULL,
    "studyDesign" TEXT,
    "sampleSize" INTEGER,
    "population" TEXT,
    "measuredEffect" DOUBLE PRECISION,
    "effectUnit" TEXT,
    "durationWeeks" DOUBLE PRECISION,
    "comparator" TEXT,
    "sourceExcerpts" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "formulaId" UUID NOT NULL,
    "clinicalStudyId" UUID NOT NULL,
    "supported" BOOLEAN NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "verdict" "Verdict",
    "reasoning" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "evidenceGaps" JSONB NOT NULL,
    "provider" "AssessmentProvider" NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaimReview_claimId_reviewedAt_idx" ON "ClaimReview"("claimId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Formula_claimId_id_key" ON "Formula"("claimId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalStudy_claimId_formulaId_id_key" ON "ClinicalStudy"("claimId", "formulaId", "id");

-- CreateIndex
CREATE INDEX "Assessment_claimId_createdAt_idx" ON "Assessment"("claimId", "createdAt");

-- CreateIndex
CREATE INDEX "Assessment_claimId_formulaId_clinicalStudyId_idx" ON "Assessment"("claimId", "formulaId", "clinicalStudyId");

-- AddForeignKey
ALTER TABLE "ClaimReview" ADD CONSTRAINT "ClaimReview_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formula" ADD CONSTRAINT "Formula_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalStudy" ADD CONSTRAINT "ClinicalStudy_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalStudy" ADD CONSTRAINT "ClinicalStudy_claimId_formulaId_fkey" FOREIGN KEY ("claimId", "formulaId") REFERENCES "Formula"("claimId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_claimId_formulaId_fkey" FOREIGN KEY ("claimId", "formulaId") REFERENCES "Formula"("claimId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_claimId_formulaId_clinicalStudyId_fkey" FOREIGN KEY ("claimId", "formulaId", "clinicalStudyId") REFERENCES "ClinicalStudy"("claimId", "formulaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce domain constraints at the database boundary.
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_confidence_range"
    CHECK ("confidence" >= 0 AND "confidence" <= 1);
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_supported_matches_verdict"
    CHECK ("verdict" IS NULL OR "supported" = ("verdict" = 'SUPPORTED'));
ALTER TABLE "ClinicalStudy" ADD CONSTRAINT "ClinicalStudy_positive_sample_size"
    CHECK ("sampleSize" > 0);
ALTER TABLE "ClinicalStudy" ADD CONSTRAINT "ClinicalStudy_positive_duration"
    CHECK ("durationWeeks" > 0 AND "durationWeeks" < 'Infinity'::double precision);
