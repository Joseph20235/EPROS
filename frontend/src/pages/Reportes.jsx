import React from 'react';

const metricas = [
  { label: 'Incapacidades', value: '1' },
  { label: 'En seguimiento', value: '1' },
  { label: 'Cerradas', value: '0' },
  { label: 'Colaboradores activos', value: '1' }
];

export default function Reportes() {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p>Analitica</p>
          <h1>Reportes</h1>
        </div>
      </header>

      <div className="metrics-grid">
        {metricas.map((metrica) => (
          <article key={metrica.label} className="metric-card">
            <span>{metrica.label}</span>
            <strong>{metrica.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
