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

export default function CobroIncapacidad({ incapacidadId }) {
  const [incapacidad, setIncapacidad] = useState(null);
  const [calculo, setCalculo] = useState(null);
  const [cobro, setCobro] = useState(null);
  const [valorAjustado, setValorAjustado] = useState('');
  const [justificacionAjuste, setJustificacionAjuste] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const valorManual = Number(valorAjustado);
  const hayAjusteManual = useMemo(() => {
    if (!calculo || valorAjustado === '') return false;
    return Number.isFinite(valorManual) && Math.abs(valorManual - calculo.valor_calculado) > 1;
  }, [calculo, valorAjustado, valorManual]);

  useEffect(() => {
    fetch(`${API_BASE}/incapacidades/${incapacidadId}/cobro`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el cobro.');
        return data;
      })
      .then((data) => {
        setIncapacidad(data.incapacidad);
        setCalculo(data.calculo);
        setCobro(data.cobro);
        setValorAjustado(data.cobro?.valor_ajustado ?? '');
        setJustificacionAjuste(data.cobro?.justificacion_ajuste ?? '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [incapacidadId]);

  async function registrarCobro(event) {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (hayAjusteManual && !justificacionAjuste.trim()) {
      setError('La justificacion es obligatoria cuando ajustas manualmente el valor.');
      return;
    }

    setGuardando(true);

    try {
      const respuesta = await fetch(`${API_BASE}/incapacidades/${incapacidadId}/cobro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor_ajustado: valorAjustado === '' ? null : valorManual,
          justificacion_ajuste: justificacionAjuste,
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible registrar el cobro.');

      setIncapacidad(data.incapacidad);
      setCobro(data.cobro);
      setMensaje('Cobro registrado. La incapacidad quedo En_Cobro.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section className="page wide-page">
        <p className="empty-state">Cargando calculo de cobro...</p>
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

  const puedeCobrar = incapacidad.estado_actual === 'Aprobada';

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Gestión humana</p>
          <h1>Gestionar cobro</h1>
        </div>
        <button type="button" className="secondary-button" onClick={() => navegar(`/incapacidades/${incapacidadId}`)}>
          Volver al expediente
        </button>
      </header>

      <div className="workflow-layout">
        <section className="panel detail-panel">
          <h2>Calculo automatico</h2>
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
              <dt>EPS/ARL</dt>
              <dd>{incapacidad.eps_arl_nombre}</dd>
            </div>
            <div>
              <dt>Dias</dt>
              <dd>{incapacidad.numero_dias}</dd>
            </div>
            <div>
              <dt>IBC diario</dt>
              <dd>{formatearMoneda(calculo.ibc_dia)}</dd>
            </div>
          </dl>

          {calculo.alertas.map((alerta) => (
            <p key={alerta} className="feedback error">{alerta}</p>
          ))}

          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Tramo</th>
                <th>Dias</th>
                <th>Porcentaje</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {calculo.desglose.map((item) => (
                <tr key={item.tramo}>
                  <td>{item.tramo}{item.excluido_cobro_eps ? ' (no cobra EPS)' : ''}</td>
                  <td>{item.dias}</td>
                  <td>{Math.round(item.porcentaje * 100)}%</td>
                  <td>{formatearMoneda(item.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="calculated-box">
            <span>Valor a cobrar</span>
            <strong>{formatearMoneda(calculo.valor_calculado)}</strong>
          </div>
        </section>

        <form className="panel form-grid" onSubmit={registrarCobro}>
          <h2>Registro del cobro</h2>
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}
          {!puedeCobrar && (
            <p className="feedback error">CU-07 solo esta disponible cuando la incapacidad esta Aprobada.</p>
          )}
          {cobro && (
            <p className="feedback success">
              Ya existe un cobro por {formatearMoneda(cobro.valor_ajustado ?? cobro.valor_calculado)}.
            </p>
          )}

          <label>
            Valor ajustado
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorAjustado}
              onChange={(event) => setValorAjustado(event.target.value)}
              disabled={!puedeCobrar}
              placeholder={String(calculo.valor_calculado)}
            />
            <small>Dejalo vacio para usar el calculo automatico.</small>
          </label>

          <label>
            <span>Justificacion del ajuste {hayAjusteManual && <strong>*</strong>}</span>
            <textarea
              rows="4"
              value={justificacionAjuste}
              onChange={(event) => setJustificacionAjuste(event.target.value)}
              disabled={!puedeCobrar}
              required={hayAjusteManual}
              placeholder="Explica el motivo del ajuste manual"
            />
          </label>

          <div className="calculated-box">
            <span>Valor final</span>
            <strong>{formatearMoneda(hayAjusteManual ? valorManual : calculo.valor_calculado)}</strong>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={guardando || !puedeCobrar}>
              {guardando ? 'Registrando...' : 'Registrar cobro'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
