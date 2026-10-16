import React, { useState, useEffect } from 'react';
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
  crearCategoria, 
  actualizarCategoria, 
  eliminarCategoria 
} from '../api';
import { colors } from '../theme';

export default function CategoriasScreen({ token }) {
  const [categorias, setCategorias] = useState([]);
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
  const cargarCategorias = async () => {
    setLoading(true);
    const res = await obtenerCategorias(token);
    if (res.exito) {
      setCategorias(res.categorias);
    } else {
      Alert.alert("Error", res.mensaje || "No se pudieron obtener las categorías.");
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    cargarCategorias();
  }, [token]);

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
          <Text style={styles.titulo}>Gestión de Categorías</Text>
          <Text style={styles.subtitulo}>Personaliza tus etiquetas financieras</Text>
        </View>

        {categorias.length === 0 ? (
          <View style={styles.vacioCard}>
            <Text style={styles.vacioTexto}>No hay categorías registradas. Añade una nueva con el botón "+".</Text>
          </View>
        ) : (
          categorias.map((cat) => (
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
          ))
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
  titulo: { fontSize: 22, fontWeight: '700', color: colors.green950, letterSpacing: -0.4 },
  subtitulo: { fontSize: 12, color: colors.muted, marginTop: 4 },
  catCard: { 
    backgroundColor: colors.white, 
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 13, 
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
  catName: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 4 },
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
    backgroundColor: colors.green800, 
    width: 54, 
    height: 54, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 5 
  },
  fabIcon: { color: colors.white, fontSize: 28, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(21,63,50,0.38)', justifyContent: 'center', padding: 18 },
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