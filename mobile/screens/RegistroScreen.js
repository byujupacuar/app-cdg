import React, { useState, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  obtenerCategorias,
  obtenerCuentasFinancieras,
  guardarMovimientoReal,
  obtenerMovimientosReal,
  actualizarMovimientoReal,
  eliminarMovimientoReal
} from '../api';
import { colors } from '../theme';

export default function RegistroScreen({ token, navigation }) {
  const scrollRef = useRef(null);
  const [tipo, setTipo] = useState('GASTO'); // 'GASTO' | 'INGRESO'
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  
  const [categorias, setCategorias] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState(null);
  const [loadingCats, setLoadingCats] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  const cargarMovimientos = async (activa = () => true) => {
    const res = await obtenerMovimientosReal(token);
    if (!activa()) return;

    if (res.exito) {
      setMovimientos(res.movimientos);
    } else {
      Alert.alert("Error", res.mensaje || "No se pudieron cargar los movimientos.");
    }

    setLoadingMovimientos(false);
  };

  useFocusEffect(
    useCallback(() => {
      let activa = true;
      setLoadingCats(true);
      setLoadingMovimientos(true);

      const cargarCategorias = async () => {
        const res = await obtenerCategorias(token);
        if (!activa) return;

        if (res.exito) {
          setCategorias(res.categorias);
          const categoriasTipo = res.categorias.filter(categoria => categoria.type === tipo);
          setCategoriaSeleccionada(actual =>
            categoriasTipo.some(categoria => categoria.name === actual)
              ? actual
              : categoriasTipo[0]?.name || null
          );
        } else {
          Alert.alert("Error", res.mensaje || "No se pudieron cargar las categorías desde la base de datos.");
        }

        setLoadingCats(false);
      };

      const cargarCuentas = async () => {
        const res = await obtenerCuentasFinancieras(token);
        if (!activa) return;
        if (res.exito) {
          setCuentas(res.cuentas);
          setCuentaFinancieraId(actual =>
            res.cuentas.some(cuenta => cuenta.id === actual)
              ? actual
              : res.cuentas[0]?.id || null
          );
        } else {
          Alert.alert("Error", res.mensaje || "No se pudieron cargar las cuentas.");
        }
      };

      cargarCategorias();
      cargarCuentas();
      cargarMovimientos(() => activa);
      return () => {
        activa = false;
      };
    }, [token, tipo])
  );

  const limpiarFormulario = () => {
    setMonto('');
    setDescripcion('');
    setEditandoId(null);
  };

  const handleEditar = (movimiento) => {
    setEditandoId(movimiento.id);
    setMonto(String(movimiento.amount));
    setDescripcion(movimiento.description === 'Sin detalle' ? '' : movimiento.description || '');
    setTipo(movimiento.type);
    setCategoriaSeleccionada(movimiento.category?.name || null);
    setCuentaFinancieraId(movimiento.financialAccountId || movimiento.financialAccount?.id || null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleGuardar = async () => {
    if (!monto || parseFloat(monto) <= 0) {
      Alert.alert("Monto inválido", "Por favor ingresa un monto mayor a cero.");
      return;
    }

    if (!categoriaSeleccionada) {
      Alert.alert("Selecciona categoría", "Debes elegir o crear una categoría primero.");
      return;
    }
    if (!cuentaFinancieraId) {
      Alert.alert("Selecciona una cuenta", "Crea o selecciona una cuenta antes de registrar el movimiento.");
      return;
    }

    setGuardando(true);

    const datosMovimiento = {
      amount: parseFloat(monto),
      type: tipo,
      categoryName: categoriaSeleccionada,
      financialAccountId: cuentaFinancieraId,
      description: descripcion || 'Sin detalle'
    };
    const res = editandoId
      ? await actualizarMovimientoReal(editandoId, datosMovimiento, token)
      : await guardarMovimientoReal(datosMovimiento, token);

    setGuardando(false);

    if (res.exito) {
      Alert.alert(
        "¡Éxito! 🚀",
        editandoId ? "Movimiento actualizado." : `${tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} guardado en PostgreSQL.`
      );
      limpiarFormulario();
      cargarMovimientos();
    } else {
      Alert.alert(editandoId ? "Error al actualizar" : "Error al guardar", res.mensaje);
    }
  };

  const confirmarEliminacion = (movimiento) => {
    Alert.alert(
      "Eliminar movimiento",
      "¿Deseas eliminar este registro? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setEliminandoId(movimiento.id);
            const res = await eliminarMovimientoReal(movimiento.id, token);
            setEliminandoId(null);

            if (!res.exito) {
              Alert.alert("Error al eliminar", res.mensaje);
              return;
            }

            setMovimientos(actuales => actuales.filter(item => item.id !== movimiento.id));
            if (editandoId === movimiento.id) limpiarFormulario();
            Alert.alert("Eliminado", "El movimiento ha sido eliminado.");
          }
        }
      ]
    );
  };

  // Filtrar categorías según el tipo seleccionado (GASTO o INGRESO)
  const categoriasFiltradas = categorias.filter(c => c.type === tipo);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.titulo}>{editandoId ? 'Editar Movimiento' : 'Registro Rápido'}</Text>

      {/* Selector Gasto / Ingreso */}
      <View style={styles.tipoRow}>
        <TouchableOpacity 
          style={[styles.btnTipo, tipo === 'GASTO' && styles.btnGastoActivo]} 
          onPress={() => setTipo('GASTO')}
        >
          <Text style={[styles.txtTipo, tipo === 'GASTO' && styles.txtActivo]}>Gasto</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btnTipo, tipo === 'INGRESO' && styles.btnIngresoActivo]} 
          onPress={() => setTipo('INGRESO')}
        >
          <Text style={[styles.txtTipo, tipo === 'INGRESO' && styles.txtActivo]}>Ingreso</Text>
        </TouchableOpacity>
      </View>

      {/* Input de Monto */}
      <Text style={styles.label}>Monto ($):</Text>
      <TextInput 
        style={styles.inputMonto} 
        placeholder="0.00" 
        keyboardType="numeric" 
        value={monto} 
        onChangeText={setMonto} 
      />

      <View style={styles.etiquetaCuenta}>
        <Text style={styles.label}>Cuenta</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cuentas')}>
          <Text style={styles.linkCuenta}>Administrar</Text>
        </TouchableOpacity>
      </View>
      {cuentas.length === 0 ? (
        <TouchableOpacity style={styles.vacioBox} onPress={() => navigation.navigate('Cuentas')}>
          <Text style={styles.vacioTxt}>No hay cuentas disponibles. Toca aquí para crear una.</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView
          horizontal
          style={styles.categoriasScroll}
          contentContainerStyle={styles.categoriasRow}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {cuentas.map(cuenta => (
            <TouchableOpacity
              key={cuenta.id}
              style={[styles.catCard, cuentaFinancieraId === cuenta.id && styles.catCardSeleccionada]}
              onPress={() => setCuentaFinancieraId(cuenta.id)}
            >
              <Text style={styles.catIcon}>
                {cuenta.type === 'EFECTIVO' ? '◉' : cuenta.type === 'BANCO' ? '▤' : '▣'}
              </Text>
              <Text style={[styles.catName, cuentaFinancieraId === cuenta.id && styles.txtBlanco]}>{cuenta.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Selector de Categorías Dinámicas */}
      <Text style={styles.label}>Categoría</Text>
      {loadingCats ? (
        <ActivityIndicator size="small" color={colors.green700} style={{ marginVertical: 15 }} />
      ) : categoriasFiltradas.length === 0 ? (
        <View style={styles.vacioBox}>
          <Text style={styles.vacioTxt}>
            No hay categorías de {tipo.toLowerCase()} creadas. Ve a la pestaña "Categorías" para agregar una.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          style={styles.categoriasScroll}
          contentContainerStyle={styles.categoriasRow}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {categoriasFiltradas.map((cat) => {
            const esSeleccionada = categoriaSeleccionada === cat.name;
            return (
              <TouchableOpacity 
                key={cat.id} 
                style={[styles.catCard, esSeleccionada && styles.catCardSeleccionada]} 
                onPress={() => setCategoriaSeleccionada(cat.name)}
              >
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={[styles.catName, esSeleccionada && styles.txtBlanco]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Detalle / Descripción */}
      <Text style={styles.label}>Detalle <Text style={styles.labelOptional}>(opcional)</Text></Text>
      <TextInput 
        style={styles.inputDetalle} 
        placeholder="Ej. Almuerzo trabajo, Pago sueldo..." 
        value={descripcion} 
        onChangeText={setDescripcion} 
      />

      {/* Botón Guardar */}
      <TouchableOpacity 
        style={[styles.btnGuardar, guardando && { backgroundColor: '#bdc3c7' }]} 
        onPress={handleGuardar}
        disabled={guardando}
      >
        {guardando ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.btnTexto}>{editandoId ? 'Guardar Cambios' : 'Guardar Movimiento'}</Text>
        )}
      </TouchableOpacity>

      {editandoId && (
        <TouchableOpacity style={styles.btnCancelarEdicion} onPress={limpiarFormulario}>
          <Text style={styles.btnCancelarTexto}>Cancelar edición</Text>
        </TouchableOpacity>
      )}

      <View style={styles.historial}>
        <Text style={styles.tituloHistorial}>Movimientos registrados</Text>
        {loadingMovimientos ? (
          <ActivityIndicator size="small" color={colors.green700} style={{ marginVertical: 15 }} />
        ) : movimientos.length === 0 ? (
          <Text style={styles.vacioTxt}>Todavía no tienes movimientos registrados.</Text>
        ) : (
          movimientos.map((movimiento) => (
            <View key={movimiento.id} style={styles.movimientoCard}>
              <View style={styles.movimientoDetalle}>
                <Text style={styles.movimientoCategoria}>
                  {movimiento.category?.icon || '🏷️'} {movimiento.category?.name || 'General'}
                </Text>
                <Text style={styles.movimientoDescripcion}>
                  {movimiento.description || 'Sin detalle'}
                </Text>
                <Text style={styles.movimientoFecha}>
                  {movimiento.financialAccount?.name || 'Sin cuenta'} · {movimiento.date ? new Date(movimiento.date).toLocaleDateString() : ''}
                </Text>
              </View>
              <View style={styles.movimientoAcciones}>
                <Text style={[
                  styles.movimientoMonto,
                  { color: movimiento.type === 'INGRESO' ? colors.green700 : colors.red }
                ]}>
                  {movimiento.type === 'INGRESO' ? '+' : '-'}${Number(movimiento.amount).toFixed(2)}
                </Text>
                <View style={styles.botonesMovimiento}>
                  <TouchableOpacity
                    style={styles.btnEditar}
                    onPress={() => handleEditar(movimiento)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar movimiento de ${movimiento.category?.name || 'categoría general'}`}
                  >
                    <Text style={styles.btnEditarTexto}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnEliminar}
                    onPress={() => confirmarEliminacion(movimiento)}
                    disabled={eliminandoId === movimiento.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar movimiento de ${movimiento.category?.name || 'categoría general'}`}
                  >
                    {eliminandoId === movimiento.id
                      ? <ActivityIndicator size="small" color={colors.red} />
                      : <Text style={styles.btnEliminarTexto}>Eliminar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1 },
  content: { padding: 18, paddingTop: 22, paddingBottom: 32 },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.green950, letterSpacing: -0.4, marginBottom: 18 },
  tipoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, backgroundColor: '#edf1ed', borderRadius: 11, padding: 4 },
  btnTipo: { flex: 1, padding: 11, borderRadius: 8, backgroundColor: 'transparent', alignItems: 'center', marginHorizontal: 2 },
  btnGastoActivo: { backgroundColor: colors.white, elevation: 1 },
  btnIngresoActivo: { backgroundColor: colors.white, elevation: 1 },
  txtTipo: { fontSize: 13, fontWeight: '700', color: colors.muted },
  txtActivo: { color: colors.green800 },
  label: { fontSize: 12, fontWeight: '700', color: '#5f6d64', marginBottom: 7, marginTop: 10 },
  labelOptional: { color: '#9aa69f', fontWeight: '400' },
  etiquetaCuenta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  linkCuenta: { color: colors.green800, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  inputMonto: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 23, fontWeight: '700', color: colors.green950 },
  categoriasScroll: { flexGrow: 0, marginVertical: 3 },
  categoriasRow: { paddingVertical: 4 },
  catCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center', marginRight: 8 },
  catCardSeleccionada: { backgroundColor: colors.green100, borderColor: '#83ac91' },
  catIcon: { fontSize: 17, marginBottom: 2 },
  catName: { fontSize: 11, fontWeight: '700', color: colors.ink },
  vacioBox: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 14, borderRadius: 10, marginVertical: 8, alignItems: 'center' },
  vacioTxt: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  inputDetalle: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 14, color: colors.ink, marginBottom: 17 },
  btnGuardar: { backgroundColor: colors.green800, padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  btnTexto: { color: colors.white, fontSize: 14, fontWeight: '700' },
  btnCancelarEdicion: { alignItems: 'center', padding: 12, marginTop: -14, marginBottom: 16 },
  btnCancelarTexto: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  historial: { marginTop: 8 },
  tituloHistorial: { fontSize: 18, fontWeight: '700', color: colors.green950, marginBottom: 10 },
  movimientoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 9 },
  movimientoDetalle: { flex: 1, marginRight: 8 },
  movimientoCategoria: { fontSize: 13, fontWeight: '700', color: colors.ink },
  movimientoDescripcion: { fontSize: 11, color: colors.muted, marginTop: 3 },
  movimientoFecha: { fontSize: 10, color: colors.muted, marginTop: 4 },
  movimientoAcciones: { alignItems: 'flex-end' },
  movimientoMonto: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  botonesMovimiento: { flexDirection: 'row', alignItems: 'center' },
  btnEditar: { paddingHorizontal: 9, paddingVertical: 6, backgroundColor: colors.green100, borderRadius: 7, marginRight: 6 },
  btnEditarTexto: { color: colors.green800, fontSize: 10, fontWeight: '700' },
  btnEliminar: { minWidth: 54, alignItems: 'center', paddingHorizontal: 7, paddingVertical: 6, backgroundColor: colors.redSoft, borderRadius: 7 },
  btnEliminarTexto: { color: colors.red, fontSize: 10, fontWeight: '700' }
});