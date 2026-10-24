import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import {
  cacheGet,
  cacheSet,
  enqueueMutation,
  getPendingMutations,
  removePendingMutation
} from './database/offlineStore';

// Dirección IP local del backend en Express
const API_URL = 'https://app-cdg.onrender.com';
let synchronizationInProgress = false;

const createId = () => {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const combinarTransferenciasPendientes = async (transferenciasRemotas) => {
  const pendientes = await getPendingMutations();
  const cuentas = (await cacheGet('accounts'))?.cuentas || [];
  const transferencias = new Map(
    (transferenciasRemotas || []).map((item) => [item.id, { ...item, pending: false }])
  );

  pendientes
    .filter((mutacion) => mutacion.entity === 'FINANCIAL_ACCOUNT_TRANSFER')
    .forEach((mutacion) => {
      if (mutacion.action !== 'CREATE') return;
      const { data, tempId } = mutacion;
      transferencias.set(tempId, {
        ...data,
        id: tempId,
        date: data.date || mutacion.clientTimestamp,
        fromFinancialAccount: cuentas.find((cuenta) => cuenta.id === data.fromFinancialAccountId),
        toFinancialAccount: cuentas.find((cuenta) => cuenta.id === data.toFinancialAccountId),
        pending: true
      });
    });

  return Array.from(transferencias.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const guardarTransferenciaLocal = async (id, datos) => {
  const resumenCuentas = await cacheGet('accounts');
  if (!resumenCuentas?.cuentas) {
    throw new Error('No hay cuentas guardadas en el dispositivo para registrar la transferencia offline.');
  }
  const cuentas = resumenCuentas.cuentas;
  const origen = cuentas.find((cuenta) => cuenta.id === datos.fromFinancialAccountId);
  const destino = cuentas.find((cuenta) => cuenta.id === datos.toFinancialAccountId);
  if (!origen || !destino || origen.type === 'DEBITO' || destino.type === 'DEBITO') {
    throw new Error('No se encontraron cuentas válidas guardadas para la transferencia.');
  }

  const monto = Number(datos.amount);
  const saldos = new Map(cuentas.map((cuenta) => [cuenta.id, Number(cuenta.saldo || 0)]));
  const origenCredito = origen.type === 'CREDITO' || origen.type === 'TARJETA_CREDITO';
  const destinoCredito = destino.type === 'CREDITO' || destino.type === 'TARJETA_CREDITO';
  saldos.set(origen.id, (saldos.get(origen.id) || 0) + monto * (origenCredito ? 1 : -1));
  saldos.set(destino.id, (saldos.get(destino.id) || 0) + monto * (destinoCredito ? -1 : 1));

  const cuentasActualizadas = cuentas.map((cuenta) => {
    const saldo = cuenta.type === 'DEBITO' && cuenta.linkedFinancialAccountId
      ? saldos.get(cuenta.linkedFinancialAccountId) || 0
      : saldos.get(cuenta.id) || 0;
    const esCredito = cuenta.type === 'CREDITO' || cuenta.type === 'TARJETA_CREDITO';
    return { ...cuenta, saldo, deuda: esCredito ? Math.max(saldo, 0) : 0 };
  });
  const totalDisponible = cuentasActualizadas
    .filter((cuenta) => !cuenta.esCredito && !cuenta.esDebitoVinculado)
    .reduce((total, cuenta) => total + Number(cuenta.saldo || 0), 0);
  const deudaTarjetas = cuentasActualizadas
    .reduce((total, cuenta) => total + Number(cuenta.deuda || 0), 0);
  const resumenActualizado = {
    ...resumenCuentas,
    cuentas: cuentasActualizadas,
    totalDisponible,
    deudaTarjetas,
    patrimonioNeto: totalDisponible - deudaTarjetas
  };
  await cacheSet('accounts', resumenActualizado);

  const fecha = datos.date || new Date().toISOString();
  const transferencia = {
    ...datos,
    id,
    date: fecha,
    fromFinancialAccount: origen,
    toFinancialAccount: destino,
    pending: true
  };
  const historial = (await cacheGet('transfers')) || [];
  await cacheSet('transfers', [
    transferencia,
    ...historial.filter((item) => item.id !== id)
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

  const dashboard = await cacheGet('dashboard');
  if (dashboard) {
    await cacheSet('dashboard', {
      ...dashboard,
      resumenCuentas: resumenActualizado
    });
  }
};

const combinarMovimientosPendientes = async (movimientosRemotos, mutaciones) => {
  const movimientosLocales = (await cacheGet('transactions')) || [];
  const categorias = (await cacheGet('categories')) || [];
  const cuentas = (await cacheGet('accounts'))?.cuentas || [];
  const movimientos = new Map(movimientosRemotos.map((movimiento) => [movimiento.id, movimiento]));

  mutaciones
    .filter((mutacion) => mutacion.entity === 'TRANSACTION')
    .forEach((mutacion) => {
      const { tempId, action, data } = mutacion;
      if (action === 'DELETE') {
        movimientos.delete(tempId);
        return;
      }

      const anterior = movimientosLocales.find((movimiento) => movimiento.id === tempId)
        || movimientos.get(tempId);
      const categoria = categorias.find((item) => item.name === data.categoryName)
        || anterior?.category
        || { name: data.categoryName, icon: '🏷️' };
      const cuenta = cuentas.find((item) => item.id === data.financialAccountId)
        || anterior?.financialAccount
        || null;
      movimientos.set(tempId, {
        ...anterior,
        ...data,
        id: tempId,
        date: data.date || anterior?.date || new Date().toISOString(),
        category: categoria,
        financialAccount: cuenta
      });
    });

  return Array.from(movimientos.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const guardarMovimientoLocal = async (id, datos, action) => {
  const movimientos = (await cacheGet('transactions')) || [];
  const anterior = movimientos.find((movimiento) => movimiento.id === id);
  const cuentas = (await cacheGet('accounts'))?.cuentas || [];
  const categorias = (await cacheGet('categories')) || [];
  const fecha = datos.date || anterior?.date || new Date().toISOString();
  const categoria = categorias.find((item) => item.name === datos.categoryName)
    || anterior?.category
    || { name: datos.categoryName, icon: '🏷️' };
  const cuenta = cuentas.find((item) => item.id === datos.financialAccountId)
    || anterior?.financialAccount
    || null;

  let actualizados;
  if (action === 'DELETE') {
    actualizados = movimientos.filter((movimiento) => movimiento.id !== id);
  } else {
    const movimiento = {
      ...anterior,
      ...datos,
      id,
      date: fecha,
      category: categoria,
      financialAccount: cuenta
    };
    actualizados = anterior
      ? movimientos.map((item) => item.id === id ? movimiento : item)
      : [movimiento, ...movimientos];
  }
  await cacheSet('transactions', actualizados);

  const resumenCuentas = await cacheGet('accounts');
  if (resumenCuentas?.cuentas) {
    const saldos = new Map(resumenCuentas.cuentas.map((cuenta) => [cuenta.id, Number(cuenta.saldo || 0)]));
    const aplicarSaldo = (movimiento, signo) => {
      if (!movimiento?.financialAccountId) return;
      const cuentaOriginal = resumenCuentas.cuentas.find((item) => item.id === movimiento.financialAccountId);
      const cuentaId = cuentaOriginal?.type === 'DEBITO' && cuentaOriginal.linkedFinancialAccountId
        ? cuentaOriginal.linkedFinancialAccountId
        : movimiento.financialAccountId;
      const cuenta = resumenCuentas.cuentas.find((item) => item.id === cuentaId);
      if (!cuenta) return;
      const credito = cuenta.type === 'CREDITO' || cuenta.type === 'TARJETA_CREDITO';
      const factor = movimiento.type === 'INGRESO'
        ? (credito ? -1 : 1)
        : (credito ? 1 : -1);
      saldos.set(cuentaId, (saldos.get(cuentaId) || 0) + Number(movimiento.amount || 0) * factor * signo);
    };
    aplicarSaldo(anterior, -1);
    if (action !== 'DELETE') aplicarSaldo(actualizados.find((item) => item.id === id), 1);

    const cuentas = resumenCuentas.cuentas.map((cuenta) => {
      const saldo = cuenta.type === 'DEBITO' && cuenta.linkedFinancialAccountId
        ? saldos.get(cuenta.linkedFinancialAccountId) || 0
        : saldos.get(cuenta.id) || 0;
      const esCredito = cuenta.type === 'CREDITO' || cuenta.type === 'TARJETA_CREDITO';
      return { ...cuenta, saldo, deuda: esCredito ? Math.max(saldo, 0) : 0 };
    });
    const totalDisponible = cuentas
      .filter((cuenta) => !cuenta.esCredito && !cuenta.esDebitoVinculado)
      .reduce((total, cuenta) => total + Number(cuenta.saldo || 0), 0);
    const deudaTarjetas = cuentas.reduce((total, cuenta) => total + Number(cuenta.deuda || 0), 0);
    const resumenActualizado = {
      ...resumenCuentas,
      cuentas,
      totalDisponible,
      deudaTarjetas,
      patrimonioNeto: totalDisponible - deudaTarjetas
    };
    await cacheSet('accounts', resumenActualizado);

    const dashboardActual = await cacheGet('dashboard');
    if (dashboardActual) {
      await cacheSet('dashboard', {
        ...dashboardActual,
        resumenCuentas: resumenActualizado
      });
    }
  }

  const dashboard = await cacheGet('dashboard');
  if (!dashboard) return;

  const ahora = new Date();
  const movimientosMes = actualizados.filter((item) => {
    const movimientoDate = new Date(item.date);
    return movimientoDate.getFullYear() === ahora.getFullYear()
      && movimientoDate.getMonth() === ahora.getMonth();
  });
  const totalIngresos = movimientosMes
    .filter((item) => item.type === 'INGRESO')
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const totalGastos = movimientosMes
    .filter((item) => item.type === 'GASTO')
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const gastosPorCategoriaMap = new Map();
  movimientosMes.filter((item) => item.type === 'GASTO').forEach((item) => {
    const idCategoria = item.category?.id || item.category?.name || 'general';
    const actual = gastosPorCategoriaMap.get(idCategoria) || {
      id: idCategoria,
      nombre: item.category?.name || 'General',
      icono: item.category?.icon || '🏷️',
      monto: 0
    };
    actual.monto += Number(item.amount || 0);
    gastosPorCategoriaMap.set(idCategoria, actual);
  });
  const gastosPorCategoria = Array.from(gastosPorCategoriaMap.values())
    .map((item) => ({
      ...item,
      porcentaje: totalGastos > 0 ? (item.monto / totalGastos) * 100 : 0
    }))
    .sort((a, b) => b.monto - a.monto);

  await cacheSet('dashboard', {
    ...dashboard,
    resumen: {
      ...dashboard.resumen,
      totalIngresos,
      totalGastos,
      balanceTotal: totalIngresos - totalGastos,
      totalMovimientos: movimientosMes.length
    },
    gastosPorCategoria,
    ultimosMovimientos: actualizados.slice(0, 10)
  });
};

const encolarMovimiento = async (id, action, data) => {
  const mutaciones = await getPendingMutations();
  const creadaPendiente = mutaciones.find((item) => item.tempId === id && item.action === 'CREATE');
  const actualizacionPendiente = mutaciones.find((item) => item.tempId === id && item.action === 'UPDATE');

  if (action === 'UPDATE' && creadaPendiente) {
    await enqueueMutation({
      id,
      entity: 'TRANSACTION',
      action: 'CREATE',
      data: { ...creadaPendiente.data, ...data, id },
      clientTimestamp: new Date().toISOString()
    });
  } else if (action === 'DELETE' && creadaPendiente) {
    await enqueueMutation({
      id,
      entity: 'TRANSACTION',
      action: 'DELETE',
      data: { ...data, id },
      clientTimestamp: new Date().toISOString()
    });
  } else {
    await enqueueMutation({
      id,
      entity: 'TRANSACTION',
      action: action === 'UPDATE' && actualizacionPendiente ? 'UPDATE' : action,
      data: action === 'UPDATE' && actualizacionPendiente
        ? { ...actualizacionPendiente.data, ...data, id }
        : { ...data, id },
      clientTimestamp: new Date().toISOString()
    });
  }
  await guardarMovimientoLocal(id, data, action);
};

export const sincronizarPendientes = async (token) => {
  if (synchronizationInProgress) return { exito: false, pendientes: true };
  synchronizationInProgress = true;
  try {
    const mutaciones = await getPendingMutations();
    if (!mutaciones.length) return { exito: true, sincronizados: 0 };
    const estadoRed = await NetInfo.fetch();
    if (estadoRed.isConnected !== true || estadoRed.isInternetReachable === false) {
      return { exito: false, pendientes: true };
    }

    const respuesta = await axios.post(`${API_URL}/api/sync`, { mutaciones }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 15000
    });
    const resultados = respuesta.data?.resultados;
    if (!Array.isArray(resultados)) {
      throw new Error('El servidor devolvió una respuesta de sincronización inválida.');
    }
    let sincronizados = 0;
    for (const resultado of resultados) {
      const mutacion = mutaciones.find((item) => item.tempId === resultado?.tempId);
      if (!mutacion) {
        throw new Error('El servidor devolvió una mutación desconocida.');
      }
      if (resultado.status === 'SYNCED') {
        const eliminada = await removePendingMutation(
          resultado.tempId,
          mutacion.clientTimestamp
        );
        if (eliminada) sincronizados += 1;
      } else if (resultado.status === 'ERROR') {
        console.error(
          `No se pudo sincronizar la mutación ${resultado.tempId}:`,
          resultado.error || 'Error no especificado por el servidor.'
        );
      } else {
        throw new Error(`Estado de sincronización desconocido: ${resultado.status}`);
      }
    }
    const pendientes = (await getPendingMutations()).length > 0;
    return {
      exito: true,
      sincronizados,
      pendientes
    };
  } catch (error) {
    console.error('No se pudieron sincronizar los cambios offline:', error.response?.data || error.message);
    return { exito: false, mensaje: 'Los cambios siguen guardados en este dispositivo.' };
  } finally {
    synchronizationInProgress = false;
  }
};

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
    const mensajeError = error.response?.data?.mensaje
      || error.response?.data?.error
      || "No se pudo iniciar sesión. Verifica tu conexión e inténtalo de nuevo.";
    return { exito: false, mensaje: mensajeError };
  }
};

const guardarMovimientoRemotoLegacy = async (datosMovimiento, token) => {
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

const obtenerMovimientosRemotoLegacy = async (token) => {
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

const actualizarMovimientoRemotoLegacy = async (id, datosMovimiento, token) => {
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

const eliminarMovimientoRemotoLegacy = async (id, token) => {
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

const obtenerDashboardRemotoLegacy = async (token) => {
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

const obtenerPresupuestosRemotoLegacy = async (token) => {
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

const obtenerPrestamosRemotoLegacy = async (token) => {
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

export const eliminarPrestamo = async (id, token) => {
  try {
    const respuesta = await axios.delete(`${API_URL}/api/prestamos/${id}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    return { exito: true, mensaje: respuesta.data.mensaje };
  } catch (error) {
    console.error('Error al eliminar préstamo:', error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudo eliminar el préstamo.' };
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

export const actualizarPagoPrestamo = async (id, datos, token) => {
  try {
    const respuesta = await axios.put(`${API_URL}/api/prestamos/pagos/${id}`, datos, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      }
    });
    return { exito: true, pago: respuesta.data.pago };
  } catch (error) {
    console.error('Error al actualizar pago de préstamo:', error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudo actualizar el pago.' };
  }
};

export const eliminarPagoPrestamo = async (id, token) => {
  try {
    const respuesta = await axios.delete(`${API_URL}/api/prestamos/pagos/${id}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    return { exito: true, mensaje: respuesta.data.mensaje };
  } catch (error) {
    console.error('Error al eliminar pago de préstamo:', error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudo eliminar el pago.' };
  }
};

const obtenerMiCuentaRemotoLegacy = async (token) => {
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

const obtenerCuentasFinancierasRemotoLegacy = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/cuentas/financieras`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, ...respuesta.data };
  } catch (error) {
    console.error("Error al consultar cuentas financieras:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "No se pudieron cargar las cuentas." };
  }
};

export const crearCuentaFinanciera = async (datos, token) => {
  try {
    const respuesta = await axios.post(`${API_URL}/api/cuentas/financieras`, datos, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, cuenta: respuesta.data.cuenta };
  } catch (error) {
    return { exito: false, mensaje: error.response?.data?.error || "No se pudo crear la cuenta." };
  }
};

export const actualizarCuentaFinanciera = async (id, datos, token) => {
  try {
    const respuesta = await axios.put(`${API_URL}/api/cuentas/financieras/${id}`, datos, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, cuenta: respuesta.data.cuenta };
  } catch (error) {
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudo actualizar la cuenta.' };
  }
};

export const eliminarCuentaFinanciera = async (id, token) => {
  try {
    const respuesta = await axios.delete(`${API_URL}/api/cuentas/financieras/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, mensaje: respuesta.data.mensaje };
  } catch (error) {
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudo eliminar la cuenta.' };
  }
};

export const ajustarSaldoCuentaFinanciera = async (id, saldoActual, token) => {
  try {
    const respuesta = await axios.put(`${API_URL}/api/cuentas/financieras/${id}/saldo`, { saldoActual }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return { exito: true, cuenta: respuesta.data.cuenta };
  } catch (error) {
    return { exito: false, mensaje: error.response?.data?.error || "No se pudo ajustar el saldo." };
  }
};

const obtenerTransferenciasRemotoLegacy = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/cuentas/financieras/transferencias`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { exito: true, transferencias: respuesta.data.transferencias };
  } catch (error) {
    console.error("Error al consultar transferencias:", error.response?.data || error.message);
    return { exito: false, mensaje: error.response?.data?.error || "No se pudieron cargar las transferencias." };
  }
};

export const crearTransferencia = async (datos, token) => {
  try {
    if (
      !Number.isFinite(Number(datos.amount))
      || Number(datos.amount) <= 0
      || !datos.fromFinancialAccountId
      || !datos.toFinancialAccountId
      || datos.fromFinancialAccountId === datos.toFinancialAccountId
    ) {
      throw new Error('Elige dos cuentas distintas e ingresa un monto válido mayor a cero.');
    }
    if (typeof datos.description !== 'undefined' && (
      typeof datos.description !== 'string' || datos.description.length > 120
    )) {
      throw new Error('El detalle de la transferencia no puede exceder 120 caracteres.');
    }
    const cuentas = (await cacheGet('accounts'))?.cuentas || [];
    const origen = cuentas.find((cuenta) => cuenta.id === datos.fromFinancialAccountId);
    const destino = cuentas.find((cuenta) => cuenta.id === datos.toFinancialAccountId);
    if (!origen || !destino || origen.type === 'DEBITO' || destino.type === 'DEBITO') {
      throw new Error('No se encontraron cuentas válidas guardadas para la transferencia.');
    }
    const id = datos.id || createId();
    const transferencia = {
      ...datos,
      id,
      date: datos.date || new Date().toISOString()
    };
    await enqueueMutation({
      id,
      entity: 'FINANCIAL_ACCOUNT_TRANSFER',
      action: 'CREATE',
      data: transferencia,
      clientTimestamp: transferencia.date
    });
    await guardarTransferenciaLocal(id, transferencia);
    await sincronizarPendientes(token);
    const pendiente = (await getPendingMutations()).some((item) => item.tempId === id);
    const transferencias = await combinarTransferenciasPendientes(
      (await cacheGet('transfers')) || []
    );
    await cacheSet('transfers', transferencias);
    return {
      exito: true,
      transferencia: transferencias.find((item) => item.id === id),
      pendiente
    };
  } catch (error) {
    console.error('No se pudo guardar la transferencia en el dispositivo:', error.message);
    return { exito: false, mensaje: error.message || 'No se pudo registrar la transferencia.' };
  }
};

const obtenerCategoriasRemotoLegacy = async (token) => {
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

export const guardarMovimientoReal = async (datosMovimiento, token) => {
  const id = datosMovimiento.id || createId();
  const datos = { ...datosMovimiento, id, date: datosMovimiento.date || new Date().toISOString() };
  try {
    await encolarMovimiento(id, 'CREATE', datos);
    const sincronizacion = await sincronizarPendientes(token);
    const movimientos = (await cacheGet('transactions')) || [];
    return {
      exito: true,
      data: { movimiento: movimientos.find((movimiento) => movimiento.id === id) },
      sincronizado: sincronizacion.exito && !sincronizacion.pendientes
    };
  } catch (error) {
    console.error('No se pudo guardar el movimiento en el dispositivo:', error.message);
    return { exito: false, mensaje: 'No se pudo guardar el movimiento en este dispositivo.' };
  }
};

export const obtenerMovimientosReal = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/movimientos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const mutaciones = await getPendingMutations();
    const movimientos = mutaciones.length
      ? await combinarMovimientosPendientes(respuesta.data.movimientos, mutaciones)
      : respuesta.data.movimientos;
    await cacheSet('transactions', movimientos);
    return { exito: true, movimientos };
  } catch (error) {
    console.error('Error al consultar movimientos:', error.response?.data || error.message);
    const movimientos = await cacheGet('transactions');
    if (Array.isArray(movimientos)) return { exito: true, movimientos, offline: true };
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudieron cargar los movimientos.' };
  }
};

export const actualizarMovimientoReal = async (id, datosMovimiento, token) => {
  try {
    const datos = { ...datosMovimiento, id };
    await encolarMovimiento(id, 'UPDATE', datos);
    const sincronizacion = await sincronizarPendientes(token);
    const movimientos = (await cacheGet('transactions')) || [];
    return {
      exito: true,
      movimiento: movimientos.find((movimiento) => movimiento.id === id),
      sincronizado: sincronizacion.exito && !sincronizacion.pendientes
    };
  } catch (error) {
    console.error('No se pudo actualizar el movimiento local:', error.message);
    return { exito: false, mensaje: 'No se pudo actualizar el movimiento en este dispositivo.' };
  }
};

export const eliminarMovimientoReal = async (id, token) => {
  try {
    const movimiento = ((await cacheGet('transactions')) || []).find((item) => item.id === id);
    await encolarMovimiento(id, 'DELETE', movimiento || { id });
    const sincronizacion = await sincronizarPendientes(token);
    return {
      exito: true,
      mensaje: 'Movimiento eliminado.',
      sincronizado: sincronizacion.exito && !sincronizacion.pendientes
    };
  } catch (error) {
    console.error('No se pudo eliminar el movimiento local:', error.message);
    return { exito: false, mensaje: 'No se pudo eliminar el movimiento en este dispositivo.' };
  }
};

export const obtenerDashboardReal = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/movimientos/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const mutaciones = await getPendingMutations();
    if (mutaciones.length) {
      const datosLocales = await cacheGet('dashboard');
      if (datosLocales) return { exito: true, datos: datosLocales, offline: true };
    }
    await cacheSet('dashboard', respuesta.data);
    return { exito: true, datos: respuesta.data };
  } catch (error) {
    console.error('Error al consultar Dashboard:', error.response?.data || error.message);
    const datos = await cacheGet('dashboard');
    if (datos) return { exito: true, datos, offline: true };
    return { exito: false, mensaje: 'No se pudo actualizar el balance.' };
  }
};

export const obtenerPresupuestos = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/presupuestos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await cacheSet('budgets', respuesta.data.presupuestos);
    return { exito: true, presupuestos: respuesta.data.presupuestos };
  } catch (error) {
    const presupuestos = await cacheGet('budgets');
    if (Array.isArray(presupuestos)) return { exito: true, presupuestos, offline: true };
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudieron obtener los presupuestos.' };
  }
};

export const obtenerPrestamos = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/prestamos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await cacheSet('loans', respuesta.data);
    return { exito: true, datos: respuesta.data };
  } catch (error) {
    console.error('Error al obtener préstamos:', error.response?.data || error.message);
    const datos = await cacheGet('loans');
    if (datos) return { exito: true, datos, offline: true };
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudieron cargar los préstamos.' };
  }
};

export const obtenerMiCuenta = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/cuentas/mi-cuenta`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await cacheSet('household', respuesta.data.cuenta);
    return { exito: true, datos: respuesta.data.cuenta };
  } catch (error) {
    console.error('Error al consultar cuenta:', error.response?.data || error.message);
    const datos = await cacheGet('household');
    if (datos) return { exito: true, datos, offline: true };
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudo obtener la información de la cuenta.' };
  }
};

export const obtenerCuentasFinancieras = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/cuentas/financieras`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const mutaciones = await getPendingMutations();
    if (mutaciones.length) {
      const datosLocales = await cacheGet('accounts');
      if (datosLocales) return { exito: true, ...datosLocales, offline: true };
    }
    await cacheSet('accounts', respuesta.data);
    return { exito: true, ...respuesta.data };
  } catch (error) {
    console.error('Error al consultar cuentas financieras:', error.response?.data || error.message);
    const datos = await cacheGet('accounts');
    if (datos) return { exito: true, ...datos, offline: true };
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudieron cargar las cuentas.' };
  }
};

export const obtenerTransferencias = async (token, { completo = false } = {}) => {
  try {
    const respuesta = await axios.get(API_URL + '/api/cuentas/financieras/transferencias', {
      headers: { Authorization: 'Bearer ' + token },
      params: completo ? { completo: true } : undefined
    });
    const transferencias = await combinarTransferenciasPendientes(respuesta.data.transferencias);
    await cacheSet('transfers', transferencias);
    return { exito: true, transferencias };
  } catch (error) {
    console.error('Error al consultar transferencias:', error.response?.data || error.message);
    const transferencias = await cacheGet('transfers');
    if (Array.isArray(transferencias)) {
      const transferenciasConPendientes = await combinarTransferenciasPendientes(transferencias);
      return { exito: true, transferencias: transferenciasConPendientes, offline: true };
    }
    return { exito: false, mensaje: error.response?.data?.error || 'No se pudieron cargar las transferencias.' };
  }
};

export const obtenerCategorias = async (token) => {
  try {
    const respuesta = await axios.get(`${API_URL}/api/categorias`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await cacheSet('categories', respuesta.data.categorias);
    return { exito: true, categorias: respuesta.data.categorias };
  } catch (error) {
    const categorias = await cacheGet('categories');
    if (Array.isArray(categorias)) return { exito: true, categorias, offline: true };
    return { exito: false, mensaje: error.response?.data?.error || 'Error al cargar categorías.' };
  }
};

export const prepararDatosOffline = async (token) => {
  const resultados = await Promise.all([
    obtenerDashboardReal(token),
    obtenerMovimientosReal(token),
    obtenerCategorias(token),
    obtenerCuentasFinancieras(token),
    obtenerTransferencias(token),
    obtenerPresupuestos(token),
    obtenerPrestamos(token),
    obtenerMiCuenta(token)
  ]);
  const errores = resultados.filter((resultado) => !resultado.exito);
  if (errores.length) {
    console.error(`${errores.length} sección(es) no pudieron actualizar su caché offline.`);
  }
  return { exito: errores.length === 0, errores: errores.length };
};