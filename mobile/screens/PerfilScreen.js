import React, { useState } from 'react';
import { Alert, Modal, ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { availableCurrencies } from '../currency';

export default function PerfilScreen({ usuario, currencyCode = 'USD', onCurrencyChange, onLogout }) {
  const [guardandoMoneda, setGuardandoMoneda] = useState(false);
  const [menuMonedaVisible, setMenuMonedaVisible] = useState(false);
  const monedaSeleccionada = availableCurrencies.find(([code]) => code === currencyCode);

  const cambiarMoneda = async (currency) => {
    setMenuMonedaVisible(false);
    if (currency === currencyCode) return;
    setGuardandoMoneda(true);
    const resultado = await onCurrencyChange(currency);
    setGuardandoMoneda(false);
    if (!resultado.exito) Alert.alert('No se pudo cambiar la moneda', resultado.mensaje);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Perfil de Usuario</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Nombre:</Text>
        <Text style={styles.valor}>{usuario?.name || 'Usuario Nivia'}</Text>

        <Text style={styles.label}>Correo:</Text>
        <Text style={styles.valor}>{usuario?.email || 'Sin correo'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Moneda de la cuenta</Text>
        <Text style={styles.descripcion}>El cambio se comparte con los miembros de la cuenta y no convierte los importes existentes.</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Elegir moneda de la cuenta"
          accessibilityState={{ expanded: menuMonedaVisible, disabled: guardandoMoneda }}
          disabled={guardandoMoneda}
          style={styles.selectorMoneda}
          onPress={() => setMenuMonedaVisible(true)}
        >
          <View style={styles.selectorTexto}>
            <Text style={styles.valor}>{monedaSeleccionada ? `${monedaSeleccionada[1]} (${currencyCode})` : currencyCode}</Text>
            <Text style={styles.selectorAyuda}>Moneda seleccionada</Text>
          </View>
          <Text style={styles.selectorFlecha}>{menuMonedaVisible ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {guardandoMoneda && <Text style={styles.descripcion}>Guardando moneda...</Text>}
      </View>

      <Modal
        visible={menuMonedaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuMonedaVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalFondo}
          onPress={() => setMenuMonedaVisible(false)}
        >
          <View style={styles.menuMoneda}>
            <View style={styles.menuEncabezado}>
              <Text style={styles.menuTitulo}>Elegir moneda</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cerrar lista de monedas"
                onPress={() => setMenuMonedaVisible(false)}
              >
                <Text style={styles.menuCerrar}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.listaMonedas}>
              {availableCurrencies.map(([code, name]) => (
                <TouchableOpacity
                  key={code}
                  accessibilityRole="button"
                  accessibilityLabel={`${name} (${code})`}
                  accessibilityState={{ selected: currencyCode === code }}
                  style={[styles.opcionMoneda, currencyCode === code && styles.opcionMonedaActiva]}
                  onPress={() => cambiarMoneda(code)}
                >
                  <Text style={[styles.valor, currencyCode === code && styles.valorActivo]}>{name} ({code})</Text>
                  {currencyCode === code && <Text style={styles.seleccion}>Seleccionada</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity style={styles.botonLogout} onPress={onLogout}>
        <Text style={styles.textoLogout}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.canvas, padding: 18, paddingTop: 24 },
  titulo: { fontSize: 25, fontWeight: '700', color: colors.green950, marginBottom: 18 },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 18, borderRadius: 14, marginBottom: 22 },
  label: { fontSize: 12, color: colors.muted, marginTop: 10, fontWeight: '600' },
  valor: { fontSize: 17, fontWeight: '700', color: colors.ink },
  descripcion: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 10 },
  selectorMoneda: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  selectorTexto: { flex: 1, paddingRight: 10 },
  selectorAyuda: { color: colors.muted, fontSize: 11, marginTop: 3 },
  selectorFlecha: { color: colors.green800, fontSize: 14, fontWeight: '700' },
  modalFondo: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  menuMoneda: {
    backgroundColor: colors.white,
    borderRadius: 14,
    maxHeight: '72%',
    overflow: 'hidden',
    width: '100%'
  },
  menuEncabezado: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  menuTitulo: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  menuCerrar: { color: colors.green800, fontSize: 13, fontWeight: '700', padding: 4 },
  listaMonedas: { paddingHorizontal: 12, paddingVertical: 6 },
  opcionMoneda: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 8, paddingVertical: 12 },
  opcionMonedaActiva: { backgroundColor: colors.green100, paddingHorizontal: 8, borderRadius: 8 },
  valorActivo: { color: colors.green800 },
  seleccion: { color: colors.green800, fontSize: 12, marginTop: 3 },
  botonLogout: { backgroundColor: colors.redSoft, padding: 14, borderRadius: 10, alignItems: 'center' },
  textoLogout: { color: colors.red, fontSize: 15, fontWeight: '700' }
});