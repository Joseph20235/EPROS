import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const FILE_BASE = API_BASE.replace(/\/api\/?$/, '');
const estadosItem = ['Cumple', 'No cumple', 'Pendiente'];

function formatearTipo(tipo) {
  return String(tipo ?? '').replaceAll('_', ' ');
}

function resolverUrlAdjunto(ruta) {
  if (!ruta) return '';
  if (/^https?:\/\//.test(ruta)) return ruta;
  return `${FILE_BASE}${ruta}`;
}

function esPdf(ruta) {
  return /\.pdf(?:$|\?)/i.test(ruta ?? '');
}

function esImagen(ruta) {
  return /\.(png|jpe?g)(?:$|\?)/i.test(ruta ?? '');
}

export default function ValidarIncapacidad({ incapacidadId }) {
  const [incapacidad, setIncapacidad] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [faltantes, setFaltantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const urlAdjunto = useMemo(() => resolverUrlAdjunto(incapacidad?.documento_adjunto), [incapacidad]);

  useEffect(() => {
    if (!incapacidadId) {
      setError('No se encontro el ID de la incapacidad en la ruta.');
      setCargando(false);
      return;
    }

    fetch(`${API_BASE}/incapacidades/${incapacidadId}/validacion`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar la validacion.');
        return data;
      })
      .then((data) => {
        setIncapacidad(data.incapacidad);
        setChecklist(data.validacion.checklist_detalle ?? []);
        setObservaciones(data.validacion.observaciones ?? '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [incapacidadId]);

  function actualizarItem(clave, cambios) {
    setChecklist((actual) =>
      actual.map((item) => (item.clave === clave ? { ...item, ...cambios } : item))
    );
    setMensaje('');
    setError('');
    setFaltantes([]);
  }

  async function guardarValidacion() {
    setGuardando(true);
    setMensaje('');
    setError('');
    setFaltantes([]);

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/validacion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist, observaciones, usuario_id: 1 })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) {
        setError(data.error ?? 'No fue posible guardar la validacion.');
        return;
      }

      setChecklist(data.checklist_detalle ?? checklist);
      setMensaje('Validacion guardada.');
    } catch (err) {
      setError(err.message ?? 'No fue posible guardar la validacion.');
    } finally {
      setGuardando(false);
    }
  }

  async function aprobarValidacion() {
    setGuardando(true);
    setMensaje('');
    setError('');
    setFaltantes([]);

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/validacion/aprobar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist, observaciones, usuario_id: 1 })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) {
        setError(data.error ?? 'No fue posible aprobar la validacion.');
        setFaltantes(data.faltantes ?? []);
        return;
      }

      setIncapacidad(data.incapacidad);
      setMensaje('Validacion aprobada. La incapacidad paso a En_Validacion.');
    } catch (err) {
      setError(err.message ?? 'No fue posible aprobar la validacion.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section className="page wide-page">
        <div className="panel">Cargando validacion documental...</div>
      </section>
    );
  }

  if (error && !incapacidad) {
    return (
      <section className="page wide-page">
        <p className="feedback error">{error}</p>
      </section>
    );
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>CU-02</p>
          <h1>Validar documentacion</h1>
        </div>
        <span className="status">{incapacidad.estado_actual}</span>
      </header>

      <div className="validation-layout">
        <div className="validation-main">
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}
          {faltantes.length > 0 && (
            <div className="feedback error">
              <strong>Items criticos pendientes:</strong>
              <ul className="compact-list">
                {faltantes.map((faltante) => (
                  <li key={faltante}>{faltante}</li>
                ))}
              </ul>
            </div>
          )}

          <section className="panel detail-panel">
            <h2>Detalle de la incapacidad</h2>
            <dl className="detail-grid">
              <div>
                <dt>Numero</dt>
                <dd>{incapacidad.numero_incapacidad}</dd>
              </div>
              <div>
                <dt>Colaborador</dt>
                <dd>{incapacidad.colaborador_nombre}</dd>
              </div>
              <div>
                <dt>Identificacion</dt>
                <dd>{incapacidad.colaborador_identificacion}</dd>
              </div>
              <div>
                <dt>EPS/ARL</dt>
                <dd>{incapacidad.eps_arl_nombre}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{formatearTipo(incapacidad.tipo)}</dd>
              </div>
              <div>
                <dt>Dias</dt>
                <dd>{incapacidad.numero_dias}</dd>
              </div>
              <div>
                <dt>Fecha inicio</dt>
                <dd>{incapacidad.fecha_inicio}</dd>
              </div>
              <div>
                <dt>Fecha fin</dt>
                <dd>{incapacidad.fecha_fin}</dd>
              </div>
              <div>
                <dt>CIE-10</dt>
                <dd>{incapacidad.diagnostico_cie10}</dd>
              </div>
              <div>
                <dt>Entidad emisora</dt>
                <dd>{incapacidad.entidad_emisora}</dd>
              </div>
              <div className="full-width">
                <dt>Observaciones de registro</dt>
                <dd>{incapacidad.observaciones || 'Sin observaciones'}</dd>
              </div>
            </dl>
          </section>

          <section className="panel checklist-panel">
            <h2>Checklist documental</h2>
            <div className="checklist-table">
              {checklist.map((item) => (
                <div className="checklist-row" key={item.clave}>
                  <div>
                    <strong>{item.etiqueta}</strong>
                    {item.critico && <span className="critical-tag">Critico</span>}
                  </div>
                  <select
                    value={item.estado}
                    onChange={(event) => actualizarItem(item.clave, { estado: event.target.value })}
                  >
                    {estadosItem.map((estado) => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                  <textarea
                    rows="2"
                    value={item.observacion}
                    onChange={(event) => actualizarItem(item.clave, { observacion: event.target.value })}
                    placeholder="Observacion del item"
                  />
                </div>
              ))}
            </div>

            <label className="general-observation">
              Observacion general
              <textarea
                rows="4"
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
              />
            </label>

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={guardarValidacion} disabled={guardando}>
                Guardar avance
              </button>
              <button type="button" className="primary-button" onClick={aprobarValidacion} disabled={guardando}>
                {guardando ? 'Procesando' : 'Aprobar validacion'}
              </button>
            </div>
          </section>
        </div>

        <aside className="panel document-viewer">
          <h2>Documento adjunto</h2>
          {urlAdjunto && esPdf(urlAdjunto) && (
            <iframe title="Documento adjunto" src={urlAdjunto} />
          )}
          {urlAdjunto && esImagen(urlAdjunto) && (
            <img src={urlAdjunto} alt="Documento adjunto de la incapacidad" />
          )}
          {urlAdjunto && !esPdf(urlAdjunto) && !esImagen(urlAdjunto) && (
            <a className="secondary-button" href={urlAdjunto} target="_blank" rel="noreferrer">
              Abrir adjunto
            </a>
          )}
          {!urlAdjunto && <p className="empty-state">No hay documento adjunto registrado.</p>}
        </aside>
      </div>
    </section>
  );
}
