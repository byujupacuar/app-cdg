const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
    const { amount, type, description, categoryName } = req.body;

    if (!amount || !categoryName) {
      return res.status(400).json({ error: 'Monto y categoría son obligatorios.' });
    }

    // 1. Obtener la cuenta vinculada al usuario
    const relacionCuenta = await prisma.accountUser.findFirst({ 
      where: { userId },
      include: { account: true } 
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    // 2. Normalizar el tipo de transacción para el Enum de Prisma
    const tipoEnum = type.toUpperCase() === 'INGRESO' ? 'INGRESO' : 'GASTO';

    // 3. Buscar o crear la categoría correspondiente
    let categoria = await prisma.category.findFirst({
      where: { name: categoryName }
    });

    if (!categoria) {
      categoria = await prisma.category.create({
        data: { 
          name: categoryName, 
          icon: '🏷️', 
          type: tipoEnum 
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
        userId: userId,
        categoryId: categoria.id
      },
      include: {
        category: true
      }
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
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });

    res.json({ exito: true, movimientos });
  } catch (error) {
    console.error('Error al consultar movimientos:', error);
    res.status(500).json({ error: 'Error interno al consultar los movimientos.' });
  }
});

router.put('/:id', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const { amount, type, description, categoryName } = req.body;
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

    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const categoria = await prisma.category.findFirst({
      where: { name: nombreCategoria, type: tipoEnum }
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
        categoryId: categoria.id
      },
      include: { category: true }
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
    const { fechaInicio, fechaFin } = req.query;
    const esFechaValida = (valor) => {
      if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
      const fecha = new Date(`${valor}T00:00:00.000Z`);
      return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
    };

    if ((fechaInicio && !esFechaValida(fechaInicio)) || (fechaFin && !esFechaValida(fechaFin))) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD.' });
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

    // 2. Obtener sumatorias y cantidad de movimientos del rango
    const ingresosAgregados = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { accountId, type: 'INGRESO', date: rangoFechas }
    });

    const gastosAgregados = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { accountId, type: 'GASTO', date: rangoFechas }
    });

    const totalMovimientos = await prisma.transaction.count({
      where: { accountId, date: rangoFechas }
    });

    const totalIngresos = ingresosAgregados._sum.amount || 0;
    const totalGastos = gastosAgregados._sum.amount || 0;
    const balanceTotal = totalIngresos - totalGastos;

    // 3. Desglose de Gastos por Categoría para el gráfico
    const gastosPorCategoriaGroup = await prisma.transaction.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
      where: { accountId, type: 'GASTO', date: rangoFechas },
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
      where: { accountId, date: rangoFechas },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 10
    });

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
      ultimosMovimientos
    });

  } catch (error) {
    console.error('Error al generar métricas del dashboard:', error);
    res.status(500).json({ error: 'Error interno al consultar el dashboard.' });
  }
});

module.exports = router;