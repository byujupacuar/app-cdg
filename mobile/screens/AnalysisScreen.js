import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerAnalisisReal } from '../api';
import { colors } from '../theme';
import { formatCurrency } from '../currency';

const fechaLocal = (fecha) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const crearRango = (key) => {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (key === '7D') inicio.setDate(inicio.getDate() - 6);
  if (key === '30D') inicio.setDate(inicio.getDate() - 29);
  if (key === '90D') inicio.setDate(inicio.getDate() - 89);
  if (key === 'MES') inicio.setDate(1);
  return { fechaInicio: fechaLocal(inicio), fechaFin: fechaLocal(hoy) };
};

const rangos = [
  { key: '7D', label: '7 días' },
  { key: '30D', label: '30 días' },
  { key: '90D', label: '90 días' },
  { key: 'MES', label: 'Este mes' }
];

const coloresGrafico = ['#2563eb', '#10b981', '#f59e0b', '#ef6b6b', '#8b5cf6', '#06b6d4'];
const DONUT_TAMANO = 220;
const DONUT_RADIO = 90;
const DONUT_CIRCUNFERENCIA = 2 * Math.PI * DONUT_RADIO;

const fechaCorta = (value) => new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC'
}).format(new Date(`${value}T00:00:00.000Z`));

export default function AnalysisScreen({ token, currencyCode = 'USD' }) {
  const moneda = (valor) => formatCurrency(valor, currencyCode);
  const [datos, setDatos] = useState(null);
  const [rango, setRango] = useState('30D');
  const [fechas, setFechas] = useState(() => crearRango('30D'));
  const [cuentaId, setCuentaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await obtenerAnalisisReal(token, {
      dateFrom: fechas.fechaInicio,
      dateTo: fechas.fechaFin,
      financialAccountId: cuentaId || undefined
    });
    if (res.exito) {
      setDatos(res.datos);
      setOffline(Boolean(res.offline));
    } else {
      setError(res.mensaje || 'No se pudo consultar el análisis.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [token, fechas, cuentaId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const movimientos = useMemo(() => datos?.ultimosMovimientos || [], [datos?.ultimosMovimientos]);
  const resumen = datos?.resumen || {};
  const ingresos = Number(resumen.totalIngresos) || 0;
  const gastos = Number(resumen.totalGastos) || 0;
  const balance = Number(resumen.balanceTotal) || ingresos - gastos;
  const totalMovimientos = Number(resumen.totalMovimientos) || 0;
  const movimientosGasto = movimientos.filter((item) => item.type === 'GASTO');
  const promedioGasto = movimientosGasto.length ? gastos / movimientosGasto.length : 0;
  const categorias = datos?.gastosPorCategoria || [];
  const cuentas = datos?.resumenCuentas?.cuentas || [];
  const cuentaSeleccionada = cuentas.find((cuenta) => cuenta.id === cuentaId);
  const inicioUTC = Date.parse(`${fechas.fechaInicio}T00:00:00.000Z`);
  const finUTC = Date.parse(`${fechas.fechaFin}T00:00:00.000Z`);
  const diasPeriodo = Math.max(1, Math.floor((finUTC - inicioUTC) / 86400000) + 1);
  const cantidadIntervalos = Math.min(12, diasPeriodo);
  const periodos = useMemo(() => {
    const serie = Array.from({ length: cantidadIntervalos }, (_, index) => {
      const inicioDia = Math.floor(index * diasPeriodo / cantidadIntervalos);
      return {
        label: fechaCorta(new Date(inicioUTC + inicioDia * 86400000).toISOString().slice(0, 10)),
        ingresos: 0,
        gastos: 0
      };
    });
    movimientos.forEach((movimiento) => {
      const fechaUTC = Date.parse(`${String(movimiento.date).slice(0, 10)}T00:00:00.000Z`);
      const diasDesdeInicio = Math.floor((fechaUTC - inicioUTC) / 86400000);
      if (diasDesdeInicio < 0 || diasDesdeInicio >= diasPeriodo) return;
      const index = Math.min(cantidadIntervalos - 1, Math.floor(diasDesdeInicio * cantidadIntervalos / diasPeriodo));
      if (movimiento.type === 'INGRESO') serie[index].ingresos += Number(movimiento.amount) || 0;
      if (movimiento.type === 'GASTO') serie[index].gastos += Number(movimiento.amount) || 0;
    });
    return serie;
  }, [cantidadIntervalos, diasPeriodo, inicioUTC, movimientos]);
  const maxBarra = Math.max(1, ...periodos.map((item) => Math.max(item.ingresos, item.gastos)));
  const cambiarRango = (key) => {
    setRango(key);
    setFechas(crearRango(key));
  };
  const fechaVisible = (value) => new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00.000Z`));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.blue700} /><Text style={styles.muted}>Preparando análisis...</Text></View>;
  }

  if (error && !datos) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={cargar}>
          <Text style={styles.retryText}>Intentar de nuevo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const categoriasVisibles = categorias.slice(0, 5).map((categoria, index) => ({
    ...categoria,
    color: coloresGrafico[index]
  }));
  const otrasCategorias = categorias.slice(5).reduce((total, categoria) => total + Number(categoria.monto || 0), 0);
  if (otrasCategorias > 0) {
    categoriasVisibles.push({
      id: 'otras',
      nombre: 'Otras categorías',
      icono: '◇',
      monto: otrasCategorias,
      porcentaje: gastos > 0 ? otrasCategorias / gastos * 100 : 0,
      color: coloresGrafico[5]
    });
  }
  const segmentos = categoriasVisibles.reduce((resultado, categoria) => {
    const longitud = DONUT_CIRCUNFERENCIA * (gastos > 0 ? Number(categoria.monto) / gastos : 0);
    const anterior = resultado[resultado.length - 1];
    return [
      ...resultado,
      { ...categoria, longitud, desplazamiento: anterior ? anterior.desplazamiento + anterior.longitud : 0 }
    ];
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[colors.blue700]} />}
    >
      <Text style={styles.title}>Análisis</Text>
      <Text style={styles.subtitle}>Explora tus tendencias y movimientos del período.</Text>

      <View style={styles.rangeRow}>
        {rangos.map((item) => (
          <TouchableOpacity key={item.key} style={[styles.rangeButton, rango === item.key && styles.rangeSelected]} onPress={() => cambiarRango(item.key)}>
            <Text style={[styles.rangeText, rango === item.key && styles.rangeTextSelected]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.periodLabel}>
        {fechaVisible(fechas.fechaInicio)} – {fechaVisible(fechas.fechaFin)}
      </Text>

      <Text style={styles.filterLabel}>Cuenta</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountFilters}>
        {[{ id: '', name: 'Todas las cuentas' }, ...cuentas].map((cuenta) => (
          <TouchableOpacity
            key={cuenta.id || 'todas'}
            style={[styles.accountFilter, cuentaId === cuenta.id && styles.accountFilterSelected]}
            onPress={() => setCuentaId(cuenta.id)}
          >
            <Text style={[styles.accountFilterText, cuentaId === cuenta.id && styles.accountFilterTextSelected]}>
              {cuenta.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {cuentaSeleccionada && (
        <Text style={styles.accountContext}>Mostrando movimientos de {cuentaSeleccionada.name}.</Text>
      )}
      {offline && <Text style={styles.offlineNote}>Mostrando datos guardados en el dispositivo.</Text>}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Ingresos</Text>
          <Text style={[styles.metricValue, styles.incomeText]} numberOfLines={1}>{moneda(ingresos)}</Text>
          <Text style={styles.metricNote}>Total recibido</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Gastos</Text>
          <Text style={[styles.metricValue, styles.expenseText]} numberOfLines={1}>{moneda(gastos)}</Text>
          <Text style={styles.metricNote}>Total utilizado</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Balance neto</Text>
          <Text style={[styles.metricValue, balance < 0 ? styles.expenseText : styles.incomeText]} numberOfLines={1}>{moneda(balance)}</Text>
          <Text style={styles.metricNote}>Ingresos menos gastos</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Actividad</Text>
          <Text style={styles.metricValue}>{totalMovimientos}</Text>
          <Text style={styles.metricNote}>{moneda(promedioGasto)} promedio por gasto</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <View style={styles.cardHeadingText}>
            <Text style={styles.eyebrow}>EVOLUCIÓN DEL PERÍODO</Text>
            <Text style={styles.cardTitle}>Ingresos y gastos en el tiempo</Text>
          </View>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.emerald700 }]} /><Text style={styles.legendText}>Ingresos</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.red }]} /><Text style={styles.legendText}>Gastos</Text></View>
        </View>
        {movimientos.length === 0 ? (
          <Text style={styles.empty}>No hay actividad para graficar en este período.</Text>
        ) : (
          <View style={styles.chart}>
            {periodos.map((item, index) => (
              <View key={`${item.label}-${index}`} style={styles.chartGroup}>
                <View style={styles.bars}>
                  <View style={[styles.bar, styles.incomeBar, { height: item.ingresos > 0 ? `${Math.max(4, item.ingresos / maxBarra * 100)}%` : 0 }]} />
                  <View style={[styles.bar, styles.expenseBar, { height: item.gastos > 0 ? `${Math.max(4, item.gastos / maxBarra * 100)}%` : 0 }]} />
                </View>
                <Text style={styles.chartLabel} numberOfLines={1}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.chartCaption}>Cada grupo resume la actividad de ese tramo del período.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.eyebrow}>DISTRIBUCIÓN</Text>
            <Text style={styles.cardTitle}>¿En qué gastaste?</Text>
          </View>
          <Text style={styles.caption}>{categorias.length} {categorias.length === 1 ? 'categoría' : 'categorías'}</Text>
        </View>
        {categoriasVisibles.length === 0 ? (
          <Text style={styles.empty}>No hay gastos en este período.</Text>
        ) : (
          <>
            <View style={styles.categoryChartWrap}>
              <Svg
                width="100%"
                height={DONUT_TAMANO}
                viewBox={`0 0 ${DONUT_TAMANO} ${DONUT_TAMANO}`}
                accessibilityRole="image"
                accessibilityLabel={`Distribución de gastos por categoría. Total ${moneda(gastos)}`}
              >
                <Circle
                  cx={DONUT_TAMANO / 2}
                  cy={DONUT_TAMANO / 2}
                  r={DONUT_RADIO}
                  fill="none"
                  stroke={colors.line}
                  strokeWidth="32"
                />
                {segmentos.map((segmento) => (
                  <Circle
                    key={segmento.id || segmento.nombre}
                    cx={DONUT_TAMANO / 2}
                    cy={DONUT_TAMANO / 2}
                    r={DONUT_RADIO}
                    fill="none"
                    stroke={segmento.color}
                    strokeWidth="32"
                    strokeDasharray={`${segmento.longitud} ${DONUT_CIRCUNFERENCIA - segmento.longitud}`}
                    strokeDashoffset={-segmento.desplazamiento}
                    rotation="-90"
                    origin={`${DONUT_TAMANO / 2}, ${DONUT_TAMANO / 2}`}
                  />
                ))}
              </Svg>
            </View>
            <View style={styles.categoryTotal}>
              <Text style={styles.categoryTotalLabel}>Total de gastos</Text>
              <Text style={styles.categoryTotalAmount}>{moneda(gastos)}</Text>
            </View>
            {categoriasVisibles.map((item, index) => {
              const porcentaje = Number(item.porcentaje) || (gastos > 0 ? Number(item.monto) / gastos * 100 : 0);
              return (
                <View key={item.id || item.nombre} style={[styles.categoryItem, index > 0 && styles.categoryBorder]}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryIdentity}>
                      <View style={[styles.categoryIcon, { backgroundColor: `${item.color}18` }]}>
                        <Text>{item.icono || '◇'}</Text>
                      </View>
                      <Text style={styles.categoryName} numberOfLines={1}>{item.nombre}</Text>
                    </View>
                    <Text style={styles.categoryAmount}>{moneda(item.monto)}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.categoryProgress, { width: `${Math.min(100, porcentaje)}%`, backgroundColor: item.color }]} />
                  </View>
                  <Text style={styles.categoryPercent}>{porcentaje.toFixed(1)}% de los gastos</Text>
                </View>
              );
            })}
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.eyebrow}>ACTIVIDAD</Text>
            <Text style={styles.cardTitle}>Movimientos del período</Text>
          </View>
          <Text style={styles.caption}>{totalMovimientos}</Text>
        </View>
        {movimientos.length === 0 ? (
          <Text style={styles.empty}>No hay movimientos dentro de este período.</Text>
        ) : movimientos.slice(0, 10).map((item, index) => {
          const esGasto = item.type === 'GASTO';
          return (
            <View key={item.id} style={[styles.activityItem, index > 0 && styles.categoryBorder]}>
              <View style={styles.activityIcon}><Text>{item.category?.icon || '◇'}</Text></View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityName} numberOfLines={1}>{item.category?.name || 'General'}</Text>
                <Text style={styles.activityDescription} numberOfLines={2}>
                  {item.description || 'Sin detalle'} · {item.financialAccount?.name || 'Sin cuenta'}
                </Text>
                <Text style={styles.activityDate}>{fechaVisible(String(item.date).slice(0, 10))}</Text>
              </View>
              <Text style={[styles.activityAmount, esGasto ? styles.expenseText : styles.incomeText]}>
                {esGasto ? '−' : '+'}{moneda(item.amount)}
              </Text>
            </View>
          );
        })}
        {totalMovimientos > movimientos.length && (
          <Text style={styles.chartCaption}>Mostrando los últimos {movimientos.length} de {totalMovimientos} movimientos.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  muted: { color: colors.muted, fontSize: 13, marginTop: 9 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 16 },
  rangeRow: { flexDirection: 'row', padding: 4, backgroundColor: '#edf1f7', borderRadius: 12, marginBottom: 10 },
  rangeButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  rangeSelected: { backgroundColor: colors.white, elevation: 1 },
  rangeText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  rangeTextSelected: { color: colors.blue700, fontWeight: '800' },
  periodLabel: { color: colors.muted, fontSize: 12, marginBottom: 16 },
  filterLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  accountFilters: { gap: 8, paddingBottom: 12 },
  accountFilter: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  accountFilterSelected: { backgroundColor: colors.blue50, borderColor: colors.blue700 },
  accountFilterText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  accountFilterTextSelected: { color: colors.blue700, fontWeight: '800' },
  accountContext: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  offlineNote: { backgroundColor: colors.blue50, borderRadius: 8, color: colors.blue700, fontSize: 12, marginBottom: 12, padding: 10 },
  errorText: { color: colors.red, fontSize: 13, lineHeight: 20, marginBottom: 10, textAlign: 'center' },
  retryButton: { backgroundColor: colors.blue700, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metricCard: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 13, borderWidth: 1, flexBasis: '48%', flexGrow: 1, minWidth: 140, padding: 14 },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  metricValue: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 7 },
  incomeText: { color: colors.emerald700 },
  expenseText: { color: colors.red },
  metricNote: { color: colors.muted, fontSize: 10, marginTop: 5 },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardHeadingText: { flexShrink: 1 },
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginBottom: 7 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.muted },
  card: { backgroundColor: colors.white, padding: 17, borderRadius: 16, borderColor: colors.line, borderWidth: 1, marginBottom: 16, width: '100%' },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 3 },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 12 },
  chart: { height: 190, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  chartGroup: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bars: { width: '100%', height: '90%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, paddingHorizontal: 3 },
  bar: { width: '38%', maxWidth: 18, minHeight: 2, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  incomeBar: { backgroundColor: colors.emerald700 },
  expenseBar: { backgroundColor: colors.red },
  chartLabel: { color: colors.muted, fontSize: 10, marginTop: 8, maxWidth: '100%', textAlign: 'center' },
  chartCaption: { color: colors.muted, fontSize: 11, marginTop: 12, textAlign: 'center' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  caption: { color: colors.muted, fontSize: 12 },
  categoryTotal: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: 12, marginBottom: 8, padding: 14 },
  categoryTotalLabel: { color: colors.muted, fontSize: 12 },
  categoryTotalAmount: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 4 },
  categoryItem: { paddingVertical: 11 },
  categoryBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  categoryIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  categoryIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  categoryName: { color: colors.ink, flexShrink: 1, fontSize: 13, fontWeight: '700' },
  categoryAmount: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 7, backgroundColor: '#eaf0f7', borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  categoryProgress: { height: '100%', backgroundColor: colors.emerald700, borderRadius: 5 },
  categoryPercent: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 5 },
  activityItem: { alignItems: 'center', flexDirection: 'row', minHeight: 62, paddingVertical: 10 },
  activityIcon: { alignItems: 'center', backgroundColor: colors.blue50, borderRadius: 11, height: 34, justifyContent: 'center', marginRight: 10, width: 34 },
  activityDetails: { flex: 1, minWidth: 0 },
  activityName: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  activityDescription: { color: colors.muted, fontSize: 11, marginTop: 2 },
  activityDate: { color: colors.muted, fontSize: 10, marginTop: 3 },
  activityAmount: { fontSize: 12, fontWeight: '800', marginLeft: 8, maxWidth: '38%', textAlign: 'right' }
});
