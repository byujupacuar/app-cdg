const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'nivia_secret_key_2026';

const parseDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};

const parseInstallments = (installments, totalAmount) => {
  if (installments === undefined) return [];
  if (!Array.isArray(installments) || installments.length > 120) return null;

  const parsed = [];
  for (const installment of installments) {
    const amount = typeof installment?.amount === 'number' || (typeof installment?.amount === 'string' && installment.amount.trim())
      ? Number(installment.amount)
      : Number.NaN;
    const dueDate = parseDate(installment?.dueDate);
    if (!Number.isFinite(amount) || amount <= 0 || !dueDate) return null;
    parsed.push({ amount, dueDate });
  }

  const amountInCents = (amount) => Math.round(amount * 100);
  const scheduledCents = parsed.reduce((sum, installment) => sum + amountInCents(installment.amount), 0);
  if (parsed.length && scheduledCents !== amountInCents(totalAmount)) return null;
  return parsed;
};

const distributePaidAmount = (installments, paidAmount) => {
  let remaining = paidAmount;
  return installments.map((installment) => {
    const paid = Math.min(installment.amount, Math.max(remaining, 0));
    remaining = Math.max(remaining - paid, 0);
    return { ...installment, paidAmount: paid };
  });
};

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
      include: {
        user: true,
        payments: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] },
        installments: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] }
      },
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
    const { contactName, totalAmount, type, dueDate, loanDate, installments } = req.body;
    const monto = typeof totalAmount === 'number' || (typeof totalAmount === 'string' && totalAmount.trim())
      ? Number(totalAmount)
      : Number.NaN;
    const fechaPrestamo = loanDate === undefined ? new Date() : parseDate(loanDate);
    const tieneFechaVencimiento = dueDate !== undefined && dueDate !== null && dueDate !== '';
    const fechaVencimiento = tieneFechaVencimiento ? parseDate(dueDate) : null;
    const cuotas = parseInstallments(installments, monto);
    if (typeof contactName !== 'string' || !contactName.trim() || !Number.isFinite(monto) || monto <= 0 || typeof type !== 'string' || !['OTORGADO', 'RECIBIDO'].includes(type.toUpperCase()) || !fechaPrestamo || (tieneFechaVencimiento && !fechaVencimiento) || cuotas === null) {
      return res.status(400).json({ error: 'Verifica el nombre, monto, tipo y fechas; las cuotas deben sumar el monto total.' });
    }

    const relacionCuenta = await prisma.accountUser.findFirst({ where: { userId } });
    if (!relacionCuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });

    const tipoEnum = type.toUpperCase();

    const nuevoPrestamo = await prisma.loan.create({
      data: {
        contactName: contactName.trim(),
        totalAmount: monto,
        dueAmount: monto, // Inicialmente el saldo pendiente es el total
        type: tipoEnum,
        loanDate: fechaPrestamo,
        dueDate: fechaVencimiento,
        accountId: relacionCuenta.accountId,
        userId: userId,
        ...(cuotas.length ? { installments: { create: cuotas } } : {})
      }
    });

    res.status(201).json({ exito: true, prestamo: nuevoPrestamo });
  } catch (error) {
    console.error('Error al crear préstamo:', error);
    res.status(500).json({ error: 'Error al registrar el préstamo.' });
  }
});

// PUT: /api/prestamos/:id/plan - Crear o actualizar fechas e importes de cuotas
router.put('/:id/plan', autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { dueDate, installments } = req.body;
    const tieneFechaVencimiento = dueDate !== undefined && dueDate !== null && dueDate !== '';
    const fechaVencimiento = tieneFechaVencimiento ? parseDate(dueDate) : null;
    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId: req.usuario.userId }
    });
    if (!relacionCuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });

    const prestamo = await prisma.loan.findFirst({
      where: { id, accountId: relacionCuenta.accountId },
      include: { installments: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] } }
    });

    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado.' });
    const cuotas = parseInstallments(installments, prestamo.totalAmount);
    if ((tieneFechaVencimiento && !fechaVencimiento) || cuotas === null || !cuotas.length) {
      return res.status(400).json({ error: 'Indica fechas válidas y cuotas cuyo total coincida con el monto del préstamo.' });
    }

    const totalPagado = prestamo.totalAmount - prestamo.dueAmount;
    const cuotasConPagos = distributePaidAmount(cuotas, totalPagado);
    const resultado = await prisma.$transaction(async (tx) => {
      await tx.loan.update({
        where: { id },
        data: { dueDate: fechaVencimiento }
      });
      await tx.loanInstallment.deleteMany({ where: { loanId: id } });
      await tx.loanInstallment.createMany({
        data: cuotasConPagos.map((cuota) => ({ ...cuota, loanId: id }))
      });
      return tx.loan.findUnique({
        where: { id },
        include: {
          payments: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] },
          installments: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] }
        }
      });
    });

    res.json({ exito: true, prestamo: resultado });
  } catch (error) {
    console.error('Error al actualizar el plan de pagos:', error);
    res.status(500).json({ error: 'Error al actualizar el plan de pagos.' });
  }
});

// PATCH: /api/prestamos/:id/abonar - Registrar un abono a un préstamo
router.patch('/:id/abonar', autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { abonoAmount, paymentDate } = req.body;
    const montoAbono = typeof abonoAmount === 'number' || (typeof abonoAmount === 'string' && abonoAmount.trim())
      ? Number(abonoAmount)
      : Number.NaN;
    const fechaPago = paymentDate === undefined ? new Date() : parseDate(paymentDate);

    if (!Number.isFinite(montoAbono) || montoAbono <= 0 || !fechaPago) {
      return res.status(400).json({ error: 'El monto del abono y la fecha de pago deben ser válidos.' });
    }

    const relacionCuenta = await prisma.accountUser.findFirst({
      where: { userId: req.usuario.userId }
    });
    if (!relacionCuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });

    const prestamo = await prisma.loan.findFirst({
      where: { id, accountId: relacionCuenta.accountId }
    });
    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado.' });

    if (montoAbono > prestamo.dueAmount) {
      return res.status(400).json({ error: 'El abono no puede superar el saldo pendiente.' });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const actualizacion = await tx.loan.updateMany({
        where: { id, accountId: relacionCuenta.accountId, dueAmount: { gte: montoAbono } },
        data: { dueAmount: { decrement: montoAbono } }
      });

      if (!actualizacion.count) {
        return null;
      }

      const pago = await tx.loanPayment.create({
        data: { loanId: id, amount: montoAbono, date: fechaPago }
      });

      const prestamoActualizado = await tx.loan.findUnique({ where: { id } });
      const cuotas = await tx.loanInstallment.findMany({
        where: { loanId: id },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
      });
      const cuotasConPagos = distributePaidAmount(cuotas, prestamoActualizado.totalAmount - prestamoActualizado.dueAmount);
      await Promise.all(cuotasConPagos.map((cuota) => tx.loanInstallment.update({
        where: { id: cuota.id },
        data: { paidAmount: cuota.paidAmount }
      })));

      const prestamoConPagos = await tx.loan.findUnique({
        where: { id },
        include: {
          payments: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] },
          installments: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] }
        }
      });

      return { prestamo: prestamoConPagos, pago };
    });

    if (!resultado) {
      return res.status(400).json({ error: 'El abono supera el saldo pendiente actualizado.' });
    }

    res.json({ exito: true, ...resultado });
  } catch (error) {
    console.error('Error al registrar abono:', error);
    res.status(500).json({ error: 'Error al procesar el abono.' });
  }
});

module.exports = router;