import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
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
const tipos = [
  'EPS',
  'ARL',
  'LICENCIA_MATERNIDAD',
  'LICENCIA_PATERNIDAD',
  'ACCIDENTE_TRANSITO',
  'ACCIDENTE_LABORAL',
  'ENFERMEDAD_GENERAL'
];

function navegar(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function construirQuery(filtros, pagina = 1) {
  const params = new URLSearchParams({ pagina: String(pagina) });

  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor) params.set(clave, valor);
  });

  return params;
}

export default function Historial() {
  const [registros, setRegistros] = useState([]);
  const [epsArl, setEpsArl] = useState([]);
  const [pagination, setPagination] = useState({ pagina: 1, limite: 20, total: 0, total_paginas: 1 });
  const [filtros, setFiltros] = useState({
    colaborador: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: '',
    tipo: '',
    eps_arl_id: '',
    area: ''
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const hayFiltros = useMemo(() => Object.values(filtros).some(Boolean), [filtros]);

  function cargarHistorial(pagina = 1) {
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/incapacidades/historial?${construirQuery(filtros, pagina)}`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el historial.');
        return data;
      })
      .then((data) => {
        setRegistros(data.data ?? []);
        setPagination(data.pagination ?? { pagina, limite: 20, total: 0, total_paginas: 1 });
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    fetch(`${API_BASE}/eps-arl`)
      .then((respuesta) => respuesta.json())
      .then(setEpsArl)
      .catch(() => setEpsArl([]));
  }, []);

  useEffect(() => {
    cargarHistorial(1);
  }, []);

  function actualizarFiltro(clave, valor) {
    setFiltros((actuales) => ({ ...actuales, [clave]: valor }));
  }

  function buscar(event) {
    event.preventDefault();
    cargarHistorial(1);
  }

  function limpiarFiltros() {
    const filtrosLimpios = {
      colaborador: '',
      fecha_inicio: '',
      fecha_fin: '',
      estado: '',
      tipo: '',
      eps_arl_id: '',
      area: ''
    };

    setFiltros(filtrosLimpios);
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/incapacidades/historial?pagina=1`)
      .then(async (respuesta) => {
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error ?? 'No fue posible cargar el historial.');
        return data;
      })
      .then((data) => {
        setRegistros(data.data ?? []);
        setPagination(data.pagination ?? { pagina: 1, limite: 20, total: 0, total_paginas: 1 });
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  function exportarExcel() {
    const params = construirQuery(filtros, pagination.pagina);
    params.delete('pagina');
    window.location.href = `${API_BASE}/incapacidades/historial/exportar?${params}`;
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Consulta</p>
          <h1>Historial</h1>
        </div>
        <button type="button" className="secondary-button" onClick={exportarExcel} disabled={cargando || registros.length === 0}>
          Exportar Excel
        </button>
      </header>

      <form className="panel history-filters" onSubmit={buscar}>
        <label>
          <span>Colaborador</span>
          <input
            value={filtros.colaborador}
            onChange={(event) => actualizarFiltro('colaborador', event.target.value)}
            placeholder="Nombre o identificacion"
          />
        </label>
        <label>
          <span>Inicio</span>
          <input type="date" value={filtros.fecha_inicio} onChange={(event) => actualizarFiltro('fecha_inicio', event.target.value)} />
        </label>
        <label>
          <span>Fin</span>
          <input type="date" value={filtros.fecha_fin} onChange={(event) => actualizarFiltro('fecha_fin', event.target.value)} />
        </label>
        <label>
          <span>Estado</span>
          <select value={filtros.estado} onChange={(event) => actualizarFiltro('estado', event.target.value)}>
            <option value="">Todos</option>
            {estados.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select value={filtros.tipo} onChange={(event) => actualizarFiltro('tipo', event.target.value)}>
            <option value="">Todos</option>
            {tipos.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </label>
        <label>
          <span>EPS/ARL</span>
          <select value={filtros.eps_arl_id} onChange={(event) => actualizarFiltro('eps_arl_id', event.target.value)}>
            <option value="">Todas</option>
            {epsArl.map((entidad) => (
              <option key={entidad.id} value={entidad.id}>{entidad.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Area</span>
          <input value={filtros.area} onChange={(event) => actualizarFiltro('area', event.target.value)} placeholder="Area del colaborador" />
        </label>
        <div className="filter-actions">
          <button type="submit" className="primary-button">Buscar</button>
          <button type="button" className="secondary-button" onClick={limpiarFiltros} disabled={!hayFiltros}>
            Limpiar
          </button>
        </div>
      </form>

      <div className="panel">
        <div className="section-heading">
          <h2>Resultados</h2>
          <span className="result-count">{pagination.total} registros encontrados</span>
        </div>

        {error && <p className="feedback error">{error}</p>}
        {cargando && <p className="empty-state">Cargando incapacidades...</p>}
        {!cargando && registros.length === 0 && <p className="empty-state">No hay incapacidades con esos filtros.</p>}

        {!cargando && registros.length > 0 && (
          <>
            <table>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Colaborador</th>
                  <th>Area</th>
                  <th>EPS/ARL</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Dias</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((registro) => (
                  <tr key={registro.id}>
                    <td>{registro.numero_incapacidad}</td>
                    <td>
                      <strong>{registro.colaborador_nombre}</strong>
                      <small>{registro.colaborador_identificacion}</small>
                    </td>
                    <td>{registro.colaborador_area}</td>
                    <td>{registro.eps_arl_nombre}</td>
                    <td>{registro.fecha_inicio}</td>
                    <td>{registro.fecha_fin}</td>
                    <td>{registro.numero_dias}</td>
                    <td>
                      <span className={`status status-${registro.estado_actual}`}>{registro.estado_actual}</span>
                    </td>
                    <td>
                      <button type="button" className="secondary-button" onClick={() => navegar(`/historial/${registro.id}`)}>
                        Ver expediente
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination-bar">
              <button
                type="button"
                className="secondary-button"
                disabled={pagination.pagina <= 1}
                onClick={() => cargarHistorial(pagination.pagina - 1)}
              >
                Anterior
              </button>
              <span>Pagina {pagination.pagina} de {pagination.total_paginas}</span>
              <button
                type="button"
                className="secondary-button"
                disabled={pagination.pagina >= pagination.total_paginas}
                onClick={() => cargarHistorial(pagination.pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
