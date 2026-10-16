const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // El celular enviará el token en un formato llamado "Bearer [token]"
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).json({ error: 'Acceso denegado. No hay token.' });

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verifica si el token es válido usando tu llave secreta del archivo .env
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Guarda el ID del usuario para usarlo después
    next(); // Deja pasar al usuario a la ruta solicitada
  } catch (error) {
    res.status(400).json({ error: 'Token no válido o caducado.' });
  }
};