import React, { useCallback, useEffect, useState } from 'react';
import { exportarMovimientosCSV, obtenerDashboard } from '../services/api';
import { formatCurrency } from '../currency';

const fechaLocal = (fecha) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const rangoRapido = (preset) => {
  const hoy = new Date();
  const fin = fechaLocal(hoy);
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  if (preset === '7dias') inicio.setDate(inicio.getDate() - 6);
  if (preset === '30dias') inicio.setDate(inicio.getDate() - 29);
  if (preset === 'mes') inicio.setDate(1);

  return { fechaInicio: fechaLocal(inicio), fechaFin: fin };
};

const rangoDelMes = (mes) => {
  const [anio, numeroMes] = mes.split('-').map(Number);
  const inicio = new Date(anio, numeroMes - 1, 1);
  const fin = new Date(anio, numeroMes, 0);
  return { fechaInicio: fechaLocal(inicio), fechaFin: fechaLocal(fin) };
};

const inicial = rangoRapido('30dias');

const fechaLegible = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
};

const fechaCorta = (value) => new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC'
}).format(new Date(`${value}T00:00:00.000Z`));

const coloresGrafico = ['#2563eb', '#10b981', '#f59e0b', '#ef6b6b', '#8b5cf6', '#06b6d4'];

export default function Analisis({ refreshKey, onNavigate, currencyCode = 'USD' }) {
  const currency = (value) => formatCurrency(value, currencyCode);
  const [desde, setDesde] = useState(inicial.fechaInicio);
  const [hasta, setHasta] = useState(inicial.fechaFin);
  const [mesSeleccionado, setMesSeleccionado] = useState(fechaLocal(new Date()).slice(0, 7));
  const [modoPeriodo, setModoPeriodo] = useState('fechas');
  const [rango, setRango] = useState(inicial);
  const [presetActivo, setPresetActivo] = useState('30dias');
  const [datos, setDatos] = useState(null);
  const [cuentaId, setCuentaId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState('');

  const cargarAnalisis = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const response = await obtenerDashboard({
        ...rango,
        financialAccountId: cuentaId || undefined,
        incluirTodos: true
      });
      if (!response.exito) {
        throw new Error(response.error || 'No se pudo consultar el período.');
      }
      setDatos(response);
    } catch (err) {
      console.error('Error al consultar análisis del período:', err);
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }, [rango, cuentaId]);

  useEffect(() => {
    cargarAnalisis();
  }, [cargarAnalisis, refreshKey]);

  const seleccionarPreset = (preset) => {
    const nuevoRango = rangoRapido(preset);
    setDesde(nuevoRango.fechaInicio);
    setHasta(nuevoRango.fechaFin);
    setPresetActivo(preset);
    setRango(nuevoRango);
  };

  const aplicarRango = (event) => {
    event.preventDefault();
    if (!desde || !hasta) {
      setError('Selecciona una fecha inicial y una fecha final.');
      return;
    }
    if (desde > hasta) {
      setError('La fecha inicial debe ser anterior o igual a la fecha final.');
      return;
    }
    setError('');
    setPresetActivo('personalizado');
    setRango({ fechaInicio: desde, fechaFin: hasta });
  };

  const aplicarMes = (event) => {
    event.preventDefault();
    const numeroMes = Number(mesSeleccionado.slice(5, 7));
    if (!/^\d{4}-\d{2}$/.test(mesSeleccionado) || numeroMes < 1 || numeroMes > 12) {
      setError('Selecciona un mes válido.');
      return;
    }
    if (mesSeleccionado > fechaLocal(new Date()).slice(0, 7)) {
      setError('No puedes consultar un mes futuro.');
      return;
    }
    const nuevoRango = rangoDelMes(mesSeleccionado);
    setDesde(nuevoRango.fechaInicio);
    setHasta(nuevoRango.fechaFin);
    setPresetActivo('personalizado');
    setError('');
    setRango(nuevoRango);
  };

  const descargarCSV = async () => {
    setError('');
    setExportando(true);
    try {
      const csv = await exportarMovimientosCSV({
        ...rango,
        financialAccountId: cuentaId || undefined
      });
      const url = URL.createObjectURL(csv);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `movimientos-${rango.fechaInicio}-${rango.fechaFin}.csv`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron exportar los movimientos.');
    } finally {
      setExportando(false);
    }
  };

  const resumen = datos?.resumen || {};
  const balance = Number(resumen.balanceTotal) || 0;
  const ingresos = Number(resumen.totalIngresos) || 0;
  const gastos = Number(resumen.totalGastos) || 0;
  const movimientos = datos?.ultimosMovimientos || [];
  const categorias = datos?.gastosPorCategoria || [];
  const totalMovimientos = Number(resumen.totalMovimientos) || 0;
  const cuentas = datos?.resumenCuentas?.cuentas || [];
  const cuentaSeleccionada = cuentas.find((cuenta) => cuenta.id === cuentaId);
  const movimientosGasto = movimientos.filter((movement) => movement.type === 'GASTO');
  const promedioGasto = movimientosGasto.length ? gastos / movimientosGasto.length : 0;
  const inicioUTC = Date.parse(`${rango.fechaInicio}T00:00:00.000Z`);
  const finUTC = Date.parse(`${rango.fechaFin}T00:00:00.000Z`);
  const diasPeriodo = Math.max(1, Math.floor((finUTC - inicioUTC) / 86400000) + 1);
  const cantidadIntervalos = Math.min(12, diasPeriodo);
  const serie = Array.from({ length: cantidadIntervalos }, (_, index) => {
    const inicioDia = Math.floor(index * diasPeriodo / cantidadIntervalos);
    return {
      label: fechaCorta(new Date(inicioUTC + inicioDia * 86400000).toISOString().slice(0, 10)),
      ingresos: 0,
      gastos: 0
    };
  });
  movimientos.forEach((movement) => {
    const fechaUTC = Date.parse(`${String(movement.date).slice(0, 10)}T00:00:00.000Z`);
    const diasDesdeInicio = Math.floor((fechaUTC - inicioUTC) / 86400000);
    if (diasDesdeInicio < 0 || diasDesdeInicio >= diasPeriodo) return;
    const index = Math.min(cantidadIntervalos - 1, Math.floor(diasDesdeInicio * cantidadIntervalos / diasPeriodo));
    if (movement.type === 'INGRESO') serie[index].ingresos += Number(movement.amount) || 0;
    if (movement.type === 'GASTO') serie[index].gastos += Number(movement.amount) || 0;
  });
  const maxSerie = Math.max(1, ...serie.map((intervalo) => Math.max(intervalo.ingresos, intervalo.gastos)));
  const categoriasVisibles = categorias.slice(0, 5).map((categoria, index) => ({
    ...categoria,
    color: coloresGrafico[index]
  }));
  const montoOtrasCategorias = categorias.slice(5).reduce((total, categoria) => total + (Number(categoria.monto) || 0), 0);
  if (montoOtrasCategorias > 0) {
    categoriasVisibles.push({
      id: 'otras',
      nombre: 'Otras categorías',
      monto: montoOtrasCategorias,
      porcentaje: gastos > 0 ? montoOtrasCategorias / gastos * 100 : 0,
      color: coloresGrafico[5]
    });
  }
  let inicioPorcentaje = 0;
  const segmentos = categoriasVisibles.map((categoria) => {
    const inicio = inicioPorcentaje;
    inicioPorcentaje += gastos > 0 ? (Number(categoria.monto) || 0) / gastos * 100 : 0;
    return `${categoria.color} ${inicio}% ${inicioPorcentaje}%`;
  });
  const fondoCategorias = segmentos.length
    ? `conic-gradient(${segmentos.join(', ')})`
    : 'conic-gradient(#edf1f6 0% 100%)';

  return (
    <div className="analysis-page">
      <section className="analysis-intro">
        <div>
          <span className="panel-kicker">TABLERO FINANCIERO</span>
          <h2>Explora tus tendencias</h2>
          <p>Visualiza cómo se mueven tus ingresos y gastos en el período elegido.</p>
        </div>
        <span className="analysis-intro-icon" aria-hidden="true">⌁</span>
      </section>

      <section className="panel-card period-panel">
        <div className="period-panel-heading">
          <div>
            <span className="panel-kicker">PERÍODO</span>
            <h2>Elige un rango de tiempo</h2>
          </div>
          {datos?.periodo && (
            <span className="period-current">
              {fechaLegible(datos.periodo.fechaInicio)} – {fechaLegible(datos.periodo.fechaFin)}
            </span>
          )}
        </div>
        <div className="period-presets" aria-label="Opciones de período">
          <button
            className={modoPeriodo === 'fechas' ? 'is-active' : ''}
            type="button"
            onClick={() => setModoPeriodo('fechas')}
            aria-pressed={modoPeriodo === 'fechas'}
          >
            Por fechas
          </button>
          <button
            className={modoPeriodo === 'mes' ? 'is-active' : ''}
            type="button"
            onClick={() => setModoPeriodo('mes')}
            aria-pressed={modoPeriodo === 'mes'}
          >
            Por mes
          </button>
          {modoPeriodo === 'fechas' && [
            ['7dias', 'Últimos 7 días'],
            ['30dias', 'Últimos 30 días'],
            ['mes', 'Este mes']
          ].map(([id, label]) => (
            <button
              className={presetActivo === id ? 'is-active' : ''}
              key={id}
              type="button"
              onClick={() => seleccionarPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {modoPeriodo === 'fechas' ? (
          <form className="period-form" onSubmit={aplicarRango}>
            <div>
              <label htmlFor="analysis-from">Desde</label>
              <input id="analysis-from" type="date" value={desde} max={hasta || undefined} onChange={(event) => setDesde(event.target.value)} required />
            </div>
            <span className="period-separator">hasta</span>
            <div>
              <label htmlFor="analysis-to">Hasta</label>
              <input id="analysis-to" type="date" value={hasta} min={desde || undefined} max={fechaLocal(new Date())} onChange={(event) => setHasta(event.target.value)} required />
            </div>
            <button className="button-primary" type="submit" disabled={cargando}>
              Aplicar período
            </button>
          </form>
        ) : (
          <form className="period-form" onSubmit={aplicarMes}>
            <div>
              <label htmlFor="analysis-month">Mes a consultar</label>
              <input
                id="analysis-month"
                type="month"
                value={mesSeleccionado}
                max={fechaLocal(new Date()).slice(0, 7)}
                onChange={(event) => setMesSeleccionado(event.target.value)}
                required
              />
            </div>
            <button className="button-primary" type="submit" disabled={cargando}>
              Aplicar mes
            </button>
          </form>
        )}
        <div className="analysis-account-filter">
          <label htmlFor="analysis-account">Cuenta</label>
          <select
            id="analysis-account"
            value={cuentaId}
            onChange={(event) => setCuentaId(event.target.value)}
          >
            <option value="">Todas las cuentas</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>{cuenta.name}</option>
            ))}
          </select>
          <button
            className="button-secondary analysis-export-button"
            type="button"
            onClick={descargarCSV}
            disabled={cargando || exportando}
          >
            {exportando ? 'Preparando CSV...' : '↓ Exportar CSV'}
          </button>
        </div>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}
      {cargando && !datos ? (
        <div className="page-loading"><span className="loader" />Consultando movimientos del período...</div>
      ) : datos && (
        <>
          {cuentaSeleccionada && (
            <p className="analysis-account-context">
              Mostrando movimientos de <strong>{cuentaSeleccionada.name}</strong> en el período seleccionado.
            </p>
          )}

          <section className="analysis-metrics" aria-label="Indicadores del período">
            <article className="analysis-metric-card">
              <span>Ingresos</span>
              <strong className="amount-positive">{currency(ingresos)}</strong>
              <small>Total recibido</small>
            </article>
            <article className="analysis-metric-card">
              <span>Gastos</span>
              <strong className="amount-negative">{currency(gastos)}</strong>
              <small>Total utilizado</small>
            </article>
            <article className="analysis-metric-card">
              <span>Balance neto</span>
              <strong className={balance >= 0 ? 'amount-positive' : 'amount-negative'}>{currency(balance)}</strong>
              <small>Ingresos menos gastos</small>
            </article>
            <article className="analysis-metric-card">
              <span>Actividad</span>
              <strong>{totalMovimientos}</strong>
              <small>{currency(promedioGasto)} promedio por gasto</small>
            </article>
          </section>

          <section className="analysis-content-grid">
            <article className="panel-card analysis-trend-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">EVOLUCIÓN DEL PERÍODO</span>
                  <h2>Ingresos y gastos en el tiempo</h2>
                </div>
                <span className="analysis-chart-period">{fechaLegible(rango.fechaInicio)} – {fechaLegible(rango.fechaFin)}</span>
              </div>
              {movimientos.length === 0 ? (
                <div className="panel-empty"><span>⌁</span><p>No hay actividad para graficar en este período.</p></div>
              ) : (
                <>
                  <div className="analysis-trend-legend" aria-hidden="true">
                    <span><i className="analysis-legend-income" /> Ingresos</span>
                    <span><i className="analysis-legend-expense" /> Gastos</span>
                  </div>
                  <div className="analysis-trend-scroll">
                    <svg
                      className="analysis-trend-chart"
                      viewBox="0 0 760 280"
                      preserveAspectRatio="xMidYMid meet"
                      role="img"
                      aria-label={`Gráfico de ingresos y gastos por intervalo desde ${fechaLegible(rango.fechaInicio)} hasta ${fechaLegible(rango.fechaFin)}`}
                    >
                      {[0, 1, 2, 3].map((step) => {
                        const y = 218 - step * 58;
                        return (
                          <g key={step}>
                            <line x1="88" x2="748" y1={y} y2={y} className="analysis-grid-line" />
                            <text x="78" y={y + 4} textAnchor="end" className="analysis-axis-label">
                              {currency(maxSerie * step / 3)}
                            </text>
                          </g>
                        );
                      })}
                      {serie.map((intervalo, index) => {
                        const groupWidth = 660 / serie.length;
                        const barWidth = Math.min(18, groupWidth * 0.28);
                        const center = 88 + groupWidth * (index + 0.5);
                        const ingresoHeight = intervalo.ingresos / maxSerie * 174;
                        const gastoHeight = intervalo.gastos / maxSerie * 174;
                        return (
                          <g key={`${intervalo.label}-${index}`}>
                            <rect
                              x={center - barWidth - 2}
                              y={218 - ingresoHeight}
                              width={barWidth}
                              height={Math.max(0, ingresoHeight)}
                              rx="4"
                              className="analysis-bar-income"
                            >
                              <title>{`${intervalo.label}: ingresos ${currency(intervalo.ingresos)}`}</title>
                            </rect>
                            <rect
                              x={center + 2}
                              y={218 - gastoHeight}
                              width={barWidth}
                              height={Math.max(0, gastoHeight)}
                              rx="4"
                              className="analysis-bar-expense"
                            >
                              <title>{`${intervalo.label}: gastos ${currency(intervalo.gastos)}`}</title>
                            </rect>
                            <text x={center} y="246" textAnchor="middle" className="analysis-axis-label">
                              {intervalo.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <p className="analysis-chart-caption">Cada grupo resume la actividad de ese tramo del período.</p>
                </>
              )}
            </article>

            <article className="panel-card analysis-category-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">DISTRIBUCIÓN</span>
                  <h2>¿En qué gastaste?</h2>
                </div>
                <span className="panel-heading-icon">◔</span>
              </div>
              {categorias.length === 0 ? (
                <div className="panel-empty"><span>◌</span><p>No hay gastos en este período.</p></div>
              ) : (
                <div className="analysis-category-content">
                  <div className="analysis-donut-wrap">
                    <div
                      className="analysis-donut"
                      role="img"
                      aria-label={`Distribución de gastos por categoría. Total ${currency(gastos)}`}
                      style={{ background: fondoCategorias }}
                    >
                      <div><strong>{currency(gastos)}</strong><small>Total de gastos</small></div>
                    </div>
                  </div>
                  <div className="analysis-category-list">
                    {categoriasVisibles.map((category) => (
                      <div className="analysis-category" key={category.id}>
                        <div className="analysis-category-heading">
                          <span><i style={{ backgroundColor: category.color }} />{category.icono || '◇'} {category.nombre}</span>
                          <strong>{currency(category.monto)}</strong>
                        </div>
                        <small>{(Number(category.porcentaje) || 0).toFixed(1)}% de los gastos</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>

            <article className="panel-card analysis-activity-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">ACTIVIDAD</span>
                  <h2>{cuentaSeleccionada ? `Movimientos · ${cuentaSeleccionada.name}` : 'Movimientos del período'}</h2>
                </div>
                <span className="period-result-count">{totalMovimientos}</span>
              </div>
              {movimientos.length === 0 ? (
                <div className="panel-empty">
                  <span>↕</span>
                  <p>No hay movimientos dentro de este rango.</p>
                  <button className="text-button" type="button" onClick={() => onNavigate('movimientos')}>Registrar movimiento →</button>
                </div>
              ) : (
                <>
                  <div className="recent-list">
                    {movimientos.map((movement) => {
                      const gasto = movement.type === 'GASTO';
                      return (
                        <div className="recent-item" key={movement.id}>
                          <span className={`recent-icon ${gasto ? 'recent-expense' : 'recent-income'}`}>{movement.category?.icon || '◇'}</span>
                          <span className="recent-description">
                            <strong>{movement.category?.name || 'General'}</strong>
                            <small>
                              {movement.financialAccount?.name || 'Sin cuenta'} · {movement.description || 'Sin detalle'} · {fechaLegible(String(movement.date).slice(0, 10))}
                            </small>
                          </span>
                          <strong className={gasto ? 'amount-negative' : 'amount-positive'}>{gasto ? '−' : '+'}{currency(movement.amount)}</strong>
                        </div>
                      );
                    })}
                  </div>
                  {totalMovimientos > movimientos.length && (
                    <p className="analysis-more-movements">Mostrando los últimos {movimientos.length} de {totalMovimientos} movimientos.</p>
                  )}
                </>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
