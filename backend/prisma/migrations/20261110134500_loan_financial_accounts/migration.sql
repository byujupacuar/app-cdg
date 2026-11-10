ALTER TABLE "Loan"
ADD COLUMN "financialAccountId" TEXT;

ALTER TABLE "LoanPayment"
ADD COLUMN "financialAccountId" TEXT;

CREATE INDEX "Loan_financialAccountId_idx"
ON "Loan"("financialAccountId");

CREATE INDEX "LoanPayment_financialAccountId_idx"
ON "LoanPayment"("financialAccountId");

ALTER TABLE "Loan"
ADD CONSTRAINT "Loan_financialAccountId_fkey"
FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanPayment"
ADD CONSTRAINT "LoanPayment_financialAccountId_fkey"
FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
