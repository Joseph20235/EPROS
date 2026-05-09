import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

function navegar(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(valor ?? 0));
}

export default function ConciliacionIncapacidad({ incapacidadId }) {
  const [data, setData] = useState(null);
  const [gestion, setGestion] = useState({ fecha_contacto: '', respuesta_eps: '', documentos_intercambiados: '' });
  const [acuerdo, setAcuerdo] = useState({ valor_acordado: '', justificacion_diferencia: '', resultado: 'pago_adicional' });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const gestiones = useMemo(() => data?.conciliacion?.gestiones ?? [], [data]);

  function cargar() {
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/incapacidades/${incapacidadId}/conciliacion`)
      .then(async (respuesta) => {
        const body = await respuesta.json();
        if (!respuesta.ok) throw new Error(body.error ?? 'No fue posible cargar la conciliacion.');
        return body;
      })
      .then((body) => {
        setData(body);
        if (body.conciliacion?.valor_acordado) {
          setAcuerdo((actual) => ({
            ...actual,
            valor_acordado: body.conciliacion.valor_acordado,
            justificacion_diferencia: body.conciliacion.justificacion_diferencia ?? '',
            resultado: body.conciliacion.resultado ?? 'pago_adicional'
          }));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, [incapacidadId]);

  function actualizarGestion(event) {
    const { name, value } = event.target;
    setGestion((actual) => ({ ...actual, [name]: value }));
    setMensaje('');
    setError('');
  }

  function actualizarAcuerdo(event) {
    const { name, value } = event.target;
    setAcuerdo((actual) => ({ ...actual, [name]: value }));
    setMensaje('');
    setError('');
  }

  async function registrarGestion(event) {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/conciliacion/gestiones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...gestion, usuario_id: 1 })
      });
      const body = await respuesta.json();
      if (!respuesta.ok) throw new Error(body.error ?? 'No fue posible registrar la gestion.');

      setData((actual) => ({ ...actual, conciliacion: body.conciliacion }));
      setGestion({ fecha_contacto: '', respuesta_eps: '', documentos_intercambiados: '' });
      setMensaje('Gestion de conciliacion registrada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function registrarAcuerdo(event) {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/conciliacion/acuerdo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...acuerdo, usuario_id: 1 })
      });
      const body = await respuesta.json();
      if (!respuesta.ok) throw new Error(body.error ?? 'No fue posible registrar el acuerdo.');

      if (body.redirect_to) {
        navegar(body.redirect_to);
        return;
      }

      setData((actual) => ({ ...actual, incapacidad: body.incapacidad, conciliacion: body.conciliacion }));
      setMensaje('Acuerdo registrado y expediente cerrado como Pagada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <section className="page wide-page"><p className="empty-state">Cargando conciliacion...</p></section>;
  if (error && !data) return <section className="page wide-page"><p className="feedback error">{error}</p></section>;

  const { incapacidad, valor_cobrado, valor_pagado, diferencia } = data;
  const disponible = incapacidad.estado_actual === 'En_Conciliacion';

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>CU-14</p>
          <h1>Conciliacion</h1>
        </div>
        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${incapacidadId}`)}>
          Volver al expediente
        </button>
      </header>

      <div className="workflow-layout">
        <section className="panel detail-panel">
          <h2>Resumen financiero</h2>
          <dl className="detail-grid">
            <div><dt>Incapacidad</dt><dd>{incapacidad.numero_incapacidad}</dd></div>
            <div><dt>Estado</dt><dd><span className={`status status-${incapacidad.estado_actual}`}>{incapacidad.estado_actual}</span></dd></div>
            <div><dt>Valor cobrado</dt><dd>{formatearMoneda(valor_cobrado)}</dd></div>
            <div><dt>Valor pagado</dt><dd>{formatearMoneda(valor_pagado)}</dd></div>
          </dl>
          <div className="calculated-box">
            <span>Diferencia calculada</span>
            <strong>{formatearMoneda(diferencia)}</strong>
          </div>

          <h2>Gestiones registradas</h2>
          {gestiones.length ? (
            <div className="compact-records">
              {gestiones.map((item, index) => (
                <div key={`${item.fecha_contacto}-${index}`} className="record-item">
                  <strong>{item.fecha_contacto}</strong>
                  <p>{item.respuesta_eps}</p>
                  <small>{item.documentos_intercambiados || 'Sin documentos intercambiados'}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No hay gestiones registradas.</p>
          )}
        </section>

        <div className="validation-main">
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}
          {!disponible && <p className="feedback error">CU-14 solo esta disponible en estado En_Conciliacion.</p>}

          <form className="panel form-grid" onSubmit={registrarGestion}>
            <h2>Registrar gestion</h2>
            <label>
              <span>Fecha contacto <strong>*</strong></span>
              <input name="fecha_contacto" type="date" value={gestion.fecha_contacto} onChange={actualizarGestion} disabled={!disponible} required />
            </label>
            <label>
              <span>Respuesta EPS <strong>*</strong></span>
              <textarea name="respuesta_eps" rows="3" value={gestion.respuesta_eps} onChange={actualizarGestion} disabled={!disponible} required />
            </label>
            <label>
              <span>Documentos intercambiados</span>
              <textarea name="documentos_intercambiados" rows="2" value={gestion.documentos_intercambiados} onChange={actualizarGestion} disabled={!disponible} />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={guardando || !disponible}>
                Registrar gestion
              </button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={registrarAcuerdo}>
            <h2>Acuerdo final</h2>
            <label>
              <span>Valor acordado <strong>*</strong></span>
              <input name="valor_acordado" type="number" min="0" step="0.01" value={acuerdo.valor_acordado} onChange={actualizarAcuerdo} disabled={!disponible} required />
            </label>
            <label>
              <span>Justificacion diferencia aceptada <strong>*</strong></span>
              <textarea name="justificacion_diferencia" rows="3" value={acuerdo.justificacion_diferencia} onChange={actualizarAcuerdo} disabled={!disponible} required />
            </label>
            <label>
              <span>Resultado <strong>*</strong></span>
              <select name="resultado" value={acuerdo.resultado} onChange={actualizarAcuerdo} disabled={!disponible} required>
                <option value="pago_adicional">Implica pago adicional</option>
                <option value="aceptar_diferencia">Aceptar diferencia</option>
                <option value="sin_acuerdo">Sin acuerdo, escalar</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={guardando || !disponible}>
                Registrar acuerdo
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
