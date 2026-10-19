import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  actualizarCuentaFinanciera,
  crearCuentaFinanciera,
  eliminarCuentaFinanciera,
  obtenerCuentasFinancieras
} from '../api';
import { colors } from '../theme';

const tiposCuenta = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: '◉' },
  { value: 'BANCO', label: 'Banco', icon: '▤' },
  { value: 'TARJETA', label: 'Tarjeta', icon: '▣' }
];

export default function CuentasScreen({ token }) {
  const [cuentas, setCuentas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('EFECTIVO');
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargarCuentas = useCallback(async () => {
    const res = await obtenerCuentasFinancieras(token);
    if (res.exito) {
      setCuentas(res.cuentas);
      setError('');
    } else {
      setError(res.mensaje);
    }
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargarCuentas();
    }, [cargarCuentas])
  );

  const limpiarFormulario = () => {
    setNombre('');
    setTipo('EFECTIVO');
    setEditandoId(null);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'Escribe un nombre para la cuenta.');
      return;
    }

    setGuardando(true);
    const datos = { name: nombre.trim(), type: tipo };
    const res = editandoId
      ? await actualizarCuentaFinanciera(editandoId, datos, token)
      : await crearCuentaFinanciera(datos, token);
    setGuardando(false);

    if (!res.exito) {
      Alert.alert('No se pudo guardar', res.mensaje);
      return;
    }

    limpiarFormulario();
    await cargarCuentas();
  };

  const handleEditar = (cuenta) => {
    setNombre(cuenta.name);
    setTipo(cuenta.type);
    setEditandoId(cuenta.id);
  };

  const confirmarEliminacion = (cuenta) => {
    Alert.alert(
      'Eliminar cuenta',
      `¿Deseas eliminar “${cuenta.name}”? No se puede eliminar si tiene movimientos asociados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const res = await eliminarCuentaFinanciera(cuenta.id, token);
            if (!res.exito) {
              Alert.alert('No se pudo eliminar', res.mensaje);
              return;
            }
            setCuentas(actuales => actuales.filter(item => item.id !== cuenta.id));
            if (editandoId === cuenta.id) limpiarFormulario();
          }
        }
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={colors.green700} />
        <Text style={styles.subtitulo}>Cargando tus cuentas...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarCuentas(); }} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.titulo}>Cuentas</Text>
        <Text style={styles.subtitulo}>Organiza tu efectivo, bancos y tarjetas.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>{editandoId ? 'Editar cuenta' : 'Crear cuenta'}</Text>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Efectivo, Banco principal..."
          value={nombre}
          onChangeText={setNombre}
          maxLength={60}
        />

        <Text style={styles.label}>Tipo de cuenta</Text>
        <View style={styles.tiposRow}>
          {tiposCuenta.map(opcion => (
            <TouchableOpacity
              key={opcion.value}
              style={[styles.tipoButton, tipo === opcion.value && styles.tipoSeleccionado]}
              onPress={() => setTipo(opcion.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: tipo === opcion.value }}
            >
              <Text style={[styles.tipoIcon, tipo === opcion.value && styles.tipoTextoSeleccionado]}>{opcion.icon}</Text>
              <Text style={[styles.tipoTexto, tipo === opcion.value && styles.tipoTextoSeleccionado]}>{opcion.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.guardarButton} onPress={handleGuardar} disabled={guardando}>
          {guardando
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.guardarTexto}>{editandoId ? 'Guardar cambios' : 'Crear cuenta'}</Text>}
        </TouchableOpacity>
        {editandoId && (
          <TouchableOpacity style={styles.cancelarButton} onPress={limpiarFormulario}>
            <Text style={styles.cancelarTexto}>Cancelar edición</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.listaTitulo}>Mis cuentas ({cuentas.length})</Text>
      {cuentas.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.vacio}>Todavía no tienes cuentas financieras.</Text>
        </View>
      ) : (
        cuentas.map(cuenta => {
          const tipoCuenta = tiposCuenta.find(item => item.value === cuenta.type);
          return (
            <View key={cuenta.id} style={styles.cuentaCard}>
              <View style={styles.cuentaIcono}>
                <Text style={styles.cuentaIconoTexto}>{tipoCuenta?.icon || '▣'}</Text>
              </View>
              <View style={styles.cuentaDatos}>
                <Text style={styles.cuentaNombre}>{cuenta.name}</Text>
                <Text style={styles.cuentaTipo}>{tipoCuenta?.label || cuenta.type}</Text>
              </View>
              <TouchableOpacity onPress={() => handleEditar(cuenta)} style={styles.accionButton}>
                <Text style={styles.editarTexto}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmarEliminacion(cuenta)} style={styles.accionButton}>
                <Text style={styles.eliminarTexto}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingTop: 22, paddingBottom: 32 },
  centro: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center' },
  header: { marginBottom: 18 },
  titulo: { color: colors.green950, fontSize: 22, fontWeight: '700' },
  subtitulo: { color: colors.muted, fontSize: 12, marginTop: 5 },
  error: { backgroundColor: colors.redSoft, borderRadius: 9, color: colors.red, fontSize: 12, marginBottom: 12, padding: 12 },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 14, borderWidth: 1, marginBottom: 18, padding: 16 },
  cardTitulo: { color: colors.green950, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, fontSize: 14, marginBottom: 15, padding: 12 },
  tiposRow: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  tipoButton: { alignItems: 'center', backgroundColor: '#fbfcfb', borderColor: colors.line, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 10 },
  tipoSeleccionado: { backgroundColor: colors.green100, borderColor: colors.green700 },
  tipoIcon: { color: colors.green800, fontSize: 17, marginBottom: 4 },
  tipoTexto: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  tipoTextoSeleccionado: { color: colors.green800 },
  guardarButton: { alignItems: 'center', backgroundColor: colors.green800, borderRadius: 10, justifyContent: 'center', minHeight: 44, padding: 12 },
  guardarTexto: { color: colors.white, fontSize: 13, fontWeight: '700' },
  cancelarButton: { alignItems: 'center', padding: 12 },
  cancelarTexto: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  listaTitulo: { color: colors.green950, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  vacio: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  cuentaCard: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginBottom: 9, padding: 11 },
  cuentaIcono: { alignItems: 'center', backgroundColor: colors.green50, borderRadius: 10, height: 38, justifyContent: 'center', marginRight: 10, width: 38 },
  cuentaIconoTexto: { color: colors.green800, fontSize: 17 },
  cuentaDatos: { flex: 1 },
  cuentaNombre: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  cuentaTipo: { color: colors.muted, fontSize: 10, marginTop: 3 },
  accionButton: { paddingHorizontal: 5, paddingVertical: 8 },
  editarTexto: { color: colors.green800, fontSize: 10, fontWeight: '700' },
  eliminarTexto: { color: colors.red, fontSize: 10, fontWeight: '700' }
});
