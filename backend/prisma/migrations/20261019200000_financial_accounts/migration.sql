CREATE TYPE "FinancialAccountType" AS ENUM ('EFECTIVO', 'BANCO', 'TARJETA');

CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL DEFAULT 'EFECTIVO',
    "householdAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FinancialAccount" ("id", "name", "type", "householdAccountId", "updatedAt")
SELECT gen_random_uuid()::text, 'Efectivo', 'EFECTIVO', "id", CURRENT_TIMESTAMP
FROM "Account";

ALTER TABLE "Transaction" ADD COLUMN "financialAccountId" TEXT;

UPDATE "Transaction" AS t
SET "financialAccountId" = financial_account."id"
FROM "FinancialAccount" AS financial_account
WHERE financial_account."householdAccountId" = t."accountId";

ALTER TABLE "Transaction" ALTER COLUMN "financialAccountId" SET NOT NULL;

CREATE UNIQUE INDEX "FinancialAccount_householdAccountId_name_key"
ON "FinancialAccount"("householdAccountId", "name");

CREATE INDEX "Transaction_financialAccountId_idx"
ON "Transaction"("financialAccountId");

ALTER TABLE "FinancialAccount"
ADD CONSTRAINT "FinancialAccount_householdAccountId_fkey"
FOREIGN KEY ("householdAccountId") REFERENCES "Account"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_financialAccountId_fkey"
FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
