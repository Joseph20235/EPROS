import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

function navegar(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function formatearFecha(valor) {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(fecha);
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState({ estados: [], alertasUrgentes: [], ultimasIncapacidades: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/dashboard`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el dashboard.');
        return data;
      })
      .then(setDashboard)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Resumen general</p>
          <h1>Dashboard</h1>
        </div>
      </header>

      {error && <p className="feedback error">{error}</p>}
      {cargando && <p className="empty-state">Cargando dashboard...</p>}

      {!cargando && (
        <div className="dashboard-layout">
          <section className="metrics-grid dashboard-states">
            {dashboard.estados.map((estado) => (
              <article key={estado.estado} className={`metric-card state-card status-${estado.estado}`}>
                <span>{estado.estado}</span>
                <strong>{estado.total}</strong>
              </article>
            ))}
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Alertas urgentes</h2>
              <button type="button" className="secondary-button" onClick={() => navegar('/seguimiento')}>
                Ver seguimiento
              </button>
            </div>
            {dashboard.alertasUrgentes.length === 0 && <p className="empty-state">No hay alertas rojas o amarillas.</p>}
            {dashboard.alertasUrgentes.length > 0 && (
              <div className="alert-list">
                {dashboard.alertasUrgentes.map((alerta) => (
                  <button
                    key={alerta.id}
                    type="button"
                    className={`alert-item alert-${alerta.tipo_alerta}`}
                    onClick={() => navegar('/seguimiento')}
                  >
                    <span>{alerta.tipo_alerta === 'rojo' ? '🔴' : '🟡'}</span>
                    <strong>{alerta.numero_incapacidad}</strong>
                    <small>{alerta.colaborador_nombre} · {alerta.etiqueta_alerta} · {formatearFecha(alerta.fecha_limite_respuesta)}</small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Ultimas 5 incapacidades</h2>
              <button type="button" className="secondary-button" onClick={() => navegar('/historial')}>
                Ver historial
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Colaborador</th>
                  <th>EPS/ARL</th>
                  <th>Estado</th>
                  <th>Inicio</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.ultimasIncapacidades.map((incapacidad) => (
                  <tr key={incapacidad.id} onClick={() => navegar(`/incapacidades/${incapacidad.id}`)}>
                    <td>{incapacidad.numero_incapacidad}</td>
                    <td>{incapacidad.colaborador_nombre}</td>
                    <td>{incapacidad.eps_arl_nombre}</td>
                    <td>
                      <span className={`status status-${incapacidad.estado_actual}`}>{incapacidad.estado_actual}</span>
                    </td>
                    <td>{formatearFecha(incapacidad.fecha_inicio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="quick-actions">
            <button type="button" className="primary-button" onClick={() => navegar('/incapacidades/nueva')}>
              Registrar nueva
            </button>
            <button type="button" className="secondary-button" onClick={() => navegar('/seguimiento')}>
              Ver seguimiento
            </button>
            <button type="button" className="secondary-button" onClick={() => navegar('/historial')}>
              Ver historial
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
