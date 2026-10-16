import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';

export default function PerfilScreen({ usuario, onLogout }) {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Perfil de Usuario</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Nombre:</Text>
        <Text style={styles.valor}>{usuario?.name || 'Usuario Nivia'}</Text>

        <Text style={styles.label}>Correo:</Text>
        <Text style={styles.valor}>{usuario?.email || 'Sin correo'}</Text>
      </View>

      <TouchableOpacity style={styles.botonLogout} onPress={onLogout}>
        <Text style={styles.textoLogout}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, padding: 18, paddingTop: 24 },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.green950, marginBottom: 18 },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 18, borderRadius: 14, marginBottom: 22 },
  label: { fontSize: 11, color: colors.muted, marginTop: 10, fontWeight: '600' },
  valor: { fontSize: 15, fontWeight: '700', color: colors.ink },
  botonLogout: { backgroundColor: colors.redSoft, padding: 14, borderRadius: 10, alignItems: 'center' },
  textoLogout: { color: colors.red, fontSize: 13, fontWeight: '700' }
});