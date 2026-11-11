import React, { useState } from 'react';
import { Alert, ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { availableCurrencies } from '../currency';

export default function PerfilScreen({ usuario, currencyCode = 'USD', onCurrencyChange, onLogout }) {
  const [guardandoMoneda, setGuardandoMoneda] = useState(false);

  const cambiarMoneda = async (currency) => {
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
        {availableCurrencies.map(([code, name]) => (
          <TouchableOpacity
            key={code}
            accessibilityRole="button"
            accessibilityState={{ selected: currencyCode === code, disabled: guardandoMoneda }}
            disabled={guardandoMoneda}
            style={[styles.opcionMoneda, currencyCode === code && styles.opcionMonedaActiva]}
            onPress={() => cambiarMoneda(code)}
          >
            <Text style={[styles.valor, currencyCode === code && styles.valorActivo]}>{name} ({code})</Text>
            {currencyCode === code && <Text style={styles.seleccion}>Seleccionada</Text>}
          </TouchableOpacity>
        ))}
        {guardandoMoneda && <Text style={styles.descripcion}>Guardando moneda...</Text>}
      </View>

      <TouchableOpacity style={styles.botonLogout} onPress={onLogout}>
        <Text style={styles.textoLogout}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.canvas, padding: 18, paddingTop: 24 },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.green950, marginBottom: 18 },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 18, borderRadius: 14, marginBottom: 22 },
  label: { fontSize: 11, color: colors.muted, marginTop: 10, fontWeight: '600' },
  valor: { fontSize: 15, fontWeight: '700', color: colors.ink },
  descripcion: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 6, marginBottom: 10 },
  opcionMoneda: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 11 },
  opcionMonedaActiva: { backgroundColor: colors.green100, paddingHorizontal: 8, borderRadius: 8 },
  valorActivo: { color: colors.green800 },
  seleccion: { color: colors.green800, fontSize: 10, marginTop: 3 },
  botonLogout: { backgroundColor: colors.redSoft, padding: 14, borderRadius: 10, alignItems: 'center' },
  textoLogout: { color: colors.red, fontSize: 13, fontWeight: '700' }
});