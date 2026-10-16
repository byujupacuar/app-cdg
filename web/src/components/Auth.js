import React, { useState } from 'react';
import { loginUsuario } from '../services/api';

export default function Auth({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    // 1. Limpieza de datos (Saneamiento de texto)
    const emailLimpio = email.trim().toLowerCase();
    const passwordLimpia = password.trim();

    try {
      // 2. Enviar datos estructurados con las llaves exactas 'email' y 'password'
      const res = await loginUsuario({ 
        email: emailLimpio, 
        password: passwordLimpia 
      });

      if (res.exito) {
        // 3. Guardar token JWT y notificar éxito
        localStorage.setItem('nivia_token', res.token);
        if (onLoginSuccess) {
          onLoginSuccess(res.token, res.usuario);
        }
      } else {
        setError(res.mensaje || 'Credenciales inválidas.');
      }
    } catch (err) {
      console.error("Error en petición de Login Web:", err.response?.data);
      setError(err.response?.data?.mensaje || err.response?.data?.error || 'Credenciales inválidas.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="stitch-card auth-card">
        <div className="brand-header">
          <span className="brand-logo">🌱</span>
          <h2>Nivia</h2>
          <p>Finanzas Personales & Pareja</p>
        </div>

        {error && <div className="alert-error" style={{ color: '#e74c3c', marginBottom: 15, fontWeight: 'bold' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Correo Electrónico</label>
            <input 
              type="email" 
              placeholder="tu@correo.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="btn-primary" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}