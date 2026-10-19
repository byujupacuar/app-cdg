import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerDashboardReal } from '../api';
import { colors } from '../theme';

export default function DashboardScreen({ token, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [datos, setDatos] = useState(null);

  // Carga de datos desde la API REST o caché local
  const cargarDashboard = async () => {
    try {
      const res = await obtenerDashboardReal(token);
      if (res && res.exito) {
        setDatos(res.datos);
      } else {
        Alert.alert("Atención", res?.mensaje || "No se pudo actualizar el balance.");
      }
    } catch (error) {
      console.error("Error al cargar dashboard:", error);
      Alert.alert("Error de Conexión", "Revisa tu conexión a internet.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Se ejecuta CADA VEZ que el usuario enfoca esta pantalla (resuelve que no se actualice)
  useFocusEffect(
    useCallback(() => {
      cargarDashboard();
    }, [token])
  );

  const confirmarCierreSesion = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Deseas salir de Nivia?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", style: "destructive", onPress: onLogout }
      ]
    );
  };

  // Desestructuración segura con encadenamiento opcional y valores por defecto
  const totalIngresos = datos?.resumen?.totalIngresos ?? 0;
  const totalGastos = datos?.resumen?.totalGastos ?? 0;
  const balanceTotal = datos?.resumen?.balanceTotal ?? 0;
  const gastosPorCategoria = datos?.gastosPorCategoria ?? [];
  const ultimosMovimientos = datos?.ultimosMovimientos ?? [];

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.green700} />
        <Text style={styles.cargandoTexto}>Cargando balance financiero...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={() => { setRefreshing(true); cargarDashboard(); }} 
          colors={[colors.green700]} 
        />
      }
    >
      {/* Encabezado y Perfil */}
      <View style={styles.header}>
        <View style={styles.headerCuenta}>
          <Text style={styles.cuentaTitulo} numberOfLines={1} ellipsizeMode="tail">
            {datos?.cuenta || 'Mi Cuenta'}
          </Text>
          <View style={styles.badgeCuenta}>
            <Text style={styles.badgeTexto} numberOfLines={1}>
              {datos?.tipoCuenta === 'SHARED' ? '👥 Pareja (Compartida)' : '👤 Cuenta Individual'}
            </Text>
          </View>
        </View>

        {onLogout && (
          <TouchableOpacity
            style={styles.btnLogout}
            onPress={confirmarCierreSesion}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            <Text style={styles.btnLogoutTexto}>🚪 Salir</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tarjeta de Balance General */}
      <View style={styles.cardBalance}>
        <Text style={styles.balanceLabel}>Balance Disponible Mensual</Text>
        <Text style={[styles.balanceMonto, { color: balanceTotal >= 0 ? colors.white : '#ffd4ca' }]}>
          ${balanceTotal.toFixed(2)}
        </Text>

        <View style={styles.resumenRow}>
          <View style={styles.resumenCol}>
            <Text style={styles.resumenSublabel}>🟢 Ingresos</Text>
            <Text style={styles.resumenValorIngreso}>+${totalIngresos.toFixed(2)}</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.resumenCol}>
            <Text style={styles.resumenSublabel}>🔴 Gastos</Text>
            <Text style={styles.resumenValorGasto}>-${totalGastos.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Evolución del Período */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Evolución del Período</Text>
        <View style={styles.barChartContainer}>
          <View style={styles.barCol}>
            <View style={styles.barTrack}>
              <View 
                style={[
                  styles.barFill, 
                  { 
                    backgroundColor: colors.green700, 
                    height: totalIngresos > 0 ? `${Math.min(100, (totalIngresos / (totalIngresos + totalGastos || 1)) * 100)}%` : '0%' 
                  }
                ]} 
              />
            </View>
            <Text style={styles.barLabel}>Ingresos</Text>
          </View>

          <View style={styles.barCol}>
            <View style={styles.barTrack}>
              <View 
                style={[
                  styles.barFill, 
                  { 
                    backgroundColor: colors.red, 
                    height: totalGastos > 0 ? `${Math.min(100, (totalGastos / (totalIngresos + totalGastos || 1)) * 100)}%` : '0%' 
                  }
                ]} 
              />
            </View>
            <Text style={styles.barLabel}>Gastos</Text>
          </View>
        </View>
      </View>

      {/* Distribución de Gastos por Categoría */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Distribución de Gastos por Categoría</Text>
        {gastosPorCategoria.length === 0 ? (
          <Text style={styles.vacioTexto}>No hay gastos registrados en este período.</Text>
        ) : (
          gastosPorCategoria.map((cat, idx) => (
            <View key={cat.id || cat.nombre || idx} style={styles.catGraphItem}>
              <View style={styles.catGraphHeader}>
                <Text style={styles.catName}>{cat.icono || '🏷️'} {cat.nombre}</Text>
                <Text style={styles.catMonto}>
                  ${(cat.monto ?? 0).toFixed(2)} ({(cat.porcentaje ?? 0).toFixed(1)}%)
                </Text>
              </View>

              <View style={styles.catTrackBar}>
                <View style={[styles.catFillBar, { width: `${cat.porcentaje ?? 0}%` }]} />
              </View>
            </View>
          ))
        )}
      </View>

      {/* Actividad Reciente */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Actividad Reciente</Text>
        {ultimosMovimientos.length === 0 ? (
          <Text style={styles.vacioTexto}>Sin movimientos recientes.</Text>
        ) : (
          ultimosMovimientos.map((m, idx) => (
            <View key={m.id || idx} style={styles.movCard}>
              <Text style={styles.movIcon}>{m.category?.icon || '🏷️'}</Text>
              <View style={styles.movDetalle}>
                <Text style={styles.movCat}>{m.category?.name || 'General'}</Text>
                <Text style={styles.movDesc}>{m.description || 'Sin detalle'}</Text>
                <Text style={styles.movDesc}>{m.financialAccount?.name || 'Sin cuenta'}</Text>
              </View>
              <Text style={[styles.movMonto, { color: m.type === 'INGRESO' ? colors.green700 : colors.red }]}>
                {m.type === 'INGRESO' ? '+' : '-'}${(m.amount ?? 0).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 18, paddingTop: 24 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas },
  cargandoTexto: { marginTop: 10, color: colors.muted, fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerCuenta: { flex: 1, minWidth: 0, marginRight: 10 },
  cuentaTitulo: { fontSize: 22, fontWeight: '700', color: colors.green950, letterSpacing: -0.4 },
  badgeCuenta: { backgroundColor: colors.green100, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, marginTop: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  badgeTexto: { fontSize: 10, fontWeight: '700', color: colors.green800 },
  btnLogout: { backgroundColor: colors.redSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, flexShrink: 0 },
  btnLogoutTexto: { color: colors.red, fontWeight: '700', fontSize: 12 },
  cardBalance: { backgroundColor: colors.green800, borderRadius: 16, padding: 20, marginBottom: 15, elevation: 0 },
  balanceLabel: { fontSize: 12, fontWeight: '600', color: '#c7dccf', textAlign: 'center' },
  balanceMonto: { fontSize: 34, fontWeight: '700', textAlign: 'center', marginVertical: 8, letterSpacing: -0.8 },
  resumenRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  resumenCol: { alignItems: 'center' },
  resumenSublabel: { fontSize: 11, color: '#c7dccf', fontWeight: '600' },
  resumenValorIngreso: { fontSize: 15, fontWeight: '700', color: colors.white, marginTop: 3 },
  resumenValorGasto: { fontSize: 15, fontWeight: '700', color: '#ffd4ca', marginTop: 3 },
  dividerVertical: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  sectionCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 15, padding: 17, marginBottom: 14, elevation: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.green950, marginBottom: 14 },
  barChartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, paddingVertical: 10 },
  barCol: { alignItems: 'center', width: '35%' },
  barTrack: { height: 90, width: 24, backgroundColor: '#edf1ed', borderRadius: 12, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 12 },
  barLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, marginTop: 6 },
  catGraphItem: { marginBottom: 15 },
  catGraphHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { fontSize: 12, fontWeight: '700', color: colors.ink },
  catMonto: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  catTrackBar: { height: 7, backgroundColor: '#edf1ed', borderRadius: 5, overflow: 'hidden' },
  catFillBar: { height: '100%', backgroundColor: colors.green700, borderRadius: 5 },
  movCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  movIcon: { fontSize: 20, marginRight: 12 },
  movDetalle: { flex: 1 },
  movCat: { fontSize: 13, fontWeight: '700', color: colors.ink },
  movDesc: { fontSize: 11, color: colors.muted },
  movMonto: { fontSize: 13, fontWeight: '700' },
  vacioTexto: { color: colors.muted, fontSize: 12, textAlign: 'center', marginVertical: 10 }
});