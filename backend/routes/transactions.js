const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { obtenerSaldosCuentasFinancieras } = require('../utils/financialAccounts');

const JWT_SECRET = process.env.JWT_SECRET || 'nivia_secret_key_2026';

// Middleware para validar Token JWT
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Acceso no autorizado.' });

  jwt.verify(token, JWT_SECRET, (err, usuario) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
    req.usuario = usuario;
    next();
  });
};

// GET: Obtener métricas y balance real para el Dashboard
/*router.get('/dashboard', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;

    // Obtener la cuenta del usuario
    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId },
      include: { account: true }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró cuenta asociada al usuario.' });
    }

    const accountId = relacionCuenta.accountId;

    // Consultar movimientos en PostgreSQL
    const transacciones = await prisma.transaction.findMany({
      where: { accountId },
      include: { category: true, user: true },
      orderBy: { date: 'desc' }
    });

    // Calcular totales
    let totalIngresos = 0;
    let totalGastos = 0;

    transacciones.forEach(t => {
      if (t.type === 'INGRESO') totalIngresos += t.amount;
      if (t.type === 'GASTO') totalGastos += t.amount;
    });

    const balanceTotal = totalIngresos - totalGastos;

    res.json({
      exito: true,
      cuenta: relacionCuenta.account.name,
      tipoCuenta: relacionCuenta.account.type,
      balanceTotal,
      totalIngresos,
      totalGastos,
      ultimosMovimientos: transacciones.slice(0, 5)
    });
  } catch (error) {
    console.error('Error al obtener dashboard:', error);
    res.status(500).json({ error: 'Error al consultar la base de datos.' });
  }
});
*/
// POST: Crear movimiento real en PostgreSQL
router.post('/', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const { amount, type, description, categoryName, financialAccountId } = req.body;

    if (!amount || !categoryName) {
      return res.status(400).json({ error: 'Monto y categoría son obligatorios.' });
    }

    if (financialAccountId !== undefined && typeof financialAccountId !== 'string') {
      return res.status(400).json({ error: 'La cuenta seleccionada no es válida.' });
    }

    // 1. Obtener la cuenta vinculada al usuario
    const relacionCuenta = await prisma.accountUser.findFirst({ 
      where: { userId },
      include: { account: true } 
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const cuentaFinanciera = financialAccountId
      ? await prisma.financialAccount.findFirst({
        where: { id: financialAccountId, householdAccountId: relacionCuenta.accountId }
      })
      : await prisma.financialAccount.findFirst({
        where: { householdAccountId: relacionCuenta.accountId },
        orderBy: { createdAt: 'asc' }
      });

    if (!cuentaFinanciera) {
      return res.status(400).json({ error: 'Crea o selecciona una cuenta válida para este movimiento.' });
    }

    // 2. Normalizar el tipo de transacción para el Enum de Prisma
    const tipoEnum = type.toUpperCase() === 'INGRESO' ? 'INGRESO' : 'GASTO';

    // 3. Buscar o crear la categoría correspondiente
    let categoria = await prisma.category.findFirst({
      where: { name: categoryName, userId }
    });

    if (!categoria) {
      categoria = await prisma.category.create({
        data: { 
          name: categoryName, 
          icon: '🏷️', 
          type: tipoEnum,
          userId
        }
      });
    }

    // 4. Registrar la Transacción en la base de datos
    const nuevaTransaccion = await prisma.transaction.create({
      data: {
        amount: parseFloat(amount),
        type: tipoEnum,
        description: description || 'Sin detalle',
        accountId: relacionCuenta.accountId,
        financialAccountId: cuentaFinanciera.id,
        userId: userId,
        categoryId: categoria.id
      },
      include: { category: true, financialAccount: true }
    });

    console.log("✅ Movimiento guardado exitosamente en Neon.tech:", nuevaTransaccion.id);

    res.status(201).json({ 
      exito: true, 
      mensaje: 'Transacción guardada correctamente',
      movimiento: nuevaTransaccion 
    });

  } catch (error) {
    console.error('❌ ERROR DETALLADO AL GUARDAR MOVIMIENTO:', error);
    res.status(500).json({ 
      error: 'Error interno al guardar la transacción.',
      detalle: error.message 
    });
  }
});

router.get('/', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const movimientos = await prisma.transaction.findMany({
      where: { accountId: relacionCuenta.accountId },
      include: { category: true, financialAccount: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });

    res.json({ exito: true, movimientos });
  } catch (error) {
    console.error('Error al consultar movimientos:', error);
    res.status(500).json({ error: 'Error interno al consultar los movimientos.' });
  }
});

router.get('/exportar.csv', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const { fechaInicio, fechaFin, financialAccountId } = req.query;
    const esFechaValida = (valor) => {
      if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
      const fecha = new Date(`${valor}T00:00:00.000Z`);
      return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
    };

    if ((fechaInicio && !esFechaValida(fechaInicio)) || (fechaFin && !esFechaValida(fechaFin))) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD.' });
    }

    if (financialAccountId !== undefined && typeof financialAccountId !== 'string') {
      return res.status(400).json({ error: 'La cuenta seleccionada no es válida.' });
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      return res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
    }

    if (financialAccountId) {
      const cuentaFinanciera = await prisma.financialAccount.findFirst({
        where: { id: financialAccountId, householdAccountId: relacionCuenta.accountId }
      });
      if (!cuentaFinanciera) {
        return res.status(404).json({ error: 'No se encontró la cuenta financiera solicitada.' });
      }
    }

    const date = {};
    if (fechaInicio) date.gte = new Date(`${fechaInicio}T00:00:00.000Z`);
    if (fechaFin) date.lte = new Date(`${fechaFin}T23:59:59.999Z`);

    const movimientos = await prisma.transaction.findMany({
      where: {
        accountId: relacionCuenta.accountId,
        ...(Object.keys(date).length > 0 && { date }),
        ...(financialAccountId && { financialAccountId })
      },
      include: { category: true, financialAccount: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });
    const transferencias = await prisma.financialAccountTransfer.findMany({
      where: {
        householdAccountId: relacionCuenta.accountId,
        ...(Object.keys(date).length > 0 && { date }),
        ...(financialAccountId && {
          OR: [
            { fromFinancialAccountId: financialAccountId },
            { toFinancialAccountId: financialAccountId }
          ]
        })
      },
      include: { fromFinancialAccount: true, toFinancialAccount: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });

    const protegerCelda = (valor) => {
      const texto = String(valor ?? '');
      const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
      return `"${seguro.replace(/"/g, '""')}"`;
    };
    const filasDatos = [
      ...movimientos.map((movimiento) => [
        movimiento.date.toISOString().slice(0, 10),
        movimiento.type,
        movimiento.category?.name || 'General',
        movimiento.description || 'Sin detalle',
        movimiento.financialAccount?.name || 'Sin cuenta',
        '',
        '',
        String(movimiento.amount)
      ]),
      ...transferencias.map((transferencia) => [
        transferencia.date.toISOString().slice(0, 10),
        'Transferencia',
        '',
        transferencia.description || 'Sin detalle',
        '',
        transferencia.fromFinancialAccount?.name || '',
        transferencia.toFinancialAccount?.name || '',
        String(transferencia.amount)
      ])
    ].sort((a, b) => b[0].localeCompare(a[0]));
    const filas = [
      ['Fecha', 'Tipo', 'Categoría', 'Detalle', 'Cuenta', 'Cuenta de origen', 'Cuenta de destino', 'Monto'],
      ...filasDatos
    ];
    const csv = `\uFEFF${filas.map((fila) => fila.map(protegerCelda).join(',')).join('\r\n')}`;
    const desde = typeof fechaInicio === 'string' ? fechaInicio : 'todo';
    const hasta = typeof fechaFin === 'string' ? fechaFin : 'todo';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="movimientos-${desde}-${hasta}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error al exportar movimientos CSV:', error);
    res.status(500).json({ error: 'No se pudieron exportar los movimientos.' });
  }
});

router.put('/:id', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const { amount, type, description, categoryName, financialAccountId } = req.body;
    const monto = (typeof amount === 'number' || (typeof amount === 'string' && amount.trim()))
      ? Number(amount)
      : Number.NaN;
    const tipoEnum = typeof type === 'string' ? type.toUpperCase() : '';
    const nombreCategoria = typeof categoryName === 'string' ? categoryName.trim() : '';

    if (!Number.isFinite(monto) || monto <= 0 || !['INGRESO', 'GASTO'].includes(tipoEnum) || !nombreCategoria) {
      return res.status(400).json({ error: 'Monto, tipo y categoría válidos son obligatorios.' });
    }

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'La descripción debe ser texto.' });
    }

    if (financialAccountId !== undefined && typeof financialAccountId !== 'string') {
      return res.status(400).json({ error: 'La cuenta seleccionada no es válida.' });
    }

    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const cuentaFinanciera = financialAccountId
      ? await prisma.financialAccount.findFirst({
        where: { id: financialAccountId, householdAccountId: relacionCuenta.accountId }
      })
      : null;

    if (financialAccountId && !cuentaFinanciera) {
      return res.status(400).json({ error: 'Selecciona una cuenta válida para este movimiento.' });
    }

    const categoria = await prisma.category.findFirst({
      where: { name: nombreCategoria, type: tipoEnum, userId }
    });

    if (!categoria) {
      return res.status(400).json({ error: 'No se encontró una categoría válida para este tipo de movimiento.' });
    }

    const movimiento = await prisma.transaction.update({
      where: { id: req.params.id, accountId: relacionCuenta.accountId },
      data: {
        amount: monto,
        type: tipoEnum,
        description: description?.trim() || 'Sin detalle',
        categoryId: categoria.id,
        ...(cuentaFinanciera && { financialAccountId: cuentaFinanciera.id })
      },
      include: { category: true, financialAccount: true }
    });

    res.json({ exito: true, movimiento });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'No se encontró el movimiento solicitado.' });
    }

    console.error('Error al actualizar movimiento:', error);
    res.status(500).json({ error: 'Error interno al actualizar el movimiento.' });
  }
});

router.delete('/:id', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const resultado = await prisma.transaction.deleteMany({
      where: { id: req.params.id, accountId: relacionCuenta.accountId }
    });

    if (resultado.count === 0) {
      return res.status(404).json({ error: 'No se encontró el movimiento solicitado.' });
    }

    res.json({ exito: true, mensaje: 'Movimiento eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    res.status(500).json({ error: 'Error interno al eliminar el movimiento.' });
  }
});

// GET: /api/movimientos/dashboard - Métricas, saldo y gastos por categoría
router.get('/dashboard', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;

    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId },
      include: { account: true }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró cuenta activa.' });
    }

    const accountId = relacionCuenta.accountId;

    const ahora = new Date();
    const { fechaInicio, fechaFin, financialAccountId } = req.query;
    const esFechaValida = (valor) => {
      if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
      const fecha = new Date(`${valor}T00:00:00.000Z`);
      return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
    };

    if ((fechaInicio && !esFechaValida(fechaInicio)) || (fechaFin && !esFechaValida(fechaFin))) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD.' });
    }

    if (financialAccountId !== undefined && typeof financialAccountId !== 'string') {
      return res.status(400).json({ error: 'La cuenta seleccionada no es válida.' });
    }

    if (financialAccountId) {
      const cuentaFinanciera = await prisma.financialAccount.findFirst({
        where: { id: financialAccountId, householdAccountId: accountId }
      });
      if (!cuentaFinanciera) {
        return res.status(404).json({ error: 'No se encontró la cuenta financiera solicitada.' });
      }
    }

    const inicioMes = fechaInicio
      ? new Date(`${fechaInicio}T00:00:00.000Z`)
      : new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = fechaFin
      ? new Date(`${fechaFin}T23:59:59.999Z`)
      : new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);

    if (inicioMes > finMes) {
      return res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
    }

    const rangoFechas = { gte: inicioMes, lte: finMes };
    const filtroMovimientos = {
      accountId,
      date: rangoFechas,
      ...(financialAccountId && { financialAccountId })
    };

    // 2. Obtener sumatorias y cantidad de movimientos del rango
    const ingresosAgregados = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { ...filtroMovimientos, type: 'INGRESO' }
    });

    const gastosAgregados = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { ...filtroMovimientos, type: 'GASTO' }
    });

    const totalMovimientos = await prisma.transaction.count({
      where: filtroMovimientos
    });

    const totalIngresos = ingresosAgregados._sum.amount || 0;
    const totalGastos = gastosAgregados._sum.amount || 0;
    const balanceTotal = totalIngresos - totalGastos;

    // 3. Desglose de Gastos por Categoría para el gráfico
    const gastosPorCategoriaGroup = await prisma.transaction.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
      where: { ...filtroMovimientos, type: 'GASTO' },
      orderBy: { _sum: { amount: 'desc' } }
    });

    // Mapear con datos de categoría (Nombre e Ícono)
    const categoriasConDetalle = await Promise.all(
      gastosPorCategoriaGroup.map(async (item) => {
        const cat = await prisma.category.findUnique({ where: { id: item.categoryId } });
        const monto = item._sum.amount || 0;
        const porcentaje = totalGastos > 0 ? (monto / totalGastos) * 100 : 0;

        return {
          id: item.categoryId,
          nombre: cat ? cat.name : 'General',
          icono: cat ? cat.icon : '🏷️',
          monto,
          porcentaje
        };
      })
    );

    // 4. Movimientos más recientes dentro del rango consultado
    const ultimosMovimientos = await prisma.transaction.findMany({
      where: filtroMovimientos,
      include: { category: true, financialAccount: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      ...(req.query.incluirTodos !== 'true' && { take: 10 })
    });
    const resumenCuentas = await obtenerSaldosCuentasFinancieras(prisma, accountId);

    res.json({
      exito: true,
      cuenta: relacionCuenta.account.name,
      tipoCuenta: relacionCuenta.account.type,
      resumen: {
        totalIngresos,
        totalGastos,
        balanceTotal,
        totalMovimientos
      },
      periodo: {
        fechaInicio: fechaInicio || new Date(inicioMes.getTime() - inicioMes.getTimezoneOffset() * 60000).toISOString().slice(0, 10),
        fechaFin: fechaFin || new Date(finMes.getTime() - finMes.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      },
      gastosPorCategoria: categoriasConDetalle,
      ultimosMovimientos,
      resumenCuentas
    });

  } catch (error) {
    console.error('Error al generar métricas del dashboard:', error);
    res.status(500).json({ error: 'Error interno al consultar el dashboard.' });
  }
});

module.exports = router;