ALTER TABLE "Loan"
ADD COLUMN "loanDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Loan"
SET "loanDate" = "createdAt";

CREATE TABLE "LoanPayment" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoanPayment_loanId_date_idx" ON "LoanPayment"("loanId", "date");

ALTER TABLE "LoanPayment"
ADD CONSTRAINT "LoanPayment_loanId_fkey"
FOREIGN KEY ("loanId") REFERENCES "Loan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
