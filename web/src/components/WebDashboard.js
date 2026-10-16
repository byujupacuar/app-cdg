import React, { useState, useEffect } from 'react';
import './WebDashboard.css';

export default function WebDashboard({ token, onLogout }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  
  // Estado del Registro Rápido
  const [tipo, setTipo] = useState('GASTO');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Alimentación');
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    // Simulación de carga desde /api/movimientos/dashboard
    setTimeout(() => {
      setDatos({
        cuenta: 'Familia Mendoza',
        tipoCuenta: 'SHARED',
        resumen: { balanceTotal: 2450.00, totalIngresos: 4200.00, totalGastos: 1750.00 },
        gastosPorCategoria: [
          { id: '1', nombre: 'Alimentación', icono: '🍕', monto: 650.00, porcentaje: 37.1 },
          { id: '2', nombre: 'Servicios & Hogar', icono: '💡', monto: 420.00, porcentaje: 24.0 },
          { id: '3', nombre: 'Transporte', icono: '🚌', monto: 280.00, porcentaje: 16.0 },
          { id: '4', nombre: 'Ocio & Entretenimiento', icono: '🎉', monto: 400.00, porcentaje: 22.9 }
        ],
        ultimosMovimientos: [
          { id: 'm1', type: 'GASTO', category: { icon: '🍕', name: 'Alimentación' }, amount: 45.00, description: 'Supermercado semanal', user: 'Carlos' },
          { id: 'm2', type: 'INGRESO', category: { icon: '💼', name: 'Sueldo' }, amount: 2100.00, description: 'Pago quincena', user: 'Ana' },
          { id: 'm3', type: 'GASTO', category: { icon: '💡', name: 'Servicios' }, amount: 85.50, description: 'Factura de luz', user: 'Carlos' }
        ]
      });
      setCargando(false);
    }, 400);
  }, []);

  if (cargando) return <div className="stitch-loading">Cargando Nivia Web...</div>;

  return (
    <div className="stitch-layout">
      {/* Sidebar de Navegación */}
      <aside className="stitch-sidebar">
        <div className="stitch-brand">
          <span className="brand-icon">🌱</span>
          <h2>Nivia</h2>
        </div>
        
        <nav className="stitch-nav">
          <a href="#dashboard" className="nav-item active">📊 Dashboard</a>
          <a href="#presupuestos" className="nav-item">🎯 Presupuestos</a>
          <a href="#prestamos" className="nav-item">💳 Préstamos</a>
          <a href="#categorias" className="nav-item">🏷️ Categorías</a>
          <a href="#pareja" className="nav-item">👥 Cuenta Pareja</a>
        </nav>

        <button className="btn-logout-sidebar" onClick={onLogout}>🚪 Cerrar Sesión</button>
      </aside>

      {/* Contenido Principal */}
      <main className="stitch-main">
        {/* Encabezado Superior */}
        <header className="stitch-topbar">
          <div>
            <h1>{datos.cuenta}</h1>
            <span className="badge-cuenta-type">
              {datos.tipoCuenta === 'SHARED' ? '👥 Pareja (Compartida)' : '👤 Cuenta Individual'}
            </span>
          </div>
          <div className="user-profile-badge">
            <span className="avatar">🧔</span>
            <span>Carlos Mendoza</span>
          </div>
        </header>

        {/* Mallas de Métricas Financieras */}
        <section className="metrics-grid">
          <div className="stitch-card balance-hero">
            <span className="card-label">Balance Disponible Total</span>
            <h2 className={datos.resumen.balanceTotal >= 0 ? 'txt-green' : 'txt-red'}>
              ${datos.resumen.balanceTotal.toFixed(2)}
            </h2>
          </div>

          <div className="stitch-card metric-sub">
            <span className="card-label">🟢 Ingresos del Mes</span>
            <h3 className="txt-green">+${datos.resumen.totalIngresos.toFixed(2)}</h3>
          </div>

          <div className="stitch-card metric-sub">
            <span className="card-label">🔴 Gastos del Mes</span>
            <h3 className="txt-red">-${datos.resumen.totalGastos.toFixed(2)}</h3>
          </div>
        </section>

        {/* Panel Dividido: Registro Rápido + Gráficos */}
        <div className="content-split">
          {/* Panel Izquierdo: Formulario de Registro (< 5s) */}
          <div className="stitch-card form-panel">
            <h3>➕ Registro Rápido</h3>
            
            <div className="type-toggle">
              <button 
                className={tipo === 'GASTO' ? 'toggle-btn active-gasto' : 'toggle-btn'}
                onClick={() => setTipo('GASTO')}
              >
                🔴 Gasto
              </button>
              <button 
                className={tipo === 'INGRESO' ? 'toggle-btn active-ingreso' : 'toggle-btn'}
                onClick={() => setTipo('INGRESO')}
              >
                🟢 Ingreso
              </button>
            </div>

            <div className="input-amount-container">
              <span>$</span>
              <input 
                type="number" 
                placeholder="0.00" 
                value={monto} 
                onChange={(e) => setMonto(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Categoría</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="Alimentación">🍕 Alimentación</option>
                <option value="Servicios">💡 Servicios & Hogar</option>
                <option value="Transporte">🚌 Transporte</option>
                <option value="Ocio">🎉 Ocio</option>
              </select>
            </div>

            <div className="form-group">
              <label>Detalle (Opcional)</label>
              <input 
                type="text" 
                placeholder="Ej. Mercado, Cine, Gasolina..." 
                value={descripcion} 
                onChange={(e) => setDescripcion(e.target.value)} 
              />
            </div>

            <button className="btn-stitch-primary">Guardar Movimiento</button>
          </div>

          {/* Panel Derecho: Gráficos de Distribución */}
          <div className="stitch-card graph-panel">
            <h3>📊 Distribución de Gastos por Categoría</h3>
            
            <div className="category-bars-list">
              {datos.gastosPorCategoria.map((cat) => (
                <div key={cat.id} className="cat-bar-row">
                  <div className="cat-bar-header">
                    <span>{cat.icono} {cat.nombre}</span>
                    <span className="cat-amount">${cat.monto.toFixed(2)} ({cat.porcentaje}%)</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${cat.porcentaje}%` }}></div>
                  </div>
                </div>
              ))}
            </div>

            <h4 className="sub-section-title">Actividad Reciente del Hogar</h4>
            <div className="activity-list">
              {datos.ultimosMovimientos.map((m) => (
                <div key={m.id} className="activity-item">
                  <span className="item-icon">{m.category.icon}</span>
                  <div className="item-info">
                    <strong>{m.category.name}</strong>
                    <small>{m.description} • <em>Por {m.user}</em></small>
                  </div>
                  <span className={m.type === 'INGRESO' ? 'item-amount txt-green' : 'item-amount'}>
                    {m.type === 'INGRESO' ? '+' : '-'}${m.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}