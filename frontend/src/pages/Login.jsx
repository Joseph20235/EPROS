import React from 'react';
import { useState } from 'react';

import { login } from '../auth.js';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(event) {
    event.preventDefault();
    setError('');
    setCargando(true);

    try {
      await login(correo, password);
      window.history.replaceState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="login-page">
      <header className="login-header">
        <div>
          <span className="login-brand-mark">E</span>
          <p>EPROS</p>
          <h1>Sistema de Gestion de Incapacidades</h1>
        </div>
      </header>

      <form className="panel form-grid login-card" onSubmit={manejarSubmit}>
        <label>
          Correo institucional
          <input
            type="email"
            placeholder="usuario@empresa.com"
            value={correo}
            onChange={(event) => setCorreo(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label>
          Contrasena
          <input
            type="password"
            placeholder="Ingresa tu contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="feedback error">{error}</p>}

        <button type="submit" className="primary-button" disabled={cargando}>
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </section>
  );
}
