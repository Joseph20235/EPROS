import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const formularioInicial = {
  numero_identificacion: '',
  nombre_completo: '',
  cargo: '',
  area: '',
  eps_arl_id: '',
  salario_base: '',
  activo: true
};

export default function AdminColaboradores() {
  const [colaboradores, setColaboradores] = useState([]);
  const [epsArl, setEpsArl] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [paginacion, setPaginacion] = useState({ total: 0, total_paginas: 1 });
  const [formulario, setFormulario] = useState(formularioInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const modoEdicion = useMemo(() => editandoId !== null, [editandoId]);

  async function cargarColaboradores(paginaActual = pagina) {
    const params = new URLSearchParams({
      pagina: String(paginaActual),
      limite: '6',
      busqueda
    });
    const respuesta = await fetch(`${API_BASE}/colaboradores?${params.toString()}`);
    const data = await respuesta.json();
    setColaboradores(data.data ?? []);
    setPaginacion(data.pagination ?? { total: 0, total_paginas: 1 });
  }

  async function cargarEpsArl() {
    const respuesta = await fetch(`${API_BASE}/eps-arl`);
    setEpsArl(await respuesta.json());
  }

  useEffect(() => {
    cargarEpsArl().catch(() => setError('No fue posible cargar EPS/ARL.'));
  }, []);

  useEffect(() => {
    cargarColaboradores().catch(() => setError('No fue posible cargar colaboradores.'));
  }, [pagina]);

  async function buscar(event) {
    event.preventDefault();
    setPagina(1);
    await cargarColaboradores(1);
  }

  function actualizarCampo(event) {
    const { name, value, type, checked } = event.target;
    setFormulario((actual) => ({ ...actual, [name]: type === 'checkbox' ? checked : value }));
  }

  function editar(colaborador) {
    setEditandoId(colaborador.id);
    setFormulario({
      numero_identificacion: colaborador.numero_identificacion,
      nombre_completo: colaborador.nombre_completo,
      cargo: colaborador.cargo,
      area: colaborador.area,
      eps_arl_id: String(colaborador.eps_arl_id),
      salario_base: String(colaborador.salario_base),
      activo: Boolean(colaborador.activo)
    });
    setMensaje('');
    setError('');
  }

  function limpiarFormulario() {
    setFormulario(formularioInicial);
    setEditandoId(null);
  }

  async function guardar(event) {
    event.preventDefault();
    setCargando(true);
    setMensaje('');
    setError('');

    const payload = {
      ...formulario,
      eps_arl_id: Number(formulario.eps_arl_id),
      salario_base: Number(formulario.salario_base),
      usuario_id: 1
    };

    const respuesta = await fetch(`${API_BASE}/colaboradores${modoEdicion ? `/${editandoId}` : ''}`, {
      method: modoEdicion ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await respuesta.json();

    setCargando(false);

    if (!respuesta.ok) {
      setError(data.error ?? 'No fue posible guardar el colaborador.');
      return;
    }

    setMensaje(modoEdicion ? 'Colaborador actualizado.' : 'Colaborador creado.');
    limpiarFormulario();
    await cargarColaboradores();
  }

  async function desactivar(colaborador) {
    setMensaje('');
    setError('');
    const respuesta = await fetch(`${API_BASE}/colaboradores/${colaborador.id}/desactivar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: 1 })
    });

    if (!respuesta.ok) {
      const data = await respuesta.json();
      setError(data.error ?? 'No fue posible desactivar el colaborador.');
      return;
    }

    setMensaje('Colaborador desactivado.');
    await cargarColaboradores();
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Administracion</p>
          <h1>Colaboradores</h1>
        </div>
      </header>

      <div className="admin-layout">
        <div className="panel">
          <form className="toolbar" onSubmit={buscar}>
            <label className="search-field">
              Buscar por nombre o identificacion
              <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Laura o 1001001001" />
            </label>
            <button type="submit" className="primary-button">Buscar</button>
          </form>

          <table>
            <thead>
              <tr>
                <th>Identificacion</th>
                <th>Nombre</th>
                <th>Area</th>
                <th>EPS/ARL</th>
                <th>Salario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((colaborador) => (
                <tr key={colaborador.id}>
                  <td>{colaborador.numero_identificacion}</td>
                  <td>{colaborador.nombre_completo}</td>
                  <td>{colaborador.area}</td>
                  <td>{colaborador.eps_arl_nombre}</td>
                  <td>{Number(colaborador.salario_base).toLocaleString('es-CO')}</td>
                  <td><span className={colaborador.activo ? 'status' : 'status muted'}>{colaborador.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="actions-cell">
                    <button type="button" className="secondary-button" onClick={() => editar(colaborador)}>Editar</button>
                    {Boolean(colaborador.activo) && (
                      <button type="button" className="danger-button" onClick={() => desactivar(colaborador)}>Desactivar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination-bar">
            <span>{paginacion.total} colaboradores</span>
            <div>
              <button type="button" className="secondary-button" disabled={pagina <= 1} onClick={() => setPagina((actual) => actual - 1)}>
                Anterior
              </button>
              <span>Pagina {pagina} de {paginacion.total_paginas || 1}</span>
              <button
                type="button"
                className="secondary-button"
                disabled={pagina >= (paginacion.total_paginas || 1)}
                onClick={() => setPagina((actual) => actual + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>

        <form className="panel form-grid admin-form" onSubmit={guardar}>
          <h2>{modoEdicion ? 'Editar colaborador' : 'Crear colaborador'}</h2>
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}

          <label>
            Numero de identificacion
            <input name="numero_identificacion" value={formulario.numero_identificacion} onChange={actualizarCampo} required />
          </label>
          <label>
            Nombre completo
            <input name="nombre_completo" value={formulario.nombre_completo} onChange={actualizarCampo} required />
          </label>
          <label>
            Cargo
            <input name="cargo" value={formulario.cargo} onChange={actualizarCampo} required />
          </label>
          <label>
            Area
            <input name="area" value={formulario.area} onChange={actualizarCampo} required />
          </label>
          <label>
            EPS/ARL
            <select name="eps_arl_id" value={formulario.eps_arl_id} onChange={actualizarCampo} required>
              <option value="">Seleccionar</option>
              {epsArl.map((entidad) => (
                <option key={entidad.id} value={entidad.id}>{entidad.nombre} ({entidad.tipo})</option>
              ))}
            </select>
          </label>
          <label>
            Salario base
            <input name="salario_base" type="number" min="1" value={formulario.salario_base} onChange={actualizarCampo} required />
          </label>
          <label className="checkbox-line">
            <input name="activo" type="checkbox" checked={formulario.activo} onChange={actualizarCampo} />
            <span>Activo</span>
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={cargando}>{cargando ? 'Guardando' : 'Guardar'}</button>
            <button type="button" className="secondary-button" onClick={limpiarFormulario}>Limpiar</button>
          </div>
        </form>
      </div>
    </section>
  );
}
