INSERT INTO "Category" ("id", "name", "icon", "type", "userId")
SELECT
    gen_random_uuid()::TEXT,
    defaults."name",
    defaults."icon",
    defaults."type"::"TransactionType",
    app_user."id"
FROM "User" app_user
CROSS JOIN (
    VALUES
        ('Alimentación', '🍎', 'GASTO'),
        ('Transporte', '🚌', 'GASTO'),
        ('Vivienda', '🏠', 'GASTO'),
        ('Servicios', '💡', 'GASTO'),
        ('Salud', '🏥', 'GASTO'),
        ('Educación', '📚', 'GASTO'),
        ('Entretenimiento', '🎬', 'GASTO'),
        ('Compras', '🛍️', 'GASTO'),
        ('Otros gastos', '🏷️', 'GASTO'),
        ('Salario', '💼', 'INGRESO'),
        ('Negocio', '🏪', 'INGRESO'),
        ('Inversiones', '📈', 'INGRESO'),
        ('Regalos', '🎁', 'INGRESO'),
        ('Otros ingresos', '🏷️', 'INGRESO')
) AS defaults("name", "icon", "type")
WHERE NOT EXISTS (
    SELECT 1
    FROM "Category" category
    WHERE category."userId" = app_user."id"
      AND category."name" = defaults."name"
      AND category."type" = defaults."type"::"TransactionType"
);
