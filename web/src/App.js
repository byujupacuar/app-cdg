import React, { useEffect, useRef, useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Registro from './components/Registro';
import Categorias from './components/Categorias';
import Presupuestos from './components/Presupuestos';
import Prestamos from './components/Prestamos';
import Analisis from './components/Analisis';
import Cuentas from './components/Cuentas';
import { invitarPareja, obtenerMiCuenta } from './services/api';
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
  const [usuario, setUsuario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('nivia_user') || 'null');
    } catch {
      return null;
    }
  });
  const [cuentaUsuario, setCuentaUsuario] = useState(null);
  const [cargandoCuentaUsuario, setCargandoCuentaUsuario] = useState(true);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [emailPareja, setEmailPareja] = useState('');
  const [invitando, setInvitando] = useState(false);
  const [errorCuenta, setErrorCuenta] = useState('');
  const [mensajeInvitacion, setMensajeInvitacion] = useState('');
  const menuUsuarioRef = useRef(null);
  const [seccion, setSeccion] = useState('dashboard');
  const [actualizacion, setActualizacion] = useState(0);

  useEffect(() => {
    if (!token) {
      setCuentaUsuario(null);
      setCargandoCuentaUsuario(false);
      return undefined;
    }

    let activo = true;
    setCargandoCuentaUsuario(true);
    obtenerMiCuenta()
      .then((response) => {
        if (!activo) return;
        setCuentaUsuario(response.cuenta);
        const usuarioActual = response.usuario;
        if (usuarioActual) {
          setUsuario(usuarioActual);
          localStorage.setItem('nivia_user', JSON.stringify(usuarioActual));
        }
        setErrorCuenta('');
        setCargandoCuentaUsuario(false);
      })
      .catch((error) => {
        if (!activo) return;
        console.error('No se pudo cargar la cuenta del usuario:', error);
        setErrorCuenta(error.response?.data?.error || 'No se pudo cargar la información de la cuenta.');
        setCargandoCuentaUsuario(false);
      });

    return () => { activo = false; };
  }, [token]);

  useEffect(() => {
    const cerrarMenuExterno = (event) => {
      if (menuUsuarioRef.current && !menuUsuarioRef.current.contains(event.target)) {
        setMenuUsuarioAbierto(false);
      }
    };
    const cerrarMenuEscape = (event) => {
      if (event.key === 'Escape') setMenuUsuarioAbierto(false);
    };
    document.addEventListener('mousedown', cerrarMenuExterno);
    document.addEventListener('keydown', cerrarMenuEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarMenuExterno);
      document.removeEventListener('keydown', cerrarMenuEscape);
    };
  }, []);

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUsuario(newUser);
    localStorage.setItem('nivia_user', JSON.stringify(newUser));
    setSeccion('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('nivia_token');
    localStorage.removeItem('nivia_user');
    setToken(null);
    setUsuario(null);
    setCuentaUsuario(null);
    setMenuUsuarioAbierto(false);
  };

  const handleInvitarPareja = async (event) => {
    event.preventDefault();
    setErrorCuenta('');
    setMensajeInvitacion('');
    setInvitando(true);
    try {
      const response = await invitarPareja(emailPareja.trim().toLowerCase());
      setMensajeInvitacion(response.mensaje || 'Tu pareja se añadió a la cuenta compartida.');
      setEmailPareja('');
      try {
        const cuentaActualizada = await obtenerMiCuenta();
        setCuentaUsuario(cuentaActualizada.cuenta);
      } catch (error) {
        console.error('La pareja se vinculó, pero no se pudo actualizar la cuenta:', error);
        setErrorCuenta('La pareja se vinculó, pero no se pudo actualizar la información de la cuenta.');
      }
    } catch (error) {
      setErrorCuenta(error.response?.data?.error || 'No se pudo vincular a tu pareja.');
    } finally {
      setInvitando(false);
    }
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
          <img className="app-brand-mark" src="/nivia-logo.png" alt="" />
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

      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div>
            <span className="eyebrow">TU DINERO, MÁS CLARO</span>
            <h1>{seccionActual?.label}</h1>
          </div>
          <div className="user-menu" ref={menuUsuarioRef}>
            <button
              className="user-menu-trigger"
              type="button"
              aria-expanded={menuUsuarioAbierto}
              aria-haspopup="true"
              onClick={() => setMenuUsuarioAbierto((abierto) => !abierto)}
            >
              <span className="user-menu-avatar" aria-hidden="true">
                {(usuario?.name || usuario?.email || 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="user-menu-identity">
                <strong>{usuario?.name || 'Mi cuenta'}</strong>
                <small>{usuario?.email || 'Perfil de usuario'}</small>
              </span>
              <span className="user-menu-chevron" aria-hidden="true">⌄</span>
            </button>
            {menuUsuarioAbierto && (
              <section className="user-menu-panel" aria-label="Menú de usuario">
                <div className="user-menu-account">
                  <span className="panel-kicker">ESPACIO FINANCIERO</span>
                  <strong>
                    {cargandoCuentaUsuario ? 'Consultando cuenta...' : cuentaUsuario?.type === 'SHARED' ? 'Cuenta compartida' : 'Cuenta individual'}
                  </strong>
                  {cuentaUsuario?.miembros?.map((miembro) => (
                    <small key={miembro.id}>{miembro.name} · {miembro.email}</small>
                  ))}
                </div>
                {cargandoCuentaUsuario ? (
                  <p className="user-menu-note">Cargando información de la cuenta...</p>
                ) : cuentaUsuario?.type === 'SHARED' ? (
                  <p className="user-menu-note">La cuenta ya está compartida con tu pareja.</p>
                ) : cuentaUsuario ? (
                  <form className="user-menu-invite" onSubmit={handleInvitarPareja}>
                    <label htmlFor="user-menu-partner-email">Invitar a tu pareja</label>
                    <small>Debe tener una cuenta registrada en Nivia.</small>
                    <input
                      id="user-menu-partner-email"
                      type="email"
                      value={emailPareja}
                      onChange={(event) => setEmailPareja(event.target.value)}
                      placeholder="correo@ejemplo.com"
                      autoComplete="email"
                      required
                    />
                    <button className="button-primary" type="submit" disabled={invitando}>
                      {invitando ? 'Vinculando...' : 'Unir a cuenta compartida'}
                    </button>
                  </form>
                ) : null}
                {errorCuenta && <p className="user-menu-message is-error" role="alert">{errorCuenta}</p>}
                {mensajeInvitacion && <p className="user-menu-message" role="status">{mensajeInvitacion}</p>}
                <button className="user-menu-logout" type="button" onClick={handleLogout}>
                  ↪ Cerrar sesión
                </button>
              </section>
            )}
          </div>
        </header>

        <div className="app-page">
          {seccion === 'dashboard' && (
            <Dashboard refreshKey={actualizacion} onNavigate={setSeccion} userName={usuario?.name} />
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
