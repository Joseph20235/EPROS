import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const formularioInicial = {
  tipo_accion: '',
  fecha: new Date().toISOString().slice(0, 10),
  responsable: 'Mariana Rios Lopez',
  observaciones: '',
  proximo_hito: ''
};

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

function nivelTexto(nivel) {
  return `Nivel ${nivel}`;
}

export default function Alertas() {
  const [alertas, setAlertas] = useState([]);
  const [seleccionadaId, setSeleccionadaId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const alertaSeleccionada = useMemo(
    () => alertas.find((alerta) => alerta.id === seleccionadaId) ?? null,
    [alertas, seleccionadaId]
  );

  function cargarAlertas() {
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/alertas`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar las alertas.');
        return data;
      })
      .then((data) => {
        setAlertas(data);
        setSeleccionadaId((actual) => actual ?? data[0]?.id ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  function cargarDetalle(alertaId) {
    if (!alertaId) {
      setDetalle(null);
      return;
    }

    setCargandoDetalle(true);
    setError('');

    fetch(`${API_BASE}/alertas/${alertaId}`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el caso alertado.');
        return data;
      })
      .then((data) => {
        setDetalle(data);
        setFormulario((actual) => ({
          ...actual,
          tipo_accion: data.alerta.acciones_disponibles?.[0] ?? '',
          proximo_hito: data.alerta.proximo_hito ?? actual.proximo_hito
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargandoDetalle(false));
  }

  useEffect(() => {
    cargarAlertas();
  }, []);

  useEffect(() => {
    cargarDetalle(seleccionadaId);
  }, [seleccionadaId]);

  async function ejecutarMonitoreo() {
    setEjecutando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/alertas/monitorear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: 1 })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible ejecutar el monitoreo.');

      setAlertas(data.alertas);
      setSeleccionadaId(data.alertas[0]?.id ?? null);
      setMensaje(`Monitoreo ejecutado. Alertas activas: ${data.total}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setEjecutando(false);
    }
  }

  function actualizarCampo(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function registrarAccion(event) {
    event.preventDefault();
    if (!seleccionadaId) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/alertas/${seleccionadaId}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formulario,
          incapacidad_id: detalle?.alerta?.incapacidad_principal_id,
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible registrar la accion.');

      setMensaje('Accion registrada y alerta reprogramada.');
      setFormulario((actual) => ({ ...formularioInicial, tipo_accion: actual.tipo_accion, proximo_hito: data.alerta.proximo_hito }));
      cargarAlertas();
      cargarDetalle(seleccionadaId);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>CU-11</p>
          <h1>Alertas prolongadas</h1>
        </div>
        <button type="button" className="primary-button" onClick={ejecutarMonitoreo} disabled={ejecutando}>
          {ejecutando ? 'Ejecutando...' : 'Ejecutar monitoreo'}
        </button>
      </header>

      {error && <p className="feedback error">{error}</p>}
      {mensaje && <p className="feedback success">{mensaje}</p>}

      <div className="alerts-layout">
        <article className="panel">
          {cargando && <p className="empty-state">Cargando alertas...</p>}
          {!cargando && alertas.length === 0 && (
            <p className="empty-state">Ejecuta el monitoreo para generar alertas por incapacidades prolongadas.</p>
          )}

          {!cargando && alertas.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Nivel</th>
                  <th>Colaborador</th>
                  <th>Dias</th>
                  <th>Diagnostico</th>
                  <th>EPS/ARL</th>
                  <th>Proximo hito</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((alerta) => (
                  <tr
                    key={alerta.id}
                    className={seleccionadaId === alerta.id ? 'selected-row' : ''}
                    onClick={() => setSeleccionadaId(alerta.id)}
                  >
                    <td>
                      <span className={`alert-level level-${alerta.nivel_alerta}`}>
                        {nivelTexto(alerta.nivel_alerta)}
                      </span>
                    </td>
                    <td>
                      <strong>{alerta.nombre_completo}</strong>
                      <small>{alerta.numero_identificacion} - {alerta.area}</small>
                    </td>
                    <td>
                      <strong>{alerta.dias_acumulados}</strong>
                      <small>{alerta.dias_ultimos_3_anios} en 3 anios</small>
                    </td>
                    <td>{alerta.diagnostico_principal}</td>
                    <td>{alerta.eps_arl_nombre}</td>
                    <td>{formatearFecha(alerta.proximo_hito)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <aside className="alerts-side">
          <article className="panel detail-panel">
            <h2>Caso seleccionado</h2>
            {!alertaSeleccionada && <p className="empty-state">Selecciona una alerta para revisar el detalle.</p>}
            {alertaSeleccionada && cargandoDetalle && <p className="empty-state">Cargando caso...</p>}

            {alertaSeleccionada && !cargandoDetalle && detalle && (
              <>
                <div className="state-header compact-state-header">
                  <div>
                    <span>{nivelTexto(detalle.alerta.nivel_alerta)}</span>
                    <strong>{detalle.alerta.nombre_completo}</strong>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navegar(`/incapacidades/${detalle.alerta.incapacidad_principal_id}`)}
                  >
                    Expediente
                  </button>
                </div>

                <dl className="detail-grid alert-detail-grid">
                  <div>
                    <dt>Dias acumulados</dt>
                    <dd>{detalle.alerta.dias_acumulados}</dd>
                  </div>
                  <div>
                    <dt>Dias 3 anios</dt>
                    <dd>{detalle.alerta.dias_ultimos_3_anios}</dd>
                  </div>
                  <div>
                    <dt>Diagnostico principal</dt>
                    <dd>{detalle.alerta.diagnostico_principal}</dd>
                  </div>
                  <div>
                    <dt>Entidad</dt>
                    <dd>{detalle.alerta.eps_arl_nombre}</dd>
                  </div>
                </dl>

                <h3 className="subheading">Acciones recomendadas</h3>
                <ul className="compact-list">
                  {detalle.alerta.recomendaciones.map((recomendacion) => (
                    <li key={recomendacion}>{recomendacion}</li>
                  ))}
                </ul>

                <h3 className="subheading">Historial activo</h3>
                <div className="compact-records">
                  {detalle.incapacidades.map((incapacidad) => (
                    <div key={incapacidad.id} className="record-item">
                      <strong>{incapacidad.numero_incapacidad} - {incapacidad.numero_dias} dias</strong>
                      <p>{incapacidad.fecha_inicio} a {incapacidad.fecha_fin} - {incapacidad.diagnostico_cie10}</p>
                      <small>{incapacidad.tipo} - {incapacidad.estado_actual}</small>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>

          <form className="panel form-grid tracking-form" onSubmit={registrarAccion}>
            <h2>Registrar accion</h2>
            <label>
              <span>Tipo de accion <strong>*</strong></span>
              <select
                value={formulario.tipo_accion}
                onChange={(event) => actualizarCampo('tipo_accion', event.target.value)}
                required
                disabled={!detalle}
              >
                {(detalle?.alerta.acciones_disponibles ?? []).map((accion) => (
                  <option key={accion} value={accion}>{accion}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Fecha <strong>*</strong></span>
              <input type="date" value={formulario.fecha} onChange={(event) => actualizarCampo('fecha', event.target.value)} required />
            </label>
            <label>
              <span>Responsable <strong>*</strong></span>
              <input value={formulario.responsable} onChange={(event) => actualizarCampo('responsable', event.target.value)} required />
            </label>
            <label>
              <span>Observaciones</span>
              <textarea rows="3" value={formulario.observaciones} onChange={(event) => actualizarCampo('observaciones', event.target.value)} />
            </label>
            <label>
              <span>Proximo hito <strong>*</strong></span>
              <input type="date" value={formulario.proximo_hito} onChange={(event) => actualizarCampo('proximo_hito', event.target.value)} required />
            </label>
            <button type="submit" className="primary-button" disabled={guardando || !detalle}>
              {guardando ? 'Guardando...' : 'Guardar accion'}
            </button>
          </form>

          {detalle?.acciones?.length > 0 && (
            <article className="panel detail-panel">
              <h2>Acciones registradas</h2>
              <div className="compact-records">
                {detalle.acciones.map((accion) => (
                  <div key={accion.id} className="record-item">
                    <strong>{accion.tipo_accion}</strong>
                    <p>{accion.observaciones ?? 'Sin observaciones'}</p>
                    <small>{formatearFecha(accion.fecha)} - proximo hito {formatearFecha(accion.proximo_hito)}</small>
                  </div>
                ))}
              </div>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}
