import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ajustarSaldoCuentaFinanciera,
  crearCuentaFinanciera,
  crearTransferencia,
  obtenerCuentasFinancieras,
  obtenerTransferencias
} from '../api';
import { colors } from '../theme';

const tipos = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'BANCO', label: 'Banco' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'OTRO', label: 'Otro' }
];

const etiquetaTipo = (tipo) => tipos.find((item) => item.value === tipo)?.label || tipo;
const moneda = (monto) => `$${(Number(monto) || 0).toFixed(2)}`;

export default function CuentasScreen({ token }) {
  const [cuentas, setCuentas] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [totalDisponible, setTotalDisponible] = useState(0);
  const [deudaTarjetas, setDeudaTarjetas] = useState(0);
  const [tipo, setTipo] = useState('EFECTIVO');
  const [tipoPersonalizado, setTipoPersonalizado] = useState('');
  const [bancoVinculadoId, setBancoVinculadoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [cuentaAjustando, setCuentaAjustando] = useState('');
  const [saldoAjustado, setSaldoAjustado] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [montoTransferencia, setMontoTransferencia] = useState('');
  const [detalleTransferencia, setDetalleTransferencia] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = useCallback(async () => {
    const [resumen, historial] = await Promise.all([
      obtenerCuentasFinancieras(token),
      obtenerTransferencias(token)
    ]);
    if (!resumen.exito) {
      Alert.alert('Error', resumen.mensaje || 'No se pudieron cargar las cuentas.');
      return;
    }
    setCuentas(resumen.cuentas || []);
    setTotalDisponible(resumen.totalDisponible || 0);
    setDeudaTarjetas(resumen.deudaTarjetas || 0);
    if (!historial.exito) {
      Alert.alert('Error', historial.mensaje || 'No se pudieron cargar las transferencias.');
    } else {
      setTransferencias(historial.transferencias || []);
    }
    setBancoVinculadoId(resumen.cuentas?.find((cuenta) => cuenta.type === 'BANCO')?.id || '');
    const transferibles = (resumen.cuentas || []).filter((cuenta) => cuenta.type !== 'DEBITO');
    setOrigen(transferibles[0]?.id || '');
    setDestino(transferibles[1]?.id || '');
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let activa = true;
      setCargando(true);
      cargarDatos().finally(() => {
        if (activa) setCargando(false);
      });
      return () => { activa = false; };
    }, [cargarDatos])
  );

  const handleCrearCuenta = async () => {
    const tipoCuenta = tipo === 'OTRO' ? tipoPersonalizado.trim() : tipo;
    if (!nombre.trim() || !tipoCuenta || !Number.isFinite(Number(saldoInicial)) || Number(saldoInicial) < 0) {
      Alert.alert('Datos inválidos', 'Ingresa el nombre, tipo y un saldo inicial válido.');
      return;
    }
    if (tipo === 'DEBITO' && !bancoVinculadoId) {
      Alert.alert('Cuenta bancaria requerida', 'Añade primero una cuenta bancaria para vincular la tarjeta de débito.');
      return;
    }
    setGuardando(true);
    const res = await crearCuentaFinanciera({
      name: nombre.trim(),
      type: tipoCuenta,
      initialBalance: tipo === 'DEBITO' ? 0 : Number(saldoInicial),
      ...(tipo === 'DEBITO' && { linkedFinancialAccountId: bancoVinculadoId })
    }, token);
    setGuardando(false);
    if (!res.exito) {
      Alert.alert('Error', res.mensaje);
      return;
    }
    setNombre('');
    setSaldoInicial('0');
    setTipoPersonalizado('');
    Alert.alert('Cuenta agregada', 'Ya puedes asociarla a tus movimientos.');
    await cargarDatos();
  };

  const handleTransferencia = async () => {
    if (!origen || !destino || origen === destino || Number(montoTransferencia) <= 0) {
      Alert.alert('Datos inválidos', 'Elige dos cuentas distintas e ingresa un monto mayor a cero.');
      return;
    }
    setGuardando(true);
    const res = await crearTransferencia({
      fromFinancialAccountId: origen,
      toFinancialAccountId: destino,
      amount: Number(montoTransferencia),
      description: detalleTransferencia.trim()
    }, token);
    setGuardando(false);
    if (!res.exito) {
      Alert.alert('Error', res.mensaje);
      return;
    }
    setMontoTransferencia('');
    setDetalleTransferencia('');
    Alert.alert('Transferencia registrada', 'Se actualizaron los saldos sin cambiar los ingresos o gastos.');
    await cargarDatos();
  };

  const handleAjustarSaldo = async (cuenta) => {
    if (!Number.isFinite(Number(saldoAjustado)) || Number(saldoAjustado) < 0) {
      Alert.alert('Saldo inválido', 'Ingresa un monto válido igual o mayor a cero.');
      return;
    }
    setGuardando(true);
    const res = await ajustarSaldoCuentaFinanciera(cuenta.id, Number(saldoAjustado), token);
    setGuardando(false);
    if (!res.exito) {
      Alert.alert('Error', res.mensaje);
      return;
    }
    setCuentaAjustando('');
    setSaldoAjustado('');
    await cargarDatos();
  };

  const renderAccountChoices = (seleccionada, onSelect, excluida, soloBancos = false) => (
    <View style={styles.opcionesCuentas}>
      {cuentas.filter((cuenta) => cuenta.id !== excluida && cuenta.type !== 'DEBITO' && (!soloBancos || cuenta.type === 'BANCO')).map((cuenta) => (
        <TouchableOpacity
          key={cuenta.id}
          style={[styles.opcionCuenta, seleccionada === cuenta.id && styles.opcionCuentaActiva]}
          onPress={() => onSelect(cuenta.id)}
        >
          <Text style={[styles.opcionCuentaTexto, seleccionada === cuenta.id && styles.opcionCuentaTextoActivo]}>
            {cuenta.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.titulo}>Cuentas</Text>
      <Text style={styles.intro}>Consulta tu patrimonio y administra tus fuentes de dinero.</Text>

      <View style={styles.resumenRow}>
        <View style={styles.resumenCard}>
          <Text style={styles.resumenLabel}>Liquidez</Text>
          <Text style={styles.resumenMonto}>{moneda(totalDisponible)}</Text>
        </View>
        <View style={styles.resumenCard}>
          <Text style={styles.resumenLabel}>Deuda en tarjetas</Text>
          <Text style={[styles.resumenMonto, styles.deuda]}>{moneda(deudaTarjetas)}</Text>
        </View>
      </View>
      <View style={styles.netWorthCard}>
        <View style={styles.netWorthCopy}>
          <Text style={styles.netWorthLabel}>Patrimonio neto</Text>
          <Text style={styles.netWorthAmount}>{moneda(totalDisponible - deudaTarjetas)}</Text>
        </View>
        <Text style={styles.netWorthIcon}>▣</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.tituloSeccion}>Mis cuentas</Text>
        {cargando ? (
          <ActivityIndicator color={colors.green700} />
        ) : cuentas.length === 0 ? (
          <Text style={styles.textoAyuda}>Todavía no has añadido ninguna cuenta.</Text>
        ) : cuentas.map((cuenta) => (
          <View key={cuenta.id}>
            <View style={styles.filaCuenta}>
              <View style={styles.infoCuenta}>
                <Text style={styles.nombreCuenta}>{cuenta.name}</Text>
                <Text style={styles.tipoCuenta}>
                  {cuenta.esDebitoVinculado ? `Débito · vinculada a ${cuenta.cuentaVinculada}` : etiquetaTipo(cuenta.type)}
                </Text>
              </View>
              <Text style={[styles.saldoCuenta, cuenta.esCredito && styles.deuda]}>
                {moneda(cuenta.esCredito ? cuenta.deuda : cuenta.saldo)}
                {cuenta.esCredito ? ' deuda' : ''}
              </Text>
              {!cuenta.esDebitoVinculado && (
                <TouchableOpacity
                  style={styles.ajustarBoton}
                  onPress={() => {
                    setCuentaAjustando(cuenta.id);
                    setSaldoAjustado(String(cuenta.esCredito ? cuenta.deuda : cuenta.saldo));
                  }}
                >
                  <Text style={styles.ajustarTexto}>Ajustar</Text>
                </TouchableOpacity>
              )}
            </View>
            {cuentaAjustando === cuenta.id && (
              <View style={styles.ajusteSaldo}>
                <Text style={styles.label}>{cuenta.esCredito ? 'Deuda actual' : 'Saldo actual'}</Text>
                <Text style={styles.textoAyuda}>El ajuste no modifica tus movimientos anteriores.</Text>
                <TextInput style={styles.input} value={saldoAjustado} onChangeText={setSaldoAjustado} keyboardType="decimal-pad" />
                <View style={styles.botonesAjuste}>
                  <TouchableOpacity style={styles.boton} onPress={() => handleAjustarSaldo(cuenta)} disabled={guardando}>
                    <Text style={styles.botonTexto}>Guardar saldo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setCuentaAjustando('')}>
                    <Text style={styles.ajustarTexto}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.tituloSeccion}>Añadir cuenta</Text>
        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej. Banco principal" maxLength={60} />
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.opcionesCuentas}>
          {tipos.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.opcionCuenta, tipo === item.value && styles.opcionCuentaActiva]}
              onPress={() => setTipo(item.value)}
            >
              <Text style={[styles.opcionCuentaTexto, tipo === item.value && styles.opcionCuentaTextoActivo]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tipo === 'OTRO' && (
          <>
            <Text style={styles.label}>Tipo personalizado</Text>
            <TextInput style={styles.input} value={tipoPersonalizado} onChangeText={setTipoPersonalizado} placeholder="Ej. Billetera digital" maxLength={30} />
            <Text style={styles.textoAyuda}>Puedes añadir billeteras digitales u otras cuentas.</Text>
          </>
        )}
        {tipo === 'DEBITO' ? (
          cuentas.some((cuenta) => cuenta.type === 'BANCO') ? (
            <>
              <Text style={styles.label}>Cuenta bancaria vinculada</Text>
              {renderAccountChoices(bancoVinculadoId, setBancoVinculadoId, null, true)}
              <Text style={styles.textoAyuda}>La tarjeta usa el saldo del banco y no se suma dos veces.</Text>
            </>
          ) : <Text style={styles.textoAyuda}>Primero añade una cuenta bancaria para vincular la tarjeta.</Text>
        ) : (
          <>
            <Text style={styles.label}>{tipo === 'CREDITO' ? 'Deuda actual al añadirla' : 'Saldo actual al añadirla'}</Text>
            <TextInput style={styles.input} value={saldoInicial} onChangeText={setSaldoInicial} keyboardType="decimal-pad" />
            <Text style={styles.textoAyuda}>
              {tipo === 'CREDITO'
                ? 'Escribe cuánto debes hoy. Las compras aumentan la deuda y los pagos la reducen.'
                : 'Escribe cuánto dinero tienes hoy en esta cuenta.'}
            </Text>
          </>
        )}
        <TouchableOpacity style={styles.boton} onPress={handleCrearCuenta} disabled={guardando || (tipo === 'DEBITO' && !bancoVinculadoId)}>
          {guardando ? <ActivityIndicator color={colors.white} /> : <Text style={styles.botonTexto}>Añadir cuenta</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.tituloSeccion}>Transferir entre cuentas</Text>
        {cuentas.filter((cuenta) => cuenta.type !== 'DEBITO').length < 2 ? (
          <Text style={styles.textoAyuda}>Añade al menos dos cuentas para transferir dinero.</Text>
        ) : (
          <>
            <Text style={styles.label}>Desde</Text>
            {renderAccountChoices(origen, (id) => {
              setOrigen(id);
              if (id === destino) setDestino(cuentas.find((cuenta) => cuenta.id !== id && cuenta.type !== 'DEBITO')?.id || '');
            })}
            <Text style={styles.label}>Hacia</Text>
            {renderAccountChoices(destino, setDestino, origen)}
            <Text style={styles.label}>Monto</Text>
            <TextInput style={styles.input} value={montoTransferencia} onChangeText={setMontoTransferencia} keyboardType="decimal-pad" placeholder="0.00" />
            <Text style={styles.label}>Detalle (opcional)</Text>
            <TextInput style={styles.input} value={detalleTransferencia} onChangeText={setDetalleTransferencia} maxLength={120} placeholder="Ej. Retiro de efectivo" />
            <Text style={styles.textoAyuda}>No se contará como ingreso ni gasto.</Text>
            <TouchableOpacity style={styles.boton} onPress={handleTransferencia} disabled={guardando}>
              {guardando ? <ActivityIndicator color={colors.white} /> : <Text style={styles.botonTexto}>Registrar transferencia</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.tituloSeccion}>Transferencias recientes</Text>
        {transferencias.length === 0 ? (
          <Text style={styles.textoAyuda}>Todavía no hay transferencias.</Text>
        ) : transferencias.map((transferencia) => (
          <View key={transferencia.id} style={styles.filaCuenta}>
            <View style={styles.infoCuenta}>
              <Text style={styles.nombreCuenta}>{transferencia.fromFinancialAccount.name} → {transferencia.toFinancialAccount.name}</Text>
              <Text style={styles.tipoCuenta}>{transferencia.description || new Date(transferencia.date).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.saldoCuenta}>{moneda(transferencia.amount)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingTop: 22, paddingBottom: 32 },
  titulo: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  intro: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 15 },
  resumenRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  resumenCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 15, flex: 1, padding: 14 },
  resumenLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  resumenMonto: { color: colors.blue700, fontSize: 17, fontWeight: '800', marginTop: 5 },
  netWorthCard: { backgroundColor: colors.blue700, borderRadius: 17, padding: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  netWorthCopy: { flex: 1 },
  netWorthLabel: { color: '#dbeafe', fontSize: 11, fontWeight: '600' },
  netWorthAmount: { color: colors.white, fontSize: 23, fontWeight: '800', marginTop: 5 },
  netWorthIcon: { color: 'rgba(255,255,255,0.8)', fontSize: 28 },
  deuda: { color: colors.red },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 17, marginBottom: 12, padding: 16 },
  tituloSeccion: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  filaCuenta: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 10 },
  infoCuenta: { flex: 1 },
  nombreCuenta: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  tipoCuenta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  saldoCuenta: { color: colors.blue700, fontSize: 12, fontWeight: '700' },
  ajustarBoton: { marginLeft: 8, padding: 5 },
  ajustarTexto: { color: colors.blue700, fontSize: 10, fontWeight: '700' },
  ajusteSaldo: { borderBottomColor: colors.line, borderBottomWidth: 1, paddingBottom: 11 },
  botonesAjuste: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginBottom: 6, marginTop: 7 },
  input: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, fontSize: 13, marginBottom: 7, paddingHorizontal: 11, paddingVertical: 10 },
  textoAyuda: { color: colors.muted, fontSize: 10, lineHeight: 15, marginBottom: 8 },
  opcionesCuentas: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 5 },
  opcionCuenta: { backgroundColor: colors.canvas, borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  opcionCuentaActiva: { backgroundColor: colors.blue50, borderColor: colors.blue700 },
  opcionCuentaTexto: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  opcionCuentaTextoActivo: { color: colors.blue700 },
  boton: { alignItems: 'center', backgroundColor: colors.blue700, borderRadius: 11, marginTop: 7, padding: 12 },
  botonTexto: { color: colors.white, fontSize: 12, fontWeight: '700' }
});
