import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const canales = ['presencial', 'virtual', 'correo'];

const formularioInicial = {
  numero_radicado: '',
  fecha_radicacion: '',
  canal: 'virtual',
  funcionario_eps_receptor: ''
};

function sumarDias(fecha, dias) {
  if (!fecha || !dias) return '';
  const base = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + Number(dias));
  return base.toISOString().slice(0, 10);
}

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export default function RadicarIncapacidad({ incapacidadId }) {
  const [incapacidad, setIncapacidad] = useState(null);
  const [plazoRespuestaDias, setPlazoRespuestaDias] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [archivo, setArchivo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const fechaLimiteRespuesta = useMemo(
    () => sumarDias(formulario.fecha_radicacion, plazoRespuestaDias),
    [formulario.fecha_radicacion, plazoRespuestaDias]
  );

  useEffect(() => {
    fetch(`${API_BASE}/incapacidades/${incapacidadId}/radicacion`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar la radicacion.');
        return data;
      })
      .then((data) => {
        setIncapacidad(data.incapacidad);
        setPlazoRespuestaDias(data.plazo_respuesta_dias);
        setFormulario(data.radicacion ? {
          numero_radicado: data.radicacion.numero_radicado ?? '',
          fecha_radicacion: data.radicacion.fecha_radicacion ?? '',
          canal: data.radicacion.canal ?? 'virtual',
          funcionario_eps_receptor: data.radicacion.funcionario_eps_receptor ?? ''
        } : formularioInicial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [incapacidadId]);

  function actualizarCampo(event) {
    const { name, value } = event.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setMensaje('');
    setError('');
  }

  function seleccionarArchivo(event) {
    const file = event.target.files?.[0] ?? null;
    setMensaje('');
    setError('');

    if (!file) {
      setArchivo(null);
      return;
    }

    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!tiposPermitidos.includes(file.type)) {
      setArchivo(null);
      setError('El comprobante debe ser PDF, JPG o PNG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setArchivo(null);
      setError('El comprobante no puede superar 5MB.');
      return;
    }

    setArchivo(file);
  }

  function validarFormulario() {
    const errores = [];

    if (!formulario.numero_radicado.trim()) errores.push('El numero radicado es obligatorio.');
    if (!formulario.fecha_radicacion) errores.push('La fecha de radicacion es obligatoria.');
    if (!canales.includes(formulario.canal)) errores.push('El canal no es valido.');
    if (!archivo) errores.push('Adjunta el comprobante de radicacion.');

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
      const comprobanteAdjuntoData = await leerArchivoComoDataUrl(archivo);
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/radicacion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formulario,
          comprobante_adjunto_data: comprobanteAdjuntoData,
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) {
        setError(data.error ?? 'No fue posible radicar la incapacidad.');
        return;
      }

      setIncapacidad(data.incapacidad);
      setMensaje(`Radicacion confirmada. Fecha limite de respuesta: ${data.radicacion.fecha_limite_respuesta}.`);
      setArchivo(null);
      event.target.reset();
      setFormulario({
        numero_radicado: data.radicacion.numero_radicado,
        fecha_radicacion: data.radicacion.fecha_radicacion,
        canal: data.radicacion.canal,
        funcionario_eps_receptor: data.radicacion.funcionario_eps_receptor ?? ''
      });
    } catch (err) {
      setError(err.message ?? 'No fue posible radicar la incapacidad.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section className="page wide-page">
        <div className="panel">Cargando radicacion...</div>
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

  const puedeRadicar = incapacidad.estado_actual === 'Transcrita';

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Gestión humana</p>
          <h1>Radicar incapacidad</h1>
        </div>
        <span className="status">{incapacidad.estado_actual}</span>
      </header>

      <div className="workflow-layout">
        <section className="panel detail-panel">
          <h2>Resumen para radicacion</h2>
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
              <dt>Plazo respuesta</dt>
              <dd>{plazoRespuestaDias} dias</dd>
            </div>
            <div>
              <dt>Fecha inicio</dt>
              <dd>{incapacidad.fecha_inicio}</dd>
            </div>
            <div>
              <dt>Fecha fin</dt>
              <dd>{incapacidad.fecha_fin}</dd>
            </div>
          </dl>
        </section>

        <form className="panel form-grid" onSubmit={guardar}>
          <h2>Datos de radicacion</h2>
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}
          {!puedeRadicar && (
            <p className="feedback error">
              CU-04 solo esta disponible cuando la incapacidad esta Transcrita.
            </p>
          )}

          <label>
            <span>Numero radicado <strong>*</strong></span>
            <input
              name="numero_radicado"
              value={formulario.numero_radicado}
              onChange={actualizarCampo}
              disabled={!puedeRadicar}
              required
            />
          </label>

          <label>
            <span>Fecha radicacion <strong>*</strong></span>
            <input
              name="fecha_radicacion"
              type="date"
              value={formulario.fecha_radicacion}
              onChange={actualizarCampo}
              disabled={!puedeRadicar}
              required
            />
          </label>

          <label>
            <span>Canal <strong>*</strong></span>
            <select name="canal" value={formulario.canal} onChange={actualizarCampo} disabled={!puedeRadicar}>
              {canales.map((canal) => (
                <option key={canal} value={canal}>{canal}</option>
              ))}
            </select>
          </label>

          <label>
            Funcionario EPS receptor
            <input
              name="funcionario_eps_receptor"
              value={formulario.funcionario_eps_receptor}
              onChange={actualizarCampo}
              disabled={!puedeRadicar}
            />
          </label>

          <label>
            <span>Comprobante adjunto <strong>*</strong></span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={seleccionarArchivo}
              disabled={!puedeRadicar}
              required
            />
            {archivo && <small>{archivo.name} - {(archivo.size / 1024 / 1024).toFixed(2)} MB</small>}
          </label>

          <div className="calculated-box">
            <span>Fecha limite respuesta</span>
            <strong>{fechaLimiteRespuesta || 'Selecciona fecha de radicacion'}</strong>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={guardando || !puedeRadicar}>
              {guardando ? 'Radicando' : 'Confirmar radicacion'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
