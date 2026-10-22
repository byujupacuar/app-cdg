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
    if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
    req.usuario = usuario;
    next();
  });
};

/**
 * POST: /api/sync
 * Procesa la cola de mutaciones generadas sin conexión.
 * Aplica en orden las mutaciones pendientes del cliente.
 */
router.post('/', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const { mutaciones } = req.body;

    if (!Array.isArray(mutaciones) || mutaciones.length === 0) {
      return res.status(400).json({ error: 'La cola de mutaciones está vacía o es inválida.' });
    }

    // Obtener la cuenta vinculada al usuario
    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId },
      include: { account: true }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta vinculada al usuario.' });
    }

    const accountId = relacionCuenta.accountId;
    const resultados = [];

    // Procesar cada mutación en orden cronológico dentro de una transacción o iteración segura
    for (const mutacion of mutaciones) {
      const { tempId, entity, action, data, clientTimestamp } = mutacion;

      try {
        if (entity === 'TRANSACTION') {
          const resultado = await procesarTransaccion(action, data, accountId, userId, clientTimestamp);
          resultados.push({ tempId, status: 'SYNCED', serverId: resultado.id });
        } else {
          resultados.push({ tempId, status: 'ERROR', error: 'Entidad no soportada' });
        }
      } catch (errError) {
        console.error(`Error procesando mutación ${tempId}:`, errError);
        resultados.push({ tempId, status: 'ERROR', error: errError.message });
      }
    }

    res.json({
      exito: true,
      procesados: resultados.filter(r => r.status === 'SYNCED').length,
      resultados
    });

  } catch (error) {
    console.error('Error durante la sincronización por lotes:', error);
    res.status(500).json({ error: 'Error interno en el servidor durante la sincronización.' });
  }
});

// Helper: Procesar mutaciones de Transacciones de forma idempotente
async function procesarTransaccion(action, data, accountId, userId, clientTimestamp) {
  const { id, amount, type, description, categoryName, date, financialAccountId } = data;
  const fechaCliente = new Date(clientTimestamp || Date.now());

  if (action === 'CREATE') {
    const cuentaFinanciera = financialAccountId
      ? await prisma.financialAccount.findFirst({
        where: { id: financialAccountId, householdAccountId: accountId }
      })
      : await prisma.financialAccount.findFirst({
        where: { householdAccountId: accountId },
        orderBy: { createdAt: 'asc' }
      });

    if (!cuentaFinanciera) {
      throw new Error('No se encontró una cuenta válida para el movimiento sincronizado.');
    }

    const tipo = ['INGRESO', 'GASTO'].includes(type) ? type : 'GASTO';
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new Error('El monto del movimiento sincronizado no es válido.');
    }

    let categoria = await prisma.category.findFirst({
      where: { name: categoryName || 'General', type: tipo, userId }
    });

    if (!categoria) {
      categoria = await prisma.category.create({
        data: { name: categoryName || 'General', icon: '🏷️', type: tipo, userId }
      });
    }

    const existente = await prisma.transaction.findUnique({ where: { id } });
    if (existente) {
      if (existente.accountId !== accountId) {
        throw new Error('El identificador del movimiento ya pertenece a otra cuenta.');
      }
      return prisma.transaction.update({
        where: { id },
        data: {
          amount: monto,
          type: tipo,
          description: description || 'Registrado offline',
          date: date ? new Date(date) : existente.date,
          financialAccountId: cuentaFinanciera.id,
          categoryId: categoria.id
        }
      });
    }

    return await prisma.transaction.create({
      data: {
        id,
        amount: monto,
        type: tipo,
        description: description || 'Registrado offline',
        date: date ? new Date(date) : new Date(),
        accountId,
        financialAccountId: cuentaFinanciera.id,
        userId,
        categoryId: categoria.id,
        createdAt: fechaCliente
      }
    });
  }

  if (action === 'UPDATE') {
    const existente = await prisma.transaction.findFirst({
      where: { id, accountId }
    });
    if (!existente) throw new Error('No se encontró el movimiento que se desea actualizar.');

    const tipoValido = ['INGRESO', 'GASTO'].includes(type);
    const monto = Number(amount);
    if (!tipoValido || !Number.isFinite(monto) || monto <= 0 || !categoryName) {
      throw new Error('Los datos del movimiento no son válidos.');
    }

    const [categoria, cuentaFinanciera] = await Promise.all([
      prisma.category.findFirst({ where: { name: categoryName, type, userId } }),
      financialAccountId
        ? prisma.financialAccount.findFirst({
          where: { id: financialAccountId, householdAccountId: accountId }
        })
        : Promise.resolve(existente.financialAccountId
          ? { id: existente.financialAccountId }
          : null)
    ]);
    if (!categoria) throw new Error('No se encontró una categoría válida.');
    if (!cuentaFinanciera) throw new Error('No se encontró una cuenta financiera válida.');

    return await prisma.transaction.update({
      where: { id },
      data: {
        amount: monto,
        type,
        description: description || 'Sin detalle',
        date: date ? new Date(date) : existente.date,
        categoryId: categoria.id,
        financialAccountId: cuentaFinanciera.id
      }
    });
  }

  if (action === 'DELETE') {
    const resultado = await prisma.transaction.deleteMany({ where: { id, accountId } });
    return { id, eliminada: resultado.count > 0 };
  }

  throw new Error(`Acción no soportada para movimientos: ${action}`);
}

module.exports = router;