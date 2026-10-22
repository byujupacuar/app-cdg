ALTER TABLE "Category" ADD COLUMN "userId" TEXT;

CREATE TEMP TABLE "_CategoryUserMap" (
    "oldCategoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newCategoryId" TEXT NOT NULL,
    PRIMARY KEY ("oldCategoryId", "userId")
);

INSERT INTO "_CategoryUserMap" ("oldCategoryId", "userId", "newCategoryId")
SELECT
    category."id",
    app_user."id",
    CASE
        WHEN ROW_NUMBER() OVER (
            PARTITION BY category."id"
            ORDER BY app_user."createdAt", app_user."id"
        ) = 1 THEN category."id"
        ELSE gen_random_uuid()::TEXT
    END
FROM "Category" category
CROSS JOIN "User" app_user;

UPDATE "Category" category
SET "userId" = mapping."userId"
FROM "_CategoryUserMap" mapping
WHERE category."id" = mapping."oldCategoryId"
  AND category."id" = mapping."newCategoryId";

INSERT INTO "Category" ("id", "name", "icon", "type", "userId")
SELECT mapping."newCategoryId", category."name", category."icon", category."type", mapping."userId"
FROM "Category" category
JOIN "_CategoryUserMap" mapping ON mapping."oldCategoryId" = category."id"
WHERE mapping."newCategoryId" <> mapping."oldCategoryId";

UPDATE "Transaction" transaction
SET "categoryId" = mapping."newCategoryId"
FROM "_CategoryUserMap" mapping
WHERE transaction."categoryId" = mapping."oldCategoryId"
  AND transaction."userId" = mapping."userId";

UPDATE "Budget" budget
SET "categoryId" = mapping."newCategoryId"
FROM "_CategoryUserMap" mapping
WHERE budget."categoryId" = mapping."oldCategoryId"
  AND mapping."userId" = (
      SELECT account_user."userId"
      FROM "AccountUser" account_user
      WHERE account_user."accountId" = budget."accountId"
      ORDER BY CASE WHEN account_user."role" = 'OWNER' THEN 0 ELSE 1 END,
               account_user."userId"
      LIMIT 1
  );

ALTER TABLE "Category"
ADD CONSTRAINT "Category_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Category_userId_name_type_idx" ON "Category"("userId", "name", "type");

DROP TABLE "_CategoryUserMap";
