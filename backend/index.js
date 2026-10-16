const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Importar enrutadores
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const loanRoutes = require('./routes/loans'); 
const accountRoutes = require('./routes/accounts'); // 👈 Importamos el enrutador de cuentas
const categoryRoutes = require('./routes/categories'); // 👈 Importamos el enrutador de categorías
const syncRoutes = require('./routes/sync'); // 👈 Importamos el enrutador de sincronización


// Montar enrutadores
app.use('/api/auth', authRoutes);
app.use('/api/movimientos', transactionRoutes); // 👈 Esta línea resuelve el 404 de /api/movimientos/dashboard
app.use('/api/presupuestos', budgetRoutes);
app.use('/api/cuentas', accountRoutes); // 👈 Montamos el enrutador de cuentas
app.use('/api/prestamos', loanRoutes); // 👈 Esta línea resuelve el 404 de /api/prestamos
app.use('/api/categorias', categoryRoutes); // 👈 Montamos el enrutador de categorías
app.use('/api/sync', syncRoutes); // 👈 Montamos el enrutador de sincronización


app.get('/', (req, res) => {
  res.json({ mensaje: "🚀 API REST de Nivia (Servidor Activo)" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===========================================`);
  console.log(`🚀 Servidor Nivia escuchando en puerto ${PORT}`);
  console.log(`📡 http://0.0.0.0:${PORT}`);
  console.log(`===========================================`);
});