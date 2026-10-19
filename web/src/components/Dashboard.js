import React, { useCallback, useEffect, useState } from 'react';
import { obtenerDashboard } from '../services/api';

const currency = (value) => new Intl.NumberFormat('es', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value) || 0);

export default function Dashboard({ refreshKey, onNavigate }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await obtenerDashboard();
      if (!res.exito) {
        throw new Error(res.mensaje || res.error || 'No se pudo cargar el resumen.');
      }
      setDatos(res);
    } catch (err) {
      console.error('Error al cargar dashboard:', err);
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, refreshKey]);

  if (cargando && !datos) {
    return <div className="page-loading"><span className="loader" />Cargando tu resumen...</div>;
  }

  if (error && !datos) {
    return (
      <section className="empty-state error-state">
        <span className="empty-icon">!</span>
        <h2>No pudimos cargar el resumen</h2>
        <p>{error}</p>
        <button className="button-primary" type="button" onClick={cargarDatos}>Intentar de nuevo</button>
      </section>
    );
  }

  const resumen = datos?.resumen || {};
  const balance = Number(resumen.balanceTotal) || 0;
  const ingresos = Number(resumen.totalIngresos) || 0;
  const gastos = Number(resumen.totalGastos) || 0;
  const gastosPorCategoria = datos?.gastosPorCategoria || [];
  const movimientos = datos?.ultimosMovimientos || [];

  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <h2>Hola, aquí está tu panorama financiero</h2>
          <p>Esto es lo que ha pasado con tu dinero este mes.</p>
        </div>
        <button className="button-secondary" type="button" onClick={cargarDatos} disabled={cargando}>
          <span aria-hidden="true">↻</span> Actualizar
        </button>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}

      <section className="summary-grid" aria-label="Resumen financiero">
        <article className="summary-card summary-balance">
          <div className="summary-card-top">
            <span className="summary-label">Balance del mes</span>
            <span className="summary-icon balance-icon">◈</span>
          </div>
          <strong className={balance >= 0 ? 'amount-positive' : 'amount-negative'}>{currency(balance)}</strong>
          <span className="summary-footnote">Ingresos menos gastos</span>
        </article>
        <article className="summary-card">
          <div className="summary-card-top">
            <span className="summary-label">Ingresos</span>
            <span className="summary-icon income-icon">↗</span>
          </div>
          <strong className="amount-positive">{currency(ingresos)}</strong>
          <span className="summary-footnote">Entradas registradas este mes</span>
        </article>
        <article className="summary-card">
          <div className="summary-card-top">
            <span className="summary-label">Gastos</span>
            <span className="summary-icon expense-icon">↘</span>
          </div>
          <strong className="amount-negative">{currency(gastos)}</strong>
          <span className="summary-footnote">Salidas registradas este mes</span>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">EN QUÉ SE VA</span>
              <h2>Gastos por categoría</h2>
            </div>
            <span className="panel-heading-icon">◔</span>
          </div>
          {gastosPorCategoria.length === 0 ? (
            <div className="panel-empty">
              <span>◌</span>
              <p>Todavía no hay gastos este mes.</p>
              <button type="button" className="text-button" onClick={() => onNavigate('movimientos')}>
                Registrar movimiento <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <div className="category-breakdown">
              {gastosPorCategoria.map((categoria) => (
                <div className="category-breakdown-item" key={categoria.id || categoria.nombre}>
                  <div className="breakdown-label">
                    <span><span className="category-dot" />{categoria.icono || '◇'} {categoria.nombre}</span>
                    <strong>{currency(categoria.monto)}</strong>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${Math.min(Number(categoria.porcentaje) || 0, 100)}%` }} />
                  </div>
                  <small>{(Number(categoria.porcentaje) || 0).toFixed(1)}% de tus gastos</small>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">LO MÁS RECIENTE</span>
              <h2>Últimos movimientos</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onNavigate('movimientos')}>
              Nuevo <span aria-hidden="true">＋</span>
            </button>
          </div>
          {movimientos.length === 0 ? (
            <div className="panel-empty">
              <span>↕</span>
              <p>Aún no tienes movimientos registrados.</p>
              <button type="button" className="text-button" onClick={() => onNavigate('movimientos')}>
                Registrar el primero <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <div className="recent-list">
              {movimientos.map((movimiento) => {
                const gasto = movimiento.type === 'GASTO';
                return (
                  <div className="recent-item" key={movimiento.id}>
                    <span className={`recent-icon ${gasto ? 'recent-expense' : 'recent-income'}`}>
                      {movimiento.category?.icon || '◇'}
                    </span>
                    <span className="recent-description">
                      <strong>{movimiento.category?.name || 'General'}</strong>
                      <small>{movimiento.description || 'Sin detalle'}</small>
                      <small>{movimiento.financialAccount?.name || 'Sin cuenta'}</small>
                    </span>
                    <strong className={gasto ? 'amount-negative' : 'amount-positive'}>
                      {gasto ? '−' : '+'}{currency(movimiento.amount)}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-cta">
        <div>
          <span className="panel-kicker">MANTÉN EL CONTROL</span>
          <h2>¿Hiciste un movimiento nuevo?</h2>
          <p>Regístralo ahora para mantener tu balance al día.</p>
        </div>
        <button className="button-primary" type="button" onClick={() => onNavigate('movimientos')}>
          <span aria-hidden="true">＋</span> Registrar movimiento
        </button>
      </section>
    </div>
  );
}
