import React, { useEffect, useState } from 'react';
import {
  actualizarCuentaFinanciera,
  crearCuentaFinanciera,
  eliminarCuentaFinanciera,
  obtenerCuentasFinancieras
} from '../services/api';

const tiposCuenta = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: '◉' },
  { value: 'BANCO', label: 'Banco', icon: '▤' },
  { value: 'TARJETA', label: 'Tarjeta', icon: '▣' }
];

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('EFECTIVO');
  const [editandoId, setEditandoId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarCuentas = async () => {
    setCargando(true);
    try {
      const res = await obtenerCuentasFinancieras();
      setCuentas(res.cuentas || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las cuentas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCuentas();
  }, []);

  const limpiarFormulario = () => {
    setNombre('');
    setTipo('EFECTIVO');
    setEditandoId(null);
  };

  const handleGuardar = async (event) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setError('Escribe un nombre para la cuenta.');
      return;
    }

    setGuardando(true);
    try {
      const datos = { name: nombreLimpio, type: tipo };
      if (editandoId) {
        await actualizarCuentaFinanciera(editandoId, datos);
        setMensaje('Cuenta actualizada.');
      } else {
        await crearCuentaFinanciera(datos);
        setMensaje('Cuenta creada.');
      }
      limpiarFormulario();
      await cargarCuentas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la cuenta.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEditar = (cuenta) => {
    setNombre(cuenta.name);
    setTipo(cuenta.type);
    setEditandoId(cuenta.id);
    setError('');
    setMensaje('');
  };

  const handleEliminar = async (cuenta) => {
    if (!window.confirm(`¿Eliminar la cuenta “${cuenta.name}”? Los movimientos asociados deben eliminarse o reasignarse primero.`)) {
      return;
    }

    setError('');
    setMensaje('');
    setEliminandoId(cuenta.id);
    try {
      await eliminarCuentaFinanciera(cuenta.id);
      setCuentas((actuales) => actuales.filter((item) => item.id !== cuenta.id));
      if (editandoId === cuenta.id) limpiarFormulario();
      setMensaje('Cuenta eliminada.');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la cuenta.');
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="financial-accounts-page">
      <section className="categories-intro">
        <div>
          <span className="panel-kicker">ORGANIZA TU DINERO</span>
          <h2>Tus cuentas</h2>
          <p>Separa tus movimientos de efectivo, bancos y tarjetas.</p>
        </div>
        <div className="movement-intro-icon">▣</div>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}
      {mensaje && <div className="inline-success" role="status">{mensaje}</div>}

      <div className="financial-accounts-layout">
        <section className="panel-card financial-account-form">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">{editandoId ? 'EDITAR CUENTA' : 'NUEVA CUENTA'}</span>
              <h2>{editandoId ? 'Actualiza sus detalles' : 'Agrega una cuenta'}</h2>
            </div>
          </div>

          <form onSubmit={handleGuardar}>
            <label htmlFor="financial-account-name">Nombre</label>
            <input
              id="financial-account-name"
              className="form-text-input"
              type="text"
              maxLength={60}
              placeholder="Ej. Efectivo, Banco principal..."
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
            />

            <label htmlFor="financial-account-type">Tipo</label>
            <select
              id="financial-account-type"
              className="form-text-input"
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
            >
              {tiposCuenta.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>

            <button type="submit" className="button-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear cuenta'}
            </button>
            {editandoId && (
              <button type="button" className="button-secondary account-cancel-button" onClick={limpiarFormulario} disabled={guardando}>
                Cancelar edición
              </button>
            )}
          </form>
        </section>

        <section className="panel-card financial-account-list">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">CUENTAS FINANCIERAS</span>
              <h2>{cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'}</h2>
            </div>
          </div>
          {cargando ? (
            <div className="form-loading"><span className="loader" />Cargando cuentas...</div>
          ) : cuentas.length === 0 ? (
            <div className="panel-empty"><span>▣</span><p>Aún no tienes cuentas. Crea una para comenzar.</p></div>
          ) : (
            <div className="financial-account-items">
              {cuentas.map((cuenta) => {
                const tipoCuenta = tiposCuenta.find((item) => item.value === cuenta.type);
                return (
                  <article className="financial-account-item" key={cuenta.id}>
                    <span className="financial-account-icon" aria-hidden="true">{tipoCuenta?.icon || '▣'}</span>
                    <div className="financial-account-details">
                      <strong>{cuenta.name}</strong>
                      <small>{tipoCuenta?.label || cuenta.type}</small>
                    </div>
                    <div className="financial-account-actions">
                      <button type="button" className="text-button" onClick={() => handleEditar(cuenta)}>Editar</button>
                      <button
                        type="button"
                        className="text-button history-delete-button"
                        onClick={() => handleEliminar(cuenta)}
                        disabled={eliminandoId === cuenta.id}
                      >
                        {eliminandoId === cuenta.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
