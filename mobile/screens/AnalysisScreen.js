import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerMovimientosReal } from '../api';
import { colors } from '../theme';

const rangos = [
  { key: '7D', label: '7 días', dias: 7, grupos: 7 },
  { key: '30D', label: '30 días', dias: 30, grupos: 4 },
  { key: '90D', label: '90 días', dias: 90, grupos: 3 }
];
const moneda = (valor) => `$${(Number(valor) || 0).toFixed(2)}`;

export default function AnalysisScreen({ token }) {
  const [movimientos, setMovimientos] = useState([]);
  const [rango, setRango] = useState('30D');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    const res = await obtenerMovimientosReal(token);
    if (res.exito) setMovimientos(res.movimientos || []);
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const seleccion = rangos.find((item) => item.key === rango) || rangos[1];
  const inicio = (() => {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    fecha.setDate(fecha.getDate() - (seleccion.dias - 1));
    return fecha;
  })();
  const movimientosRango = movimientos.filter((item) => {
    const fecha = new Date(item.date);
    return !Number.isNaN(fecha.getTime()) && fecha >= inicio && fecha <= new Date();
  });
  const ingresos = movimientosRango
    .filter((item) => item.type === 'INGRESO')
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const gastos = movimientosRango
    .filter((item) => item.type === 'GASTO')
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const excedente = ingresos - gastos;
  const tasaAhorro = ingresos > 0 ? excedente / ingresos * 100 : 0;

  const periodos = Array.from({ length: seleccion.grupos }, (_, index) => {
    const diasPorGrupo = seleccion.dias / seleccion.grupos;
    const desde = new Date(inicio);
    desde.setDate(inicio.getDate() + Math.floor(index * diasPorGrupo));
    const hasta = new Date(inicio);
    hasta.setDate(inicio.getDate() + Math.floor((index + 1) * diasPorGrupo));
    if (index === seleccion.grupos - 1) hasta.setTime(new Date().getTime() + 1);
    const items = movimientosRango.filter((item) => {
      const fecha = new Date(item.date);
      return fecha >= desde && fecha < hasta;
    });
    return {
      label: seleccion.key === '7D'
        ? desde.toLocaleDateString('es', { weekday: 'short' })
        : desde.toLocaleDateString('es', { day: 'numeric', month: 'short' }),
      ingresos: items.filter((item) => item.type === 'INGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0),
      gastos: items.filter((item) => item.type === 'GASTO').reduce((sum, item) => sum + Number(item.amount || 0), 0)
    };
  });
  const maxBarra = Math.max(1, ...periodos.flatMap((item) => [item.ingresos, item.gastos]));
  const categorias = (() => {
    const agrupado = new Map();
    movimientosRango.filter((item) => item.type === 'GASTO').forEach((item) => {
      const key = item.category?.id || item.category?.name || 'general';
      const anterior = agrupado.get(key) || {
        key,
        nombre: item.category?.name || 'General',
        icono: item.category?.icon || '•',
        total: 0
      };
      anterior.total += Number(item.amount || 0);
      agrupado.set(key, anterior);
    });
    return Array.from(agrupado.values()).sort((a, b) => b.total - a.total);
  })();

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.blue700} /><Text style={styles.muted}>Preparando análisis...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[colors.blue700]} />}
    >
      <Text style={styles.title}>Análisis</Text>
      <Text style={styles.subtitle}>Entiende cómo se mueve tu dinero</Text>

      <View style={styles.rangeRow}>
        {rangos.map((item) => (
          <TouchableOpacity key={item.key} style={[styles.rangeButton, rango === item.key && styles.rangeSelected]} onPress={() => setRango(item.key)}>
            <Text style={[styles.rangeText, rango === item.key && styles.rangeTextSelected]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.eyebrow}>EXCEDENTE DEL PERÍODO</Text>
        <Text style={[styles.surplus, excedente < 0 && styles.negative]}>{moneda(excedente)}</Text>
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryText}>Tasa de ahorro</Text>
          <Text style={styles.savingsRate}>{ingresos > 0 ? `${tasaAhorro.toFixed(1)}%` : '—'}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, tasaAhorro))}%` }]} />
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.blue700 }]} /><Text style={styles.legendText}>Ingresos</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.emerald700 }]} /><Text style={styles.legendText}>Gastos</Text></View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ingresos vs. gastos</Text>
        {movimientosRango.length === 0 ? (
          <Text style={styles.empty}>No hay actividad en este período para mostrar.</Text>
        ) : (
          <View style={styles.chart}>
            {periodos.map((item, index) => (
              <View key={`${item.label}-${index}`} style={styles.chartGroup}>
                <View style={styles.bars}>
                  <View style={[styles.bar, styles.incomeBar, { height: `${item.ingresos > 0 ? Math.max(5, item.ingresos / maxBarra * 100) : 0}%` }]} />
                  <View style={[styles.bar, styles.expenseBar, { height: `${item.gastos > 0 ? Math.max(5, item.gastos / maxBarra * 100) : 0}%` }]} />
                </View>
                <Text style={styles.chartLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.totalsRow}>
          <View><Text style={styles.totalLabel}>Ingresos</Text><Text style={styles.totalIncome}>{moneda(ingresos)}</Text></View>
          <View><Text style={styles.totalLabel}>Gastos</Text><Text style={styles.totalExpense}>{moneda(gastos)}</Text></View>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.cardTitle}>Gastos por categoría</Text>
        <Text style={styles.caption}>{categorias.length} {categorias.length === 1 ? 'categoría' : 'categorías'}</Text>
      </View>
      <View style={styles.card}>
        {categorias.length === 0 ? (
          <Text style={styles.empty}>Aún no hay gastos para analizar en este período.</Text>
        ) : categorias.map((item, index) => {
          const porcentaje = gastos > 0 ? item.total / gastos * 100 : 0;
          return (
            <View key={item.key} style={[styles.categoryItem, index > 0 && styles.categoryBorder]}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryIdentity}>
                  <View style={styles.categoryIcon}><Text>{item.icono}</Text></View>
                  <Text style={styles.categoryName}>{item.nombre}</Text>
                </View>
                <Text style={styles.categoryAmount}>{moneda(item.total)}</Text>
              </View>
              <View style={styles.progressTrack}><View style={[styles.categoryProgress, { width: `${porcentaje}%` }]} /></View>
              <Text style={styles.categoryPercent}>{porcentaje.toFixed(0)}% de tus gastos</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.insight}>
        <Text style={styles.insightIcon}>✦</Text>
        <View style={styles.insightCopy}>
          <Text style={styles.insightTitle}>{categorias[0] ? `${categorias[0].nombre} es tu mayor gasto` : 'Tu análisis empieza aquí'}</Text>
          <Text style={styles.insightText}>
            {categorias[0]
              ? `Representa ${gastos > 0 ? (categorias[0].total / gastos * 100).toFixed(0) : 0}% de tus gastos en el período.`
              : 'Cuando registres gastos, verás aquí en qué categorías se concentra tu dinero.'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  muted: { color: colors.muted, fontSize: 12, marginTop: 9 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, marginBottom: 19 },
  rangeRow: { flexDirection: 'row', padding: 4, backgroundColor: '#edf1f7', borderRadius: 12, marginBottom: 15 },
  rangeButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  rangeSelected: { backgroundColor: colors.white, elevation: 1 },
  rangeText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  rangeTextSelected: { color: colors.blue700, fontWeight: '800' },
  summaryCard: { borderRadius: 20, backgroundColor: colors.blue700, padding: 20, marginBottom: 18 },
  eyebrow: { color: '#dbeafe', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  surplus: { color: colors.white, fontSize: 31, fontWeight: '800', marginTop: 9 },
  negative: { color: '#ffe3df' },
  summaryFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 19, marginBottom: 8 },
  summaryText: { color: '#dbeafe', fontSize: 11 },
  savingsRate: { color: colors.white, fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 7, backgroundColor: '#eaf0f7', borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: colors.emerald700, borderRadius: 5 },
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginBottom: 9 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10, color: colors.muted },
  card: { backgroundColor: colors.white, padding: 16, borderRadius: 18, borderColor: colors.line, borderWidth: 1, marginBottom: 19 },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingVertical: 12 },
  chart: { height: 132, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 },
  chartGroup: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bars: { width: '68%', height: 100, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  bar: { width: 9, minHeight: 2, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  incomeBar: { backgroundColor: colors.blue700 },
  expenseBar: { backgroundColor: colors.emerald700 },
  chartLabel: { color: colors.muted, fontSize: 8, marginTop: 8 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 14, marginTop: 13 },
  totalLabel: { color: colors.muted, fontSize: 10 },
  totalIncome: { color: colors.blue700, fontSize: 13, fontWeight: '800', marginTop: 4 },
  totalExpense: { color: colors.emerald700, fontSize: 13, fontWeight: '800', marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  caption: { color: colors.muted, fontSize: 10 },
  categoryItem: { paddingVertical: 11 },
  categoryBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryIdentity: { flexDirection: 'row', alignItems: 'center' },
  categoryIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  categoryName: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  categoryAmount: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  categoryProgress: { height: '100%', backgroundColor: colors.emerald700, borderRadius: 5 },
  categoryPercent: { color: colors.muted, fontSize: 9, textAlign: 'right', marginTop: 5 },
  insight: { flexDirection: 'row', backgroundColor: colors.emerald100, borderRadius: 16, padding: 15, marginBottom: 8 },
  insightIcon: { color: colors.emerald700, fontSize: 19, marginRight: 10 },
  insightCopy: { flex: 1 },
  insightTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  insightText: { color: colors.ink, fontSize: 11, lineHeight: 16, marginTop: 4 }
});
