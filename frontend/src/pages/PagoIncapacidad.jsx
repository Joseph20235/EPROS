import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const formularioInicial = {
  valor_pagado: '',
  fecha_pago: '',
  numero_referencia: '',
  entidad_pagadora: ''
};

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

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export default function PagoIncapacidad({ incapacidadId }) {
  const [incapacidad, setIncapacidad] = useState(null);
  const [cobro, setCobro] = useState(null);
  const [valorCobrado, setValorCobrado] = useState(0);
  const [pagos, setPagos] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [archivo, setArchivo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const diferencia = useMemo(() => {
    const valorPagado = Number(formulario.valor_pagado);
    if (!Number.isFinite(valorPagado)) return 0;
    return Math.round((Number(valorCobrado) - valorPagado + Number.EPSILON) * 100) / 100;
  }, [formulario.valor_pagado, valorCobrado]);
  const pagoCuadra = Math.abs(diferencia) <= 1;

  useEffect(() => {
    fetch(`${API_BASE}/incapacidades/${incapacidadId}/pago`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el pago.');
        return data;
      })
      .then((data) => {
        setIncapacidad(data.incapacidad);
        setCobro(data.cobro);
        setValorCobrado(data.valor_cobrado ?? 0);
        setPagos(data.pagos ?? []);
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
    const valorPagado = Number(formulario.valor_pagado);

    if (!Number.isFinite(valorPagado) || valorPagado < 0) errores.push('El valor pagado debe ser mayor o igual a cero.');
    if (!formulario.fecha_pago) errores.push('La fecha de pago es obligatoria.');
    if (!formulario.numero_referencia.trim()) errores.push('El numero de referencia es obligatorio.');
    if (!formulario.entidad_pagadora.trim()) errores.push('La entidad pagadora es obligatoria.');
    if (!archivo) errores.push('Adjunta el comprobante de pago.');

    return errores;
  }

  async function registrarPago(event) {
    event.preventDefault();
    setError('');
    setMensaje('');

    const errores = validarFormulario();
    if (errores.length) {
      setError(errores.join(' '));
      return;
    }

    setGuardando(true);

    try {
      const comprobanteAdjuntoData = await leerArchivoComoDataUrl(archivo);
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formulario,
          comprobante_adjunto_data: comprobanteAdjuntoData,
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible registrar el pago.');

      setIncapacidad(data.incapacidad);
      setCobro(data.cobro);
      setPagos((actual) => [data.pago, ...actual]);
      setMensaje(
        data.estado_nuevo === 'Pagada'
          ? 'Pago registrado por el valor cobrado. Expediente financiero cerrado.'
          : `Pago registrado con diferencia de ${formatearMoneda(data.diferencia)}. El caso paso a conciliacion.`
      );
      setFormulario(formularioInicial);
      setArchivo(null);
      event.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section className="page wide-page">
        <p className="empty-state">Cargando registro de pago...</p>
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

  const puedePagar = incapacidad.estado_actual === 'En_Cobro' && cobro;

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>CU-08</p>
          <h1>Registrar pago</h1>
        </div>
        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${incapacidadId}`)}>
          Volver al expediente
        </button>
      </header>

      <div className="workflow-layout">
        <section className="panel detail-panel">
          <h2>Resumen del cobro</h2>
          <dl className="detail-grid">
            <div>
              <dt>Incapacidad</dt>
              <dd>{incapacidad.numero_incapacidad}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd><span className={`status status-${incapacidad.estado_actual}`}>{incapacidad.estado_actual}</span></dd>
            </div>
            <div>
              <dt>Colaborador</dt>
              <dd>{incapacidad.colaborador_nombre}</dd>
            </div>
            <div>
              <dt>Entidad</dt>
              <dd>{incapacidad.eps_arl_nombre}</dd>
            </div>
            <div>
              <dt>Valor cobrado</dt>
              <dd>{formatearMoneda(valorCobrado)}</dd>
            </div>
            <div>
              <dt>Fecha cobro</dt>
              <dd>{cobro?.fecha_cobro ?? 'Sin cobro'}</dd>
            </div>
          </dl>

          <div className="calculated-box">
            <span>Diferencia proyectada</span>
            <strong>{formulario.valor_pagado ? formatearMoneda(diferencia) : 'Ingresa el pago'}</strong>
          </div>

          {formulario.valor_pagado && (
            <p className={`feedback ${pagoCuadra ? 'success' : 'error'}`}>
              {pagoCuadra
                ? 'La diferencia esta dentro de la tolerancia de $1. Se cerrara como Pagada.'
                : 'El pago no coincide con el cobro. Se abrira conciliacion.'}
            </p>
          )}

          {pagos.length > 0 && (
            <>
              <h2>Pagos registrados</h2>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Referencia</th>
                    <th>Valor</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((pago) => (
                    <tr key={pago.id}>
                      <td>{pago.fecha_pago}</td>
                      <td>{pago.numero_referencia}</td>
                      <td>{formatearMoneda(pago.valor_pagado)}</td>
                      <td>{formatearMoneda(pago.diferencia_detectada)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <form className="panel form-grid" onSubmit={registrarPago}>
          <h2>Datos del pago</h2>
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}
          {!puedePagar && (
            <p className="feedback error">CU-08 solo esta disponible cuando la incapacidad esta En_Cobro y tiene cobro registrado.</p>
          )}

          <label>
            <span>Valor pagado <strong>*</strong></span>
            <input
              name="valor_pagado"
              type="number"
              min="0"
              step="0.01"
              value={formulario.valor_pagado}
              onChange={actualizarCampo}
              disabled={!puedePagar}
              required
            />
          </label>

          <label>
            <span>Fecha pago <strong>*</strong></span>
            <input
              name="fecha_pago"
              type="date"
              value={formulario.fecha_pago}
              onChange={actualizarCampo}
              disabled={!puedePagar}
              required
            />
          </label>

          <label>
            <span>Numero referencia <strong>*</strong></span>
            <input
              name="numero_referencia"
              value={formulario.numero_referencia}
              onChange={actualizarCampo}
              disabled={!puedePagar}
              required
            />
          </label>

          <label>
            <span>Entidad pagadora <strong>*</strong></span>
            <input
              name="entidad_pagadora"
              value={formulario.entidad_pagadora}
              onChange={actualizarCampo}
              disabled={!puedePagar}
              required
            />
          </label>

          <label>
            <span>Comprobante adjunto <strong>*</strong></span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={seleccionarArchivo}
              disabled={!puedePagar}
              required
            />
            {archivo && <small>{archivo.name} - {(archivo.size / 1024 / 1024).toFixed(2)} MB</small>}
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={guardando || !puedePagar}>
              {guardando ? 'Registrando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
