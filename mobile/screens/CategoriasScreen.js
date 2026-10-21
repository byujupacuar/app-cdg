import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Modal,
  RefreshControl
} from 'react-native';
import { 
  obtenerCategorias, 
  obtenerDashboardReal,
  obtenerPresupuestos,
  crearCategoria, 
  actualizarCategoria, 
  eliminarCategoria 
} from '../api';
import { colors } from '../theme';

export default function CategoriasScreen({ token }) {
  const [categorias, setCategorias] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados del Modal (Añadir / Editar)
  const [modalVisible, setModalVisible] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [categoriaId, setCategoriaId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState('🏷️');
  const [tipo, setTipo] = useState('GASTO');
  const [guardando, setGuardando] = useState(false);

  // Cargar categorías desde la API
  const cargarCategorias = useCallback(async () => {
    const [res, resumen, limites] = await Promise.all([
      obtenerCategorias(token),
      obtenerDashboardReal(token),
      obtenerPresupuestos(token)
    ]);
    if (res.exito) setCategorias(res.categorias || []);
    else {
      Alert.alert("Error", res.mensaje || "No se pudieron obtener las categorías.");
    }
    if (resumen.exito) setDashboard(resumen.datos);
    if (limites.exito) {
      setPresupuestos(limites.presupuestos || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => {
    Promise.resolve().then(cargarCategorias);
  }, [cargarCategorias]);

  // Abrir Modal para Crear
  const abrirModalCrear = () => {
    setModoEdicion(false);
    setCategoriaId(null);
    setNombre('');
    setIcono('🏷️');
    setTipo('GASTO');
    setModalVisible(true);
  };

  // Abrir Modal para Editar
  const abrirModalEditar = (cat) => {
    setModoEdicion(true);
    setCategoriaId(cat.id);
    setNombre(cat.name);
    setIcono(cat.icon || '🏷️');
    setTipo(cat.type);
    setModalVisible(true);
  };

  // Guardar (Crear o Actualizar)
  const handleGuardar = async () => {
    if (!nombre.trim()) {
      Alert.alert("Campo incompleto", "Por favor ingresa un nombre para la categoría.");
      return;
    }

    setGuardando(true);
    let res;

    if (modoEdicion) {
      res = await actualizarCategoria(categoriaId, { name: nombre, icon: icono, type: tipo }, token);
    } else {
      res = await crearCategoria({ name: nombre, icon: icono, type: tipo }, token);
    }

    setGuardando(false);

    if (res.exito) {
      Alert.alert("¡Éxito!", modoEdicion ? "Categoría actualizada." : "Nueva categoría creada.");
      setModalVisible(false);
      cargarCategorias();
    } else {
      Alert.alert("Error", res.mensaje);
    }
  };

  // Confirmar y Eliminar Categoría
  const handleEliminar = (cat) => {
    Alert.alert(
      "Eliminar Categoría",
      `¿Estás seguro de eliminar "${cat.icon} ${cat.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            const res = await eliminarCategoria(cat.id, token);
            if (res.exito) {
              Alert.alert("Eliminada", "La categoría ha sido eliminada.");
              cargarCategorias();
            } else {
              Alert.alert("Atención", res.mensaje);
            }
          }
        }
      ]
    );
  };

  const categoriasVisibles = categorias.filter((categoria) =>
    `${categoria.name} ${categoria.type}`.toLocaleLowerCase().includes(busqueda.trim().toLocaleLowerCase())
  );
  const gastosMes = dashboard?.gastosPorCategoria || [];
  const totalPresupuestado = presupuestos.reduce((total, item) => total + Number(item.limitAmount || 0), 0);
  const totalGastadoPresupuestos = presupuestos.reduce((total, item) => total + Number(item.spentAmount || 0), 0);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.green700} />
        <Text style={styles.cargandoTexto}>Cargando categorías...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => { setRefreshing(true); cargarCategorias(); }} 
            colors={[colors.green700]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.titulo}>Categorías</Text>
          <Text style={styles.subtitulo}>Tus gastos agrupados por categoría</Text>
        </View>

        <View style={styles.budgetSummary}>
          <Text style={styles.summaryLabel}>Presupuestos utilizados este mes</Text>
          <View style={styles.summaryAmounts}>
            <Text style={styles.summarySpent}>${totalGastadoPresupuestos.toFixed(2)}</Text>
            <Text style={styles.summaryLimit}>de ${totalPresupuestado.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryTrack}>
            <View style={[styles.summaryFill, { width: `${totalPresupuestado > 0 ? Math.min(100, totalGastadoPresupuestos / totalPresupuestado * 100) : 0}%` }]} />
          </View>
        </View>
        <TextInput
          style={styles.searchInput}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar categoría"
          placeholderTextColor={colors.muted}
        />

        {categoriasVisibles.length === 0 ? (
          <View style={styles.vacioCard}>
            <Text style={styles.vacioTexto}>{categorias.length ? 'No hay resultados para esta búsqueda.' : 'No hay categorías registradas. Añade una nueva con el botón "+".'}</Text>
          </View>
        ) : (
          categoriasVisibles.map((cat) => {
            const presupuesto = presupuestos.find((item) => item.categoryId === cat.id || item.categoria === cat.name);
            const gastoReal = gastosMes.find((item) => item.id === cat.id || item.nombre === cat.name);
            const gastado = Number(presupuesto?.spentAmount ?? gastoReal?.monto ?? 0);
            const limite = Number(presupuesto?.limitAmount || 0);
            return (
            <View key={cat.id} style={styles.catCard}>
              <View style={styles.catIconBox}>
                <Text style={styles.catIcon}>{cat.icon}</Text>
              </View>

              <View style={styles.catInfo}>
                <Text style={styles.catName}>{cat.name}</Text>
                <View style={[
                  styles.badgeTipo, 
                  cat.type === 'INGRESO' ? styles.badgeIngreso : styles.badgeGasto
                ]}>
                  <Text style={[
                    styles.badgeText, 
                    cat.type === 'INGRESO' ? styles.badgeTextIngreso : styles.badgeTextGasto
                  ]}>
                    {cat.type}
                  </Text>
                  {cat.type === 'GASTO' && (
                    <View style={styles.categoryUsage}>
                      <Text style={styles.categoryUsageText}>
                        ${gastado.toFixed(2)}{limite > 0 ? ` de $${limite.toFixed(2)}` : ' gastados'}
                      </Text>
                      {limite > 0 && <View style={styles.categoryTrack}><View style={[styles.categoryFill, { width: `${Math.min(100, gastado / limite * 100)}%` }]} /></View>}
                    </View>
                  )}
                </View>
              </View>

              {/* Botones de Acción (Editar / Eliminar) */}
              <View style={styles.accionesRow}>
                <TouchableOpacity 
                  style={styles.btnAccionEditar} 
                  onPress={() => abrirModalEditar(cat)}
                >
                  <Text style={styles.btnAccionTxt}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.btnAccionEliminar} 
                  onPress={() => handleEliminar(cat)}
                >
                  <Text style={styles.btnAccionTxt}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )})
        )}
      </ScrollView>

      {/* Botón Flotante para Crear Categoría */}
      <TouchableOpacity style={styles.fab} onPress={abrirModalCrear}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Modal para Crear / Editar Categoría */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>
              {modoEdicion ? 'Editar Categoría' : 'Nueva Categoría'}
            </Text>

            <Text style={styles.label}>Ícono Emoji:</Text>
            <TextInput 
              style={styles.inputEmoji} 
              placeholder="Ej. 🍔, 🏠, 🚗" 
              value={icono} 
              onChangeText={setIcono}
              maxLength={4}
            />

            <Text style={styles.label}>Nombre:</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Nombre de categoría" 
              value={nombre} 
              onChangeText={setNombre} 
            />

            <Text style={styles.label}>Tipo de Movimiento:</Text>
            <View style={styles.tipoRow}>
              <TouchableOpacity 
                style={[styles.btnTipo, tipo === 'GASTO' && styles.btnTipoGastoActivo]} 
                onPress={() => setTipo('GASTO')}
              >
                <Text style={[styles.txtTipo, tipo === 'GASTO' && styles.txtActivo]}>Gasto</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.btnTipo, tipo === 'INGRESO' && styles.btnTipoIngresoActivo]} 
                onPress={() => setTipo('INGRESO')}
              >
                <Text style={[styles.txtTipo, tipo === 'INGRESO' && styles.txtActivo]}>Ingreso</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.btnGuardar, guardando && { backgroundColor: '#bdc3c7' }]} 
              onPress={handleGuardar}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.btnTexto}>
                  {modoEdicion ? 'Actualizar Categoría' : 'Añadir Categoría'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.btnCancelar} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 22 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas },
  cargandoTexto: { marginTop: 10, color: colors.muted, fontSize: 13 },
  header: { marginBottom: 18 },
  titulo: { fontSize: 23, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  subtitulo: { fontSize: 12, color: colors.muted, marginTop: 4 },
  budgetSummary: { backgroundColor: colors.blue700, padding: 16, borderRadius: 17, marginBottom: 13 },
  summaryLabel: { color: '#dbeafe', fontSize: 10, fontWeight: '600' },
  summaryAmounts: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 7 },
  summarySpent: { color: colors.white, fontSize: 23, fontWeight: '800' },
  summaryLimit: { color: '#dbeafe', fontSize: 11 },
  summaryTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  summaryFill: { height: '100%', backgroundColor: colors.emerald700, borderRadius: 4 },
  searchInput: { height: 43, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 11, fontSize: 12, marginBottom: 12, color: colors.ink },
  catCard: { 
    backgroundColor: colors.white, 
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13, 
    marginBottom: 9, 
    flexDirection: 'row', 
    alignItems: 'center', 
    elevation: 0 
  },
  catIconBox: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    backgroundColor: colors.green50, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  catIcon: { fontSize: 24 },
  catInfo: { flex: 1, marginLeft: 12 },
  catName: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  categoryUsage: { marginTop: 6 },
  categoryUsageText: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  categoryTrack: { height: 4, backgroundColor: colors.blue50, borderRadius: 3, overflow: 'hidden', marginTop: 5 },
  categoryFill: { height: '100%', backgroundColor: colors.emerald700, borderRadius: 3 },
  badgeTipo: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  badgeGasto: { backgroundColor: colors.redSoft },
  badgeIngreso: { backgroundColor: colors.green100 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  badgeTextGasto: { color: colors.red },
  badgeTextIngreso: { color: colors.green700 },
  accionesRow: { flexDirection: 'row', alignItems: 'center' },
  btnAccionEditar: { backgroundColor: colors.green50, padding: 8, borderRadius: 8, marginRight: 6 },
  btnAccionEliminar: { backgroundColor: colors.redSoft, padding: 8, borderRadius: 8 },
  btnAccionTxt: { fontSize: 14 },
  vacioCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 22, borderRadius: 13, alignItems: 'center', marginTop: 15 },
  vacioTexto: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  fab: { 
    position: 'absolute', 
    right: 25, 
    bottom: 25, 
    backgroundColor: colors.blue700,
    width: 54, 
    height: 54, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 5 
  },
  fabIcon: { color: colors.white, fontSize: 28, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,37,84,0.28)', justifyContent: 'center', padding: 18 },
  modalContent: { backgroundColor: colors.white, borderRadius: 17, padding: 22, borderColor: colors.line, borderWidth: 1 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: colors.green950, marginBottom: 16, textAlign: 'left' },
  label: { fontSize: 12, fontWeight: '700', color: '#5f6d64', marginBottom: 6 },
  inputEmoji: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 10, fontSize: 20, textAlign: 'center', marginBottom: 12 },
  input: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 12, fontSize: 14, color: colors.ink, marginBottom: 12 },
  tipoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, backgroundColor: '#edf1ed', borderRadius: 10, padding: 4 },
  btnTipo: { flex: 1, padding: 10, borderRadius: 7, backgroundColor: 'transparent', alignItems: 'center', marginHorizontal: 2 },
  btnTipoGastoActivo: { backgroundColor: colors.white, elevation: 1 },
  btnTipoIngresoActivo: { backgroundColor: colors.white, elevation: 1 },
  txtTipo: { fontSize: 12, fontWeight: '700', color: colors.muted },
  txtActivo: { color: colors.green800 },
  btnGuardar: { backgroundColor: colors.green800, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnTexto: { color: colors.white, fontWeight: '700', fontSize: 14 },
  btnCancelar: { padding: 10, alignItems: 'center', marginTop: 6 },
  txtCancelar: { color: colors.muted, fontSize: 12, fontWeight: '600' }
});