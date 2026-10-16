import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, RefreshControl 
} from 'react-native';
import { obtenerMiCuenta, invitarPareja } from '../api';
import { colors } from '../theme';

export default function ParejaScreen({ token, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cuentaInfo, setCuentaInfo] = useState(null);
  const [emailPareja, setEmailPareja] = useState('');

  const cargarCuenta = async () => {
    setLoading(true);
    const res = await obtenerMiCuenta(token);
    if (res.exito) {
      setCuentaInfo(res.datos);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    cargarCuenta();
  }, [token]);

  const handleInvitar = async () => {
    if (!emailPareja) {
      Alert.alert("Campo vacío", "Ingresa el correo electrónico de tu pareja.");
      return;
    }

    const res = await invitarPareja(emailPareja, token);
    if (res.exito) {
      Alert.alert("¡Vinculación Exitosa! 👥", res.mensaje);
      setEmailPareja('');
      cargarCuenta();
    } else {
      Alert.alert("Atención", res.mensaje);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.green700} />
        <Text style={styles.cargandoTexto}>Cargando espacio financiero...</Text>
      </View>
    );
  }

  const esCompartida = cuentaInfo?.type === 'SHARED';

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarCuenta(); }} />}
    >
      <View style={styles.header}>
        <Text style={styles.titulo}>Cuenta y Pareja</Text>
        <Text style={styles.subtitulo}>Gestión del Espacio Financiero</Text>
      </View>

      {/* Tarjeta Tipo de Cuenta */}
      <View style={styles.cardStatus}>
        <Text style={styles.cardLabel}>Modalidad Actual</Text>
        <Text style={styles.cardVal}>
          {esCompartida ? '👥 Cuenta Compartida en Pareja' : '👤 Cuenta Individual (Personal)'}
        </Text>
        <Text style={styles.cardDesc}>
          {esCompartida 
            ? 'Ambos miembros registran y consultan los ingresos, gastos, préstamos y presupuestos en tiempo real.'
            : 'Solo tú tienes acceso a tus movimientos. Puedes vincular a tu pareja a continuación.'}
        </Text>
      </View>

      {/* Lista de Miembros Actuales */}
      <Text style={styles.seccionTitulo}>Miembros de la Cuenta ({cuentaInfo?.miembros?.length || 0})</Text>
      {cuentaInfo?.miembros?.map((m) => (
        <View key={m.id} style={styles.memberCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{m.name?.substring(0, 2).toUpperCase() || 'US'}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{m.name}</Text>
            <Text style={styles.memberEmail}>{m.email}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{m.role}</Text>
          </View>
        </View>
      ))}

      {/* Formulario de Invitación */}
      <View style={styles.cardForm}>
        <Text style={styles.formTitulo}>Invitar a tu Pareja</Text>
        <Text style={styles.formDesc}>
          Ingresa el correo electrónico con el que tu pareja se registró en Nivia para unificar sus finanzas:
        </Text>

        <TextInput 
          style={styles.input} 
          placeholder="correo.pareja@ejemplo.com" 
          keyboardType="email-address"
          autoCapitalize="none"
          value={emailPareja}
          onChangeText={setEmailPareja}
        />

        <TouchableOpacity style={styles.btnInvitar} onPress={handleInvitar}>
          <Text style={styles.btnText}>Unir a la Cuenta Compartida</Text>
        </TouchableOpacity>
      </View>
    
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={onLogout}
      >
        <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 18, paddingTop: 22 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas },
  cargandoTexto: { marginTop: 10, color: colors.muted, fontSize: 13 },
  header: { marginBottom: 18 },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.green950, letterSpacing: -0.4 },
  subtitulo: { fontSize: 12, color: colors.muted, marginTop: 4 },
  cardStatus: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 17, marginBottom: 18 },
  cardLabel: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  cardVal: { fontSize: 16, fontWeight: '700', color: colors.green950, marginVertical: 7 },
  cardDesc: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  seccionTitulo: { fontSize: 14, fontWeight: '700', color: colors.green950, marginBottom: 10 },
  memberCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.green100, justifyContent: 'center', alignItems: 'center', marginRight: 11 },
  avatarText: { color: colors.green800, fontWeight: '700', fontSize: 14 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  memberEmail: { fontSize: 11, color: colors.muted },
  roleBadge: { backgroundColor: colors.green50, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  roleText: { fontSize: 9, fontWeight: '700', color: colors.green800 },
  cardForm: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 17, marginTop: 8, marginBottom: 22 },
  formTitulo: { fontSize: 15, fontWeight: '700', color: colors.green950, marginBottom: 6 },
  formDesc: { fontSize: 11, color: colors.muted, marginBottom: 14, lineHeight: 16 },
  input: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderWidth: 1, padding: 12, borderRadius: 9, fontSize: 14, marginBottom: 13 },
  btnInvitar: { backgroundColor: colors.green800, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  logoutButton: { backgroundColor: colors.redSoft, padding: 13, borderRadius: 10, alignItems: 'center', marginTop: 4, marginBottom: 24 },
  logoutButtonText: { color: colors.red, fontWeight: '700', fontSize: 13 }
});