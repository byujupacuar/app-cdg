const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { obtenerSaldosCuentasFinancieras } = require('../utils/financialAccounts');

const JWT_SECRET = process.env.JWT_SECRET || 'nivia_secret_key_2026';
const TIPOS_CUENTA_PREDEFINIDOS = new Set(['EFECTIVO', 'BANCO', 'DEBITO', 'CREDITO']);
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

router.get('/financieras', autenticarToken, async (req, res) => {
  try {
    const relacion = await prisma.accountUser.findFirst({
      where: { userId: req.usuario.userId }
    });

    if (!relacion) {
      return res.status(404).json({ error: 'No se encontró una cuenta asociada.' });
    }

    const resumen = await obtenerSaldosCuentasFinancieras(prisma, relacion.accountId);
    res.json({ exito: true, ...resumen });
  } catch (error) {
    console.error('Error al obtener cuentas financieras:', error);
    res.status(500).json({ error: 'Error al consultar las cuentas financieras.' });
  }
});

router.post('/financieras', autenticarToken, async (req, res) => {
  try {
    const nombre = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const tipoEntrada = typeof req.body.type === 'string' ? req.body.type.trim() : '';
    const tipo = TIPOS_CUENTA_PREDEFINIDOS.has(tipoEntrada.toUpperCase())
      ? tipoEntrada.toUpperCase()
      : tipoEntrada;
    const saldoInicial = typeof req.body.initialBalance === 'number' || (
      typeof req.body.initialBalance === 'string' && req.body.initialBalance.trim()
    ) ? Number(req.body.initialBalance) : Number.NaN;

    if (!nombre || nombre.length > 60 || !tipo || tipo.length > 30) {
      return res.status(400).json({ error: 'Ingresa un nombre de hasta 60 caracteres y un tipo de hasta 30 caracteres.' });
    }

    if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
      return res.status(400).json({ error: 'El saldo inicial debe ser un monto válido mayor o igual a cero.' });
    }

    if (tipo === 'DEBITO' && typeof req.body.linkedFinancialAccountId !== 'string') {
      return res.status(400).json({ error: 'Selecciona una cuenta bancaria para vincular la tarjeta de débito.' });
    }

    const relacion = await prisma.accountUser.findFirst({
      where: { userId: req.usuario.userId }
    });

    if (!relacion) {
      return res.status(404).json({ error: 'No se encontró una cuenta asociada.' });
    }

    if (tipo === 'DEBITO') {
      const bancoVinculado = await prisma.financialAccount.findFirst({
        where: {
          id: req.body.linkedFinancialAccountId,
          householdAccountId: relacion.accountId,
          type: 'BANCO'
        }
      });

      if (!bancoVinculado) {
        return res.status(400).json({ error: 'Vincula la tarjeta de débito a una cuenta bancaria válida.' });
      }
    }

    const cuenta = await prisma.financialAccount.create({
      data: {
        name: nombre,
        type: tipo,
        initialBalance: tipo === 'DEBITO' ? 0 : saldoInicial,
        ...(tipo === 'DEBITO' && { linkedFinancialAccountId: req.body.linkedFinancialAccountId }),
        householdAccountId: relacion.accountId
      }
    });

    const saldoCuenta = tipo === 'DEBITO'
      ? (await obtenerSaldosCuentasFinancieras(prisma, relacion.accountId)).cuentas.find((item) => item.id === cuenta.id)?.saldo || 0
      : saldoInicial;
    res.status(201).json({
      exito: true,
      cuenta: {
        ...cuenta,
        saldo: saldoCuenta,
        deuda: tipo === 'CREDITO' ? saldoInicial : 0,
        esCredito: tipo === 'CREDITO',
        esDebitoVinculado: tipo === 'DEBITO'
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese nombre.' });
    }

    console.error('Error al crear cuenta financiera:', error);
    res.status(500).json({ error: 'Error al crear la cuenta financiera.' });
  }
});

router.put('/financieras/:id/saldo', autenticarToken, async (req, res) => {
  try {
    const saldoActual = typeof req.body.saldoActual === 'number' || (
      typeof req.body.saldoActual === 'string' && req.body.saldoActual.trim()
    ) ? Number(req.body.saldoActual) : Number.NaN;

    if (!Number.isFinite(saldoActual) || saldoActual < 0) {
      return res.status(400).json({ error: 'El saldo actual debe ser un monto válido mayor o igual a cero.' });
    }

    const relacion = await prisma.accountUser.findFirst({
      where: { userId: req.usuario.userId }
    });

    if (!relacion) {
      return res.status(404).json({ error: 'No se encontró una cuenta asociada.' });
    }

    const cuenta = await prisma.financialAccount.findFirst({
      where: { id: req.params.id, householdAccountId: relacion.accountId }
    });

    if (!cuenta) {
      return res.status(404).json({ error: 'No se encontró la cuenta financiera solicitada.' });
    }

    if (cuenta.type === 'DEBITO') {
      return res.status(400).json({ error: 'Ajusta el saldo de la cuenta bancaria vinculada a esta tarjeta.' });
    }

    const resumen = await obtenerSaldosCuentasFinancieras(prisma, relacion.accountId);
    const saldoCalculado = resumen.cuentas.find((item) => item.id === cuenta.id)?.saldo || 0;
    const cuentaActualizada = await prisma.financialAccount.update({
      where: { id: cuenta.id },
      data: { initialBalance: cuenta.initialBalance + saldoActual - saldoCalculado }
    });

    res.json({
      exito: true,
      cuenta: { ...cuentaActualizada, saldo: saldoActual, deuda: cuentaActualizada.type === 'CREDITO' ? saldoActual : 0 }
    });
  } catch (error) {
    console.error('Error al ajustar el saldo de la cuenta:', error);
    res.status(500).json({ error: 'Error al ajustar el saldo de la cuenta.' });
  }
});

router.post('/financieras/transferencias', autenticarToken, async (req, res) => {
  try {
    const { fromFinancialAccountId, toFinancialAccountId } = req.body;
    const amount = typeof req.body.amount === 'number' || (
      typeof req.body.amount === 'string' && req.body.amount.trim()
    ) ? Number(req.body.amount) : Number.NaN;
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';

    if (!Number.isFinite(amount) || amount <= 0 || !fromFinancialAccountId || !toFinancialAccountId) {
      return res.status(400).json({ error: 'Selecciona las cuentas de origen y destino e ingresa un monto válido.' });
    }

    if (typeof fromFinancialAccountId !== 'string' || typeof toFinancialAccountId !== 'string') {
      return res.status(400).json({ error: 'Las cuentas de origen y destino no son válidas.' });
    }

    if (description.length > 120) {
      return res.status(400).json({ error: 'El detalle de la transferencia no puede exceder 120 caracteres.' });
    }

    if (fromFinancialAccountId === toFinancialAccountId) {
      return res.status(400).json({ error: 'El origen y el destino deben ser cuentas diferentes.' });
    }

    const relacion = await prisma.accountUser.findFirst({
      where: { userId: req.usuario.userId }
    });

    if (!relacion) {
      return res.status(404).json({ error: 'No se encontró una cuenta asociada.' });
    }

    const cuentas = await prisma.financialAccount.findMany({
      where: {
        householdAccountId: relacion.accountId,
        id: { in: [fromFinancialAccountId, toFinancialAccountId] }
      }
    });

    if (cuentas.length !== 2) {
      return res.status(400).json({ error: 'Selecciona cuentas válidas de tu hogar.' });
    }

    if (cuentas.some((cuenta) => cuenta.type === 'DEBITO')) {
      return res.status(400).json({ error: 'Usa la cuenta bancaria vinculada para hacer transferencias de una tarjeta de débito.' });
    }

    const transferencia = await prisma.financialAccountTransfer.create({
      data: {
        amount,
        description: description || null,
        householdAccountId: relacion.accountId,
        fromFinancialAccountId,
        toFinancialAccountId
      },
      include: { fromFinancialAccount: true, toFinancialAccount: true }
    });

    res.status(201).json({ exito: true, transferencia });
  } catch (error) {
    console.error('Error al registrar transferencia:', error);
    res.status(500).json({ error: 'Error al registrar la transferencia.' });
  }
});

router.get('/financieras/transferencias', autenticarToken, async (req, res) => {
  try {
    const relacion = await prisma.accountUser.findFirst({
      where: { userId: req.usuario.userId }
    });

    if (!relacion) {
      return res.status(404).json({ error: 'No se encontró una cuenta asociada.' });
    }

    const transferencias = await prisma.financialAccountTransfer.findMany({
      where: { householdAccountId: relacion.accountId },
      include: { fromFinancialAccount: true, toFinancialAccount: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 30
    });

    res.json({ exito: true, transferencias });
  } catch (error) {
    console.error('Error al consultar transferencias:', error);
    res.status(500).json({ error: 'Error al consultar las transferencias.' });
  }
});

// GET: /api/cuentas/mi-cuenta - Consultar la cuenta activa y los miembros vinculados
router.get('/mi-cuenta', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;

    const relacion = await prisma.accountUser.findFirst({
      where: { userId },
      include: {
        account: {
          include: {
            users: {
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                }
              }
            }
          }
        }
      }
    });

    if (!relacion) {
      return res.status(404).json({ error: 'No se encontró cuenta asociada.' });
    }

    const miembros = relacion.account.users.map(u => ({
      id: u.user.id,
      name: u.user.name,
      email: u.user.email,
      role: u.role
    }));

    res.json({
      exito: true,
      cuenta: {
        id: relacion.account.id,
        name: relacion.account.name,
        type: relacion.account.type,
        role: relacion.role,
        miembros
      }
    });
  } catch (error) {
    console.error('Error al obtener cuenta:', error);
    res.status(500).json({ error: 'Error al consultar la cuenta en PostgreSQL.' });
  }
});

// POST: /api/cuentas/invitar - Invitar pareja a compartir la cuenta (SHARED)
router.post('/invitar', autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.userId;
    const { emailPareja } = req.body;

    if (!emailPareja) {
      return res.status(400).json({ error: 'Debes proporcionar el correo de tu pareja.' });
    }

    if (emailPareja.toLowerCase() === req.usuario.email.toLowerCase()) {
      return res.status(400).json({ error: 'No puedes invitarte a ti mismo.' });
    }

    // 1. Obtener la cuenta activa del usuario invitante
    const relacionPropia = await prisma.accountUser.findFirst({
      where: { userId },
      include: { account: true }
    });

    if (!relacionPropia) {
      return res.status(404).json({ error: 'No tienes una cuenta registrada.' });
    }

    const accountId = relacionPropia.accountId;

    // 2. Buscar si la pareja ya tiene usuario en Nivia
    const usuarioPareja = await prisma.user.findUnique({
      where: { email: emailPareja.toLowerCase() }
    });

    if (!usuarioPareja) {
      return res.status(404).json({ 
        error: `El usuario ${emailPareja} aún no está registrado en Nivia. Pídele que cree su cuenta primero.` 
      });
    }

    // 3. Verificar si la pareja ya pertenece a esta cuenta
    const yaEstaVinculado = await prisma.accountUser.findUnique({
      where: {
        userId_accountId: {
          userId: usuarioPareja.id,
          accountId: accountId
        }
      }
    });

    if (yaEstaVinculado) {
      return res.status(400).json({ error: 'Esta persona ya forma parte de tu cuenta compartida.' });
    }

    // 4. Transacción Prisma: Convertir la cuenta a SHARED y agregar a la pareja como MEMBER
    await prisma.$transaction([
      prisma.account.update({
        where: { id: accountId },
        data: { 
          type: 'SHARED',
          name: `Cuenta Compartida (${relacionPropia.account.name})`
        }
      }),
      prisma.accountUser.create({
        data: {
          userId: usuarioPareja.id,
          accountId: accountId,
          role: 'MEMBER'
        }
      })
    ]);

    res.json({
      exito: true,
      mensaje: `¡Excelente! Se ha vinculado a ${usuarioPareja.name} (${usuarioPareja.email}) a tu cuenta compartida.`
    });
  } catch (error) {
    console.error('Error al invitar pareja:', error);
    res.status(500).json({ error: 'Error interno al procesar la invitación.' });
  }
});

module.exports = router;