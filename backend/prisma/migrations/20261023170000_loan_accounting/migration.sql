ALTER TABLE "Transaction"
ADD COLUMN "loanPaymentId" TEXT;

CREATE UNIQUE INDEX "Transaction_loanPaymentId_key"
ON "Transaction"("loanPaymentId");

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_loanPaymentId_fkey"
FOREIGN KEY ("loanPaymentId") REFERENCES "LoanPayment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
