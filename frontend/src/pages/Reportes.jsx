import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const tiposReporte = [
  { id: 'incapacidades_periodo', label: 'Incapacidades por periodo' },
  { id: 'cobros_pagos_pendientes', label: 'Cobros y pagos pendientes' },
  { id: 'reporte_colaborador', label: 'Reporte por colaborador' },
  { id: 'incapacidades_prolongadas', label: 'Incapacidades prolongadas' }
];
const estados = [
  'Registrada',
  'En_Validacion',
  'Transcrita',
  'Radicada',
  'En_Revision_EPS',
  'Aprobada',
  'Rechazada',
  'En_Cobro',
  'En_Conciliacion',
  'Cobro_Juridico',
  'Pagada',
  'Cerrada_Sin_Pago'
];
const tiposIncapacidad = [
  'EPS',
  'ARL',
  'LICENCIA_MATERNIDAD',
  'LICENCIA_PATERNIDAD',
  'ACCIDENTE_TRANSITO',
  'ACCIDENTE_LABORAL',
  'ENFERMEDAD_GENERAL'
];
const etiquetasColumnas = {
  numero_incapacidad: 'Codigo',
  colaborador_nombre: 'Colaborador',
  colaborador_identificacion: 'Identificacion',
  colaborador_area: 'Area',
  eps_arl_nombre: 'EPS/ARL',
  fecha_inicio: 'Inicio',
  fecha_fin: 'Fin',
  numero_dias: 'Dias',
  estado_actual: 'Estado',
  tipo: 'Tipo',
  diagnostico_cie10: 'CIE-10',
  fecha_cobro: 'Fecha cobro',
  dias_desde_cobro: 'Dias desde cobro',
  valor_cobrado: 'Valor cobrado',
  total_incapacidades: 'Incapacidades',
  dias_acumulados: 'Dias acumulados',
  diagnosticos: 'Diagnosticos'
};

function formatearValor(clave, valor) {
  if (clave.includes('valor')) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(Number(valor ?? 0));
  }

  return valor ?? '';
}

function resumenPlano(resumen) {
  if (!resumen) return [];

  return Object.entries(resumen)
    .filter(([, valor]) => !Array.isArray(valor) && typeof valor !== 'object')
    .map(([clave, valor]) => ({ clave: clave.replaceAll('_', ' '), valor }));
}

export default function Reportes() {
  const [tipo, setTipo] = useState('incapacidades_periodo');
  const [parametros, setParametros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    estado: '',
    tipo_incapacidad: '',
    colaborador_id: '',
    eps_arl_id: '',
    area: ''
  });
  const [colaboradores, setColaboradores] = useState([]);
  const [epsArl, setEpsArl] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const requiereColaborador = tipo === 'reporte_colaborador';
  const permiteEstadoTipo = tipo === 'incapacidades_periodo';
  const filas = reporte?.filas ?? [];
  const columnas = useMemo(() => reporte?.columnas ?? [], [reporte]);

  useEffect(() => {
    fetch(`${API_BASE}/colaboradores?activo=1&limite=50`)
      .then((respuesta) => respuesta.json())
      .then((data) => setColaboradores(data.data ?? []))
      .catch(() => setColaboradores([]));

    fetch(`${API_BASE}/eps-arl`)
      .then((respuesta) => respuesta.json())
      .then(setEpsArl)
      .catch(() => setEpsArl([]));
  }, []);

  function actualizarParametro(clave, valor) {
    setParametros((actuales) => ({ ...actuales, [clave]: valor }));
  }

  async function generarReporte(event) {
    event.preventDefault();
    setCargando(true);
    setError('');
    setReporte(null);

    try {
      const respuesta = await fetch(`${API_BASE}/reportes/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          parametros,
          usuario_id: 1
        })
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible generar el reporte.');

      setReporte(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  function exportarPdf() {
    if (!reporte) return;

    const ventana = window.open('', '_blank', 'width=1024,height=768');
    const tabla = filas
      .map(
        (fila) => `
          <tr>${columnas.map((columna) => `<td>${formatearValor(columna, fila[columna])}</td>`).join('')}</tr>
        `
      )
      .join('');
    const resumen = resumenPlano(reporte.resumen)
      .map((item) => `<div><span>${item.clave}</span><strong>${item.valor}</strong></div>`)
      .join('');

    ventana.document.write(`
      <html>
        <head>
          <title>${reporte.titulo}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1b2430; padding: 28px; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 18px; color: #537083; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
            .summary div { border: 1px solid #dce3e8; border-radius: 8px; padding: 10px; }
            .summary span { display: block; color: #537083; font-size: 11px; text-transform: uppercase; }
            .summary strong { display: block; margin-top: 6px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border-bottom: 1px solid #dce3e8; padding: 8px; text-align: left; }
            th { color: #537083; text-transform: uppercase; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>${reporte.titulo}</h1>
          <p>Generado en ${new Date(reporte.generado_en).toLocaleString('es-CO')} · Auditoria ${reporte.auditoria_id}</p>
          <section class="summary">${resumen}</section>
          <table>
            <thead>
              <tr>${columnas.map((columna) => `<th>${etiquetasColumnas[columna] ?? columna}</th>`).join('')}</tr>
            </thead>
            <tbody>${tabla}</tbody>
          </table>
        </body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Analitica</p>
          <h1>Reportes</h1>
        </div>
        <button type="button" className="secondary-button" onClick={exportarPdf} disabled={!reporte || filas.length === 0}>
          Exportar PDF
        </button>
      </header>

      <form className="panel report-builder" onSubmit={generarReporte}>
        <label className="full-width">
          <span>Tipo de reporte</span>
          <select value={tipo} onChange={(event) => setTipo(event.target.value)}>
            {tiposReporte.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>{opcion.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Inicio</span>
          <input type="date" value={parametros.fecha_inicio} onChange={(event) => actualizarParametro('fecha_inicio', event.target.value)} />
        </label>
        <label>
          <span>Fin</span>
          <input type="date" value={parametros.fecha_fin} onChange={(event) => actualizarParametro('fecha_fin', event.target.value)} />
        </label>
        {permiteEstadoTipo && (
          <>
            <label>
              <span>Estado</span>
              <select value={parametros.estado} onChange={(event) => actualizarParametro('estado', event.target.value)}>
                <option value="">Todos</option>
                {estados.map((estado) => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Tipo</span>
              <select value={parametros.tipo_incapacidad} onChange={(event) => actualizarParametro('tipo_incapacidad', event.target.value)}>
                <option value="">Todos</option>
                {tiposIncapacidad.map((tipoIncapacidad) => (
                  <option key={tipoIncapacidad} value={tipoIncapacidad}>{tipoIncapacidad}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          <span>EPS/ARL</span>
          <select value={parametros.eps_arl_id} onChange={(event) => actualizarParametro('eps_arl_id', event.target.value)}>
            <option value="">Todas</option>
            {epsArl.map((entidad) => (
              <option key={entidad.id} value={entidad.id}>{entidad.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Area</span>
          <input value={parametros.area} onChange={(event) => actualizarParametro('area', event.target.value)} placeholder="Area del colaborador" />
        </label>
        {requiereColaborador && (
          <label className="full-width">
            <span>Colaborador</span>
            <select value={parametros.colaborador_id} onChange={(event) => actualizarParametro('colaborador_id', event.target.value)} required>
              <option value="">Selecciona un colaborador</option>
              {colaboradores.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nombre_completo} · {colaborador.numero_identificacion}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="filter-actions full-width">
          <button type="submit" className="primary-button" disabled={cargando}>
            {cargando ? 'Generando...' : 'Generar reporte'}
          </button>
        </div>
      </form>

      {error && <p className="feedback error">{error}</p>}

      {reporte && (
        <div className="panel report-preview">
          <div className="section-heading">
            <div>
              <h2>{reporte.titulo}</h2>
              <p className="empty-state">Generado en {new Date(reporte.generado_en).toLocaleString('es-CO')} · Auditoria {reporte.auditoria_id}</p>
            </div>
            <span className="result-count">{filas.length} filas</span>
          </div>

          <div className="metrics-grid report-metrics">
            {resumenPlano(reporte.resumen).map((item) => (
              <article key={item.clave} className="metric-card">
                <span>{item.clave}</span>
                <strong>{item.valor}</strong>
              </article>
            ))}
          </div>

          {reporte.resumen?.estados && (
            <div className="report-summary-grid">
              <div>
                <h3>Totales por estado</h3>
                {reporte.resumen.estados.map((item) => (
                  <p key={item.estado}>{item.estado}: {item.total} casos · {item.dias} dias</p>
                ))}
              </div>
              <div>
                <h3>Totales por tipo</h3>
                {reporte.resumen.tipos.map((item) => (
                  <p key={item.tipo}>{item.tipo}: {item.total} casos · {item.dias} dias</p>
                ))}
              </div>
            </div>
          )}

          {reporte.resumen?.diagnosticos_frecuentes && (
            <div className="report-summary-grid">
              <div>
                <h3>Diagnosticos frecuentes</h3>
                {reporte.resumen.diagnosticos_frecuentes.map((item) => (
                  <p key={item.diagnostico_cie10}>{item.diagnostico_cie10}: {item.total} casos · {item.dias} dias</p>
                ))}
              </div>
            </div>
          )}

          {filas.length ? (
            <table className="stacked-table">
              <thead>
                <tr>
                  {columnas.map((columna) => (
                    <th key={columna}>{etiquetasColumnas[columna] ?? columna}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, indice) => (
                  <tr key={`${fila.id ?? fila.colaborador_id ?? fila.numero_incapacidad}-${indice}`}>
                    {columnas.map((columna) => (
                      <td key={columna}>{formatearValor(columna, fila[columna])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">El reporte no tiene registros con esos parametros.</p>
          )}
        </div>
      )}
    </section>
  );
}
