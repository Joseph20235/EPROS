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

export default function JuridicoIncapacidad({ incapacidadId }) {
  const [data, setData] = useState(null);
  const [formulario, setFormulario] = useState({
    apoderado_legal: '',
    fecha_inicio: '',
    valor_en_disputa: '',
    numero_radicado_judicial: '',
    estado_proceso: 'Inicio de cobro juridico'
  });
  const [novedad, setNovedad] = useState({ fecha: '', descripcion: '' });
  const [resultado, setResultado] = useState({ resultado_final: 'exito', motivo_cierre: '' });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const novedades = useMemo(() => data?.juridico?.novedades ?? [], [data]);

  function cargar() {
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/incapacidades/${incapacidadId}/juridico`)
      .then(async (respuesta) => {
        const body = await respuesta.json();
        if (!respuesta.ok) throw new Error(body.error ?? 'No fue posible cargar el cobro juridico.');
        return body;
      })
      .then((body) => {
        setData(body);
        const valorSugerido = body.juridico?.valor_en_disputa ?? body.cobro?.valor_ajustado ?? body.cobro?.valor_calculado ?? '';
        setFormulario({
          apoderado_legal: body.juridico?.apoderado_legal ?? '',
          fecha_inicio: body.juridico?.fecha_inicio ?? '',
          valor_en_disputa: valorSugerido,
          numero_radicado_judicial: body.juridico?.numero_radicado_judicial ?? '',
          estado_proceso: body.juridico?.estado_proceso ?? 'Inicio de cobro juridico'
        });
        setResultado({
          resultado_final: body.juridico?.resultado_final ?? 'exito',
          motivo_cierre: body.juridico?.motivo_cierre ?? ''
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, [incapacidadId]);

  function actualizarFormulario(event) {
    const { name, value } = event.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setMensaje('');
    setError('');
  }

  function actualizarNovedad(event) {
    const { name, value } = event.target;
    setNovedad((actual) => ({ ...actual, [name]: value }));
    setMensaje('');
    setError('');
  }

  function actualizarResultado(event) {
    const { name, value } = event.target;
    setResultado((actual) => ({ ...actual, [name]: value }));
    setMensaje('');
    setError('');
  }

  async function registrarJuridico(event) {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/juridico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formulario, usuario_id: 1 })
      });
      const body = await respuesta.json();
      if (!respuesta.ok) throw new Error(body.error ?? 'No fue posible registrar el cobro juridico.');

      setData((actual) => ({ ...actual, incapacidad: body.incapacidad, juridico: body.juridico, disponible: true }));
      setMensaje('Cobro juridico registrado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function registrarNovedad(event) {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/juridico/novedades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...novedad, usuario_id: 1 })
      });
      const body = await respuesta.json();
      if (!respuesta.ok) throw new Error(body.error ?? 'No fue posible registrar la novedad.');

      setData((actual) => ({ ...actual, juridico: body.juridico }));
      setNovedad({ fecha: '', descripcion: '' });
      setMensaje('Novedad juridica registrada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function registrarResultado(event) {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/juridico/resultado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resultado, usuario_id: 1 })
      });
      const body = await respuesta.json();
      if (!respuesta.ok) throw new Error(body.error ?? 'No fue posible registrar el resultado.');

      if (body.redirect_to) {
        navegar(body.redirect_to);
        return;
      }

      setData((actual) => ({ ...actual, incapacidad: body.incapacidad, juridico: body.juridico }));
      setMensaje('Resultado juridico registrado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <section className="page wide-page"><p className="empty-state">Cargando cobro juridico...</p></section>;
  if (error && !data) return <section className="page wide-page"><p className="feedback error">{error}</p></section>;

  const { incapacidad, cobro, disponible, cobro_vencido: cobroVencido, juridico } = data;
  const enJuridico = incapacidad.estado_actual === 'Cobro_Juridico';

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Gestión humana</p>
          <h1>Cobro juridico</h1>
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
            <div><dt>Valor cobro</dt><dd>{formatearMoneda(cobro?.valor_ajustado ?? cobro?.valor_calculado ?? 0)}</dd></div>
          </dl>
          {cobro && (
            <p className={`feedback ${cobroVencido ? 'error' : 'success'}`}>
              {cobroVencido ? 'Cobro vencido por mas de 180 dias.' : 'Cobro aun dentro de plazo ordinario.'}
            </p>
          )}

          <h2>Novedades</h2>
          {novedades.length ? (
            <div className="compact-records">
              {novedades.map((item, index) => (
                <div key={`${item.fecha}-${index}`} className="record-item">
                  <strong>{item.fecha}</strong>
                  <p>{item.descripcion}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No hay novedades juridicas.</p>
          )}
        </section>

        <div className="validation-main">
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}
          {!disponible && <p className="feedback error">CU-13 solo esta disponible por cobro vencido, rechazo o conciliacion fallida.</p>}

          <form className="panel form-grid" onSubmit={registrarJuridico}>
            <h2>Datos del proceso</h2>
            <label>
              <span>Apoderado legal <strong>*</strong></span>
              <input name="apoderado_legal" value={formulario.apoderado_legal} onChange={actualizarFormulario} disabled={!disponible} required />
            </label>
            <label>
              <span>Fecha inicio <strong>*</strong></span>
              <input name="fecha_inicio" type="date" value={formulario.fecha_inicio} onChange={actualizarFormulario} disabled={!disponible} required />
            </label>
            <label>
              <span>Valor en disputa <strong>*</strong></span>
              <input name="valor_en_disputa" type="number" min="0" step="0.01" value={formulario.valor_en_disputa} onChange={actualizarFormulario} disabled={!disponible} required />
            </label>
            <label>
              <span>Radicado judicial</span>
              <input name="numero_radicado_judicial" value={formulario.numero_radicado_judicial} onChange={actualizarFormulario} disabled={!disponible} />
            </label>
            <label>
              <span>Estado proceso <strong>*</strong></span>
              <input name="estado_proceso" value={formulario.estado_proceso} onChange={actualizarFormulario} disabled={!disponible} required />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={guardando || !disponible}>
                {juridico ? 'Actualizar proceso' : 'Registrar cobro juridico'}
              </button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={registrarNovedad}>
            <h2>Agregar novedad</h2>
            <label>
              <span>Fecha <strong>*</strong></span>
              <input name="fecha" type="date" value={novedad.fecha} onChange={actualizarNovedad} disabled={!enJuridico || !juridico} required />
            </label>
            <label>
              <span>Descripcion <strong>*</strong></span>
              <textarea name="descripcion" rows="3" value={novedad.descripcion} onChange={actualizarNovedad} disabled={!enJuridico || !juridico} required />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={guardando || !enJuridico || !juridico}>
                Agregar novedad
              </button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={registrarResultado}>
            <h2>Resultado final</h2>
            <label>
              <span>Resultado <strong>*</strong></span>
              <select name="resultado_final" value={resultado.resultado_final} onChange={actualizarResultado} disabled={!enJuridico || !juridico} required>
                <option value="exito">Exito / pago ordenado</option>
                <option value="desistimiento">Desistimiento</option>
                <option value="acuerdo">Acuerdo</option>
                <option value="perdida">Perdida</option>
              </select>
            </label>
            <label>
              <span>Motivo de cierre</span>
              <textarea name="motivo_cierre" rows="3" value={resultado.motivo_cierre} onChange={actualizarResultado} disabled={!enJuridico || !juridico} />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={guardando || !enJuridico || !juridico}>
                Registrar resultado
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
