const DEFAULT_FINANCIAL_ACCOUNTS = [
  { name: 'Efectivo (billetera)', type: 'EFECTIVO' },
  { name: 'Efectivo en casa', type: 'EFECTIVO' },
  { name: 'Cuenta de ahorro bancaria (principal)', type: 'BANCO' },
  { name: 'Cuenta en dólares o billetera digital internacional', type: 'DIGITAL' },
  { name: 'Billetera digital / QR', type: 'DIGITAL' }
];

const crearCuentasFinancierasPorDefecto = async (tx, householdAccountId) => {
  const existentes = await tx.financialAccount.findMany({
    where: { householdAccountId },
    select: { id: true, name: true }
  });

  const cuentaEfectivoAnterior = existentes.find((cuenta) => cuenta.name === 'Efectivo');
  const yaTieneBilletera = existentes.some((cuenta) => cuenta.name === 'Efectivo (billetera)');
  if (cuentaEfectivoAnterior && !yaTieneBilletera) {
    await tx.financialAccount.update({
      where: { id: cuentaEfectivoAnterior.id },
      data: { name: 'Efectivo (billetera)' }
    });
  }

  const nombresExistentes = new Set(existentes.map((cuenta) => cuenta.name));
  if (cuentaEfectivoAnterior && !yaTieneBilletera) {
    nombresExistentes.add('Efectivo (billetera)');
  }
  const faltantes = DEFAULT_FINANCIAL_ACCOUNTS
    .filter((cuenta) => !nombresExistentes.has(cuenta.name))
    .map((cuenta) => ({ ...cuenta, householdAccountId }));

  if (faltantes.length > 0) {
    await tx.financialAccount.createMany({
      data: faltantes,
      skipDuplicates: true
    });
  }
};

module.exports = { crearCuentasFinancierasPorDefecto };
