UPDATE "FinancialAccount" cash_account
SET "name" = 'Efectivo (billetera)'
WHERE cash_account."name" = 'Efectivo'
  AND NOT EXISTS (
      SELECT 1
      FROM "FinancialAccount" existing
      WHERE existing."householdAccountId" = cash_account."householdAccountId"
        AND existing."name" = 'Efectivo (billetera)'
  );

INSERT INTO "FinancialAccount" ("id", "name", "type", "householdAccountId", "updatedAt")
SELECT gen_random_uuid()::TEXT, defaults."name", defaults."type", account."id", CURRENT_TIMESTAMP
FROM "Account" account
CROSS JOIN (
    VALUES
        ('Efectivo (billetera)', 'EFECTIVO'),
        ('Efectivo en casa', 'EFECTIVO'),
        ('Cuenta de ahorro bancaria (principal)', 'BANCO'),
        ('Cuenta en dólares o billetera digital internacional', 'DIGITAL'),
        ('Billetera digital / QR', 'DIGITAL')
) AS defaults("name", "type")
WHERE NOT EXISTS (
    SELECT 1
    FROM "FinancialAccount" existing
    WHERE existing."householdAccountId" = account."id"
      AND existing."name" = defaults."name"
);
