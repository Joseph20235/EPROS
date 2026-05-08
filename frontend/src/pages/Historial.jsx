import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

function navegar(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function Historial() {
  const [registros, setRegistros] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/incapacidades`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar incapacidades.');
        return data;
      })
      .then(setRegistros)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Consulta</p>
          <h1>Historial</h1>
        </div>
      </header>

      <div className="panel">
        {error && <p className="feedback error">{error}</p>}
        {cargando && <p className="empty-state">Cargando incapacidades...</p>}
        {!cargando && registros.length === 0 && <p className="empty-state">No hay incapacidades registradas.</p>}

        {!cargando && registros.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Colaborador</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((registro) => (
                <tr key={registro.id}>
                  <td>{registro.numero_incapacidad}</td>
                  <td>{registro.colaborador_nombre}</td>
                  <td>{registro.fecha_inicio}</td>
                  <td>{registro.fecha_fin}</td>
                  <td>
                    <span className={`status status-${registro.estado_actual}`}>{registro.estado_actual}</span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${registro.id}`)}>
                        Ver expediente
                      </button>
                      {registro.estado_actual === 'Registrada' && (
                        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${registro.id}/validar`)}>
                          Validar
                        </button>
                      )}
                      {registro.estado_actual === 'En_Validacion' && (
                        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${registro.id}/transcribir`)}>
                          Transcribir
                        </button>
                      )}
                      {registro.estado_actual === 'Transcrita' && (
                        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${registro.id}/radicar`)}>
                          Radicar
                        </button>
                      )}
                      {registro.estado_actual === 'Aprobada' && (
                        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${registro.id}/cobro`)}>
                          Cobro
                        </button>
                      )}
                      {registro.estado_actual === 'En_Cobro' && (
                        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${registro.id}/pago`)}>
                          Pago
                        </button>
                      )}
                      {!['Registrada', 'En_Validacion', 'Transcrita', 'Aprobada', 'En_Cobro'].includes(registro.estado_actual) && (
                        <span className="empty-state">Sin accion inicial</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
