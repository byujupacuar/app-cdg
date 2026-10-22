const DEFAULT_CATEGORIES = [
  { name: 'Alimentación', icon: '🍎', type: 'GASTO' },
  { name: 'Transporte', icon: '🚌', type: 'GASTO' },
  { name: 'Vivienda', icon: '🏠', type: 'GASTO' },
  { name: 'Servicios', icon: '💡', type: 'GASTO' },
  { name: 'Salud', icon: '🏥', type: 'GASTO' },
  { name: 'Educación', icon: '📚', type: 'GASTO' },
  { name: 'Entretenimiento', icon: '🎬', type: 'GASTO' },
  { name: 'Compras', icon: '🛍️', type: 'GASTO' },
  { name: 'Otros gastos', icon: '🏷️', type: 'GASTO' },
  { name: 'Salario', icon: '💼', type: 'INGRESO' },
  { name: 'Negocio', icon: '🏪', type: 'INGRESO' },
  { name: 'Inversiones', icon: '📈', type: 'INGRESO' },
  { name: 'Regalos', icon: '🎁', type: 'INGRESO' },
  { name: 'Otros ingresos', icon: '🏷️', type: 'INGRESO' }
];

const crearCategoriasPorDefecto = async (tx, userId) => {
  const existentes = await tx.category.findMany({
    where: { userId },
    select: { name: true, type: true }
  });
  const clavesExistentes = new Set(
    existentes.map((categoria) => `${categoria.type}:${categoria.name}`)
  );
  const faltantes = DEFAULT_CATEGORIES
    .filter((categoria) => !clavesExistentes.has(`${categoria.type}:${categoria.name}`))
    .map((categoria) => ({ ...categoria, userId }));

  if (faltantes.length > 0) {
    await tx.category.createMany({ data: faltantes });
  }
};

module.exports = { crearCategoriasPorDefecto };
