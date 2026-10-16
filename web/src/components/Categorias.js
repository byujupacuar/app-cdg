import React, { useEffect, useState } from 'react';
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  obtenerCategorias
} from '../services/api';

const initialForm = { name: '', icon: '🏷️', type: 'GASTO' };

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [formulario, setFormulario] = useState(initialForm);
  const [editandoId, setEditandoId] = useState(null);
  const [filtro, setFiltro] = useState('TODAS');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarCategorias = async () => {
    setCargando(true);
    setError('');
    try {
      const res = await obtenerCategorias();
      setCategorias(res.categorias || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las categorías.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
  }, []);

  const limpiarFormulario = () => {
    setFormulario(initialForm);
    setEditandoId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    const datos = {
      name: formulario.name.trim(),
      icon: formulario.icon.trim() || '🏷️',
      type: formulario.type
    };
    if (!datos.name) {
      setError('Escribe un nombre para la categoría.');
      return;
    }

    setGuardando(true);
    try {
      if (editandoId) {
        await actualizarCategoria(editandoId, datos);
        setMensaje('Categoría actualizada.');
      } else {
        await crearCategoria(datos);
        setMensaje('Categoría creada.');
      }
      limpiarFormulario();
      await cargarCategorias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la categoría.');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (categoria) => {
    setFormulario({
      name: categoria.name,
      icon: categoria.icon || '🏷️',
      type: categoria.type
    });
    setEditandoId(categoria.id);
    setError('');
    setMensaje('');
    document.getElementById('category-name')?.focus();
  };

  const eliminar = async (categoria) => {
    if (!window.confirm(`¿Eliminar la categoría "${categoria.name}"?`)) return;
    setError('');
    setMensaje('');
    try {
      await eliminarCategoria(categoria.id);
      setMensaje('Categoría eliminada.');
      if (editandoId === categoria.id) limpiarFormulario();
      await cargarCategorias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la categoría.');
    }
  };

  const visibles = categorias.filter((categoria) => filtro === 'TODAS' || categoria.type === filtro);
  const gastos = categorias.filter((categoria) => categoria.type === 'GASTO').length;
  const ingresos = categorias.filter((categoria) => categoria.type === 'INGRESO').length;

  return (
    <div className="categories-page">
      <section className="categories-intro">
        <div>
          <span className="panel-kicker">ORDENA TUS FINANZAS</span>
          <h2>Una categoría para cada cosa</h2>
          <p>Personaliza las etiquetas que usas para organizar ingresos y gastos.</p>
        </div>
        <div className="category-counts">
          <div><strong>{gastos}</strong><span>Gastos</span></div>
          <div><strong>{ingresos}</strong><span>Ingresos</span></div>
        </div>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}
      {mensaje && <div className="inline-success" role="status">{mensaje}</div>}

      <div className="categories-layout">
        <section className="panel-card category-list-panel">
          <div className="panel-heading category-list-heading">
            <div>
              <span className="panel-kicker">TU LISTA</span>
              <h2>Categorías</h2>
            </div>
            <select
              className="filter-select"
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
              aria-label="Filtrar categorías"
            >
              <option value="TODAS">Todas</option>
              <option value="GASTO">Gastos</option>
              <option value="INGRESO">Ingresos</option>
            </select>
          </div>

          {cargando ? (
            <div className="page-loading"><span className="loader" />Cargando categorías...</div>
          ) : visibles.length === 0 ? (
            <div className="panel-empty">
              <span>◇</span>
              <p>{categorias.length ? 'No hay categorías en este filtro.' : 'Aún no tienes categorías.'}</p>
              {!categorias.length && <small>Crea una categoría con el formulario para empezar.</small>}
            </div>
          ) : (
            <div className="category-list">
              {visibles.map((categoria) => (
                <article className="category-row" key={categoria.id}>
                  <span className={`category-row-icon ${categoria.type === 'INGRESO' ? 'income-icon-bg' : 'expense-icon-bg'}`}>
                    {categoria.icon || '🏷️'}
                  </span>
                  <div className="category-row-info">
                    <strong>{categoria.name}</strong>
                    <span className={`category-type ${categoria.type === 'INGRESO' ? 'type-income' : 'type-expense'}`}>
                      {categoria.type === 'INGRESO' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </div>
                  <div className="category-actions">
                    <button type="button" className="icon-button" onClick={() => editar(categoria)} aria-label={`Editar ${categoria.name}`}>
                      ✎
                    </button>
                    <button type="button" className="icon-button delete-button" onClick={() => eliminar(categoria)} aria-label={`Eliminar ${categoria.name}`}>
                      ×
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel-card category-form-panel">
          <span className="panel-kicker">{editandoId ? 'PERSONALIZA' : 'AÑADE ALGO NUEVO'}</span>
          <h2>{editandoId ? 'Editar categoría' : 'Crear categoría'}</h2>
          <p className="form-intro">Elige un nombre fácil de reconocer y asígnale un tipo.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="category-name">Nombre</label>
            <input
              id="category-name"
              type="text"
              placeholder="Ej. Mascotas"
              maxLength={40}
              value={formulario.name}
              onChange={(event) => setFormulario({ ...formulario, name: event.target.value })}
              required
            />

            <label htmlFor="category-icon">Ícono</label>
            <input
              id="category-icon"
              className="icon-input"
              type="text"
              placeholder="🏷️"
              maxLength={8}
              value={formulario.icon}
              onChange={(event) => setFormulario({ ...formulario, icon: event.target.value })}
            />

            <label htmlFor="category-type">Tipo</label>
            <select
              id="category-type"
              value={formulario.type}
              onChange={(event) => setFormulario({ ...formulario, type: event.target.value })}
            >
              <option value="GASTO">Gasto</option>
              <option value="INGRESO">Ingreso</option>
            </select>

            <button className="button-primary form-submit" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear categoría'}
            </button>
            {editandoId && (
              <button className="button-quiet" type="button" onClick={limpiarFormulario}>
                Cancelar edición
              </button>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
