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