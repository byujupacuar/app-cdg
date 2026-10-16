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
router.get('/dashboard', autenticarToken, async (req, res) => {
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

    // 1. Rango del mes actual
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);

    // 2. Obtener sumatorias del mes
    const ingresosAgregados = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { accountId, type: 'INGRESO', date: { gte: inicioMes, lte: finMes } }
    });

    const gastosAgregados = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { accountId, type: 'GASTO', date: { gte: inicioMes, lte: finMes } }
    });

    const totalIngresos = ingresosAgregados._sum.amount || 0;
    const totalGastos = gastosAgregados._sum.amount || 0;
    const balanceTotal = totalIngresos - totalGastos;

    // 3. Desglose de Gastos por Categoría para el gráfico
    const gastosPorCategoriaGroup = await prisma.transaction.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
      where: { accountId, type: 'GASTO', date: { gte: inicioMes, lte: finMes } },
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

    // 4. Últimos 5 movimientos
    const ultimosMovimientos = await prisma.transaction.findMany({
      where: { accountId },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 5
    });

    res.json({
      exito: true,
      cuenta: relacionCuenta.account.name,
      tipoCuenta: relacionCuenta.account.type,
      resumen: {
        totalIngresos,
        totalGastos,
        balanceTotal
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