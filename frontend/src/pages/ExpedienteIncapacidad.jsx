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

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(valor ?? 0));
}

export default function ExpedienteIncapacidad({ incapacidadId, soloLectura = false }) {
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
    navegar(`/incapacidades/${incapacidadId}/cobro`);
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
              {!soloLectura && (
                <div className="actions-cell">
                  {expediente.estado_actual === 'Aprobada' && (
                    <button type="button" className="primary-button" onClick={iniciarCobro}>
                      Gestionar cobro
                    </button>
                  )}
                  {expediente.estado_actual === 'En_Cobro' && (
                    <button type="button" className="primary-button" onClick={() => navegar(`/incapacidades/${incapacidadId}/pago`)}>
                      Registrar pago
                    </button>
                  )}
                  {['Radicada', 'En_Revision_EPS'].includes(expediente.estado_actual) && (
                    <button type="button" className="primary-button" onClick={() => navegar(`/incapacidades/${incapacidadId}/rechazo`)}>
                      Gestionar rechazo
                    </button>
                  )}
                  {expediente.estado_actual === 'En_Conciliacion' && (
                    <button type="button" className="primary-button" onClick={() => navegar(`/incapacidades/${incapacidadId}/conciliacion`)}>
                      Conciliacion
                    </button>
                  )}
                  {['Rechazada', 'Cobro_Juridico'].includes(expediente.estado_actual) && (
                    <button type="button" className="primary-button" onClick={() => navegar(`/incapacidades/${incapacidadId}/juridico`)}>
                      Cobro juridico
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
              )}
            </div>

            {mostrarCambio && !soloLectura && (
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

          <article className="panel detail-panel">
            <h2>Novedades de seguimiento</h2>
            {expediente.seguimientos?.length ? (
              <div className="compact-records">
                {expediente.seguimientos.map((seguimiento) => (
                  <div key={seguimiento.id} className="record-item">
                    <strong>{seguimiento.fecha_contacto} · {seguimiento.canal_contacto}</strong>
                    <p>{seguimiento.resultado_gestion}</p>
                    <small>{seguimiento.proximo_paso ?? 'Sin proximo paso'} · {seguimiento.auxiliar_nombre ?? 'Usuario sistema'}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No hay novedades registradas.</p>
            )}
          </article>

          <article className="panel detail-panel">
            <h2>Cobros y pagos</h2>
            {expediente.cobros?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Fecha cobro</th>
                    <th>Valor cobrado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {expediente.cobros.map((cobro) => (
                    <tr key={cobro.id}>
                      <td>{cobro.fecha_cobro}</td>
                      <td>{formatearMoneda(cobro.valor_cobrado)}</td>
                      <td>{cobro.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">No hay cobros registrados.</p>
            )}

            {expediente.pagos?.length ? (
              <table className="stacked-table">
                <thead>
                  <tr>
                    <th>Fecha pago</th>
                    <th>Referencia</th>
                    <th>Entidad</th>
                    <th>Valor pagado</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {expediente.pagos.map((pago) => (
                    <tr key={pago.id}>
                      <td>{pago.fecha_pago}</td>
                      <td>{pago.numero_referencia}</td>
                      <td>{pago.entidad_pagadora}</td>
                      <td>{formatearMoneda(pago.valor_pagado)}</td>
                      <td>{formatearMoneda(pago.diferencia_detectada)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state finance-empty">No hay pagos registrados.</p>
            )}
          </article>

          {(expediente.rechazo || expediente.conciliacion || expediente.cobro_juridico) && (
            <article className="panel detail-panel">
              <h2>Gestion excepcional</h2>
              <div className="compact-records">
                {expediente.rechazo && (
                  <div className="record-item">
                    <strong>Rechazo {expediente.rechazo.codigo_rechazo ?? expediente.rechazo.motivo_codigo}</strong>
                    <p>{expediente.rechazo.motivo_descripcion}</p>
                    <small>{expediente.rechazo.accion_seleccionada ?? 'Sin accion seleccionada'}</small>
                  </div>
                )}
                {expediente.conciliacion && (
                  <div className="record-item">
                    <strong>Conciliacion - diferencia {formatearMoneda(expediente.conciliacion.diferencia)}</strong>
                    <p>{expediente.conciliacion.justificacion_diferencia ?? 'Sin justificacion final'}</p>
                    <small>{expediente.conciliacion.resultado ?? 'Sin resultado final'}</small>
                  </div>
                )}
                {expediente.cobro_juridico && (
                  <div className="record-item">
                    <strong>Cobro juridico - {formatearMoneda(expediente.cobro_juridico.valor_en_disputa)}</strong>
                    <p>{expediente.cobro_juridico.estado_proceso}</p>
                    <small>{expediente.cobro_juridico.resultado_final ?? 'Proceso activo'}</small>
                  </div>
                )}
              </div>
            </article>
          )}

          <article className="panel detail-panel">
            <h2>Documentos adjuntos</h2>
            {expediente.documentos?.length ? (
              <div className="document-list">
                {expediente.documentos.map((documento) => (
                  <a key={`${documento.etiqueta}-${documento.url}`} href={`${API_BASE.replace('/api', '')}${documento.url}`} download>
                    {documento.etiqueta}
                  </a>
                ))}
              </div>
            ) : (
              <p className="empty-state">No hay documentos descargables.</p>
            )}
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
