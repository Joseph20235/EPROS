import React from 'react';

const tareas = [
  'Validar soporte medico',
  'Confirmar dias reconocidos',
  'Actualizar estado con talento humano'
];

export default function Seguimiento() {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p>Control</p>
          <h1>Seguimiento</h1>
        </div>
      </header>

      <div className="panel task-list">
        {tareas.map((tarea) => (
          <label key={tarea} className="task-item">
            <input type="checkbox" />
            <span>{tarea}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
