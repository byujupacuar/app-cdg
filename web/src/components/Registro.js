import React, { useEffect, useState } from 'react';
import {
  obtenerCategorias,
  obtenerCuentasFinancieras,
  guardarMovimiento,
  obtenerMovimientos,
  actualizarMovimiento,
  eliminarMovimiento,
  obtenerTransferencias
} from '../services/api';

const currency = (amount) => new Intl.NumberFormat('es', {
  style: 'currency',
  currency: 'USD'
}).format(Number(amount) || 0);

export default function Registro({ onGuardado, onNavigate }) {
  const [tipo, setTipo] = useState('GASTO');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const cargarMovimientos = async (activo = () => true) => {
    setCargandoMovimientos(true);
    try {
      const res = await obtenerMovimientos();
      if (activo()) setMovimientos(res.movimientos || []);
    } catch (err) {
      if (activo()) setError(err.response?.data?.error || 'No se pudieron cargar los movimientos.');
    } finally {
      if (activo()) setCargandoMovimientos(false);
    }
  };

  useEffect(() => {
    let activo = true;
    setCargandoMovimientos(true);
    const cargarCategorias = async () => {
      setCargando(true);
      try {
        const res = await obtenerCategorias();
        if (activo) setCategorias(res.categorias || []);
      } catch (err) {
        if (activo) setError(err.response?.data?.error || 'No se pudieron cargar las categorías.');
      } finally {
        if (activo) setCargando(false);
      }
    };
    const cargarCuentas = async () => {
      try {
        const res = await obtenerCuentasFinancieras();
        if (activo) {
          setCuentas(res.cuentas || []);
          setCuentaFinancieraId((actual) => res.cuentas?.some((cuenta) => cuenta.id === actual)
            ? actual
            : res.cuentas?.[0]?.id || '');
        }
      } catch (err) {
        if (activo) setError(err.response?.data?.error || 'No se pudieron cargar las cuentas.');
      }
    };
    const cargarTransferencias = async () => {
      try {
        const res = await obtenerTransferencias({ completo: true });
        if (activo) setTransferencias(res.transferencias || []);
      } catch (err) {
        if (activo) setError(err.response?.data?.error || 'No se pudieron cargar las transferencias para exportar.');
      }
    };
    cargarCategorias();
    cargarCuentas();
    cargarTransferencias();
    cargarMovimientos(() => activo);
    return () => { activo = false; };
  }, []);

  const catsFiltradas = categorias.filter((categoria) => categoria.type === tipo);

  useEffect(() => {
    const categoriasTipo = categorias.filter((categoria) => categoria.type === tipo);
    if (!categoriasTipo.some((categoria) => categoria.name === categoriaSel)) {
      setCategoriaSel(categoriasTipo[0]?.name || '');
    }
  }, [tipo, categorias, categoriaSel]);

  const handleGuardar = async (event) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    if (!Number.isFinite(Number(monto)) || Number(monto) <= 0) {
      setError('Ingresa un monto mayor a cero.');
      return;
    }
    if (!categoriaSel) {
      setError(`Crea primero una categoría de ${tipo === 'GASTO' ? 'gasto' : 'ingreso'}.`);
      return;
    }
    if (!cuentaFinancieraId) {
      setError('Añade una cuenta antes de registrar un movimiento.');
      return;
    }
    setGuardando(true);
    try {
      const datosMovimiento = {
        amount: Number(monto),
        type: tipo,
        categoryName: categoriaSel,
        financialAccountId: cuentaFinancieraId,
        description: descripcion.trim() || 'Sin detalle'
      };
      if (editandoId) {
        await actualizarMovimiento(editandoId, datosMovimiento);
      } else {
        await guardarMovimiento(datosMovimiento);
      }
      setMensaje(editandoId ? 'Movimiento actualizado. Tu resumen ya está actualizado.' : 'Movimiento registrado. Tu resumen ya está actualizado.');
      limpiarFormulario();
      await cargarMovimientos();
      onGuardado?.();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el movimiento. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const limpiarFormulario = () => {
    setMonto('');
    setDescripcion('');
    setEditandoId(null);
  };

  const handleEditar = (movimiento) => {
    setEditandoId(movimiento.id);
    setTipo(movimiento.type);
    setMonto(String(movimiento.amount));
    setDescripcion(movimiento.description === 'Sin detalle' ? '' : movimiento.description || '');
    setCategoriaSel(movimiento.category?.name || '');
    setCuentaFinancieraId(movimiento.financialAccountId || '');
    setError('');
    setMensaje('');
    document.getElementById('movement-amount')?.focus();
  };

  const handleEliminar = async (movimiento) => {
    const categoria = movimiento.category?.name || 'este movimiento';
    if (!window.confirm(`¿Deseas eliminar el registro de ${categoria}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setError('');
    setMensaje('');
    setEliminandoId(movimiento.id);
    try {
      await eliminarMovimiento(movimiento.id);
      setMovimientos((actuales) => actuales.filter((item) => item.id !== movimiento.id));
      if (editandoId === movimiento.id) limpiarFormulario();
      setMensaje('Movimiento eliminado.');
      onGuardado?.();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar el movimiento.');
    } finally {
      setEliminandoId(null);
    }
  };

  const movimientosFiltrados = movimientos.filter((movimiento) => {
    const fecha = String(movimiento.date || '').slice(0, 10);
    const consulta = busqueda.trim().toLocaleLowerCase();
    const texto = [
      movimiento.description,
      movimiento.category?.name,
      movimiento.financialAccount?.name
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    return (filtroTipo === 'TODOS' || movimiento.type === filtroTipo) &&
      (!fechaInicio || fecha >= fechaInicio) &&
      (!fechaFin || fecha <= fechaFin) &&
      (!consulta || texto.includes(consulta));
  });
  const transferenciasFiltradas = transferencias.filter((transferencia) => {
    const fecha = String(transferencia.date || '').slice(0, 10);
    const consulta = busqueda.trim().toLocaleLowerCase();
    const texto = [
      transferencia.description,
      transferencia.fromFinancialAccount?.name,
      transferencia.toFinancialAccount?.name,
      'transferencia'
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    return filtroTipo === 'TODOS' &&
      (!fechaInicio || fecha >= fechaInicio) &&
      (!fechaFin || fecha <= fechaFin) &&
      (!consulta || texto.includes(consulta));
  });
  const ingresosFiltrados = movimientosFiltrados
    .filter((movimiento) => movimiento.type === 'INGRESO')
    .reduce((total, movimiento) => total + (Number(movimiento.amount) || 0), 0);
  const gastosFiltrados = movimientosFiltrados
    .filter((movimiento) => movimiento.type === 'GASTO')
    .reduce((total, movimiento) => total + (Number(movimiento.amount) || 0), 0);

  const exportarCSV = () => {
    const valorCSV = (value) => {
      const texto = String(value ?? '');
      const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
      return `"${seguro.replace(/"/g, '""')}"`;
    };
    const rowsData = [
      ...movimientosFiltrados.map((movimiento) => [
        String(movimiento.date || '').slice(0, 10),
        movimiento.type === 'INGRESO' ? 'Ingreso' : 'Gasto',
        movimiento.category?.name || 'General',
        movimiento.description || 'Sin detalle',
        movimiento.financialAccount?.name || '',
        '',
        '',
        Number(movimiento.amount) || 0
      ]),
      ...transferenciasFiltradas.map((transferencia) => [
        String(transferencia.date || '').slice(0, 10),
        'Transferencia',
        '',
        transferencia.description || 'Sin detalle',
        '',
        transferencia.fromFinancialAccount?.name || '',
        transferencia.toFinancialAccount?.name || '',
        Number(transferencia.amount) || 0
      ])
    ].sort((a, b) => b[0].localeCompare(a[0]));
    const rows = [
      ['Fecha', 'Tipo', 'Categoría', 'Detalle', 'Cuenta', 'Cuenta de origen', 'Cuenta de destino', 'Monto'],
      ...rowsData
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(valorCSV).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `movimientos${fechaInicio ? `-${fechaInicio}` : ''}${fechaFin ? `-${fechaFin}` : ''}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="transactions-page">
      <section className="categories-intro">
        <div>
          <span className="panel-kicker">REGISTRO FINANCIERO</span>
          <h2>Registra un movimiento</h2>
          <p>Agrega tus ingresos y gastos para tener una visión clara de tu dinero.</p>
        </div>
        <div className="movement-intro-icon">↕</div>
      </section>

      <section className="transaction-summary" aria-label="Totales de movimientos filtrados">
        <article className="panel-card transaction-total-card">
          <span className="panel-kicker">INGRESOS</span>
          <strong className="amount-positive">{currency(ingresosFiltrados)}</strong>
        </article>
        <article className="panel-card transaction-total-card">
          <span className="panel-kicker">GASTOS</span>
          <strong className="amount-negative">{currency(gastosFiltrados)}</strong>
        </article>
        <article className="panel-card transaction-total-card">
          <span className="panel-kicker">BALANCE NETO</span>
          <strong className={ingresosFiltrados - gastosFiltrados >= 0 ? 'amount-positive' : 'amount-negative'}>
            {currency(ingresosFiltrados - gastosFiltrados)}
          </strong>
        </article>
      </section>

      <div className="transaction-layout">
        <section className="panel-card transaction-form-card">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">{editandoId ? 'EDITAR MOVIMIENTO' : 'NUEVO MOVIMIENTO'}</span>
              <h2>{editandoId ? 'Actualiza los detalles' : 'Completa los detalles'}</h2>
            </div>
          </div>

          {error && <div className="inline-error" role="alert">{error}</div>}
          {mensaje && <div className="inline-success" role="status">{mensaje}</div>}

          <div className="transaction-type-switch" aria-label="Tipo de movimiento">
            <button
              type="button"
              className={tipo === 'GASTO' ? 'selected-expense' : ''}
              onClick={() => { setTipo('GASTO'); setError(''); }}
              aria-pressed={tipo === 'GASTO'}
            >
              <span>↘</span> Es un gasto
            </button>
            <button
              type="button"
              className={tipo === 'INGRESO' ? 'selected-income' : ''}
              onClick={() => { setTipo('INGRESO'); setError(''); }}
              aria-pressed={tipo === 'INGRESO'}
            >
              <span>↗</span> Es un ingreso
            </button>
          </div>

          <form onSubmit={handleGuardar}>
            <label htmlFor="movement-amount">¿Cuánto?</label>
            <div className="amount-field">
              <span>$</span>
              <input
                id="movement-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
                required
              />
            </div>

            <div className="form-label-row">
              <label htmlFor="movement-account">Cuenta</label>
              <button className="text-button" type="button" onClick={() => onNavigate('cuentas')}>
                Administrar <span aria-hidden="true">→</span>
              </button>
            </div>
            {cuentas.length ? (
              <select
                id="movement-account"
                className="form-text-input movement-account-select"
                value={cuentaFinancieraId}
                onChange={(event) => setCuentaFinancieraId(event.target.value)}
                required
              >
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.name} · {cuenta.type === 'CREDITO' ? 'Deuda' : cuenta.type === 'EFECTIVO' ? 'Efectivo' : cuenta.type === 'BANCO' ? 'Banco' : cuenta.type === 'DEBITO' ? 'Débito' : cuenta.type}
                  </option>
                ))}
              </select>
            ) : (
              <div className="no-categories">
                <p>No hay cuentas disponibles.</p>
                <button className="text-button" type="button" onClick={() => onNavigate('cuentas')}>
                  Añadir cuenta <span aria-hidden="true">→</span>
                </button>
              </div>
            )}

            <div className="form-label-row">
              <label>Categoría</label>
              <button className="text-button" type="button" onClick={() => onNavigate('categorias')}>
                Administrar <span aria-hidden="true">→</span>
              </button>
            </div>
            {cargando ? (
              <div className="form-loading"><span className="loader" />Cargando categorías...</div>
            ) : catsFiltradas.length ? (
              <div className="transaction-category-grid">
                {catsFiltradas.map((categoria) => (
                  <button
                    key={categoria.id}
                    type="button"
                    className={`transaction-category ${categoriaSel === categoria.name ? 'is-selected' : ''}`}
                    onClick={() => setCategoriaSel(categoria.name)}
                    aria-pressed={categoriaSel === categoria.name}
                  >
                    <span>{categoria.icon || '🏷️'}</span>
                    <small>{categoria.name}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="no-categories">
                <span>◇</span>
                <p>No hay categorías de {tipo === 'GASTO' ? 'gasto' : 'ingreso'} disponibles.</p>
                <button className="text-button" type="button" onClick={() => onNavigate('categorias')}>
                  Crear categoría <span aria-hidden="true">→</span>
                </button>
              </div>
            )}

            <label htmlFor="movement-description">Detalle <span>(opcional)</span></label>
            <input
              id="movement-description"
              className="form-text-input"
              type="text"
              placeholder="Ej. Supermercado, salario, transporte..."
              maxLength={120}
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />

            <button type="submit" className="button-primary form-submit" disabled={guardando || cargando || !cuentas.length}>
              {guardando
                ? <><span className="button-spinner" /> Guardando...</>
                : <><span aria-hidden="true">{editandoId ? '✓' : '＋'}</span> {editandoId ? 'Guardar cambios' : 'Guardar movimiento'}</>}
            </button>
            {editandoId && (
              <button type="button" className="button-secondary form-cancel-edit" onClick={limpiarFormulario} disabled={guardando}>
                Cancelar edición
              </button>
            )}
          </form>
        </section>

        <aside className="transaction-tip">
          <div className="tip-icon">✦</div>
          <span className="panel-kicker">UN CONSEJO</span>
          <h3>Pequeños registros, grandes decisiones.</h3>
          <p>Agregar un detalle te ayuda a recordar en qué se fue el dinero cuando revises tu resumen.</p>
          <div className="tip-decoration">Nivia</div>
        </aside>
      </div>

      <section className="panel-card transaction-history">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">HISTORIAL · {movimientosFiltrados.length} REGISTROS</span>
            <h2>Movimientos registrados</h2>
          </div>
          <button
            className="button-secondary"
            type="button"
            onClick={exportarCSV}
            disabled={!movimientosFiltrados.length && !transferenciasFiltradas.length}
          >
            ↓ Exportar CSV
          </button>
        </div>
        <div className="transaction-filters">
          <label className="transaction-search">
            <span>Buscar</span>
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Descripción, categoría o cuenta"
            />
          </label>
          <label>
            <span>Tipo</span>
            <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)}>
              <option value="TODOS">Todos</option>
              <option value="INGRESO">Ingresos</option>
              <option value="GASTO">Gastos</option>
            </select>
          </label>
          <label>
            <span>Desde</span>
            <input type="date" value={fechaInicio} max={fechaFin || undefined} onChange={(event) => setFechaInicio(event.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={fechaFin} min={fechaInicio || undefined} onChange={(event) => setFechaFin(event.target.value)} />
          </label>
        </div>
        {cargandoMovimientos ? (
          <div className="form-loading"><span className="loader" />Cargando movimientos...</div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="panel-empty"><span>↕</span><p>{movimientos.length ? 'No hay movimientos que coincidan con estos filtros.' : 'Aún no tienes movimientos registrados.'}</p></div>
        ) : (
          <div className="transaction-history-list">
            {movimientosFiltrados.map((movimiento) => (
              <article className="transaction-history-item" key={movimiento.id}>
                <span className={`transaction-history-icon ${movimiento.type === 'INGRESO' ? 'history-income' : 'history-expense'}`}>
                  {movimiento.category?.icon || '🏷️'}
                </span>
                <div className="transaction-history-details">
                  <strong>{movimiento.category?.name || 'General'}</strong>
                  <span>{movimiento.description || 'Sin detalle'}</span>
                  {movimiento.financialAccount?.name && <small>{movimiento.financialAccount.name}</small>}
                  <small>{movimiento.date ? new Date(movimiento.date).toLocaleDateString() : ''}</small>
                </div>
                <div className="transaction-history-actions">
                  <strong className={movimiento.type === 'INGRESO' ? 'amount-positive' : 'amount-negative'}>
                    {movimiento.type === 'INGRESO' ? '+' : '-'}${Number(movimiento.amount).toFixed(2)}
                  </strong>
                  <div>
                    <button type="button" className="text-button" onClick={() => handleEditar(movimiento)} aria-label={`Editar movimiento ${movimiento.category?.name || ''}`}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-button history-delete-button"
                      onClick={() => handleEliminar(movimiento)}
                      disabled={eliminandoId === movimiento.id}
                      aria-label={`Eliminar movimiento ${movimiento.category?.name || ''}`}
                    >
                      {eliminandoId === movimiento.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
