import React, { useState, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Share
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  obtenerCategorias,
  obtenerCuentasFinancieras,
  guardarMovimientoReal,
  obtenerMovimientosReal,
  obtenerTransferencias,
  actualizarMovimientoReal,
  eliminarMovimientoReal
} from '../api';
import { colors } from '../theme';

export default function RegistroScreen({ token, navigation, route }) {
  const scrollRef = useRef(null);
  const [tipo, setTipo] = useState('GASTO'); // 'GASTO' | 'INGRESO'
  const [showForm, setShowForm] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroCuenta, setFiltroCuenta] = useState(null);
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  
  const [categorias, setCategorias] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState(null);
  const [loadingCats, setLoadingCats] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  const cargarMovimientos = useCallback(async (activa = () => true) => {
    const res = await obtenerMovimientosReal(token);
    if (!activa()) return;

    if (res.exito) {
      setMovimientos(res.movimientos);
    } else {
      Alert.alert("Error", res.mensaje || "No se pudieron cargar los movimientos.");
    }

    setLoadingMovimientos(false);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let activa = true;
      if (route?.params?.abrirNuevo) {
        setShowForm(true);
        if (route.params.tipoInicial) setTipo(route.params.tipoInicial);
        navigation.setParams({ abrirNuevo: false, tipoInicial: undefined });
      }
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
          setCuentas(res.cuentas || []);
          setCuentaFinancieraId((actual) =>
            res.cuentas?.some((cuenta) => cuenta.id === actual)
              ? actual
              : res.cuentas?.[0]?.id || null
          );
        } else {
          Alert.alert("Error", res.mensaje || "No se pudieron cargar las cuentas.");
        }
      };

      const cargarTransferencias = async () => {
        const res = await obtenerTransferencias(token, { completo: true });
        if (!activa) return;
        if (res.exito) {
          setTransferencias(res.transferencias || []);
        } else {
          Alert.alert("Error", res.mensaje || "No se pudieron cargar las transferencias para exportar.");
        }
      };

      cargarCategorias();
      cargarCuentas();
      cargarTransferencias();
      cargarMovimientos(() => activa);
      return () => {
        activa = false;
      };
    }, [token, tipo, route, navigation, cargarMovimientos])
  );

  const limpiarFormulario = () => {
    setMonto('');
    setDescripcion('');
    setEditandoId(null);
  };

  const handleEditar = (movimiento) => {
    setShowForm(true);
    setEditandoId(movimiento.id);
    setMonto(String(movimiento.amount));
    setDescripcion(movimiento.description === 'Sin detalle' ? '' : movimiento.description || '');
    setTipo(movimiento.type);
    setCategoriaSeleccionada(movimiento.category?.name || null);
    setCuentaFinancieraId(movimiento.financialAccountId || null);
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
      Alert.alert("Selecciona una cuenta", "Añade una cuenta antes de registrar el movimiento.");
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
        res.sincronizado
          ? (editandoId ? "Movimiento actualizado." : `${tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} guardado.`)
          : "Movimiento guardado en este dispositivo. Se sincronizará cuando vuelva la conexión."
      );
      limpiarFormulario();
      setShowForm(false);
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
            Alert.alert(
              "Eliminado",
              res.sincronizado
                ? "El movimiento ha sido eliminado."
                : "El movimiento se eliminó en este dispositivo y se sincronizará cuando vuelva la conexión."
            );
          }
        }
      ]
    );
  };

  // Filtrar categorías según el tipo seleccionado (GASTO o INGRESO)
  const categoriasFiltradas = categorias.filter(c => c.type === tipo);
  const movimientosFiltrados = movimientos
    .filter((movimiento) => filtroTipo === 'TODOS' || movimiento.type === filtroTipo)
    .filter((movimiento) => !filtroCuenta || movimiento.financialAccountId === filtroCuenta || movimiento.financialAccount?.id === filtroCuenta)
    .filter((movimiento) => {
      const consulta = busqueda.trim().toLocaleLowerCase();
      if (!consulta) return true;
      return [
        movimiento.description,
        movimiento.category?.name,
        movimiento.financialAccount?.name,
        movimiento.type
      ].some((valor) => String(valor || '').toLocaleLowerCase().includes(consulta));
    });
  const fechaActual = new Date();
  const movimientosPeriodo = movimientosFiltrados.filter((movimiento) => {
    const fecha = new Date(movimiento.date);
    return fecha.getFullYear() === fechaActual.getFullYear() && fecha.getMonth() === fechaActual.getMonth();
  });
  const totalPeriodo = movimientosPeriodo.reduce((total, movimiento) =>
    total + (movimiento.type === 'INGRESO' ? 1 : -1) * Number(movimiento.amount || 0), 0);
  const ingresosPeriodo = movimientosPeriodo.filter((item) => item.type === 'INGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gastosPeriodo = movimientosPeriodo.filter((item) => item.type === 'GASTO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const exportarCsv = async () => {
    const escapar = (valor) => {
      const texto = String(valor ?? '');
      const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
      return `"${seguro.replace(/"/g, '""')}"`;
    };
    const filasDatos = [
      ...movimientosFiltrados.map((item) => [
        item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
        item.type,
        item.category?.name,
        item.description,
        item.financialAccount?.name,
        '',
        '',
        Number(item.amount || 0).toFixed(2)
      ]),
      ...transferencias
        .filter((item) => filtroTipo === 'TODOS')
        .filter((item) => !filtroCuenta
          || item.fromFinancialAccount?.id === filtroCuenta
          || item.toFinancialAccount?.id === filtroCuenta)
        .filter((item) => {
          const consulta = busqueda.trim().toLocaleLowerCase();
          if (!consulta) return true;
          return [
            item.description,
            item.fromFinancialAccount?.name,
            item.toFinancialAccount?.name,
            'transferencia'
          ].some((valor) => String(valor || '').toLocaleLowerCase().includes(consulta));
        })
        .map((item) => [
          item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
          'Transferencia',
          '',
          item.description || 'Sin detalle',
          '',
          item.fromFinancialAccount?.name || '',
          item.toFinancialAccount?.name || '',
          Number(item.amount || 0).toFixed(2)
        ])
    ].sort((a, b) => b[0].localeCompare(a[0]));
    const filas = [
      ['Fecha', 'Tipo', 'Categoría', 'Detalle', 'Cuenta', 'Cuenta de origen', 'Cuenta de destino', 'Monto'],
      ...filasDatos
    ];
    try {
      await Share.share({
        title: 'Exportar movimientos Nivia',
        message: filas.map((fila) => fila.map(escapar).join(',')).join('\n')
      });
    } catch {
      Alert.alert('No se pudo exportar', 'Intenta compartir el archivo de nuevo.');
    }
  };

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
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.titulo}>Movimientos</Text>
          <Text style={styles.subtitulo}>Todos tus ingresos y gastos</Text>
        </View>
        <TouchableOpacity style={styles.nuevoButton} onPress={() => { limpiarFormulario(); setShowForm(true); }}>
          <Text style={styles.nuevoButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.periodCard}>
        <Text style={styles.periodLabel}>Balance de {fechaActual.toLocaleDateString('es', { month: 'long' })}</Text>
        <Text style={styles.periodAmount}>{totalPeriodo < 0 ? '−' : ''}${Math.abs(totalPeriodo).toFixed(2)}</Text>
        <View style={styles.periodTotals}>
          <Text style={styles.periodIncome}>↑ ${ingresosPeriodo.toFixed(2)} ingresos</Text>
          <Text style={styles.periodExpense}>↓ ${gastosPeriodo.toFixed(2)} gastos</Text>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Buscar por detalle, categoría o cuenta"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Buscar movimientos"
      />
      <View style={styles.filtersRow}>
        {['TODOS', 'GASTO', 'INGRESO'].map((item) => (
          <TouchableOpacity key={item} onPress={() => setFiltroTipo(item)} style={[styles.filterChip, filtroTipo === item && styles.filterChipActive]}>
            <Text style={[styles.filterText, filtroTipo === item && styles.filterTextActive]}>{item === 'TODOS' ? 'Todos' : item === 'GASTO' ? 'Gastos' : 'Ingresos'}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={exportarCsv} style={styles.exportButton}>
          <Text style={styles.exportText}>↓ CSV</Text>
        </TouchableOpacity>
      </View>
      {cuentas.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountFilters}>
          <TouchableOpacity onPress={() => setFiltroCuenta(null)} style={[styles.filterChip, !filtroCuenta && styles.filterChipActive]}>
            <Text style={[styles.filterText, !filtroCuenta && styles.filterTextActive]}>Todas las cuentas</Text>
          </TouchableOpacity>
          {cuentas.map((cuenta) => (
            <TouchableOpacity key={cuenta.id} onPress={() => setFiltroCuenta(cuenta.id)} style={[styles.filterChip, filtroCuenta === cuenta.id && styles.filterChipActive]}>
              <Text style={[styles.filterText, filtroCuenta === cuenta.id && styles.filterTextActive]}>{cuenta.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {showForm && (
      <View style={styles.formCard}>
      <View style={styles.formHeading}>
        <Text style={styles.formTitle}>{editandoId ? 'Editar movimiento' : 'Nuevo movimiento'}</Text>
        <TouchableOpacity onPress={() => { limpiarFormulario(); setShowForm(false); }}><Text style={styles.linkCuenta}>Cerrar</Text></TouchableOpacity>
      </View>
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
          <Text style={styles.linkCuenta}>Añadir</Text>
        </TouchableOpacity>
      </View>
      {cuentas.length === 0 ? (
        <TouchableOpacity style={styles.vacioBox} onPress={() => navigation.navigate('Cuentas')}>
          <Text style={styles.vacioTxt}>Añade una cuenta para registrar de dónde viene o a dónde va el dinero.</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView
          horizontal
          style={styles.categoriasScroll}
          contentContainerStyle={styles.categoriasRow}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {cuentas.map((cuenta) => (
            <TouchableOpacity
              key={cuenta.id}
              style={[styles.catCard, cuentaFinancieraId === cuenta.id && styles.catCardSeleccionada]}
              onPress={() => setCuentaFinancieraId(cuenta.id)}
            >
              <Text style={[styles.catName, cuentaFinancieraId === cuenta.id && styles.txtBlanco]}>{cuenta.name}</Text>
              <Text style={[styles.tipoCuenta, cuentaFinancieraId === cuenta.id && styles.txtBlanco]}>
                {cuenta.type === 'CREDITO' ? 'Crédito' : cuenta.type === 'EFECTIVO' ? 'Efectivo' : cuenta.type === 'BANCO' ? 'Banco' : cuenta.type === 'DEBITO' ? 'Débito' : cuenta.type}
              </Text>
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
            No hay categorías de {tipo.toLowerCase()} creadas. Ve a la sección Categorías para agregar una.
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
      </View>
      )}

      <View style={styles.historial}>
        <Text style={styles.tituloHistorial}>Historial</Text>
        {loadingMovimientos ? (
          <ActivityIndicator size="small" color={colors.green700} style={{ marginVertical: 15 }} />
        ) : movimientos.length === 0 ? (
          <Text style={styles.vacioTxt}>Todavía no tienes movimientos registrados.</Text>
        ) : movimientosFiltrados.length === 0 ? (
          <Text style={styles.vacioTxt}>No hay movimientos que coincidan con estos filtros.</Text>
        ) : (
          movimientosFiltrados.map((movimiento, index) => {
            const fechaGrupo = movimiento.date
              ? new Date(movimiento.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Sin fecha';
            const fechaAnterior = index > 0 && movimientosFiltrados[index - 1].date
              ? new Date(movimientosFiltrados[index - 1].date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
              : null;
            return (
            <React.Fragment key={movimiento.id}>
            {fechaGrupo !== fechaAnterior && <Text style={styles.dateHeading}>{fechaGrupo}</Text>}
            <View style={styles.movimientoCard}>
              <View style={styles.movimientoDetalle}>
                <Text style={styles.movimientoCategoria}>
                  {movimiento.category?.icon || '🏷️'} {movimiento.category?.name || 'General'}
                </Text>
                <Text style={styles.movimientoDescripcion}>
                  {movimiento.description || 'Sin detalle'}
                </Text>
                <Text style={styles.movimientoFecha}>
                  {movimiento.financialAccount?.name ? `${movimiento.financialAccount.name} · ` : ''}
                  {movimiento.date ? new Date(movimiento.date).toLocaleDateString() : ''}
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
            </React.Fragment>
          )})
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
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  titulo: { fontSize: 23, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  subtitulo: { color: colors.muted, fontSize: 11, marginTop: 4 },
  nuevoButton: { borderRadius: 11, backgroundColor: colors.blue700, paddingHorizontal: 13, paddingVertical: 10 },
  nuevoButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  periodCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 16, marginBottom: 14 },
  periodLabel: { color: colors.muted, fontSize: 11 },
  periodAmount: { color: colors.ink, fontSize: 26, fontWeight: '800', marginTop: 5 },
  periodTotals: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  periodIncome: { color: colors.emerald700, fontSize: 10, fontWeight: '700' },
  periodExpense: { color: colors.red, fontSize: 10, fontWeight: '700' },
  searchInput: { height: 44, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, color: colors.ink, fontSize: 12, marginBottom: 10 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  filterChip: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginRight: 6 },
  filterChipActive: { backgroundColor: colors.blue50, borderColor: colors.blue100 },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: colors.blue700 },
  exportButton: { marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 10 },
  exportText: { color: colors.blue700, fontSize: 10, fontWeight: '800' },
  accountFilters: { flexGrow: 0, marginBottom: 12 },
  formCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 15, marginBottom: 16 },
  formHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  formTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  tipoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, backgroundColor: '#edf1f7', borderRadius: 11, padding: 4 },
  btnTipo: { flex: 1, padding: 11, borderRadius: 8, backgroundColor: 'transparent', alignItems: 'center', marginHorizontal: 2 },
  btnGastoActivo: { backgroundColor: colors.white, elevation: 1 },
  btnIngresoActivo: { backgroundColor: colors.white, elevation: 1 },
  txtTipo: { fontSize: 13, fontWeight: '700', color: colors.muted },
  txtActivo: { color: colors.blue700 },
  label: { fontSize: 12, fontWeight: '700', color: '#5f6d64', marginBottom: 7, marginTop: 10 },
  etiquetaCuenta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  linkCuenta: { color: colors.green800, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  tipoCuenta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  labelOptional: { color: '#9aa69f', fontWeight: '400' },
  inputMonto: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 23, fontWeight: '700', color: colors.ink },
  categoriasScroll: { flexGrow: 0, marginVertical: 3 },
  categoriasRow: { paddingVertical: 4 },
  catCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center', marginRight: 8 },
  catCardSeleccionada: { backgroundColor: colors.blue50, borderColor: colors.blue600 },
  catIcon: { fontSize: 17, marginBottom: 2 },
  catName: { fontSize: 11, fontWeight: '700', color: colors.ink },
  vacioBox: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 14, borderRadius: 10, marginVertical: 8, alignItems: 'center' },
  vacioTxt: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  inputDetalle: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 14, color: colors.ink, marginBottom: 17 },
  btnGuardar: { backgroundColor: colors.blue700, padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  btnTexto: { color: colors.white, fontSize: 14, fontWeight: '700' },
  btnCancelarEdicion: { alignItems: 'center', padding: 12, marginTop: -14, marginBottom: 16 },
  btnCancelarTexto: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  historial: { marginTop: 8 },
  tituloHistorial: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  dateHeading: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'capitalize', marginTop: 9, marginBottom: 8 },
  movimientoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 9 },
  movimientoDetalle: { flex: 1, marginRight: 8 },
  movimientoCategoria: { fontSize: 13, fontWeight: '700', color: colors.ink },
  movimientoDescripcion: { fontSize: 11, color: colors.muted, marginTop: 3 },
  movimientoFecha: { fontSize: 10, color: colors.muted, marginTop: 4 },
  movimientoAcciones: { alignItems: 'flex-end' },
  movimientoMonto: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  botonesMovimiento: { flexDirection: 'row', alignItems: 'center' },
  btnEditar: { paddingHorizontal: 9, paddingVertical: 6, backgroundColor: colors.blue50, borderRadius: 7, marginRight: 6 },
  btnEditarTexto: { color: colors.blue700, fontSize: 10, fontWeight: '700' },
  btnEliminar: { minWidth: 54, alignItems: 'center', paddingHorizontal: 7, paddingVertical: 6, backgroundColor: colors.redSoft, borderRadius: 7 },
  btnEliminarTexto: { color: colors.red, fontSize: 10, fontWeight: '700' }
});