import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerDashboardReal, obtenerMovimientosReal } from '../api';
import { colors } from '../theme';

const moneda = (valor) => `$${(Number(valor) || 0).toFixed(2)}`;

export default function DashboardScreen({ token, navigation, usuario }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [datos, setDatos] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [offline, setOffline] = useState(false);

  const cargarDashboard = useCallback(async () => {
    const [resumen, historial] = await Promise.all([
      obtenerDashboardReal(token),
      obtenerMovimientosReal(token)
    ]);
    if (resumen.exito) {
      setDatos(resumen.datos);
      setOffline(Boolean(resumen.offline));
    } else Alert.alert('Atención', resumen.mensaje || 'No se pudo actualizar el resumen.');
    if (historial.exito) setMovimientos(historial.movimientos || []);
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useFocusEffect(useCallback(() => {
    cargarDashboard();
  }, [cargarDashboard]));

  const resumen = datos?.resumen || {};
  const ingresos = Number(resumen.totalIngresos || 0);
  const gastos = Number(resumen.totalGastos || 0);
  const balance = Number(resumen.balanceTotal ?? ingresos - gastos);
  const cuentas = datos?.resumenCuentas || {};
  const hoy = new Date();
  const haceUnaSemana = new Date(hoy);
  haceUnaSemana.setDate(hoy.getDate() - 6);
  const gastosSemanales = movimientos
    .filter((item) => item.type === 'GASTO' && new Date(item.date) >= haceUnaSemana && new Date(item.date) <= hoy)
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const tasaAhorro = ingresos > 0 ? (balance / ingresos) * 100 : null;
  const nombreCuenta = typeof datos?.cuenta === 'string' ? datos.cuenta : datos?.cuenta?.name;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue700} />
        <Text style={styles.muted}>Cargando tus finanzas...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargarDashboard(); }}
          colors={[colors.blue700]}
        />
      }
    >
      <View style={styles.welcomeRow}>
        <View style={styles.flex}>
          <Text style={styles.greeting}>Hola, {usuario?.name?.split(' ')[0] || nombreCuenta || 'bienvenido'} 👋</Text>
          <Text style={styles.caption}>{offline ? 'Última sincronización guardada' : 'Este es tu resumen financiero'}</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreNumber}>{tasaAhorro === null ? '—' : `${tasaAhorro.toFixed(0)}%`}</Text>
          <Text style={styles.scoreCaption}>AHORRO</Text>
        </View>
      </View>

      <View style={styles.balanceCard}>
        <View style={styles.cardLabelRow}>
          <Text style={styles.balanceLabel}>Balance del mes</Text>
          <Text style={styles.monthTag}>{hoy.toLocaleDateString('es', { month: 'long' })}</Text>
        </View>
        <Text style={styles.balanceAmount}>{moneda(balance)}</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Ingresos</Text>
            <Text style={styles.income}>{moneda(ingresos)}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Gastos</Text>
            <Text style={styles.expense}>{moneda(gastos)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {[
          ['＋', 'Ingreso', 'INGRESO'],
          ['↗', 'Gasto', 'GASTO'],
          ['⇄', 'Transferir', 'Cuentas']
        ].map(([icon, label, target]) => (
          <TouchableOpacity
            key={label}
            style={styles.action}
            onPress={() => target === 'Cuentas' ? navigation.navigate(target) : navigation.navigate('Movimientos', { abrirNuevo: true, tipoInicial: target })}
          >
            <View style={styles.actionIcon}><Text style={styles.actionIconText}>{icon}</Text></View>
            <Text style={styles.actionLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Actividad de la semana</Text>
        <Text style={styles.seeAll} onPress={() => navigation.navigate('Movimientos')}>Ver movimientos</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.weekSummary}>
          <Text style={styles.largeMetric}>{moneda(gastosSemanales)}</Text>
          <Text style={styles.caption}>gastados en los últimos 7 días</Text>
        </View>
        <View style={styles.weekBars}>
          {Array.from({ length: 7 }, (_, index) => {
            const date = new Date(haceUnaSemana);
            date.setDate(haceUnaSemana.getDate() + index);
            const amount = movimientos
              .filter((item) => item.type === 'GASTO' && new Date(item.date).toDateString() === date.toDateString())
              .reduce((total, item) => total + Number(item.amount || 0), 0);
            const maximum = Math.max(...Array.from({ length: 7 }, (_, day) => {
              const d = new Date(haceUnaSemana);
              d.setDate(haceUnaSemana.getDate() + day);
              return movimientos
                .filter((item) => item.type === 'GASTO' && new Date(item.date).toDateString() === d.toDateString())
                .reduce((total, item) => total + Number(item.amount || 0), 0);
            }), 1);
            return (
              <View key={index} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${amount > 0 ? Math.max(5, (amount / maximum) * 100) : 0}%` }]} />
                </View>
                <Text style={styles.barLabel}>{date.toLocaleDateString('es', { weekday: 'narrow' })}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.insightCard}>
        <Text style={styles.insightEyebrow}>TU PROGRESO</Text>
        <Text style={styles.insightTitle}>Vas por buen camino</Text>
        <Text style={styles.insightText}>
          {ingresos > 0
            ? balance >= 0
              ? `Tu tasa de ahorro este mes es ${tasaAhorro.toFixed(0)}%. Mantén el ritmo para alcanzar tus metas.`
              : 'Tus gastos superan los ingresos del mes. Revisa el detalle para encontrar oportunidades de ahorro.'
            : 'Registra tus ingresos y gastos para descubrir oportunidades de ahorro.'}
        </Text>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Movimientos recientes</Text>
        <Text style={styles.seeAll} onPress={() => navigation.navigate('Movimientos')}>Ver todos</Text>
      </View>
      <View style={styles.card}>
        {(datos?.ultimosMovimientos || []).length === 0 ? (
          <Text style={styles.empty}>Aún no tienes movimientos. Registra el primero con el botón +.</Text>
        ) : (datos.ultimosMovimientos || []).slice(0, 5).map((item, index) => (
          <View key={item.id || index} style={[styles.transaction, index > 0 && styles.transactionBorder]}>
            <View style={styles.transactionIcon}><Text>{item.category?.icon || '•'}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.transactionTitle}>{item.category?.name || 'Movimiento'}</Text>
              <Text style={styles.transactionDetail}>{item.description || 'Sin detalle'} · {item.financialAccount?.name || 'Cuenta'}</Text>
            </View>
            <Text style={[styles.transactionAmount, item.type === 'INGRESO' ? styles.income : styles.expense]}>
              {item.type === 'INGRESO' ? '+' : '−'}{moneda(item.amount)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.accountLink}>
        <Text style={styles.accountLinkTitle}>Patrimonio neto</Text>
        <Text style={styles.accountLinkAmount}>{moneda(cuentas.patrimonioNeto)}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cuentas')}>
          <Text style={styles.seeAll}>Ver cuentas →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingBottom: 34 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  muted: { color: colors.muted, marginTop: 10, fontSize: 13 },
  flex: { flex: 1, minWidth: 0 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  greeting: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  caption: { color: colors.muted, fontSize: 12, marginTop: 5 },
  scoreBadge: { height: 54, width: 54, borderRadius: 18, backgroundColor: colors.emerald100, alignItems: 'center', justifyContent: 'center' },
  scoreNumber: { color: colors.emerald700, fontWeight: '800', fontSize: 17 },
  scoreCaption: { color: colors.emerald700, fontSize: 7, fontWeight: '800', letterSpacing: 0.6 },
  balanceCard: { backgroundColor: colors.blue700, borderRadius: 22, padding: 22, marginBottom: 16 },
  cardLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: '#dbeafe', fontSize: 13, fontWeight: '600' },
  monthTag: { color: colors.white, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  balanceAmount: { color: colors.white, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, marginTop: 10 },
  metricsRow: { flexDirection: 'row', alignItems: 'center', borderTopColor: 'rgba(255,255,255,0.24)', borderTopWidth: 1, marginTop: 18, paddingTop: 16 },
  metric: { flex: 1 },
  metricLabel: { color: '#dbeafe', fontSize: 11, marginBottom: 5 },
  income: { color: colors.emerald700, fontSize: 14, fontWeight: '800' },
  expense: { color: colors.red, fontSize: 14, fontWeight: '800' },
  metricDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 18 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  action: { alignItems: 'center', flex: 1 },
  actionIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionIconText: { color: colors.blue700, fontSize: 23, fontWeight: '700' },
  actionLabel: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 7 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 2 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  seeAll: { color: colors.blue700, fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.line, marginBottom: 18 },
  weekSummary: { marginBottom: 12 },
  largeMetric: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  weekBars: { height: 92, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { height: 65, width: 16, borderRadius: 8, backgroundColor: colors.blue50, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: colors.blue600, borderRadius: 8 },
  barLabel: { color: colors.muted, fontSize: 9, marginTop: 7 },
  insightCard: { padding: 18, borderRadius: 18, backgroundColor: colors.emerald100, marginBottom: 22 },
  insightEyebrow: { color: colors.emerald700, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  insightTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 7 },
  insightText: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 5 },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingVertical: 6 },
  transaction: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  transactionBorder: { borderTopColor: colors.line, borderTopWidth: 1 },
  transactionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  transactionTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  transactionDetail: { color: colors.muted, fontSize: 10, marginTop: 4 },
  transactionAmount: { fontSize: 11, fontWeight: '800', marginLeft: 6 },
  accountLink: { padding: 17, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 8 },
  accountLinkTitle: { color: colors.muted, fontSize: 11 },
  accountLinkAmount: { color: colors.ink, fontSize: 21, fontWeight: '800', marginVertical: 6 }
});
