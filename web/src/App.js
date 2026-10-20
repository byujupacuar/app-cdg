import React, { useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Registro from './components/Registro';
import Categorias from './components/Categorias';
import Presupuestos from './components/Presupuestos';
import Prestamos from './components/Prestamos';
import Analisis from './components/Analisis';
import Cuentas from './components/Cuentas';
import './App.css';

const navigation = [
  { id: 'dashboard', icon: '◫', label: 'Resumen' },
  { id: 'analisis', icon: '⌁', label: 'Análisis' },
  { id: 'movimientos', icon: '↕', label: 'Movimientos' },
  { id: 'categorias', icon: '◇', label: 'Categorías' },
  { id: 'presupuestos', icon: '◉', label: 'Presupuestos' },
  { id: 'prestamos', icon: '↗', label: 'Préstamos' },
  { id: 'cuentas', icon: '▣', label: 'Cuentas' }
];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('nivia_token'));
  const [seccion, setSeccion] = useState('dashboard');
  const [actualizacion, setActualizacion] = useState(0);

  const handleLogin = (newToken) => {
    setToken(newToken);
    setSeccion('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('nivia_token');
    setToken(null);
  };

  const actualizarResumen = () => setActualizacion((current) => current + 1);

  if (!token) {
    return <Auth onLoginSuccess={handleLogin} />;
  }

  const seccionActual = navigation.find((item) => item.id === seccion);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <a className="app-brand" href="#inicio" onClick={(event) => event.preventDefault()}>
          <span className="app-brand-mark">n</span>
          <span>Nivia<small>FINANZAS EN CALMA</small></span>
        </a>

        <div className="sidebar-caption">ESPACIO PERSONAL</div>
        <nav className="app-navigation" aria-label="Navegación principal">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`navigation-item ${seccion === item.id ? 'is-active' : ''}`}
              onClick={() => setSeccion(item.id)}
              aria-current={seccion === item.id ? 'page' : undefined}
            >
              <span className="navigation-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.id === 'movimientos' && <span className="navigation-arrow">›</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <span className="sidebar-note-icon">✦</span>
          <strong>Un paso a la vez</strong>
          <p>Pequeños hábitos hacen grandes cambios.</p>
        </div>

        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          <span aria-hidden="true">↪</span> Cerrar sesión
        </button>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div>
            <span className="eyebrow">TU DINERO, MÁS CLARO</span>
            <h1>{seccionActual?.label}</h1>
          </div>
          <div className="topbar-status"><span /> Cuenta segura</div>
        </header>

        <div className="app-page">
          {seccion === 'dashboard' && (
            <Dashboard refreshKey={actualizacion} onNavigate={setSeccion} />
          )}
          {seccion === 'analisis' && (
            <Analisis refreshKey={actualizacion} onNavigate={setSeccion} />
          )}
          {seccion === 'movimientos' && (
            <Registro onGuardado={actualizarResumen} onNavigate={setSeccion} />
          )}
          {seccion === 'categorias' && (
            <Categorias />
          )}
          {seccion === 'presupuestos' && (
            <Presupuestos />
          )}
          {seccion === 'prestamos' && (
            <Prestamos />
          )}
          {seccion === 'cuentas' && (
            <Cuentas onUpdated={actualizarResumen} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
