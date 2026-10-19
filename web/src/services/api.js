import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para inyectar automáticamente el Token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nivia_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginUsuario = async (credentials) => {
  const res = await api.post('/api/auth/login', credentials);
  return res.data;
};

export const obtenerDashboard = async (periodo) => {
  const res = await api.get('/api/movimientos/dashboard', { params: periodo });
  return res.data;
};

export const obtenerCategorias = async () => {
  const res = await api.get('/api/categorias');
  return res.data;
};

export const crearCategoria = async (datos) => {
  const res = await api.post('/api/categorias', datos);
  return res.data;
};

export const actualizarCategoria = async (id, datos) => {
  const res = await api.put(`/api/categorias/${id}`, datos);
  return res.data;
};

export const eliminarCategoria = async (id) => {
  const res = await api.delete(`/api/categorias/${id}`);
  return res.data;
};

export const guardarMovimiento = async (datos) => {
  const res = await api.post('/api/movimientos', datos);
  return res.data;
};

export const obtenerMovimientos = async () => {
  const res = await api.get('/api/movimientos');
  return res.data;
};

export const actualizarMovimiento = async (id, datos) => {
  const res = await api.put(`/api/movimientos/${id}`, datos);
  return res.data;
};

export const eliminarMovimiento = async (id) => {
  const res = await api.delete(`/api/movimientos/${id}`);
  return res.data;
};

export const obtenerPresupuestos = async () => {
  const res = await api.get('/api/presupuestos');
  return res.data;
};

export const guardarPresupuesto = async (datos) => {
  const res = await api.post('/api/presupuestos', datos);
  return res.data;
};

export const obtenerPrestamos = async () => {
  const res = await api.get('/api/prestamos');
  return res.data;
};

export const crearPrestamo = async (datos) => {
  const res = await api.post('/api/prestamos', datos);
  return res.data;
};

export const actualizarPlanPrestamo = async (id, plan) => {
  const res = await api.put(`/api/prestamos/${id}/plan`, plan);
  return res.data;
};

export const abonarPrestamo = async (id, abonoAmount, paymentDate) => {
  const res = await api.patch(`/api/prestamos/${id}/abonar`, { abonoAmount, paymentDate });
  return res.data;
};

export default api;