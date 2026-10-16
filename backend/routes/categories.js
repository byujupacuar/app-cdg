const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'nivia_secret_key_2026';

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

// GET: /api/categorias - Listar categorías registradas
router.get('/', autenticarToken, async (req, res) => {
  try {
    const categorias = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ exito: true, categorias });
  } catch (error) {
    console.error('Error al consultar categorías:', error);
    res.status(500).json({ error: 'Error al consultar categorías en la base de datos.' });
  }
});

// POST: /api/categorias - Añadir una nueva categoría personalizada
router.post('/', autenticarToken, async (req, res) => {
  try {
    const { name, icon, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }

    const tipoEnum = type && type.toUpperCase() === 'INGRESO' ? 'INGRESO' : 'GASTO';

    let categoria = await prisma.category.findFirst({
      where: { name: name.trim() }
    });

    if (categoria) {
      return res.status(400).json({ error: 'Esta categoría ya existe.' });
    }

    categoria = await prisma.category.create({
      data: {
        name: name.trim(),
        icon: icon || '🏷️',
        type: tipoEnum
      }
    });

    res.status(201).json({ exito: true, categoria });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error interno al guardar la categoría.' });
  }
});

// PUT: /api/categorias/:id - Editar categoría existente
router.put('/:id', autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    const categoriaActualizada = await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        icon: icon || '🏷️',
        type: type ? type.toUpperCase() : 'GASTO'
      }
    });

    res.json({ exito: true, categoria: categoriaActualizada });
  } catch (error) {
    console.error('Error al editar categoría:', error);
    res.status(500).json({ error: 'Error al actualizar la categoría.' });
  }
});

// DELETE: /api/categorias/:id - Eliminar categoría
router.delete('/:id', autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si hay transacciones asociadas
    const movimientosAsociados = await prisma.transaction.count({
      where: { categoryId: id }
    });

    if (movimientosAsociados > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar la categoría porque tiene ${movimientosAsociados} movimiento(s) registrado(s). Reasigna los movimientos primero.` 
      });
    }

    await prisma.category.delete({ where: { id } });

    res.json({ exito: true, mensaje: 'Categoría eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error al eliminar la categoría.' });
  }
});

module.exports = router;