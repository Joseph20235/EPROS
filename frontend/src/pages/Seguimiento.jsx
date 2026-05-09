import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const semaforoMeta = {
  rojo: { icono: '🔴', texto: 'Rojo', clase: 'traffic-red' },
  amarillo: { icono: '🟡', texto: 'Amarillo', clase: 'traffic-yellow' },
  verde: { icono: '🟢', texto: 'Verde', clase: 'traffic-green' },
  sin_fecha: { icono: '○', texto: 'Sin fecha', clase: 'traffic-muted' }
};

const formularioInicial = {
  fecha_contacto: new Date().toISOString().slice(0, 10),
  canal_contacto: '',
  resultado_gestion: '',
  proximo_paso: ''
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

export default function Seguimiento() {
  const [incapacidades, setIncapacidades] = useState([]);
  const [seleccionadaId, setSeleccionadaId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const seleccionada = useMemo(
    () => incapacidades.find((incapacidad) => incapacidad.id === seleccionadaId) ?? null,
    [incapacidades, seleccionadaId]
  );

  function cargarPanel() {
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/seguimiento`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el seguimiento.');
        return data;
      })
      .then((data) => {
        setIncapacidades(data);
        setSeleccionadaId((actual) => actual ?? data[0]?.id ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  function cargarDetalle(incapacidadId) {
    if (!incapacidadId) {
      setDetalle(null);
      return;
    }

    setCargandoDetalle(true);
    setError('');

    fetch(`${API_BASE}/seguimiento/${incapacidadId}`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el historial de seguimiento.');
        return data;
      })
      .then(setDetalle)
      .catch((err) => setError(err.message))
      .finally(() => setCargandoDetalle(false));
  }

  useEffect(() => {
    cargarPanel();
  }, []);

  useEffect(() => {
    cargarDetalle(seleccionadaId);
  }, [seleccionadaId]);

  async function registrarSeguimiento(event) {
    event.preventDefault();
    if (!seleccionadaId) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/seguimiento/${seleccionadaId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formulario, usuario_id: 1 })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible registrar la novedad.');

      setDetalle({ incapacidad: data.incapacidad, historial: data.historial });
      setFormulario(formularioInicial);
      setMensaje('Novedad de seguimiento registrada.');
      cargarPanel();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function actualizarCampo(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Gestión humana</p>
          <h1>Seguimiento</h1>
        </div>
      </header>

      {error && <p className="feedback error">{error}</p>}
      {mensaje && <p className="feedback success">{mensaje}</p>}

      <div className="tracking-layout">
        <article className="panel">
          {cargando && <p className="empty-state">Cargando incapacidades en seguimiento...</p>}
          {!cargando && incapacidades.length === 0 && (
            <p className="empty-state">No hay incapacidades Radicada o En_Revision_EPS.</p>
          )}

          {!cargando && incapacidades.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Semaforo</th>
                  <th>Codigo</th>
                  <th>Colaborador</th>
                  <th>Estado</th>
                  <th>Fecha limite</th>
                  <th>Ultimo seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {incapacidades.map((incapacidad) => {
                  const meta = semaforoMeta[incapacidad.semaforo.nivel] ?? semaforoMeta.sin_fecha;

                  return (
                    <tr
                      key={incapacidad.id}
                      className={seleccionadaId === incapacidad.id ? 'selected-row' : ''}
                      onClick={() => setSeleccionadaId(incapacidad.id)}
                    >
                      <td>
                        <span className={`traffic-chip ${meta.clase}`}>
                          <span>{meta.icono}</span>
                          <strong>{incapacidad.semaforo.etiqueta}</strong>
                        </span>
                      </td>
                      <td>{incapacidad.numero_incapacidad}</td>
                      <td>{incapacidad.colaborador_nombre}</td>
                      <td>
                        <span className={`status status-${incapacidad.estado_actual}`}>{incapacidad.estado_actual}</span>
                      </td>
                      <td>{formatearFecha(incapacidad.fecha_limite_respuesta)}</td>
                      <td>{formatearFecha(incapacidad.fecha_ultimo_seguimiento)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </article>

        <aside className="tracking-side">
          <article className="panel detail-panel">
            <h2>Historial</h2>
            {!seleccionada && <p className="empty-state">Selecciona una incapacidad para ver su historial.</p>}
            {seleccionada && cargandoDetalle && <p className="empty-state">Cargando historial...</p>}

            {seleccionada && !cargandoDetalle && detalle && (
              <>
                <div className="state-header compact-state-header">
                  <div>
                    <span>Incapacidad</span>
                    <strong>{detalle.incapacidad.numero_incapacidad}</strong>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navegar(`/incapacidades/${detalle.incapacidad.id}`)}
                  >
                    Expediente
                  </button>
                </div>

                {detalle.historial.length === 0 && (
                  <p className="empty-state">Todavia no hay novedades registradas para esta incapacidad.</p>
                )}

                {detalle.historial.length > 0 && (
                  <ol className="timeline tracking-timeline">
                    {detalle.historial.map((seguimiento) => (
                      <li key={seguimiento.id}>
                        <span className="timeline-dot status-En_Revision_EPS" />
                        <div>
                          <strong>{seguimiento.canal_contacto}</strong>
                          <time>{formatearFecha(seguimiento.fecha_contacto)}</time>
                          <p>{seguimiento.resultado_gestion}</p>
                          <small>{seguimiento.proximo_paso ?? 'Sin proximo paso'} · {seguimiento.auxiliar_nombre ?? 'Usuario sistema'}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </article>

          <form className="panel form-grid tracking-form" onSubmit={registrarSeguimiento}>
            <h2>Registrar novedad</h2>
            <label>
              <span>Fecha contacto <strong>*</strong></span>
              <input
                type="date"
                value={formulario.fecha_contacto}
                onChange={(event) => actualizarCampo('fecha_contacto', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Canal contacto <strong>*</strong></span>
              <select
                value={formulario.canal_contacto}
                onChange={(event) => actualizarCampo('canal_contacto', event.target.value)}
                required
              >
                <option value="">Selecciona un canal</option>
                <option value="correo">Correo</option>
                <option value="telefono">Telefono</option>
                <option value="portal">Portal EPS/ARL</option>
                <option value="presencial">Presencial</option>
                <option value="sistema">Sistema</option>
              </select>
            </label>
            <label>
              <span>Resultado gestion <strong>*</strong></span>
              <textarea
                rows="3"
                value={formulario.resultado_gestion}
                onChange={(event) => actualizarCampo('resultado_gestion', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Proximo paso</span>
              <textarea
                rows="2"
                value={formulario.proximo_paso}
                onChange={(event) => actualizarCampo('proximo_paso', event.target.value)}
              />
            </label>
            <button type="submit" className="primary-button" disabled={guardando || !seleccionadaId}>
              {guardando ? 'Guardando...' : 'Guardar novedad'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
