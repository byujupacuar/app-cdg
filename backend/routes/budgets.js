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

// POST: /api/presupuestos - Crear o Actualizar Presupuesto (y su Categoría)
router.post('/', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const { categoryName, categoryIcon, limitAmount, period } = req.body;

    if (!categoryName || !limitAmount) {
      return res.status(400).json({ error: 'Categoría y monto límite son obligatorios.' });
    }

    const relacionCuenta = await prisma.accountUser.findFirst({ where: { userId } });
    if (!relacionCuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });

    const accountId = relacionCuenta.accountId;

    // Transacción Prisma: Actualiza/Crea Categoría y Asigna el Presupuesto
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Buscar o Crear/Actualizar la Categoría vinculada a la cuenta
      let categoria = await tx.category.findFirst({
        where: {
          name: categoryName.trim(),
          OR: [{ accountId: accountId }, { accountId: null }]
        }
      });

      if (categoria) {
        // Si existe, se actualiza el icono si fue proporcionado
        if (categoryIcon && categoria.icon !== categoryIcon) {
          categoria = await tx.category.update({
            where: { id: categoria.id },
            data: { icon: categoryIcon }
          });
        }
      } else {
        // Si no existe, se crea automáticamente la categoría
        categoria = await tx.category.create({
          data: {
            name: categoryName.trim(),
            icon: categoryIcon || '🏷️',
            type: 'GASTO',
            accountId: accountId
          }
        });
      }

      // 2. Upsert del Presupuesto (Crear o Actualizar límite)
      const presupuestoExistente = await tx.budget.findFirst({
        where: { accountId, categoryId: categoria.id }
      });

      let presupuesto;
      if (presupuestoExistente) {
        presupuesto = await tx.budget.update({
          where: { id: presupuestoExistente.id },
          data: {
            limitAmount: parseFloat(limitAmount),
            period: period || 'MENSUAL'
          }
        });
      } else {
        presupuesto = await tx.budget.create({
          data: {
            limitAmount: parseFloat(limitAmount),
            period: period || 'MENSUAL',
            accountId,
            categoryId: categoria.id
          }
        });
      }

      return { presupuesto, categoria };
    });

    res.status(201).json({ exito: true, ...resultado });
  } catch (error) {
    console.error('Error al procesar presupuesto y categoría:', error);
    res.status(500).json({ error: 'Error interno al guardar presupuesto.' });
  }
});

module.exports = router;