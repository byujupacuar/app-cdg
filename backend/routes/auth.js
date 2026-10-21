const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { OAuth2Client } = require('google-auth-library');

const googleClientIds = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
  .split(',')
  .map((clientId) => clientId.trim())
  .filter(Boolean);
const googleClient = new OAuth2Client(googleClientIds[0]);
const JWT_SECRET = process.env.JWT_SECRET || 'nivia_secret_key_2026';

// POST: /auth/google - Login / Registro con Google OAuth 2.0
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (typeof idToken !== 'string' || !idToken) {
      return res.status(400).json({ error: 'Token de Google requerido.' });
    }

    if (googleClientIds.length === 0) {
      console.error('No hay Client IDs de Google configurados.');
      return res.status(503).json({ error: 'El inicio de sesión con Google no está configurado.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientIds
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ error: 'La cuenta de Google debe tener un correo verificado.' });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name;
    let usuario = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email }
        ]
      }
    });

    // Si no existe, se crea el usuario con su cuenta individual en PostgreSQL
    if (!usuario) {
      usuario = await prisma.$transaction(async (tx) => {
        const nuevoUser = await tx.user.create({
          data: {
            name: name || 'Usuario de Google',
            email,
            googleId,
            password: null
          }
        });

        const account = await tx.account.create({
          data: {
            name: `Cuenta de ${nuevoUser.name}`,
            type: 'INDIVIDUAL'
          }
        });

        await tx.accountUser.create({
          data: {
            userId: nuevoUser.id,
            accountId: account.id,
            role: 'OWNER'
          }
        });

        await tx.financialAccount.create({
          data: {
            name: 'Efectivo',
            type: 'EFECTIVO',
            householdAccountId: account.id
          }
        });

        return nuevoUser;
      });
    } else if (usuario.googleId && usuario.googleId !== googleId) {
      return res.status(409).json({ error: 'Este correo ya está vinculado a otra cuenta de Google.' });
    } else if (!usuario.googleId) {
      usuario = await prisma.user.update({
        where: { id: usuario.id },
        data: { googleId }
      });
    }

    // Generar Token JWT firmado por Nivia
    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Autenticación con Google exitosa',
      token,
      user: {
        id: usuario.id,
        name: usuario.name,
        email: usuario.email
      }
    });

  } catch (error) {
    console.error('Error al autenticar con Google:', error);
    res.status(500).json({ error: 'Error al verificar la credencial de Google.' });
  }
});

// POST: /auth/register - Registro con Correo y Contraseña
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }

    const usuarioExistente = await prisma.user.findUnique({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, password: hashedPassword },
      });

      const account = await tx.account.create({
        data: { name: `Cuenta de ${name}`, type: 'INDIVIDUAL' },
      });

      await tx.accountUser.create({
        data: { userId: user.id, accountId: account.id, role: 'OWNER' },
      });

      await tx.financialAccount.create({
        data: {
          name: 'Efectivo',
          type: 'EFECTIVO',
          householdAccountId: account.id
        }
      });

      return user;
    });

    const token = jwt.sign(
      { userId: nuevoUsuario.id, email: nuevoUsuario.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: { id: nuevoUsuario.id, name: nuevoUsuario.name, email: nuevoUsuario.email },
    });
  } catch (error) {
    console.error("❌ ERROR DETALLADO EN /auth/register:", error);
    res.status(500).json({ 
      error: 'Error interno del servidor al registrar el usuario.',
      detalle: error.message 
    });
  }
});

// POST: /auth/login - Inicio de Sesión Tradicional
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ exito: false, mensaje: 'Ingresa correo y contraseña.' });
    }

    // Normalizar correo recibido
    const emailNormalizado = String(email).trim().toLowerCase();

    const usuario = await prisma.user.findUnique({ 
      where: { email: emailNormalizado } 
    });

    if (!usuario || !usuario.password) {
      return res.status(401).json({ exito: false, mensaje: 'Credenciales inválidas.' });
    }

    const esCorrecto = await bcrypt.compare(String(password).trim(), usuario.password);
    if (!esCorrecto) {
      return res.status(401).json({ exito: false, mensaje: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      exito: true,
      token,
      usuario: { id: usuario.id, name: usuario.name, email: usuario.email }
    });
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno en el servidor.' });
  }
});

module.exports = router;