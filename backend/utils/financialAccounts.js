const TIPOS_CUENTA_CREDITO = new Set(['CREDITO', 'TARJETA_CREDITO']);

const redondearDinero = (monto) => Math.round((monto + Number.EPSILON) * 100) / 100;

async function obtenerSaldosCuentasFinancieras(prisma, householdAccountId) {
  const [cuentas, movimientos, transferenciasSalida, transferenciasEntrada] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { householdAccountId },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    }),
    prisma.transaction.groupBy({
      by: ['financialAccountId', 'type'],
      _sum: { amount: true },
      where: { accountId: householdAccountId, financialAccountId: { not: null } }
    }),
    prisma.financialAccountTransfer.groupBy({
      by: ['fromFinancialAccountId'],
      _sum: { amount: true },
      where: { householdAccountId }
    }),
    prisma.financialAccountTransfer.groupBy({
      by: ['toFinancialAccountId'],
      _sum: { amount: true },
      where: { householdAccountId }
    })
  ]);

  const saldos = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta.initialBalance]));

  for (const movimiento of movimientos) {
    const cuentaOriginal = cuentas.find((item) => item.id === movimiento.financialAccountId);
    if (!cuentaOriginal) continue;
    const cuenta = cuentaOriginal.type === 'DEBITO' && cuentaOriginal.linkedFinancialAccountId
      ? cuentas.find((item) => item.id === cuentaOriginal.linkedFinancialAccountId)
      : cuentaOriginal;
    if (!cuenta) continue;

    const esCredito = TIPOS_CUENTA_CREDITO.has(cuenta.type);
    const factor = movimiento.type === 'INGRESO'
      ? (esCredito ? -1 : 1)
      : (esCredito ? 1 : -1);
    saldos.set(
      cuenta.id,
      (saldos.get(cuenta.id) || 0) + factor * (movimiento._sum.amount || 0)
    );
  }

  for (const transferencia of transferenciasSalida) {
    const cuenta = cuentas.find((item) => item.id === transferencia.fromFinancialAccountId);
    if (!cuenta) continue;
    const factor = TIPOS_CUENTA_CREDITO.has(cuenta.type) ? 1 : -1;
    saldos.set(
      cuenta.id,
      (saldos.get(cuenta.id) || 0) + factor * (transferencia._sum.amount || 0)
    );
  }

  for (const transferencia of transferenciasEntrada) {
    const cuenta = cuentas.find((item) => item.id === transferencia.toFinancialAccountId);
    if (!cuenta) continue;
    const factor = TIPOS_CUENTA_CREDITO.has(cuenta.type) ? -1 : 1;
    saldos.set(
      cuenta.id,
      (saldos.get(cuenta.id) || 0) + factor * (transferencia._sum.amount || 0)
    );
  }

  const cuentasConSaldo = cuentas.map((cuenta) => {
    const saldoActual = cuenta.type === 'DEBITO' && cuenta.linkedFinancialAccountId
      ? saldos.get(cuenta.linkedFinancialAccountId) || 0
      : saldos.get(cuenta.id) || 0;
    const saldo = redondearDinero(saldoActual);
    const esCredito = TIPOS_CUENTA_CREDITO.has(cuenta.type);
    return {
      ...cuenta,
      saldo,
      deuda: esCredito ? Math.max(saldo, 0) : 0,
      esCredito,
      esDebitoVinculado: cuenta.type === 'DEBITO' && Boolean(cuenta.linkedFinancialAccountId),
      cuentaVinculada: cuentas.find((item) => item.id === cuenta.linkedFinancialAccountId)?.name || null
    };
  });

  const totalDisponible = redondearDinero(
    cuentasConSaldo
      .filter((cuenta) => !cuenta.esCredito)
      .filter((cuenta) => !cuenta.esDebitoVinculado)
      .reduce((total, cuenta) => total + cuenta.saldo, 0)
  );
  const deudaTarjetas = redondearDinero(
    cuentasConSaldo.reduce((total, cuenta) => total + cuenta.deuda, 0)
  );

  return {
    cuentas: cuentasConSaldo,
    totalDisponible,
    deudaTarjetas,
    patrimonioNeto: redondearDinero(totalDisponible - deudaTarjetas)
  };
}

module.exports = {
  TIPOS_CUENTA_CREDITO,
  obtenerSaldosCuentasFinancieras
};
