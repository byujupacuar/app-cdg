ALTER TABLE "FinancialAccount"
ADD COLUMN "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "FinancialAccount"
ADD COLUMN "linkedFinancialAccountId" TEXT;

ALTER TABLE "FinancialAccount"
ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "FinancialAccount"
ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

ALTER TABLE "FinancialAccount"
ALTER COLUMN "type" SET DEFAULT 'EFECTIVO';

CREATE INDEX "FinancialAccount_linkedFinancialAccountId_idx"
ON "FinancialAccount"("linkedFinancialAccountId");

ALTER TABLE "FinancialAccount"
ADD CONSTRAINT "FinancialAccount_linkedFinancialAccountId_fkey"
FOREIGN KEY ("linkedFinancialAccountId") REFERENCES "FinancialAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FinancialAccountTransfer" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "householdAccountId" TEXT NOT NULL,
    "fromFinancialAccountId" TEXT NOT NULL,
    "toFinancialAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAccountTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialAccountTransfer_householdAccountId_date_idx"
ON "FinancialAccountTransfer"("householdAccountId", "date");

CREATE INDEX "FinancialAccountTransfer_fromFinancialAccountId_idx"
ON "FinancialAccountTransfer"("fromFinancialAccountId");

CREATE INDEX "FinancialAccountTransfer_toFinancialAccountId_idx"
ON "FinancialAccountTransfer"("toFinancialAccountId");

ALTER TABLE "FinancialAccountTransfer"
ADD CONSTRAINT "FinancialAccountTransfer_householdAccountId_fkey"
FOREIGN KEY ("householdAccountId") REFERENCES "Account"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialAccountTransfer"
ADD CONSTRAINT "FinancialAccountTransfer_fromFinancialAccountId_fkey"
FOREIGN KEY ("fromFinancialAccountId") REFERENCES "FinancialAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialAccountTransfer"
ADD CONSTRAINT "FinancialAccountTransfer_toFinancialAccountId_fkey"
FOREIGN KEY ("toFinancialAccountId") REFERENCES "FinancialAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
