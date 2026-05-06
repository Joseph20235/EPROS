import React from 'react';

export default function Login() {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p>Acceso</p>
          <h1>Inicio de sesion</h1>
        </div>
      </header>

      <form className="panel form-grid">
        <label>
          Correo institucional
          <input type="email" placeholder="usuario@empresa.com" />
        </label>

        <label>
          Contrasena
          <input type="password" placeholder="Ingresa tu contrasena" />
        </label>

        <button type="button" className="primary-button">
          Ingresar
        </button>
      </form>
    </section>
  );
}
