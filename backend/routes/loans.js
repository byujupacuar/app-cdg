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

// GET: /api/prestamos - Obtener resumen de préstamos activos
router.get('/', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;

    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId },
      include: { account: true }
    });

    if (!relacionCuenta) {
      return res.status(404).json({ error: 'No se encontró cuenta asociada.' });
    }

    const accountId = relacionCuenta.accountId;

    // Obtener todos los préstamos vinculados a la cuenta
    const prestamos = await prisma.loan.findMany({
      where: { accountId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular totales
    let totalPorCobrar = 0; // OTORGADO
    let totalPorPagar = 0;  // RECIBIDO

    prestamos.forEach(p => {
      if (p.type === 'OTORGADO') totalPorCobrar += p.dueAmount;
      if (p.type === 'RECIBIDO') totalPorPagar += p.dueAmount;
    });

    res.json({
      exito: true,
      totales: {
        totalPorCobrar,
        totalPorPagar
      },
      prestamos
    });
  } catch (error) {
    console.error('Error al obtener préstamos:', error);
    res.status(500).json({ error: 'Error al consultar préstamos en la base de datos.' });
  }
});

// POST: /api/prestamos - Crear un nuevo préstamo
router.post('/', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const { contactName, totalAmount, type, dueDate } = req.body;

    if (!contactName || !totalAmount || !type) {
      return res.status(400).json({ error: 'Nombre de contacto, monto y tipo son obligatorios.' });
    }

    const relacionCuenta = await prisma.accountUser.findFirst({ where: { userId } });
    if (!relacionCuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });

    const tipoEnum = type.toUpperCase() === 'RECIBIDO' ? 'RECIBIDO' : 'OTORGADO';
    const monto = parseFloat(totalAmount);

    const nuevoPrestamo = await prisma.loan.create({
      data: {
        contactName,
        totalAmount: monto,
        dueAmount: monto, // Inicialmente el saldo pendiente es el total
        type: tipoEnum,
        dueDate: dueDate ? new Date(dueDate) : null,
        accountId: relacionCuenta.accountId,
        userId: userId
      }
    });

    res.status(201).json({ exito: true, prestamo: nuevoPrestamo });
  } catch (error) {
    console.error('Error al crear préstamo:', error);
    res.status(500).json({ error: 'Error al registrar el préstamo.' });
  }
});

// PATCH: /api/prestamos/:id/abonar - Registrar un abono a un préstamo
router.patch('/:id/abonar', autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { abonoAmount } = req.body;

    if (!abonoAmount || parseFloat(abonoAmount) <= 0) {
      return res.status(400).json({ error: 'El monto del abono debe ser mayor a cero.' });
    }

    const prestamo = await prisma.loan.findUnique({ where: { id } });
    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado.' });

    const montoAbono = parseFloat(abonoAmount);
    const nuevoSaldo = Math.max(0, prestamo.dueAmount - montoAbono);

    const prestamoActualizado = await prisma.loan.update({
      where: { id },
      data: { dueAmount: nuevoSaldo }
    });

    res.json({ exito: true, prestamo: prestamoActualizado });
  } catch (error) {
    console.error('Error al registrar abono:', error);
    res.status(500).json({ error: 'Error al procesar el abono.' });
  }
});

module.exports = router;