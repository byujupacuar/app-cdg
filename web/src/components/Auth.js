import React, { useState } from 'react';
import { loginUsuario, registrarUsuario } from '../services/api';

export default function Auth({ onLoginSuccess }) {
  const [modoRegistro, setModoRegistro] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    const emailLimpio = email.trim().toLowerCase();
    const passwordLimpia = password.trim();

    try {
      const res = modoRegistro
        ? await registrarUsuario({ name: nombre.trim(), email: emailLimpio, password: passwordLimpia })
        : await loginUsuario({ email: emailLimpio, password: passwordLimpia });

      if (res.token) {
        localStorage.setItem('nivia_token', res.token);
        localStorage.setItem('nivia_user', JSON.stringify(res.usuario || res.user));
        if (onLoginSuccess) {
          onLoginSuccess(res.token, res.usuario || res.user);
        }
      } else {
        setError(res.mensaje || (modoRegistro ? 'No se pudo crear la cuenta.' : 'Credenciales inválidas.'));
      }
    } catch (err) {
      console.error(`Error al ${modoRegistro ? 'registrar' : 'iniciar sesión'} en la web:`, err.response?.data);
      setError(err.response?.data?.mensaje || err.response?.data?.error || (
        modoRegistro ? 'No se pudo crear la cuenta.' : 'Credenciales inválidas.'
      ));
    } finally {
      setCargando(false);
    }
  };

  const cambiarModo = () => {
    setModoRegistro((actual) => !actual);
    setError('');
  };

  return (
    <div className="auth-container">
      <div className="stitch-card auth-card">
        <div className="brand-header">
          <span className="brand-logo">🌱</span>
          <h2>Nivia</h2>
          <p>Finanzas Personales & Pareja</p>
          <h3 className="auth-form-title">{modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</h3>
        </div>

        {error && <div className="alert-error" style={{ color: '#e74c3c', marginBottom: 15, fontWeight: 'bold' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {modoRegistro && (
            <div className="input-group">
              <label htmlFor="auth-name">Nombre</label>
              <input
                id="auth-name"
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                autoComplete="name"
                maxLength={80}
                required
              />
            </div>
          )}
          <div className="input-group">
            <label htmlFor="auth-email">Correo Electrónico</label>
            <input 
              id="auth-email"
              type="email" 
              placeholder="tu@correo.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              autoComplete="email"
              required 
            />
          </div>

          <div className="input-group">
            <label htmlFor="auth-password">Contraseña</label>
            <input 
              id="auth-password"
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              autoComplete={modoRegistro ? 'new-password' : 'current-password'}
              required 
            />
          </div>

          <button type="submit" className="btn-primary" disabled={cargando}>
            {cargando
              ? (modoRegistro ? 'Creando cuenta...' : 'Ingresando...')
              : (modoRegistro ? 'Crear cuenta' : 'Iniciar sesión')}
          </button>
        </form>
        <button className="auth-mode-toggle" type="button" onClick={cambiarModo} disabled={cargando}>
          {modoRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>
      </div>
    </div>
  );
}