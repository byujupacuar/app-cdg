const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'nivia_secret_key_2026';

// Middleware de autenticación JWT
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acceso no autorizado.' });

  jwt.verify(token, JWT_SECRET, (err, usuario) => {
    if (err) return res.status(403).json({ error: 'Token inválido.' });
    req.usuario = usuario;
    next();
  });
};

// GET: /api/presupuestos - Listar presupuestos y consumo del mes actual
router.get('/', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const relacionCuenta = await prisma.accountUser.findFirst({ where: { userId } });
    if (!relacionCuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
    const presupuestos = await prisma.budget.findMany({
      where: {
        accountId: relacionCuenta.accountId,
        category: { userId }
      },
      include: { category: true }
    });

    const presupuestosConConsumo = await Promise.all(presupuestos.map(async (item) => {
      const agregado = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          accountId: relacionCuenta.accountId,
          categoryId: item.categoryId,
          type: 'GASTO',
          date: { gte: inicioMes, lte: finMes }
        }
      });
      const spentAmount = agregado._sum.amount || 0;
      const percentage = item.limitAmount > 0 ? (spentAmount / item.limitAmount) * 100 : 0;

      return {
        id: item.id,
        categoryId: item.categoryId,
        categoria: item.category.name,
        icono: item.category.icon,
        limitAmount: item.limitAmount,
        period: item.period,
        spentAmount,
        percentage,
        estadoSemaforo: percentage >= 100 ? 'ROJO' : percentage >= 80 ? 'AMARILLO' : 'VERDE'
      };
    }));

    res.json({ exito: true, presupuestos: presupuestosConConsumo });
  } catch (error) {
    console.error('Error al consultar presupuestos:', error);
    res.status(500).json({ error: 'Error al consultar presupuestos en la base de datos.' });
  }
});

// POST: /api/presupuestos - Crear o Actualizar Presupuesto para una categoría existente
router.post('/', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const { categoryId, limitAmount, period } = req.body;

    if (!categoryId || !Number.isFinite(Number(limitAmount)) || Number(limitAmount) <= 0) {
      return res.status(400).json({ error: 'Selecciona una categoría y proporciona un monto límite válido.' });
    }

    const relacionCuenta = await prisma.accountUser.findFirst({ where: { userId } });
    if (!relacionCuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });

    const accountId = relacionCuenta.accountId;

    const resultado = await prisma.$transaction(async (tx) => {
      const categoria = await tx.category.findFirst({
        where: {
          id: categoryId,
          type: 'GASTO',
          userId
        }
      });

      if (!categoria) return null;

      const presupuestoExistente = await tx.budget.findFirst({
        where: { accountId, categoryId: categoria.id }
      });

      let presupuesto;
      if (presupuestoExistente) {
        presupuesto = await tx.budget.update({
          where: { id: presupuestoExistente.id },
          data: {
            limitAmount: Number(limitAmount),
            period: period || 'MENSUAL'
          }
        });
      } else {
        presupuesto = await tx.budget.create({
          data: {
            limitAmount: Number(limitAmount),
            period: period || 'MENSUAL',
            accountId,
            categoryId: categoria.id
          }
        });
      }

      return { presupuesto, categoria };
    });

    if (!resultado) {
      return res.status(400).json({ error: 'La categoría seleccionada no existe o no es una categoría de gasto disponible.' });
    }

    res.status(201).json({ exito: true, ...resultado });
  } catch (error) {
    console.error('Error al procesar presupuesto y categoría:', error);
    res.status(500).json({ error: 'Error interno al guardar presupuesto.' });
  }
});

module.exports = router;