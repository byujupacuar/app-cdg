import React, { useCallback, useEffect, useState } from 'react';
import { obtenerDashboard } from '../services/api';

const currency = (value) => new Intl.NumberFormat('es', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value) || 0);

export default function Dashboard({ refreshKey, onNavigate, userName }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [manualRefresh, setManualRefresh] = useState(0);
  const [flujoSemanal, setFlujoSemanal] = useState({ cargando: true, resumen: null });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await obtenerDashboard();
      if (!res.exito) {
        throw new Error(res.mensaje || res.error || 'No se pudo cargar el resumen.');
      }
      setDatos(res);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error('Error al cargar dashboard:', err);
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, refreshKey, manualRefresh]);

  useEffect(() => {
    let activo = true;
    setFlujoSemanal({ cargando: true, resumen: null });
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 6);
    const fechaLocal = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

    obtenerDashboard({
      fechaInicio: fechaLocal(inicio),
      fechaFin: fechaLocal(hoy),
      incluirTodos: true
    }).then((res) => {
      if (!activo) return;
      if (!res.exito) throw new Error(res.error || 'No se pudo consultar el flujo semanal.');
      setFlujoSemanal({ cargando: false, resumen: res.resumen || {} });
    }).catch(() => {
      if (activo) setFlujoSemanal({ cargando: false, resumen: null });
    });

    return () => { activo = false; };
  }, [refreshKey, manualRefresh]);

  if (cargando && !datos) {
    return <div className="page-loading"><span className="loader" />Cargando tu resumen...</div>;
  }

  if (error && !datos) {
    return (
      <section className="empty-state error-state">
        <span className="empty-icon">!</span>
        <h2>No pudimos cargar el resumen</h2>
        <p>{error}</p>
        <button className="button-primary" type="button" onClick={() => setManualRefresh((actual) => actual + 1)}>Intentar de nuevo</button>
      </section>
    );
  }

  const resumen = datos?.resumen || {};
  const ingresos = Number(resumen.totalIngresos) || 0;
  const gastos = Number(resumen.totalGastos) || 0;
  const gastosPorCategoria = datos?.gastosPorCategoria || [];
  const movimientos = datos?.ultimosMovimientos || [];
  const resumenCuentas = datos?.resumenCuentas || {};
  const cuentas = resumenCuentas.cuentas || [];
  const saldoInicial = cuentas.reduce((total, cuenta) => {
    const saldo = Number(cuenta.initialBalance) || 0;
    return total + (cuenta.esCredito ? -saldo : saldo);
  }, 0);
  const flujoMensual = ingresos - gastos;
  const balance = saldoInicial + flujoMensual;
  const ahorroPorcentaje = ingresos > 0 ? (flujoMensual / ingresos) * 100 : null;
  const nombreCorto = userName?.trim().split(/\s+/)[0];
  const ingresosSemanales = Number(flujoSemanal.resumen?.totalIngresos) || 0;
  const gastosSemanales = Number(flujoSemanal.resumen?.totalGastos) || 0;
  const escalaSemanal = Math.max(ingresosSemanales, gastosSemanales, 1);

  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <h2>{nombreCorto ? `Hola, ${nombreCorto}` : 'Hola, aquí está tu panorama financiero'}</h2>
          <p>Esto es lo que ha pasado con tu dinero este mes.</p>
          <div className={`dashboard-sync-status ${error ? 'sync-error' : ''}`} role="status">
            <span aria-hidden="true" />
            {error
              ? 'No se pudo actualizar'
              : cargando
                ? 'Actualizando información...'
                : `Datos actualizados${ultimaActualizacion ? ` · ${ultimaActualizacion.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
          </div>
        </div>
        <div className="dashboard-actions">
          <button className="button-primary" type="button" onClick={() => onNavigate('movimientos')}>
            <span aria-hidden="true">＋</span> Añadir movimiento
          </button>
          <button className="button-secondary" type="button" onClick={() => onNavigate('cuentas')}>
            <span aria-hidden="true">⇄</span> Transferir
          </button>
          <button className="button-secondary dashboard-refresh" type="button" onClick={() => setManualRefresh((actual) => actual + 1)} disabled={cargando} aria-label="Actualizar resumen">
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}

      <section className="panel-card account-overview">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">TUS CUENTAS</span>
            <h2>Resumen de cuentas</h2>
          </div>
          <button className="text-button" type="button" onClick={() => onNavigate('cuentas')}>
            Administrar <span aria-hidden="true">→</span>
          </button>
        </div>
        {cuentas.length === 0 ? (
          <div className="panel-empty">
            <span>＋</span>
            <p>Añade una cuenta para consultar tus saldos.</p>
            <button className="text-button" type="button" onClick={() => onNavigate('cuentas')}>Añadir una cuenta →</button>
          </div>
        ) : (
          <>
            <div className="account-overview-totals">
              <div><span>Disponible</span><strong>{currency(resumenCuentas.totalDisponible)}</strong></div>
              <div><span>Patrimonio neto</span><strong>{currency(resumenCuentas.patrimonioNeto)}</strong></div>
              <div><span>Deuda de tarjetas</span><strong className="amount-negative">{currency(resumenCuentas.deudaTarjetas)}</strong></div>
            </div>
            <div className="account-overview-list">
              {cuentas.map((cuenta) => (
                <div className="account-overview-item" key={cuenta.id}>
                  <span><strong>{cuenta.name}</strong>                  <small>{cuenta.esDebitoVinculado ? `Débito · ${cuenta.cuentaVinculada}` : cuenta.type === 'CREDITO' ? 'Tarjeta de crédito' : cuenta.type === 'EFECTIVO' ? 'Efectivo' : cuenta.type === 'BANCO' ? 'Cuenta bancaria' : cuenta.type === 'DEBITO' ? 'Tarjeta de débito' : cuenta.type}</small></span>
                  <strong className={cuenta.esCredito ? 'amount-negative' : 'account-amount'}>
                    {currency(cuenta.esCredito ? cuenta.deuda : cuenta.saldo)}
                    {cuenta.esCredito && <small> deuda</small>}
                  </strong>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="summary-grid" aria-label="Resumen financiero">
        <article className="summary-card summary-balance">
          <div className="summary-card-top">
            <span className="summary-label">Saldo del mes</span>
            <span className="summary-icon balance-icon">◈</span>
          </div>
          <strong className={balance >= 0 ? 'amount-positive' : 'amount-negative'}>{currency(balance)}</strong>
          <span className="summary-footnote">Saldo inicial: {currency(saldoInicial)}</span>
          {ahorroPorcentaje !== null && <span className="summary-footnote">{ahorroPorcentaje.toFixed(1)}% de ingresos retenidos</span>}
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

      <section className="panel-card weekly-cashflow-panel" aria-label="Flujo de efectivo de los últimos 7 días">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">FLUJO DE EFECTIVO</span>
            <h2>Últimos 7 días</h2>
          </div>
          {!flujoSemanal.cargando && flujoSemanal.resumen && (
            <span className={`weekly-cashflow-net ${Number(flujoSemanal.resumen.balanceTotal) >= 0 ? 'amount-positive' : 'amount-negative'}`}>
              {currency(flujoSemanal.resumen.balanceTotal)}
            </span>
          )}
        </div>
        {flujoSemanal.cargando ? (
          <div className="weekly-cashflow-message"><span className="loader" />Consultando tu actividad reciente...</div>
        ) : flujoSemanal.resumen ? (
          <div className="weekly-cashflow-rows">
            <div className="weekly-cashflow-row">
              <div><span>Ingresos</span><strong className="amount-positive">{currency(ingresosSemanales)}</strong></div>
              <div className="weekly-cashflow-track"><span className="income-fill" style={{ width: `${(ingresosSemanales / escalaSemanal) * 100}%` }} /></div>
            </div>
            <div className="weekly-cashflow-row">
              <div><span>Gastos</span><strong className="amount-negative">{currency(gastosSemanales)}</strong></div>
              <div className="weekly-cashflow-track"><span className="expense-fill" style={{ width: `${(gastosSemanales / escalaSemanal) * 100}%` }} /></div>
            </div>
          </div>
        ) : (
          <p className="weekly-cashflow-message">No fue posible consultar el flujo de estos días.</p>
        )}
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
                      {movimiento.financialAccount?.name && <small>{movimiento.financialAccount.name}</small>}
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
