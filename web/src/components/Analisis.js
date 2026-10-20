import React, { useCallback, useEffect, useState } from 'react';
import { exportarMovimientosCSV, obtenerDashboard } from '../services/api';

const currency = (value) => new Intl.NumberFormat('es', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value) || 0);

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

const inicial = rangoRapido('30dias');

const fechaLegible = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
};

export default function Analisis({ refreshKey, onNavigate }) {
  const [desde, setDesde] = useState(inicial.fechaInicio);
  const [hasta, setHasta] = useState(inicial.fechaFin);
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

  return (
    <div className="analysis-page">
      <section className="analysis-intro">
        <div>
          <span className="panel-kicker">TUS FINANZAS, EN CONTEXTO</span>
          <h2>Analiza cualquier período</h2>
          <p>Compara ingresos y gastos en las fechas que elijas.</p>
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
        <div className="period-presets" aria-label="Períodos rápidos">
          {[
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
        <div className="analysis-account-filter">
          <label htmlFor="analysis-account">Cuenta o lugar</label>
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
          <section className="analysis-account-summary" aria-label="Saldos por cuenta">
            {cuentas.map((cuenta) => (
              <button
                className={`analysis-account-card ${cuentaId === cuenta.id ? 'is-selected' : ''}`}
                key={cuenta.id}
                type="button"
                onClick={() => setCuentaId(cuentaId === cuenta.id ? '' : cuenta.id)}
                aria-pressed={cuentaId === cuenta.id}
              >
                <span>{cuenta.name}</span>
                <strong className={cuenta.esCredito ? 'amount-negative' : ''}>
                  {currency(cuenta.esCredito ? cuenta.deuda : cuenta.saldo)}
                </strong>
                <small>{cuenta.esCredito ? 'Deuda actual' : 'Saldo actual'} · ver actividad</small>
              </button>
            ))}
          </section>

          {cuentaSeleccionada && (
            <p className="analysis-account-context">
              Mostrando movimientos de <strong>{cuentaSeleccionada.name}</strong> en el período seleccionado.
            </p>
          )}

          <section className="analysis-metrics" aria-label="Resumen del período">
            <article className="analysis-balance-card">
              <span className="analysis-metric-label">Balance neto</span>
              <strong className={balance >= 0 ? 'analysis-balance-positive' : 'analysis-balance-negative'}>{currency(balance)}</strong>
              <small>Ingresos menos gastos</small>
            </article>
            <article className="analysis-metric-card">
              <span className="analysis-metric-icon income-icon">↗</span>
              <span className="analysis-metric-label">Ingresos</span>
              <strong className="amount-positive">{currency(ingresos)}</strong>
              <small>Entradas en el período</small>
            </article>
            <article className="analysis-metric-card">
              <span className="analysis-metric-icon expense-icon">↘</span>
              <span className="analysis-metric-label">Gastos</span>
              <strong className="amount-negative">{currency(gastos)}</strong>
              <small>Salidas en el período</small>
            </article>
            <article className="analysis-metric-card">
              <span className="analysis-metric-icon count-icon">↕</span>
              <span className="analysis-metric-label">Movimientos</span>
              <strong>{totalMovimientos}</strong>
              <small>Registros en total</small>
            </article>
          </section>

          <section className="analysis-content-grid">
            <article className="panel-card">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">DISTRIBUCIÓN</span>
                  <h2>Gastos por categoría</h2>
                </div>
                <span className="panel-heading-icon">◔</span>
              </div>
              {categorias.length === 0 ? (
                <div className="panel-empty"><span>◌</span><p>No hay gastos en este período.</p></div>
              ) : (
                <div className="analysis-category-list">
                  {categorias.map((category) => (
                    <div className="analysis-category" key={category.id}>
                      <div className="analysis-category-heading">
                        <span>{category.icono || '◇'} {category.nombre}</span>
                        <strong>{currency(category.monto)}</strong>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${Math.min(Number(category.porcentaje) || 0, 100)}%` }} />
                      </div>
                      <small>{(Number(category.porcentaje) || 0).toFixed(1)}% de los gastos</small>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel-card">
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
