import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const tiposIncapacidad = [
  'EPS',
  'ARL',
  'LICENCIA_MATERNIDAD',
  'LICENCIA_PATERNIDAD',
  'ACCIDENTE_TRANSITO',
  'ACCIDENTE_LABORAL',
  'ENFERMEDAD_GENERAL'
];
const formularioInicial = {
  numero_incapacidad: '',
  fecha_inicio: '',
  fecha_fin: '',
  diagnostico_cie10: '',
  entidad_emisora: '',
  tipo: '',
  eps_arl_id: '',
  observaciones: ''
};

function calcularDias(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return '';
  const inicio = new Date(`${fechaInicio}T00:00:00`);
  const fin = new Date(`${fechaFin}T00:00:00`);
  const dias = Math.floor((fin - inicio) / 86400000) + 1;
  return Number.isFinite(dias) && dias > 0 ? String(dias) : '';
}

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export default function Registro() {
  const [formulario, setFormulario] = useState(formularioInicial);
  const [busquedaColaborador, setBusquedaColaborador] = useState('');
  const [colaboradores, setColaboradores] = useState([]);
  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null);
  const [epsArl, setEpsArl] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [incapacidadCreada, setIncapacidadCreada] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const numeroDias = useMemo(
    () => calcularDias(formulario.fecha_inicio, formulario.fecha_fin),
    [formulario.fecha_inicio, formulario.fecha_fin]
  );

  useEffect(() => {
    fetch(`${API_BASE}/eps-arl`)
      .then((respuesta) => respuesta.json())
      .then(setEpsArl)
      .catch(() => setError('No fue posible cargar EPS/ARL.'));
  }, []);

  useEffect(() => {
    const busqueda = busquedaColaborador.trim();

    if (busqueda.length < 2) {
      setColaboradores([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ busqueda, activo: 'true', limite: '6' });
      fetch(`${API_BASE}/colaboradores?${params.toString()}`)
        .then((respuesta) => respuesta.json())
        .then((data) => setColaboradores(data.data ?? []))
        .catch(() => setError('No fue posible buscar colaboradores.'));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [busquedaColaborador]);

  function actualizarCampo(event) {
    const { name, value } = event.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
  }

  function seleccionarColaborador(colaborador) {
    setColaboradorSeleccionado(colaborador);
    setBusquedaColaborador(`${colaborador.numero_identificacion} - ${colaborador.nombre_completo}`);
    setFormulario((actual) => ({ ...actual, eps_arl_id: String(colaborador.eps_arl_id) }));
    setColaboradores([]);
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
      setError('El adjunto debe ser PDF, JPG o PNG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setArchivo(null);
      setError('El adjunto no puede superar 5MB.');
      return;
    }

    setArchivo(file);
  }

  function validarFormulario() {
    const errores = [];

    if (!colaboradorSeleccionado) errores.push('Selecciona un colaborador de la lista.');
    if (!formulario.numero_incapacidad.trim()) errores.push('El numero de incapacidad es obligatorio.');
    if (!formulario.fecha_inicio) errores.push('La fecha de inicio es obligatoria.');
    if (!formulario.fecha_fin) errores.push('La fecha de fin es obligatoria.');
    if (!numeroDias) errores.push('La fecha fin debe ser mayor o igual a la fecha de inicio.');
    if (!/^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/.test(formulario.diagnostico_cie10.trim().toUpperCase())) {
      errores.push('El CIE-10 debe tener formato valido, por ejemplo A09 o J11.1.');
    }
    if (!formulario.entidad_emisora.trim()) errores.push('La entidad emisora es obligatoria.');
    if (!formulario.tipo) errores.push('El tipo es obligatorio.');
    if (!archivo) errores.push('Adjunta un soporte PDF, JPG o PNG.');

    return errores;
  }

  async function guardar(event) {
    event.preventDefault();
    setMensaje('');
    setError('');
    setIncapacidadCreada(null);

    const errores = validarFormulario();
    if (errores.length) {
      setError(errores.join(' '));
      return;
    }

    setCargando(true);

    try {
      const documentoAdjuntoData = await leerArchivoComoDataUrl(archivo);
      const respuesta = await fetch(`${API_BASE}/incapacidades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formulario,
          colaborador_id: colaboradorSeleccionado.id,
          numero_dias: Number(numeroDias),
          diagnostico_cie10: formulario.diagnostico_cie10.trim().toUpperCase(),
          documento_adjunto_data: documentoAdjuntoData,
          created_by: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) {
        setError(data.error ?? 'No fue posible registrar la incapacidad.');
        return;
      }

      setMensaje(`Incapacidad registrada con ID ${data.id}.`);
      setIncapacidadCreada(data);
      setFormulario(formularioInicial);
      setBusquedaColaborador('');
      setColaboradorSeleccionado(null);
      setArchivo(null);
      event.target.reset();
    } catch (err) {
      setError(err.message ?? 'No fue posible registrar la incapacidad.');
    } finally {
      setCargando(false);
    }
  }

  function irAValidar() {
    if (!incapacidadCreada) return;
    window.history.pushState({}, '', `/incapacidades/${incapacidadCreada.id}/validar`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>CU-01</p>
          <h1>Registrar incapacidad</h1>
        </div>
      </header>

      <form className="panel form-grid two-columns registro-form" onSubmit={guardar}>
        {mensaje && (
          <div className="feedback success full-width success-row">
            <span>{mensaje}</span>
            <button type="button" className="secondary-button" onClick={irAValidar}>
              Ir a validar
            </button>
          </div>
        )}
        {error && <p className="feedback error full-width">{error}</p>}

        <label className="full-width autocomplete-field">
          <span>Colaborador <strong>*</strong></span>
          <input
            value={busquedaColaborador}
            onChange={(event) => {
              setBusquedaColaborador(event.target.value);
              setColaboradorSeleccionado(null);
            }}
            placeholder="Buscar por identificacion o nombre"
            autoComplete="off"
            required
          />
          {colaboradores.length > 0 && (
            <div className="autocomplete-list">
              {colaboradores.map((colaborador) => (
                <button key={colaborador.id} type="button" onClick={() => seleccionarColaborador(colaborador)}>
                  <strong>{colaborador.nombre_completo}</strong>
                  <span>{colaborador.numero_identificacion} - {colaborador.area} - {colaborador.eps_arl_nombre}</span>
                </button>
              ))}
            </div>
          )}
        </label>

        <label>
          <span>EPS/ARL del colaborador <strong>*</strong></span>
          <select name="eps_arl_id" value={formulario.eps_arl_id} onChange={actualizarCampo} disabled required>
            <option value="">Seleccionar colaborador</option>
            {epsArl.map((entidad) => (
              <option key={entidad.id} value={entidad.id}>{entidad.nombre} ({entidad.tipo})</option>
            ))}
          </select>
        </label>

        <label>
          <span>Numero incapacidad <strong>*</strong></span>
          <input name="numero_incapacidad" value={formulario.numero_incapacidad} onChange={actualizarCampo} required />
        </label>

        <label>
          <span>Fecha inicio <strong>*</strong></span>
          <input name="fecha_inicio" type="date" value={formulario.fecha_inicio} onChange={actualizarCampo} required />
        </label>

        <label>
          <span>Fecha fin <strong>*</strong></span>
          <input name="fecha_fin" type="date" value={formulario.fecha_fin} onChange={actualizarCampo} required />
        </label>

        <label>
          Numero dias
          <input value={numeroDias} readOnly placeholder="Calculado automaticamente" />
        </label>

        <label>
          <span>Diagnostico CIE-10 <strong>*</strong></span>
          <input
            name="diagnostico_cie10"
            value={formulario.diagnostico_cie10}
            onChange={actualizarCampo}
            placeholder="A09, J11.1"
            required
          />
        </label>

        <label>
          <span>Entidad emisora <strong>*</strong></span>
          <input name="entidad_emisora" value={formulario.entidad_emisora} onChange={actualizarCampo} placeholder="IPS o medico emisor" required />
        </label>

        <label>
          <span>Tipo <strong>*</strong></span>
          <select name="tipo" value={formulario.tipo} onChange={actualizarCampo} required>
            <option value="">Seleccionar</option>
            {tiposIncapacidad.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Adjunto <strong>*</strong></span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={seleccionarArchivo} required />
          {archivo && <small>{archivo.name} - {(archivo.size / 1024 / 1024).toFixed(2)} MB</small>}
        </label>

        <label className="full-width">
          Observaciones
          <textarea name="observaciones" rows="4" value={formulario.observaciones} onChange={actualizarCampo} />
        </label>

        <div className="form-actions full-width">
          <button type="submit" className="primary-button" disabled={cargando}>
            {cargando ? 'Guardando' : 'Guardar registro'}
          </button>
        </div>
      </form>
    </section>
  );
}
