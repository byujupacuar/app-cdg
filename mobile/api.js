import axios from 'axios';

// Dirección IP local del backend en Express
const API_URL = 'https://app-cdg.onrender.com';

export const verificarConexion = async () => {
  try {
    const respuesta = await axios.get(`${API_URL}/`);
    return respuesta.data.mensaje;
  } catch (error) {
    console.error("Error de red:", error.message);
    return "Desconectado del Servidor";
  }
};

export const loginConGoogleApi = async (idToken) => {
  try {
    const respuesta = await axios.post(`${API_URL}/api/auth/google`, { idToken }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000
    });
    return {
      exito: true,
      token: respuesta.data.token,
      usuario: respuesta.data.user 
    };
  } catch (error) {
    console.error("Error en loginConGoogleApi:", error.response?.data || error.message);
    const mensajeError = error.response?.data?.error || "No se pudo autenticar con Google.";
    return { exito: false, mensaje: mensajeError };
  }
};

export const registrarUsuario = async (datos) => {
  try {
    const respuesta = await axios.post(`${API_URL}/api/auth/register`, datos, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    return { 
      exito: true, 
      token: respuesta.data.token, 
      usuario: respuesta.data.user 
    };
  } catch (error) {
    console.error("Error en registrarUsuario:", error.response?.data || error.message);
    const mensajeError = error.response?.data?.error || "No se pudo conectar con el servidor.";
    return { exito: false, mensaje: mensajeError };
  }
};

export const iniciarSesion = async (credenciales) => {
  try {
    const respuesta = await axios.post(`${API_URL}/api/auth/login`, credenciales, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    return { 
      exito: true, 
      token: respuesta.data.token, 
      usuario: respuesta.data.usuario 
    };
  } catch (error) {
    console.error("Error en iniciarSesion:", error.response?.data || error.message);
    const mensajeError = error.response?.data?.error || "Credenciales inválidas.";
    return { exito: false, mensaje: mensajeError };
  }
};

export const guardarMovimientoReal = async (datosMovimiento, token) => {
  try {
    const respuesta = await axios.post(
      `${API_URL}/api/movimientos`, 
      datosMovimiento,
      { 
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        } 
      }
    );
    return { exito: true, data: respuesta.data };
  } catch (error) {
    console.error("Error al guardar movimiento real:", error.response?.data || error.message);
    return { 
      exito: false, 
      mensaje: error.response?.data?.error || "Error al guardar el movimiento en el servidor." 
    };
  }
};

export const obtenerMovimientosReal = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/movimientos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, movimientos: respuesta.data.movimientos };
  } catch (error) {
    console.error("Error al consultar movimientos:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "No se pudieron cargar los movimientos." };
  }
};

export const actualizarMovimientoReal = async (id, datosMovimiento, token) => {
  try {
    const respuesta = await axios.put(`${API_URL}/api/movimientos/${id}`, datosMovimiento, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, movimiento: respuesta.data.movimiento };
  } catch (error) {
    console.error("Error al actualizar movimiento:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "No se pudo actualizar el movimiento." };
  }
};

export const eliminarMovimientoReal = async (id, token) => {
  try {
    const respuesta = await axios.delete(`${API_URL}/api/movimientos/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, mensaje: respuesta.data.mensaje };
  } catch (error) {
    console.error("Error al eliminar movimiento:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "No se pudo eliminar el movimiento." };
  }
};

export const obtenerDashboardReal = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/movimientos/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, datos: respuesta.data };
  } catch (error) {
    console.error("Error al consultar Dashboard:", error.response?.data || error.message);
    return { exito: false, mensaje: "No se pudo actualizar el balance." };
  }
};

export const obtenerPresupuestos = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/presupuestos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, presupuestos: respuesta.data.presupuestos };
  } catch (error) {
    return { exito: false, mensaje: "No se pudieron obtener los presupuestos." };
  }
};

export const guardarPresupuesto = async (datos, token) => {
  try {
    const respuesta = await axios.post(`${API_URL}/api/presupuestos`, datos, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, presupuesto: respuesta.data.presupuesto };
  } catch (error) {
    return { exito: false, mensaje: error.response?.data?.error || "No se pudo guardar el presupuesto." };
  }
};

export const obtenerPrestamos = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/prestamos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, datos: respuesta.data };
  } catch (error) {
    console.error("Error al obtener préstamos:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "No se pudieron cargar los préstamos." };
  }
};

export const crearPrestamo = async (datos, token) => {
  try {
    const respuesta = await axios.post(`${API_URL}/api/prestamos`, datos, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, prestamo: respuesta.data.prestamo };
  } catch (error) {
    console.error("Error al crear préstamo:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "No se pudo crear el préstamo." };
  }
};

export const actualizarPlanPrestamo = async (id, plan, token) => {
  try {
    const respuesta = await axios.put(`${API_URL}/api/prestamos/${id}/plan`, plan, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, prestamo: respuesta.data.prestamo };
  } catch (error) {
    console.error("Error al actualizar plan de pagos:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "No se pudo actualizar el plan de pagos." };
  }
};

export const abonarPrestamo = async (id, abonoAmount, token, paymentDate) => {
  try {
    const respuesta = await axios.patch(`${API_URL}/api/prestamos/${id}/abonar`, { abonoAmount, paymentDate }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, prestamo: respuesta.data.prestamo };
  } catch (error) {
    console.error("Error al abonar préstamo:", error.response?.data || error.message);
    return { exito: false, mensaje: "No se pudo registrar el abono." };
  }
};

export const obtenerMiCuenta = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/cuentas/mi-cuenta`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, datos: respuesta.data.cuenta };
  } catch (error) {
    console.error("Error al consultar cuenta:", error.response?.data || error.message);
    return { exito: false, mensaje: "No se pudo obtener la información de la cuenta." };
  }
};

export const invitarPareja = async (emailPareja, token) => {
  try {
    const respuesta = await axios.post(`${API_URL}/api/cuentas/invitar`, { emailPareja }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, mensaje: respuesta.data.mensaje };
  } catch (error) {
    console.error("Error al invitar pareja:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "Error al enviar la invitación." };
  }
};

export const obtenerCategorias = async (token) => {
  try {
    const res = await axios.get(`${API_URL}/api/categorias`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, categorias: res.data.categorias };
  } catch (err) {
    return { exito: false, mensaje: "Error al cargar categorías." };
  }
};

export const crearCategoria = async (datos, token) => {
  try {
    const res = await axios.post(`${API_URL}/api/categorias`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, categoria: res.data.categoria };
  } catch (err) {
    return { exito: false, mensaje: err.response?.data?.error || "Error al crear la categoría." };
  }
};

export const actualizarCategoria = async (id, datos, token) => {
  try {
    const res = await axios.put(`${API_URL}/api/categorias/${id}`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, categoria: res.data.categoria };
  } catch (err) {
    return { exito: false, mensaje: err.response?.data?.error || "Error al actualizar la categoría." };
  }
};

export const eliminarCategoria = async (id, token) => {
  try {
    const res = await axios.delete(`${API_URL}/api/categorias/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, mensaje: res.data.mensaje };
  } catch (err) {
    return { exito: false, mensaje: err.response?.data?.error || "Error al eliminar la categoría." };
  }
};

export const enviarColaSincronizacion = async (colaMutaciones, token) => {
  try {
    const respuesta = await axios.post(`${API_URL}/api/sync`, { mutaciones: colaMutaciones }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 15000 // Timeout extendido para lotes grandes
    });
    return { exito: true, resultados: respuesta.data.resultados };
  } catch (error) {
    console.error("Error al sincronizar mutaciones offline:", error.response?.data || error.message);
    return { exito: false, mensaje: "No se pudo sincronizar la cola offline." };
  }
};