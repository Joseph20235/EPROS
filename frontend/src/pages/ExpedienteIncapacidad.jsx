import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const estadoLabels = {
  Registrada: 'Registrada',
  En_Validacion: 'En validacion',
  Transcrita: 'Transcrita',
  Radicada: 'Radicada',
  En_Revision_EPS: 'En revision EPS',
  Aprobada: 'Aprobada',
  Rechazada: 'Rechazada',
  En_Cobro: 'En cobro',
  En_Conciliacion: 'En conciliacion',
  Cobro_Juridico: 'Cobro juridico',
  Pagada: 'Pagada',
  Cerrada_Sin_Pago: 'Cerrada sin pago'
};

function navegar(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function formatearFechaHora(valor) {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(fecha);
}

function etiquetaEstado(estado) {
  return estadoLabels[estado] ?? estado;
}

export default function ExpedienteIncapacidad({ incapacidadId }) {
  const [expediente, setExpediente] = useState(null);
  const [estadoDestino, setEstadoDestino] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [mostrarCambio, setMostrarCambio] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const transiciones = useMemo(() => expediente?.transiciones_validas ?? [], [expediente]);

  function cargarExpediente() {
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/incapacidades/${incapacidadId}`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el expediente.');
        return data;
      })
      .then((data) => {
        setExpediente(data);
        setEstadoDestino(data.transiciones_validas?.[0] ?? '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarExpediente();
  }, [incapacidadId]);

  async function cambiarEstado(event) {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: estadoDestino,
          justificacion,
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cambiar el estado.');

      setExpediente(data);
      setEstadoDestino(data.transiciones_validas?.[0] ?? '');
      setJustificacion('');
      setMostrarCambio(false);
      setMensaje(`Estado actualizado a ${etiquetaEstado(data.estado_actual)}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function iniciarCobro() {
    setMostrarCambio(true);
    setEstadoDestino('En_Cobro');
    setJustificacion('Inicio de gestion de cobro por incapacidad aprobada.');
  }

  if (cargando) {
    return (
      <section className="page wide-page">
        <p className="empty-state">Cargando expediente...</p>
      </section>
    );
  }

  if (!expediente) {
    return (
      <section className="page wide-page">
        {error && <p className="feedback error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Expediente</p>
          <h1>{expediente.numero_incapacidad}</h1>
        </div>
        <button type="button" className="secondary-button" onClick={() => navegar('/historial')}>
          Volver
        </button>
      </header>

      <div className="expediente-layout">
        <div className="validation-main">
          {error && <p className="feedback error">{error}</p>}
          {mensaje && <p className="feedback success">{mensaje}</p>}

          <article className="panel detail-panel">
            <div className="state-header">
              <div>
                <span>Estado actual</span>
                <strong className={`status status-${expediente.estado_actual}`}>
                  {etiquetaEstado(expediente.estado_actual)}
                </strong>
              </div>
              <div className="actions-cell">
                {expediente.estado_actual === 'Aprobada' && (
                  <button type="button" className="primary-button" onClick={iniciarCobro}>
                    Iniciar cobro
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  disabled={transiciones.length === 0}
                  onClick={() => setMostrarCambio((actual) => !actual)}
                >
                  Cambiar estado
                </button>
              </div>
            </div>

            {mostrarCambio && (
              <form className="state-change-form" onSubmit={cambiarEstado}>
                <label>
                  <span>Nuevo estado</span>
                  <select value={estadoDestino} onChange={(event) => setEstadoDestino(event.target.value)} required>
                    {transiciones.map((estado) => (
                      <option key={estado} value={estado}>
                        {etiquetaEstado(estado)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Justificacion <strong>*</strong></span>
                  <textarea
                    rows="3"
                    value={justificacion}
                    onChange={(event) => setJustificacion(event.target.value)}
                    required
                    placeholder="Describe el motivo del cambio de estado"
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={guardando || !estadoDestino}>
                    {guardando ? 'Guardando...' : 'Confirmar cambio'}
                  </button>
                </div>
              </form>
            )}

            <dl className="detail-grid">
              <div>
                <dt>Colaborador</dt>
                <dd>{expediente.colaborador_nombre}</dd>
              </div>
              <div>
                <dt>Identificacion</dt>
                <dd>{expediente.colaborador_identificacion}</dd>
              </div>
              <div>
                <dt>EPS/ARL</dt>
                <dd>{expediente.eps_arl_nombre}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{expediente.tipo}</dd>
              </div>
              <div>
                <dt>Fechas</dt>
                <dd>{expediente.fecha_inicio} a {expediente.fecha_fin}</dd>
              </div>
              <div>
                <dt>Dias</dt>
                <dd>{expediente.numero_dias}</dd>
              </div>
              <div>
                <dt>CIE-10</dt>
                <dd>{expediente.diagnostico_cie10}</dd>
              </div>
              <div>
                <dt>Entidad emisora</dt>
                <dd>{expediente.entidad_emisora}</dd>
              </div>
              <div className="full-width">
                <dt>Observaciones</dt>
                <dd>{expediente.observaciones ?? 'Sin observaciones'}</dd>
              </div>
            </dl>
          </article>
        </div>

        <aside className="panel timeline-panel">
          <h2>Timeline de estados</h2>
          <ol className="timeline">
            {expediente.estados.map((estado) => (
              <li key={estado.id}>
                <span className={`timeline-dot status-${estado.estado}`} />
                <div>
                  <strong>{etiquetaEstado(estado.estado)}</strong>
                  <time>{formatearFechaHora(estado.fecha_cambio)}</time>
                  <p>{estado.justificacion ?? 'Sin justificacion registrada.'}</p>
                  <small>{estado.usuario_nombre ?? `Usuario ${estado.usuario_id ?? 'sistema'}`}</small>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}
