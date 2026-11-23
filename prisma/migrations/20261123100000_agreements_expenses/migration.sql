-- Commission agreements per place, restaurant or laundry provider (with history), and VIIPA's expenses.
CREATE TYPE "AgreementSubject" AS ENUM ('PLACE', 'RESTAURANT', 'LAUNDRY');
CREATE TABLE "commissionAgreement" (
    "id" TEXT NOT NULL,
    "subject" "AgreementSubject" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "percentBps" INTEGER,
    "fixedFee" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commissionAgreement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commissionAgreement_subject_subjectId_effectiveFrom_idx" ON "commissionAgreement"("subject", "subjectId", "effectiveFrom");
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "spentOn" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expense_spentOn_idx" ON "expense"("spentOn");
