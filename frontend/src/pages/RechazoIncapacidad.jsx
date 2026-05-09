import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const formularioInicial = {
  motivo_codigo: '',
  motivo_descripcion: '',
  fecha_notificacion: '',
  codigo_rechazo: '',
  observaciones: ''
};

function navegar(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export default function RechazoIncapacidad({ incapacidadId }) {
  const [incapacidad, setIncapacidad] = useState(null);
  const [rechazo, setRechazo] = useState(null);
  const [motivos, setMotivos] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [archivo, setArchivo] = useState(null);
  const [plazoImpugnacion, setPlazoImpugnacion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  function cargar() {
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/incapacidades/${incapacidadId}/rechazo`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el rechazo.');
        return data;
      })
      .then((data) => {
        setIncapacidad(data.incapacidad);
        setRechazo(data.rechazo);
        setMotivos(data.motivos ?? []);
        if (data.rechazo) {
          setFormulario({
            motivo_codigo: data.rechazo.motivo_codigo ?? '',
            motivo_descripcion: data.rechazo.motivo_descripcion ?? '',
            fecha_notificacion: data.rechazo.fecha_notificacion ?? '',
            codigo_rechazo: data.rechazo.codigo_rechazo ?? '',
            observaciones: data.rechazo.observaciones ?? ''
          });
          setPlazoImpugnacion(data.rechazo.plazo_impugnacion ?? '');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, [incapacidadId]);

  function actualizarCampo(event) {
    const { name, value } = event.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setMensaje('');
    setError('');
  }

  function seleccionarMotivo(event) {
    const codigo = event.target.value;
    const motivo = motivos.find((item) => item.codigo === codigo);
    setFormulario((actual) => ({
      ...actual,
      motivo_codigo: codigo,
      motivo_descripcion: codigo === 'OTRO' ? '' : motivo?.descripcion ?? ''
    }));
  }

  function seleccionarArchivo(event) {
    const file = event.target.files?.[0] ?? null;
    setMensaje('');
    setError('');

    if (!file) {
      setArchivo(null);
      return;
    }

    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setArchivo(null);
      setError('La notificacion debe ser PDF, JPG o PNG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setArchivo(null);
      setError('La notificacion no puede superar 5MB.');
      return;
    }

    setArchivo(file);
  }

  async function registrarRechazo(event) {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      if (!archivo) throw new Error('Adjunta la notificacion de la EPS.');
      const documentoNotificacionData = await leerArchivoComoDataUrl(archivo);
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/rechazo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formulario,
          documento_notificacion_data: documentoNotificacionData,
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible registrar el rechazo.');

      setIncapacidad(data.incapacidad);
      setRechazo(data.rechazo);
      setMensaje('Rechazo registrado. Selecciona la accion a seguir.');
      setArchivo(null);
      event.target.reset();
      setFormulario({
        motivo_codigo: data.rechazo.motivo_codigo ?? '',
        motivo_descripcion: data.rechazo.motivo_descripcion ?? '',
        fecha_notificacion: data.rechazo.fecha_notificacion ?? '',
        codigo_rechazo: data.rechazo.codigo_rechazo ?? '',
        observaciones: data.rechazo.observaciones ?? ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function decidirAccion(accion) {
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      if (accion === 'impugnar' && !plazoImpugnacion) {
        throw new Error('Indica el plazo legal de impugnacion.');
      }

      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/rechazo/accion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          plazo_impugnacion: plazoImpugnacion,
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible registrar la decision.');
      if (data.redirect_to) {
        navegar(data.redirect_to);
        return;
      }

      setIncapacidad(data.incapacidad);
      setRechazo(data.rechazo);
      setMensaje(accion === 're_radicar' ? 'El caso volvio a Transcrita para re-radicar.' : 'Impugnacion registrada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <section className="page wide-page"><p className="empty-state">Cargando rechazo...</p></section>;
  if (error && !incapacidad) return <section className="page wide-page"><p className="feedback error">{error}</p></section>;

  const puedeRegistrar = ['Radicada', 'En_Revision_EPS'].includes(incapacidad.estado_actual);
  const puedeDecidir = incapacidad.estado_actual === 'Rechazada' && rechazo;

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>CU-12</p>
          <h1>Gestionar rechazo</h1>
        </div>
        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${incapacidadId}`)}>
          Volver al expediente
        </button>
      </header>

      <div className="workflow-layout">
        <section className="panel detail-panel">
          <h2>Resumen</h2>
          <dl className="detail-grid">
            <div><dt>Incapacidad</dt><dd>{incapacidad.numero_incapacidad}</dd></div>
            <div><dt>Estado</dt><dd><span className={`status status-${incapacidad.estado_actual}`}>{incapacidad.estado_actual}</span></dd></div>
            <div><dt>Colaborador</dt><dd>{incapacidad.colaborador_nombre}</dd></div>
            <div><dt>Entidad</dt><dd>{incapacidad.eps_arl_nombre}</dd></div>
          </dl>

          {rechazo && (
            <div className="compact-records stacked-table">
              <div className="record-item">
                <strong>{rechazo.codigo_rechazo ?? rechazo.motivo_codigo} - {rechazo.fecha_notificacion}</strong>
                <p>{rechazo.motivo_descripcion}</p>
                <small>{rechazo.observaciones ?? 'Sin observaciones'} {rechazo.accion_seleccionada ? `- Accion: ${rechazo.accion_seleccionada}` : ''}</small>
              </div>
            </div>
          )}

          {puedeDecidir && (
            <div className="action-panel">
              <h2>Accion a seguir</h2>
              <label>
                <span>Plazo legal de impugnacion</span>
                <input type="date" value={plazoImpugnacion} onChange={(event) => setPlazoImpugnacion(event.target.value)} />
              </label>
              <div className="actions-cell">
                <button type="button" className="secondary-button" disabled={guardando} onClick={() => decidirAccion('re_radicar')}>
                  Corregir y re-radicar
                </button>
                <button type="button" className="secondary-button" disabled={guardando} onClick={() => decidirAccion('impugnar')}>
                  Impugnar
                </button>
                <button type="button" className="primary-button" disabled={guardando} onClick={() => decidirAccion('cobro_juridico')}>
                  Cobro juridico
                </button>
              </div>
            </div>
          )}
        </section>

        <form className="panel form-grid" onSubmit={registrarRechazo}>
          <h2>Datos del rechazo</h2>
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}
          {!puedeRegistrar && !puedeDecidir && (
            <p className="feedback error">CU-12 solo esta disponible cuando la incapacidad esta Radicada o En_Revision_EPS.</p>
          )}

          <label>
            <span>Motivo <strong>*</strong></span>
            <select name="motivo_codigo" value={formulario.motivo_codigo} onChange={seleccionarMotivo} disabled={!puedeRegistrar} required>
              <option value="">Selecciona un motivo</option>
              {motivos.map((motivo) => (
                <option key={motivo.codigo} value={motivo.codigo}>{motivo.descripcion}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Descripcion del motivo <strong>*</strong></span>
            <textarea name="motivo_descripcion" rows="3" value={formulario.motivo_descripcion} onChange={actualizarCampo} disabled={!puedeRegistrar || formulario.motivo_codigo !== 'OTRO'} required />
          </label>

          <label>
            <span>Fecha notificacion <strong>*</strong></span>
            <input name="fecha_notificacion" type="date" value={formulario.fecha_notificacion} onChange={actualizarCampo} disabled={!puedeRegistrar} required />
          </label>

          <label>
            <span>Codigo rechazo <strong>*</strong></span>
            <input name="codigo_rechazo" value={formulario.codigo_rechazo} onChange={actualizarCampo} disabled={!puedeRegistrar} required />
          </label>

          <label>
            <span>Observaciones</span>
            <textarea name="observaciones" rows="3" value={formulario.observaciones} onChange={actualizarCampo} disabled={!puedeRegistrar} />
          </label>

          <label>
            <span>Adjunto notificacion EPS <strong>*</strong></span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={seleccionarArchivo} disabled={!puedeRegistrar} required={!rechazo} />
            {archivo && <small>{archivo.name}</small>}
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={guardando || !puedeRegistrar}>
              {guardando ? 'Guardando...' : 'Registrar rechazo'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
