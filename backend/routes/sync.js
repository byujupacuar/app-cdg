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
 * Aplica la estrategia Last-Write-Wins (LWW) para resolver conflictos.
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
        } else if (entity === 'LOAN') {
          const resultado = await procesarPrestamo(action, data, accountId, userId, clientTimestamp);
          resultados.push({ tempId, status: 'SYNCED', serverId: resultado.id });
        } else if (entity === 'CATEGORY') {
          const resultado = await procesarCategoria(action, data, accountId, clientTimestamp);
          resultados.push({ tempId, status: 'SYNCED', serverId: resultado.id });
        } else {
          resultados.push({ tempId, status: 'SKIPPED', error: 'Entidad no soportada' });
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

// Helper: Procesar mutaciones de Transacciones con LWW
async function procesarTransaccion(action, data, accountId, userId, clientTimestamp) {
  const { id, amount, type, description, categoryName, date } = data;
  const fechaCliente = new Date(clientTimestamp || Date.now());

  if (action === 'CREATE') {
    // Buscar o crear la categoría correspondiente
    let categoria = await prisma.category.findFirst({
      where: { name: categoryName || 'General' }
    });

    if (!categoria) {
      categoria = await prisma.category.create({
        data: { name: categoryName || 'General', icon: '🏷️', type: type || 'GASTO' }
      });
    }

    return await prisma.transaction.create({
      data: {
        id: id, // Preserva el UUID generado en la app cliente
        amount: parseFloat(amount),
        type: type || 'GASTO',
        description: description || 'Registrado offline',
        date: date ? new Date(date) : new Date(),
        accountId,
        userId,
        categoryId: categoria.id,
        createdAt: fechaCliente,
        updatedAt: fechaCliente
      }
    });
  }

  if (action === 'UPDATE') {
    const existente = await prisma.transaction.findUnique({ where: { id } });

    // Estrategia LWW (Last-Write-Wins): Se aplica el cambio solo si la mutación es más reciente
    if (existente && existente.updatedAt > fechaCliente) {
      return existente; // Descartar mutación antigua
    }

    return await prisma.transaction.update({
      where: { id },
      data: {
        amount: parseFloat(amount),
        description: description,
        updatedAt: fechaCliente
      }
    });
  }

  if (action === 'DELETE') {
    return await prisma.transaction.delete({ where: { id } });
  }
}

// Helper: Procesar mutaciones de Préstamos con LWW
async function procesarPrestamo(action, data, accountId, userId, clientTimestamp) {
  const { id, contactName, totalAmount, dueAmount, type, dueDate } = data;
  const fechaCliente = new Date(clientTimestamp || Date.now());

  if (action === 'CREATE') {
    return await prisma.loan.create({
      data: {
        id: id,
        contactName,
        totalAmount: parseFloat(totalAmount),
        dueAmount: parseFloat(dueAmount || totalAmount),
        type: type || 'OTORGADO',
        dueDate: dueDate ? new Date(dueDate) : null,
        accountId,
        userId,
        createdAt: fechaCliente,
        updatedAt: fechaCliente
      }
    });
  }

  if (action === 'ABONO' || action === 'UPDATE') {
    const existente = await prisma.loan.findUnique({ where: { id } });

    if (existente && existente.updatedAt > fechaCliente) {
      return existente;
    }

    return await prisma.loan.update({
      where: { id },
      data: {
        dueAmount: parseFloat(dueAmount),
        updatedAt: fechaCliente
      }
    });
  }
}

// Helper: Procesar mutaciones de Categorías
async function procesarCategoria(action, data, accountId, clientTimestamp) {
  const { id, name, icon, type } = data;

  if (action === 'CREATE') {
    return await prisma.category.create({
      data: {
        id: id,
        name: name.trim(),
        icon: icon || '🏷️',
        type: type || 'GASTO'
      }
    });
  }
}

module.exports = router;