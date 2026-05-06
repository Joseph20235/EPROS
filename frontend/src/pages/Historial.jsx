import React from 'react';

const registros = [
  {
    id: 'INC-001',
    colaborador: 'Ana Torres',
    inicio: '2026-05-01',
    fin: '2026-05-05',
    estado: 'En seguimiento'
  }
];

export default function Historial() {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p>Consulta</p>
          <h1>Historial</h1>
        </div>
      </header>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Colaborador</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id}>
                <td>{registro.id}</td>
                <td>{registro.colaborador}</td>
                <td>{registro.inicio}</td>
                <td>{registro.fin}</td>
                <td>
                  <span className="status">{registro.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
