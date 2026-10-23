import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  obtenerPrestamos,
  crearPrestamo,
  actualizarPlanPrestamo,
  eliminarPrestamo,
  abonarPrestamo,
  actualizarPagoPrestamo,
  eliminarPagoPrestamo
} from '../api';
import { colors } from '../theme';

const fechaHoy = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

const mostrarFecha = (fecha) => {
  if (!fecha) return '';
  const [year, month, day] = String(fecha).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
};

const fechaDesdeIso = (value) => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const fechaAFormatoIso = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

function CampoFecha({ value, onChange, placeholder, opcional = false, fieldStyle }) {
  const [visible, setVisible] = useState(false);
  const [fechaTemporal, setFechaTemporal] = useState(() => fechaDesdeIso(value));

  const abrirCalendario = () => {
    setFechaTemporal(fechaDesdeIso(value));
    setVisible(true);
  };

  const cambiarFecha = (event, date) => {
    if (Platform.OS !== 'ios') {
      setVisible(false);
      if (event.type === 'set' && date) onChange(fechaAFormatoIso(date));
      return;
    }
    if (date) setFechaTemporal(date);
  };

  return (
    <>
      <View style={[styles.dateFieldRow, fieldStyle]}>
        <TouchableOpacity
          style={[styles.input, styles.dateInput, opcional && value && styles.dateInputOptional]}
          onPress={abrirCalendario}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
        >
          <Text style={value ? styles.dateValue : styles.datePlaceholder}>
            {value ? mostrarFecha(value) : placeholder}
          </Text>
          <Text style={styles.dateIcon}>▦</Text>
        </TouchableOpacity>
        {opcional && value && Platform.OS !== 'ios' && (
          <TouchableOpacity style={styles.dateClear} onPress={() => onChange('')}>
            <Text style={styles.dateClearText}>Quitar</Text>
          </TouchableOpacity>
        )}
      </View>
      {Platform.OS === 'ios' ? (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.datePickerCard}>
              <DateTimePicker
                value={fechaTemporal}
                mode="date"
                display="spinner"
                onChange={cambiarFecha}
                locale="es"
              />
              {opcional && (
                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => {
                    onChange('');
                    setVisible(false);
                  }}
                >
                  <Text style={styles.txtCancelar}>Quitar fecha</Text>
                </TouchableOpacity>
              )}
              <View style={styles.datePickerActions}>
                <TouchableOpacity style={styles.btnCancelar} onPress={() => setVisible(false)}>
                  <Text style={styles.txtCancelar}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerConfirm}
                  onPress={() => {
                    onChange(fechaAFormatoIso(fechaTemporal));
                    setVisible(false);
                  }}
                >
                  <Text style={styles.btnTexto}>Aceptar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : visible ? (
        <DateTimePicker
          value={fechaTemporal}
          mode="date"
          display="default"
          onChange={cambiarFecha}
        />
      ) : null}
    </>
  );
}

export default function PrestamosScreen({ token }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabTipo, setTabTipo] = useState('OTORGADO'); // 'OTORGADO' (Te deben) | 'RECIBIDO' (Debes)
  const [totales, setTotales] = useState({ totalPorCobrar: 0, totalPorPagar: 0 });
  const [prestamos, setPrestamos] = useState([]);

  // Modal Crear Préstamo
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [contacto, setContacto] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [fechaPrestamo, setFechaPrestamo] = useState(fechaHoy);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [cuotasNuevas, setCuotasNuevas] = useState([]);
  const [tipoNuevo, setTipoNuevo] = useState('OTORGADO');

  // Modal Abonar
  const [modalAbonarVisible, setModalAbonarVisible] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [fechaPago, setFechaPago] = useState(fechaHoy);
  const [pagoEditando, setPagoEditando] = useState(null);
  const [montoPagoEditado, setMontoPagoEditado] = useState('');
  const [fechaPagoEditada, setFechaPagoEditada] = useState(fechaHoy);
  const [modalPlanVisible, setModalPlanVisible] = useState(false);
  const [prestamoPlan, setPrestamoPlan] = useState(null);
  const [fechaLimitePlan, setFechaLimitePlan] = useState('');
  const [cuotasPlan, setCuotasPlan] = useState([]);

  const cargarDatos = useCallback(async () => {
    const res = await obtenerPrestamos(token);
    if (res.exito) {
      setTotales(res.datos.totales);
      setPrestamos(res.datos.prestamos);
    }
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => {
    Promise.resolve().then(cargarDatos);
  }, [cargarDatos]);

  const handleCrear = async () => {
    const monto = Number(montoTotal);
    if (!contacto.trim() || !Number.isFinite(monto) || monto <= 0) {
      Alert.alert("Faltan datos", "Ingresa el nombre del contacto y el monto.");
      return;
    }

    const cuotasCompletas = cuotasNuevas.filter((cuota) => cuota.dueDate || cuota.amount);
    if (cuotasCompletas.some((cuota) => !cuota.dueDate || !Number.isFinite(Number(cuota.amount)) || Number(cuota.amount) <= 0) ||
      (cuotasCompletas.length && cuotasCompletas.reduce((sum, cuota) => sum + Math.round(Number(cuota.amount) * 100), 0) !== Math.round(monto * 100))) {
      Alert.alert("Plan de pagos inválido", "Completa la fecha y el monto de cada cuota. La suma de las cuotas debe coincidir con el monto total.");
      return;
    }

    const res = await crearPrestamo({
      contactName: contacto,
      totalAmount: monto,
      type: tipoNuevo,
      loanDate: fechaPrestamo,
      dueDate: fechaVencimiento || null,
      installments: cuotasCompletas.map((cuota) => ({ dueDate: cuota.dueDate, amount: Number(cuota.amount) }))
    }, token);

    if (res.exito) {
      Alert.alert(
        '¡Registrado!',
        tipoNuevo === 'OTORGADO'
          ? 'Préstamo registrado como gasto, pendiente de cobro.'
          : 'Préstamo recibido registrado como ingreso, pendiente de pago.'
      );
      setContacto('');
      setMontoTotal('');
      setFechaPrestamo(fechaHoy());
      setFechaVencimiento('');
      setCuotasNuevas([]);
      setModalCrearVisible(false);
      cargarDatos();
    } else {
      Alert.alert("Error", res.mensaje);
    }
  };

  const abrirPlan = (prestamo) => {
    setPrestamoPlan(prestamo);
    setFechaLimitePlan(prestamo.dueDate ? String(prestamo.dueDate).slice(0, 10) : '');
    setCuotasPlan(prestamo.installments?.length
      ? prestamo.installments.map((cuota) => ({ dueDate: String(cuota.dueDate).slice(0, 10), amount: String(cuota.amount) }))
      : [{ dueDate: fechaHoy(), amount: String(prestamo.totalAmount) }]);
    setModalPlanVisible(true);
  };

  const handleGuardarPlan = async () => {
    const cuotasCompletas = cuotasPlan.filter((cuota) => cuota.dueDate || cuota.amount);
    if (!cuotasCompletas.length || cuotasCompletas.some((cuota) => !cuota.dueDate || !Number.isFinite(Number(cuota.amount)) || Number(cuota.amount) <= 0) ||
      cuotasCompletas.reduce((sum, cuota) => sum + Math.round(Number(cuota.amount) * 100), 0) !== Math.round(Number(prestamoPlan.totalAmount) * 100)) {
      Alert.alert("Plan de pagos inválido", "Completa las fechas e importes. La suma de las cuotas debe coincidir con el monto original del préstamo.");
      return;
    }

    const res = await actualizarPlanPrestamo(prestamoPlan.id, {
      dueDate: fechaLimitePlan || null,
      installments: cuotasCompletas.map((cuota) => ({ dueDate: cuota.dueDate, amount: Number(cuota.amount) }))
    }, token);
    if (res.exito) {
      setModalPlanVisible(false);
      setPrestamoPlan(null);
      cargarDatos();
    } else {
      Alert.alert("Error", res.mensaje);
    }
  };

  const handleAbonar = async () => {
    if (!montoAbono || parseFloat(montoAbono) <= 0) {
      Alert.alert("Monto inválido", "Ingresa un monto de abono mayor a 0.");
      return;
    }

    const res = await abonarPrestamo(prestamoSeleccionado.id, parseFloat(montoAbono), token, fechaPago);
    if (res.exito) {
      Alert.alert(
        '¡Abono registrado!',
        prestamoSeleccionado.type === 'OTORGADO'
          ? 'El pago se registró como ingreso y el saldo pendiente se actualizó.'
          : 'El pago se registró como gasto y el saldo pendiente se actualizó.'
      );
      setMontoAbono('');
      setFechaPago(fechaHoy());
      setModalAbonarVisible(false);
      setPrestamoSeleccionado(null);
      cargarDatos();
    } else {
      Alert.alert("Error", res.mensaje);
    }
  };

  const abrirEditorPago = (pago) => {
    setPagoEditando(pago);
    setMontoPagoEditado(String(pago.amount));
    setFechaPagoEditada(String(pago.date).slice(0, 10));
  };

  const handleActualizarPago = async () => {
    const amount = Number(montoPagoEditado);
    if (!Number.isFinite(amount) || amount <= 0 || !fechaPagoEditada) {
      Alert.alert('Datos inválidos', 'Ingresa un monto mayor que cero y una fecha válida.');
      return;
    }
    const res = await actualizarPagoPrestamo(pagoEditando.id, { amount, date: fechaPagoEditada }, token);
    if (res.exito) {
      setPagoEditando(null);
      cargarDatos();
    } else {
      Alert.alert('Error', res.mensaje);
    }
  };

  const confirmarEliminarPago = (pago) => {
    Alert.alert('Eliminar pago', 'Se actualizará el saldo pendiente del préstamo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const res = await eliminarPagoPrestamo(pago.id, token);
          if (res.exito) cargarDatos();
          else Alert.alert('Error', res.mensaje);
        }
      }
    ]);
  };

  const confirmarEliminarPrestamo = (prestamo) => {
    Alert.alert(
      'Eliminar préstamo',
      `¿Eliminar el préstamo de ${prestamo.contactName}? También se eliminarán sus pagos y movimientos asociados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const res = await eliminarPrestamo(prestamo.id, token);
            if (res.exito) cargarDatos();
            else Alert.alert('Error', res.mensaje);
          }
        }
      ]
    );
  };

  const prestamosFiltrados = prestamos.filter(p => p.type === tabTipo);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.green700} />
        <Text style={styles.cargandoTexto}>Consultando saldos de préstamos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarDatos(); }} />}
      >
        <View style={styles.header}>
          <Text style={styles.titulo}>Préstamos y deudas</Text>
          <Text style={styles.subtitulo}>Lleva el control de lo que debes y te deben</Text>
        </View>
        {/* Tarjetas Resumen */}
        <View style={styles.resumenRow}>
          <View style={[styles.resumenCard, { backgroundColor: colors.green100 }]}>
            <Text style={styles.resumenLabel}>A Favor (Te deben)</Text>
            <Text style={[styles.resumenMonto, { color: colors.green700 }]}>
              ${totales.totalPorCobrar.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.resumenCard, { backgroundColor: colors.redSoft }]}>
            <Text style={styles.resumenLabel}>En Contra (Debes)</Text>
            <Text style={[styles.resumenMonto, { color: colors.red }]}>
              ${totales.totalPorPagar.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Selector Pestaña (Te Deben vs Debes) */}
        <View style={styles.tabSelector}>
          <TouchableOpacity 
            style={[styles.tabBtn, tabTipo === 'OTORGADO' && styles.tabBtnActivo]}
            onPress={() => setTabTipo('OTORGADO')}
          >
            <Text style={[styles.tabTxt, tabTipo === 'OTORGADO' && styles.tabTxtActivo]}>
              🤝 Te Deben ({prestamos.filter(p => p.type === 'OTORGADO').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, tabTipo === 'RECIBIDO' && styles.tabBtnActivo]}
            onPress={() => setTabTipo('RECIBIDO')}
          >
            <Text style={[styles.tabTxt, tabTipo === 'RECIBIDO' && styles.tabTxtActivo]}>
              💳 Debes ({prestamos.filter(p => p.type === 'RECIBIDO').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Préstamos */}
        {prestamosFiltrados.length === 0 ? (
          <View style={styles.vacioCard}>
            <Text style={styles.vacioTexto}>
              {tabTipo === 'OTORGADO' ? 'No has prestado dinero a nadie aún.' : 'No tienes deudas registradas.'}
            </Text>
          </View>
        ) : (
          prestamosFiltrados.map((item) => {
            const porcentajePagado = ((item.totalAmount - item.dueAmount) / item.totalAmount) * 100;
            const estaCompletado = item.dueAmount === 0;
            const pagos = item.payments || [];
            const totalAbonado = Number(item.totalAmount) - Number(item.dueAmount);
            const pagosHistoricos = Math.max(0, totalAbonado - pagos.reduce((suma, pago) => suma + Number(pago.amount), 0));
            const cuotas = item.installments || [];

            return (
              <View key={item.id} style={styles.loanCard}>
                <View style={styles.loanHeader}>
                  <View>
                    <Text style={styles.contactName}>{item.contactName}</Text>
                    <Text style={styles.subtext}>
                      Monto Total: ${item.totalAmount.toFixed(2)}
                    </Text>
                    <Text style={styles.subtext}>Fecha del préstamo: {mostrarFecha(item.loanDate || item.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: estaCompletado ? colors.green700 : colors.amber }]}>
                    <Text style={styles.statusText}>{estaCompletado ? 'LIQUIDADO' : 'PENDIENTE'}</Text>
                  </View>
                </View>

                <View style={styles.fechasPago}>
                  <Text style={styles.historialTitulo}>Seguimiento de fechas</Text>
                  {item.dueDate ? (
                    <Text style={[
                      styles.fechaVencimiento,
                      !estaCompletado && String(item.dueDate).slice(0, 10) < fechaHoy() && styles.textoVencido
                    ]}>
                      Fecha límite: {mostrarFecha(item.dueDate)}{!estaCompletado && String(item.dueDate).slice(0, 10) < fechaHoy() ? ' · VENCIDO' : ''}
                    </Text>
                  ) : (
                    <Text style={styles.sinPagos}>Sin fecha límite general.</Text>
                  )}
                  {cuotas.length ? cuotas.map((cuota) => {
                    const montoPagado = Number(cuota.paidAmount);
                    const pagada = montoPagado >= Number(cuota.amount) - 0.005;
                    const vencida = !pagada && !estaCompletado && String(cuota.dueDate).slice(0, 10) < fechaHoy();
                    const estadoCuota = pagada ? 'Pagada' : montoPagado > 0 ? 'Parcial' : vencida ? 'Vencida' : 'Pendiente';
                    return (
                      <View key={cuota.id} style={styles.pagoFila}>
                        <Text style={[styles.pagoFecha, vencida && styles.textoVencido]}>{mostrarFecha(cuota.dueDate)} · {estadoCuota}</Text>
                        <Text style={styles.pagoMonto}>
                          {montoPagado > 0
                            ? `$${montoPagado.toFixed(2)} de $${Number(cuota.amount).toFixed(2)}`
                            : `$${Number(cuota.amount).toFixed(2)}`}
                        </Text>
                      </View>
                    );
                  }) : <Text style={styles.sinPagos}>No hay cuotas programadas.</Text>}
                  <TouchableOpacity style={styles.botonPlan} onPress={() => abrirPlan(item)}>
                    <Text style={styles.botonPlanTexto}>Programar fechas de pago</Text>
                  </TouchableOpacity>
                </View>

                {/* Barra Amortización */}
                <View style={styles.trackBar}>
                  <View style={[styles.fillBar, { width: `${porcentajePagado}%`, backgroundColor: colors.green700 }]} />
                </View>

                <View style={styles.loanFooter}>
                  <Text style={styles.dueText}>
                    Saldo Restante: <Text style={styles.dueHighlight}>${item.dueAmount.toFixed(2)}</Text>
                  </Text>
                  {!estaCompletado && (
                    <TouchableOpacity 
                      style={styles.btnAbonar} 
                      onPress={() => {
                        setPrestamoSeleccionado(item);
                        setModalAbonarVisible(true);
                        setFechaPago(fechaHoy());
                      }}
                    >
                      <Text style={styles.btnAbonarTxt}>+ Abonar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.eliminarPrestamo} onPress={() => confirmarEliminarPrestamo(item)}>
                  <Text style={[styles.pagoAccion, styles.pagoEliminar]}>Eliminar préstamo</Text>
                </TouchableOpacity>
                <View style={styles.historialPagos}>
                  <Text style={styles.historialTitulo}>Historial de pagos</Text>
                  {pagosHistoricos > 0.005 && (
                    <Text style={styles.pagoAnterior}>
                      Pagos anteriores sin fecha registrada: ${pagosHistoricos.toFixed(2)}
                    </Text>
                  )}
                  {pagos.length === 0 && pagosHistoricos <= 0.005 ? (
                    <Text style={styles.sinPagos}>Aún no hay pagos registrados.</Text>
                  ) : pagos.map((pago) => (
                    <View key={pago.id} style={styles.pagoItem}>
                      <View style={styles.pagoFila}>
                        <Text style={styles.pagoFecha}>{mostrarFecha(pago.date)}</Text>
                        <Text style={styles.pagoMonto}>${Number(pago.amount).toFixed(2)}</Text>
                      </View>
                      <View style={styles.pagoAcciones}>
                        <TouchableOpacity onPress={() => abrirEditorPago(pago)}>
                          <Text style={styles.pagoAccion}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmarEliminarPago(pago)}>
                          <Text style={[styles.pagoAccion, styles.pagoEliminar]}>Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Botón Flotante */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalCrearVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Modal Crear Préstamo */}
      <Modal visible={modalCrearVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Nuevo Registro de Préstamo</Text>

            <View style={styles.tipoSelectorModal}>
              <TouchableOpacity 
                style={[styles.btnTipoModal, tipoNuevo === 'OTORGADO' && { backgroundColor: colors.green800 }]}
                onPress={() => setTipoNuevo('OTORGADO')}
              >
                <Text style={styles.txtTipoModal}>Presté (Te deben)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btnTipoModal, tipoNuevo === 'RECIBIDO' && { backgroundColor: colors.red }]}
                onPress={() => setTipoNuevo('RECIBIDO')}
              >
                <Text style={styles.txtTipoModal}>Me prestaron (Debes)</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Contacto / Persona:</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ej. Carlos Mendoza, Banco X" 
              value={contacto} 
              onChangeText={setContacto} 
            />

            <Text style={styles.label}>Monto Total ($):</Text>
            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              keyboardType="numeric" 
              value={montoTotal} 
              onChangeText={setMontoTotal} 
            />

            <Text style={styles.label}>Fecha del préstamo:</Text>
            <CampoFecha
              value={fechaPrestamo}
              onChange={setFechaPrestamo}
              placeholder="Selecciona la fecha"
            />

            <Text style={styles.label}>Fecha límite general (opcional):</Text>
            <CampoFecha
              value={fechaVencimiento}
              onChange={setFechaVencimiento}
              placeholder="Selecciona una fecha"
              opcional
            />
            <Text style={styles.label}>Cuotas mensuales (opcional):</Text>
            {cuotasNuevas.map((cuota, index) => (
              <View key={`nueva-cuota-${index}`} style={styles.cuotaEditor}>
                <CampoFecha
                  value={cuota.dueDate}
                  onChange={(value) => setCuotasNuevas((actuales) => actuales.map((actual, i) => i === index ? { ...actual, dueDate: value } : actual))}
                  placeholder="Fecha de cuota"
                  fieldStyle={styles.cuotaFecha}
                />
                <TextInput
                  style={[styles.input, styles.cuotaMontoInput]}
                  placeholder="Monto"
                  keyboardType="numeric"
                  value={cuota.amount}
                  onChangeText={(value) => setCuotasNuevas((actuales) => actuales.map((actual, i) => i === index ? { ...actual, amount: value } : actual))}
                />
                <TouchableOpacity onPress={() => setCuotasNuevas((actuales) => actuales.filter((_, i) => i !== index))}>
                  <Text style={styles.quitarCuota}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.botonPlan} onPress={() => setCuotasNuevas((actuales) => [...actuales, { dueDate: fechaHoy(), amount: '' }])}>
              <Text style={styles.botonPlanTexto}>+ Agregar cuota</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnGuardar} onPress={handleCrear}>
              <Text style={styles.btnTexto}>Guardar Préstamo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalCrearVisible(false)}>
              <Text style={styles.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={modalPlanVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitulo}>Plan de pagos · {prestamoPlan?.contactName}</Text>
              <Text style={styles.subtextModal}>Las cuotas deben sumar ${Number(prestamoPlan?.totalAmount || 0).toFixed(2)}.</Text>
              <Text style={styles.label}>Fecha límite general (opcional):</Text>
              <CampoFecha
                value={fechaLimitePlan}
                onChange={setFechaLimitePlan}
                placeholder="Selecciona una fecha"
                opcional
              />
              <Text style={styles.label}>Cuotas mensuales:</Text>
              {cuotasPlan.map((cuota, index) => (
                <View key={`plan-cuota-${index}`} style={styles.cuotaEditor}>
                  <CampoFecha
                    value={cuota.dueDate}
                    onChange={(value) => setCuotasPlan((actuales) => actuales.map((actual, i) => i === index ? { ...actual, dueDate: value } : actual))}
                    placeholder="Fecha de cuota"
                    fieldStyle={styles.cuotaFecha}
                  />
                  <TextInput
                    style={[styles.input, styles.cuotaMontoInput]}
                    placeholder="Monto"
                    keyboardType="numeric"
                    value={cuota.amount}
                    onChangeText={(value) => setCuotasPlan((actuales) => actuales.map((actual, i) => i === index ? { ...actual, amount: value } : actual))}
                  />
                  <TouchableOpacity onPress={() => setCuotasPlan((actuales) => actuales.filter((_, i) => i !== index))}>
                    <Text style={styles.quitarCuota}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.botonPlan} onPress={() => setCuotasPlan((actuales) => [...actuales, { dueDate: fechaHoy(), amount: '' }])}>
                <Text style={styles.botonPlanTexto}>+ Agregar cuota</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarPlan}>
                <Text style={styles.btnTexto}>Guardar plan de pagos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalPlanVisible(false)}>
                <Text style={styles.txtCancelar}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Abonar */}
      <Modal visible={modalAbonarVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Abonar a {prestamoSeleccionado?.contactName}</Text>
            <Text style={styles.subtextModal}>Saldo Pendiente: ${prestamoSeleccionado?.dueAmount.toFixed(2)}</Text>

            <Text style={styles.label}>Monto a Abonar ($):</Text>
            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              keyboardType="numeric" 
              value={montoAbono} 
              onChangeText={setMontoAbono} 
            />

            <Text style={styles.label}>Fecha del pago:</Text>
            <CampoFecha
              value={fechaPago}
              onChange={setFechaPago}
              placeholder="Selecciona la fecha"
            />

            <TouchableOpacity style={styles.btnGuardar} onPress={handleAbonar}>
              <Text style={styles.btnTexto}>Registrar Abono</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalAbonarVisible(false)}>
              <Text style={styles.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={Boolean(pagoEditando)} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Editar pago</Text>
            <Text style={styles.label}>Monto del pago ($):</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={montoPagoEditado}
              onChangeText={setMontoPagoEditado}
            />
            <Text style={styles.label}>Fecha del pago:</Text>
            <CampoFecha
              value={fechaPagoEditada}
              onChange={setFechaPagoEditada}
              placeholder="Selecciona la fecha"
            />
            <TouchableOpacity style={styles.btnGuardar} onPress={handleActualizarPago}>
              <Text style={styles.btnTexto}>Guardar cambios</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancelar} onPress={() => setPagoEditando(null)}>
              <Text style={styles.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 22 },
  header: { marginBottom: 16 },
  titulo: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  subtitulo: { color: colors.muted, fontSize: 12, marginTop: 4 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas },
  cargandoTexto: { marginTop: 10, color: colors.muted, fontSize: 13 },
  resumenRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  resumenCard: { width: '48%', padding: 15, borderRadius: 16, alignItems: 'center' },
  resumenLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, marginBottom: 5 },
  resumenMonto: { fontSize: 19, fontWeight: '700' },
  tabSelector: { flexDirection: 'row', backgroundColor: '#edf1ed', borderRadius: 10, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 7 },
  tabBtnActivo: { backgroundColor: colors.white, elevation: 1 },
  tabTxt: { fontSize: 11, fontWeight: '700', color: colors.muted },
  tabTxtActivo: { color: colors.green800 },
  loanCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 11, elevation: 0 },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  contactName: { fontSize: 15, fontWeight: '700', color: colors.green950 },
  subtext: { fontSize: 11, color: colors.muted, marginTop: 3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  trackBar: { height: 7, backgroundColor: '#edf1ed', borderRadius: 4, overflow: 'hidden', marginVertical: 10 },
  fillBar: { height: '100%' },
  loanFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  eliminarPrestamo: { alignSelf: 'flex-end', paddingVertical: 7 },
  dueText: { fontSize: 12, color: colors.muted },
  dueHighlight: { fontWeight: '700', color: colors.ink },
  btnAbonar: { backgroundColor: colors.green800, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8 },
  btnAbonarTxt: { color: colors.white, fontWeight: '700', fontSize: 11 },
  fechasPago: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 12, paddingTop: 10 },
  fechaVencimiento: { color: colors.ink, fontSize: 11, marginBottom: 5 },
  textoVencido: { color: colors.red, fontWeight: '700' },
  botonPlan: { alignSelf: 'flex-start', paddingVertical: 6 },
  botonPlanTexto: { color: colors.green800, fontSize: 11, fontWeight: '700' },
  cuotaEditor: { flexDirection: 'row', alignItems: 'center' },
  cuotaInput: { flex: 1, marginRight: 5 },
  cuotaMontoInput: { width: 86, marginRight: 5 },
  dateFieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  dateInput: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  dateInputOptional: { marginRight: 8 },
  cuotaFecha: { flex: 1, marginRight: 5 },
  dateValue: { color: colors.ink, fontSize: 14 },
  datePlaceholder: { color: colors.muted, fontSize: 14 },
  dateIcon: { color: colors.green800, fontSize: 18, fontWeight: '700' },
  dateClear: { paddingHorizontal: 6, paddingVertical: 8 },
  dateClearText: { color: colors.red, fontSize: 11, fontWeight: '700' },
  datePickerCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 17, padding: 16 },
  datePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  datePickerConfirm: { backgroundColor: colors.green800, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9, marginLeft: 8 },
  quitarCuota: { color: colors.red, fontSize: 23, fontWeight: '700', paddingHorizontal: 5, paddingBottom: 10 },
  historialPagos: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 12, paddingTop: 10 },
  historialTitulo: { color: colors.green950, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  pagoFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  pagoItem: { paddingVertical: 3 },
  pagoAcciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  pagoAccion: { color: colors.green800, fontSize: 11, fontWeight: '700', paddingVertical: 3 },
  pagoEliminar: { color: colors.red },
  pagoFecha: { color: colors.muted, fontSize: 11 },
  pagoMonto: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  pagoAnterior: { color: colors.amber, fontSize: 10, marginBottom: 5 },
  sinPagos: { color: colors.muted, fontSize: 10 },
  vacioCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 22, borderRadius: 13, alignItems: 'center', marginTop: 10 },
  vacioTexto: { color: colors.muted, fontSize: 12 },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: colors.blue700, width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  fabIcon: { color: colors.white, fontSize: 28, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,37,84,0.28)', justifyContent: 'center', padding: 18 },
  keyboardContainer: { flex: 1, justifyContent: 'center' },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalContent: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 17, padding: 22 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: colors.green950, marginBottom: 14 },
  subtextModal: { color: colors.muted, marginBottom: 14, fontSize: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#5f6d64', marginBottom: 7 },
  input: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderWidth: 1, padding: 12, borderRadius: 9, fontSize: 14, marginBottom: 14 },
  tipoSelectorModal: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  btnTipoModal: { flex: 1, padding: 11, borderRadius: 9, backgroundColor: '#9aa69f', alignItems: 'center', marginHorizontal: 4 },
  txtTipoModal: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  btnGuardar: { backgroundColor: colors.green800, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnTexto: { color: colors.white, fontWeight: '700', fontSize: 14 },
  btnCancelar: { padding: 10, alignItems: 'center', marginTop: 5 },
  txtCancelar: { color: colors.muted, fontSize: 12, fontWeight: '600' }
});