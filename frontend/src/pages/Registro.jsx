import React from 'react';

export default function Registro() {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p>Gestion</p>
          <h1>Registro de incapacidad</h1>
        </div>
      </header>

      <form className="panel form-grid two-columns">
        <label>
          Colaborador
          <input type="text" placeholder="Nombre completo" />
        </label>

        <label>
          Documento
          <input type="text" placeholder="Numero de documento" />
        </label>

        <label>
          Fecha de inicio
          <input type="date" />
        </label>

        <label>
          Fecha de fin
          <input type="date" />
        </label>

        <label className="full-width">
          Diagnostico
          <textarea rows="4" placeholder="Resumen del soporte medico" />
        </label>

        <button type="button" className="primary-button">
          Guardar registro
        </button>
      </form>
    </section>
  );
}
