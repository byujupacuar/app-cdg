import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  Alert, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import { obtenerPresupuestos, obtenerCategorias, guardarPresupuesto } from '../api';
import { colors } from '../theme';

export default function PresupuestosScreen({ token }) {
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);

  // Formulario de Presupuesto
  const [categoryId, setCategoryId] = useState(null);
  const [limitAmount, setLimitAmount] = useState('');
  const [period, setPeriod] = useState('MENSUAL');

  const cargarPresupuestos = async () => {
    setLoading(true);
    const res = await obtenerPresupuestos(token);
    if (res.exito) {
      setPresupuestos(res.presupuestos);
    } else {
      Alert.alert("Atención", res.mensaje || "No se pudieron cargar los presupuestos.");
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    cargarPresupuestos();
  }, [token]);

  const abrirModalPresupuesto = async () => {
    setModalVisible(true);
    setCategoryId(null);
    setLoadingCategorias(true);

    const res = await obtenerCategorias(token);
    if (res.exito) {
      setCategorias(res.categorias.filter((categoria) => categoria.type === 'GASTO'));
    } else {
      Alert.alert("Error", res.mensaje || "No se pudieron cargar las categorías.");
    }

    setLoadingCategorias(false);
  };

  const handleCrearPresupuesto = async () => {
    if (!categoryId || !limitAmount || parseFloat(limitAmount) <= 0) {
      Alert.alert("Datos incompletos", "Por favor selecciona una categoría de gasto e ingresa un monto límite mayor a cero.");
      return;
    }

    setGuardando(true);

    const res = await guardarPresupuesto({
      categoryId,
      limitAmount: parseFloat(limitAmount),
      period
    }, token);

    setGuardando(false);

    if (res.exito) {
      Alert.alert("¡Éxito! 🚀", "Presupuesto configurado.");
      setCategoryId(null);
      setLimitAmount('');
      setModalVisible(false);
      cargarPresupuestos();
    } else {
      Alert.alert("Error", res.mensaje);
    }
  };

  const getSemaforoColor = (estado) => {
    switch (estado) {
      case 'ROJO': return colors.red;
      case 'AMARILLO': return colors.amber;
      case 'VERDE': default: return colors.green700;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.green700} />
        <Text style={styles.cargandoTexto}>Calculando consumo semafórico...</Text>
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
            onRefresh={() => { setRefreshing(true); cargarPresupuestos(); }} 
            colors={[colors.green700]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.titulo}>Presupuestos Semafóricos</Text>
          <Text style={styles.subtitulo}>Límites de consumo mensual activo</Text>
        </View>

        {presupuestos.length === 0 ? (
          <View style={styles.vacioCard}>
            <Text style={styles.vacioTexto}>No has configurado límites de gasto.</Text>
            <Text style={styles.vacioSubtexto}>Toca el botón "+" para crear tu primer presupuesto.</Text>
          </View>
        ) : (
          presupuestos.map((item) => {
            const colorSemaforo = getSemaforoColor(item.estadoSemaforo);
            return (
              <View key={item.id} style={styles.cardPresupuesto}>
                <View style={styles.cardHeader}>
                  <Text style={styles.categoriaNombre}>{item.icono} {item.categoria}</Text>
                  <View style={[styles.badgeSemaforo, { backgroundColor: colorSemaforo }]}>
                    <Text style={styles.badgeTexto}>
                      {item.estadoSemaforo === 'ROJO' ? 'EXCEDIDO' : item.estadoSemaforo === 'AMARILLO' ? 'ALERTA' : 'OK'}
                    </Text>
                  </View>
                </View>

                {/* Barra de Progreso Semafórica */}
                <View style={styles.trackBar}>
                  <View style={[styles.fillBar, { width: `${item.percentage}%`, backgroundColor: colorSemaforo }]} />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.montoDetalle}>
                    Gastado: <Text style={{ fontWeight: 'bold', color: colorSemaforo }}>${item.spentAmount.toFixed(2)}</Text>
                  </Text>
                  <Text style={styles.montoDetalle}>
                    Límite: <Text style={{ fontWeight: 'bold', color: colors.ink }}>${item.limitAmount.toFixed(2)}</Text>
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Botón Flotante para Nuevo Presupuesto */}
      <TouchableOpacity style={styles.fab} onPress={abrirModalPresupuesto}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Modal Configurar Presupuesto */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Establecer Presupuesto</Text>

            <Text style={styles.label}>Categoría de gasto:</Text>
            {loadingCategorias ? (
              <ActivityIndicator size="small" color={colors.green700} style={styles.loadingCategorias} />
            ) : categorias.length === 0 ? (
              <Text style={styles.categoriasVacias}>
                No hay categorías de gasto. Crea una en la pestaña "Categorías" antes de establecer un presupuesto.
              </Text>
            ) : (
              <ScrollView style={styles.categoriasList} nestedScrollEnabled>
                {categorias.map((categoria) => (
                  <TouchableOpacity
                    key={categoria.id}
                    style={[
                      styles.categoriaOption,
                      categoryId === categoria.id && styles.categoriaOptionSeleccionada
                    ]}
                    onPress={() => setCategoryId(categoria.id)}
                  >
                    <Text style={styles.categoriaOptionTexto}>
                      {categoria.icon || '🏷️'} {categoria.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.label}>Monto Límite ($):</Text>
            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              keyboardType="numeric" 
              value={limitAmount} 
              onChangeText={setLimitAmount} 
            />

            <TouchableOpacity 
              style={[styles.btnGuardar, guardando && { backgroundColor: '#bdc3c7' }]} 
              onPress={handleCrearPresupuesto}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.btnTexto}>Guardar Presupuesto</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalVisible(false)}>
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
  cardPresupuesto: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 17, marginBottom: 12, elevation: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoriaNombre: { fontSize: 15, fontWeight: '700', color: colors.green950 },
  badgeSemaforo: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTexto: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  trackBar: { height: 7, backgroundColor: '#edf1ed', borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  fillBar: { height: '100%', borderRadius: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  montoDetalle: { fontSize: 11, color: colors.muted },
  vacioCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 22, borderRadius: 14, alignItems: 'center', marginTop: 14 },
  vacioTexto: { color: colors.green950, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  vacioSubtexto: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 5 },
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
  modalTitulo: { fontSize: 18, fontWeight: '700', color: colors.green950, marginBottom: 15 },
  label: { fontSize: 12, fontWeight: '700', color: '#5f6d64', marginBottom: 6 },
  categoriasList: { maxHeight: 150, marginBottom: 12 },
  categoriaOption: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  categoriaOptionSeleccionada: { backgroundColor: colors.green100, borderColor: '#83ac91' },
  categoriaOptionTexto: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  categoriasVacias: { backgroundColor: colors.green50, borderRadius: 10, padding: 12, color: colors.muted, marginBottom: 10, fontSize: 12 },
  loadingCategorias: { marginVertical: 15 },
  input: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 12, fontSize: 14, color: colors.ink, marginBottom: 12 },
  btnGuardar: { backgroundColor: colors.green800, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnTexto: { color: colors.white, fontWeight: '700', fontSize: 14 },
  btnCancelar: { padding: 10, alignItems: 'center', marginTop: 5 },
  txtCancelar: { color: colors.muted, fontSize: 12, fontWeight: '600' }
});