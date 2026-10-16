import React, { useCallback, useEffect, useState } from 'react';
import { obtenerCategorias, obtenerPresupuestos, guardarPresupuesto } from '../services/api';

const currency = (amount) => new Intl.NumberFormat('es', {
  style: 'currency',
  currency: 'USD'
}).format(Number(amount) || 0);

export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await obtenerPresupuestos();
      setPresupuestos(response.presupuestos || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los presupuestos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      try {
        const response = await obtenerCategorias();
        if (active) setCategorias((response.categorias || []).filter((category) => category.type === 'GASTO'));
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'No se pudieron cargar las categorías.');
      } finally {
        if (active) setLoadingCategories(false);
      }
    };
    loadCategories();
    loadBudgets();
    return () => { active = false; };
  }, [loadBudgets]);

  const submitBudget = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!categoryId || !Number.isFinite(Number(limitAmount)) || Number(limitAmount) <= 0) {
      setError('Selecciona una categoría y escribe un límite mayor que cero.');
      return;
    }

    setSaving(true);
    try {
      await guardarPresupuesto({ categoryId, limitAmount: Number(limitAmount), period: 'MENSUAL' });
      setMessage('Presupuesto guardado. Si ya existía, se actualizó el límite.');
      setLimitAmount('');
      await loadBudgets();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  };

  const totalLimites = presupuestos.reduce((total, item) => total + Number(item.limitAmount || 0), 0);
  const totalGastado = presupuestos.reduce((total, item) => total + Number(item.spentAmount || 0), 0);

  return (
    <div className="budgets-page">
      <section className="categories-intro">
        <div>
          <span className="panel-kicker">PONLE RUMBO A TUS GASTOS</span>
          <h2>Presupuestos mensuales</h2>
          <p>Define límites por categoría y sigue tu avance durante el mes.</p>
        </div>
        <div className="budget-summary">
          <span>Límites totales</span>
          <strong>{currency(totalLimites)}</strong>
          <small>{currency(totalGastado)} utilizados</small>
        </div>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}
      {message && <div className="inline-success" role="status">{message}</div>}

      <div className="budgets-layout">
        <section className="panel-card budget-list-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">SEGUIMIENTO DEL MES</span>
              <h2>Tus límites</h2>
            </div>
            <span className="budget-count">{presupuestos.length}</span>
          </div>

          {loading ? (
            <div className="page-loading"><span className="loader" />Cargando presupuestos...</div>
          ) : presupuestos.length === 0 ? (
            <div className="panel-empty">
              <span>◉</span>
              <p>Aún no tienes presupuestos.</p>
              <small>Elige una categoría de gasto y establece su límite mensual.</small>
            </div>
          ) : (
            <div className="budget-list">
              {presupuestos.map((budget) => {
                const spent = Number(budget.spentAmount) || 0;
                const limit = Number(budget.limitAmount) || 0;
                const percentage = Number(budget.percentage) || 0;
                const status = budget.estadoSemaforo || 'VERDE';
                const statusLabel = status === 'ROJO' ? 'Límite superado' : status === 'AMARILLO' ? 'Cerca del límite' : 'En buen camino';
                return (
                  <article className="budget-item" key={budget.id}>
                    <div className="budget-item-heading">
                      <span className="budget-category-icon">{budget.icono || '◇'}</span>
                      <div className="budget-category-name">
                        <strong>{budget.categoria}</strong>
                        <small>{budget.period === 'QUINCENAL' ? 'Quincenal' : 'Mensual'}</small>
                      </div>
                      <span className={`budget-status status-${status.toLowerCase()}`}>{statusLabel}</span>
                    </div>
                    <div className="budget-progress-label">
                      <span>{currency(spent)} <small>gastados</small></span>
                      <strong>{currency(limit)}</strong>
                    </div>
                    <div className="budget-progress-track">
                      <span className={`progress-${status.toLowerCase()}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </div>
                    <div className="budget-progress-foot">
                      <span>{percentage.toFixed(0)}% utilizado</span>
                      <span>{currency(Math.max(limit - spent, 0))} disponible</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel-card budget-form-panel">
          <span className="panel-kicker">PLANIFICA CON INTENCIÓN</span>
          <h2>Establecer presupuesto</h2>
          <p className="form-intro">Cada categoría admite un presupuesto. Guardar otra vez actualiza el límite existente.</p>
          <form onSubmit={submitBudget}>
            <label htmlFor="budget-category">Categoría de gasto</label>
            <select
              id="budget-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={loadingCategories || categorias.length === 0}
              required
            >
              <option value="">{loadingCategories ? 'Cargando categorías...' : 'Selecciona una categoría'}</option>
              {categorias.map((category) => (
                <option value={category.id} key={category.id}>{category.icon || '◇'} {category.name}</option>
              ))}
            </select>

            <label htmlFor="budget-limit">Límite mensual</label>
            <div className="budget-amount-field">
              <span>$</span>
              <input
                id="budget-limit"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={limitAmount}
                onChange={(event) => setLimitAmount(event.target.value)}
                required
              />
            </div>
            {categorias.length === 0 && !loadingCategories && (
              <p className="form-hint">Primero crea una categoría de gasto en la sección Categorías.</p>
            )}
            <button className="button-primary form-submit" type="submit" disabled={saving || loadingCategories || !categorias.length}>
              {saving ? 'Guardando...' : 'Guardar presupuesto'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
