import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl 
} from 'react-native';
import { obtenerPrestamos, crearPrestamo, abonarPrestamo } from '../api';
import { colors } from '../theme';

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
  const [tipoNuevo, setTipoNuevo] = useState('OTORGADO');

  // Modal Abonar
  const [modalAbonarVisible, setModalAbonarVisible] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');

  const cargarDatos = async () => {
    setLoading(true);
    const res = await obtenerPrestamos(token);
    if (res.exito) {
      setTotales(res.datos.totales);
      setPrestamos(res.datos.prestamos);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    cargarDatos();
  }, [token]);

  const handleCrear = async () => {
    if (!contacto || !montoTotal) {
      Alert.alert("Faltan datos", "Ingresa el nombre del contacto y el monto.");
      return;
    }

    const res = await crearPrestamo({
      contactName: contacto,
      totalAmount: parseFloat(montoTotal),
      type: tipoNuevo
    }, token);

    if (res.exito) {
      Alert.alert("¡Registrado! 🚀", "Préstamo creado con éxito.");
      setContacto('');
      setMontoTotal('');
      setModalCrearVisible(false);
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

    const res = await abonarPrestamo(prestamoSeleccionado.id, parseFloat(montoAbono), token);
    if (res.exito) {
      Alert.alert("¡Abono Registrado!", "El saldo pendiente se ha actualizado.");
      setMontoAbono('');
      setModalAbonarVisible(false);
      setPrestamoSeleccionado(null);
      cargarDatos();
    } else {
      Alert.alert("Error", res.mensaje);
    }
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

            return (
              <View key={item.id} style={styles.loanCard}>
                <View style={styles.loanHeader}>
                  <View>
                    <Text style={styles.contactName}>{item.contactName}</Text>
                    <Text style={styles.subtext}>
                      Monto Total: ${item.totalAmount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: estaCompletado ? colors.green700 : colors.amber }]}>
                    <Text style={styles.statusText}>{estaCompletado ? 'LIQUIDADO' : 'PENDIENTE'}</Text>
                  </View>
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
                      }}
                    >
                      <Text style={styles.btnAbonarTxt}>+ Abonar</Text>
                    </TouchableOpacity>
                  )}
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

            <TouchableOpacity style={styles.btnGuardar} onPress={handleCrear}>
              <Text style={styles.btnTexto}>Guardar Préstamo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalCrearVisible(false)}>
              <Text style={styles.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Abonar */}
      <Modal visible={modalAbonarVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
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

            <TouchableOpacity style={styles.btnGuardar} onPress={handleAbonar}>
              <Text style={styles.btnTexto}>Registrar Abono</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalAbonarVisible(false)}>
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
  resumenRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  resumenCard: { width: '48%', padding: 15, borderRadius: 13, alignItems: 'center' },
  resumenLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, marginBottom: 5 },
  resumenMonto: { fontSize: 19, fontWeight: '700' },
  tabSelector: { flexDirection: 'row', backgroundColor: '#edf1ed', borderRadius: 10, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 7 },
  tabBtnActivo: { backgroundColor: colors.white, elevation: 1 },
  tabTxt: { fontSize: 11, fontWeight: '700', color: colors.muted },
  tabTxtActivo: { color: colors.green800 },
  loanCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 13, padding: 16, marginBottom: 11, elevation: 0 },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  contactName: { fontSize: 15, fontWeight: '700', color: colors.green950 },
  subtext: { fontSize: 11, color: colors.muted, marginTop: 3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  trackBar: { height: 7, backgroundColor: '#edf1ed', borderRadius: 4, overflow: 'hidden', marginVertical: 10 },
  fillBar: { height: '100%' },
  loanFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  dueText: { fontSize: 12, color: colors.muted },
  dueHighlight: { fontWeight: '700', color: colors.ink },
  btnAbonar: { backgroundColor: colors.green800, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8 },
  btnAbonarTxt: { color: colors.white, fontWeight: '700', fontSize: 11 },
  vacioCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 22, borderRadius: 13, alignItems: 'center', marginTop: 10 },
  vacioTexto: { color: colors.muted, fontSize: 12 },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: colors.green800, width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  fabIcon: { color: colors.white, fontSize: 28, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(21,63,50,0.38)', justifyContent: 'center', padding: 18 },
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