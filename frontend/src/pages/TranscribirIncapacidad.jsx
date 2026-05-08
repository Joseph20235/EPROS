import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

function formatearTipo(tipo) {
  return String(tipo ?? '').replaceAll('_', ' ');
}

const formularioVacio = {
  codigo_cie10_detallado: '',
  tipo_licencia_medica: '',
  medico_tratante: '',
  numero_registro_medico: '',
  ips_institucion: ''
};

export default function TranscribirIncapacidad({ incapacidadId }) {
  const [incapacidad, setIncapacidad] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const draftKey = useMemo(() => `epros:transcripcion:${incapacidadId}`, [incapacidadId]);

  useEffect(() => {
    fetch(`${API_BASE}/incapacidades/${incapacidadId}/transcripcion`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar la transcripcion.');
        return data;
      })
      .then((data) => {
        const draft = localStorage.getItem(draftKey);
        let draftParseado = null;
        if (draft) {
          try {
            draftParseado = JSON.parse(draft);
          } catch {
            localStorage.removeItem(draftKey);
          }
        }
        setIncapacidad(data.incapacidad);
        setFormulario(draftParseado ? { ...data.transcripcion, ...draftParseado } : data.transcripcion);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [draftKey, incapacidadId]);

  useEffect(() => {
    if (!incapacidad) return undefined;

    const intervalId = window.setInterval(() => {
      localStorage.setItem(draftKey, JSON.stringify(formulario));
      setMensaje('Borrador guardado automaticamente.');
    }, 120000);

    return () => window.clearInterval(intervalId);
  }, [draftKey, formulario, incapacidad]);

  function actualizarCampo(event) {
    const { name, value } = event.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setMensaje('');
    setError('');
  }

  function validarFormulario() {
    const errores = [];
    const cie10 = formulario.codigo_cie10_detallado.trim().toUpperCase();

    if (!/^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/.test(cie10)) {
      errores.push('El CIE-10 detallado debe tener formato valido.');
    }
    if (!formulario.tipo_licencia_medica.trim()) errores.push('El tipo de licencia medica es obligatorio.');
    if (!formulario.medico_tratante.trim()) errores.push('El medico tratante es obligatorio.');
    if (!formulario.numero_registro_medico.trim()) errores.push('El registro medico es obligatorio.');
    if (!formulario.ips_institucion.trim()) errores.push('La IPS o institucion es obligatoria.');

    return errores;
  }

  async function guardar(event) {
    event.preventDefault();
    setMensaje('');
    setError('');

    const errores = validarFormulario();
    if (errores.length) {
      setError(errores.join(' '));
      return;
    }

    setGuardando(true);

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/transcripcion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formulario,
          codigo_cie10_detallado: formulario.codigo_cie10_detallado.trim().toUpperCase(),
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) {
        setError(data.error ?? 'No fue posible guardar la transcripcion.');
        return;
      }

      localStorage.removeItem(draftKey);
      setIncapacidad(data.incapacidad);
      setFormulario(data.transcripcion);
      setMensaje('Transcripcion guardada. La incapacidad paso a Transcrita.');
    } catch (err) {
      setError(err.message ?? 'No fue posible guardar la transcripcion.');
    } finally {
      setGuardando(false);
    }
  }

  function irARadicar() {
    window.history.pushState({}, '', `/incapacidades/${incapacidadId}/radicar`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  if (cargando) {
    return (
      <section className="page wide-page">
        <div className="panel">Cargando transcripcion...</div>
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

  const puedeTranscribir = incapacidad.estado_actual === 'En_Validacion';

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>CU-03</p>
          <h1>Transcribir incapacidad</h1>
        </div>
        <span className="status">{incapacidad.estado_actual}</span>
      </header>

      <div className="workflow-layout">
        <section className="panel detail-panel">
          <h2>Datos registrados</h2>
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
              <dt>EPS/ARL</dt>
              <dd>{incapacidad.eps_arl_nombre}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{formatearTipo(incapacidad.tipo)}</dd>
            </div>
            <div>
              <dt>Fechas</dt>
              <dd>{incapacidad.fecha_inicio} a {incapacidad.fecha_fin}</dd>
            </div>
            <div>
              <dt>Dias</dt>
              <dd>{incapacidad.numero_dias}</dd>
            </div>
            <div>
              <dt>CIE-10 inicial</dt>
              <dd>{incapacidad.diagnostico_cie10}</dd>
            </div>
            <div>
              <dt>Entidad emisora</dt>
              <dd>{incapacidad.entidad_emisora}</dd>
            </div>
          </dl>
        </section>

        <form className="panel form-grid" onSubmit={guardar}>
          <h2>Datos de transcripcion</h2>
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}
          {!puedeTranscribir && (
            <p className="feedback error">
              CU-03 solo esta disponible cuando la incapacidad esta en En_Validacion.
            </p>
          )}

          <label>
            <span>Codigo CIE-10 detallado <strong>*</strong></span>
            <input
              name="codigo_cie10_detallado"
              value={formulario.codigo_cie10_detallado ?? ''}
              onChange={actualizarCampo}
              disabled={!puedeTranscribir}
              required
            />
          </label>

          <label>
            <span>Tipo de licencia medica <strong>*</strong></span>
            <input
              name="tipo_licencia_medica"
              value={formulario.tipo_licencia_medica ?? ''}
              onChange={actualizarCampo}
              disabled={!puedeTranscribir}
              required
            />
          </label>

          <label>
            <span>Medico tratante <strong>*</strong></span>
            <input
              name="medico_tratante"
              value={formulario.medico_tratante ?? ''}
              onChange={actualizarCampo}
              disabled={!puedeTranscribir}
              required
            />
          </label>

          <label>
            <span>Numero registro medico <strong>*</strong></span>
            <input
              name="numero_registro_medico"
              value={formulario.numero_registro_medico ?? ''}
              onChange={actualizarCampo}
              disabled={!puedeTranscribir}
              required
            />
          </label>

          <label>
            <span>IPS / institucion <strong>*</strong></span>
            <input
              name="ips_institucion"
              value={formulario.ips_institucion ?? ''}
              onChange={actualizarCampo}
              disabled={!puedeTranscribir}
              required
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={guardando || !puedeTranscribir}>
              {guardando ? 'Guardando' : 'Guardar transcripcion'}
            </button>
            {incapacidad.estado_actual === 'Transcrita' && (
              <button type="button" className="secondary-button" onClick={irARadicar}>
                Ir a radicar
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
