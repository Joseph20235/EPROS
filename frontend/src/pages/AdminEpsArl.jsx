import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const formularioInicial = {
  nombre: '',
  tipo: 'EPS',
  porcentaje_reconocimiento: '66.67',
  plazo_respuesta_dias: '',
  portal_url: '',
  correo_radicacion: ''
};

export default function AdminEpsArl() {
  const [entidades, setEntidades] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');
  const [formulario, setFormulario] = useState(formularioInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function cargarEntidades() {
    const params = new URLSearchParams();
    if (busqueda) params.set('busqueda', busqueda);
    if (tipo) params.set('tipo', tipo);
    const respuesta = await fetch(`${API_BASE}/eps-arl?${params.toString()}`);
    setEntidades(await respuesta.json());
  }

  useEffect(() => {
    cargarEntidades().catch(() => setError('No fue posible cargar EPS/ARL.'));
  }, []);

  function actualizarCampo(event) {
    const { name, value } = event.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
  }

  async function buscar(event) {
    event.preventDefault();
    await cargarEntidades();
  }

  function editar(entidad) {
    setEditandoId(entidad.id);
    setFormulario({
      nombre: entidad.nombre,
      tipo: entidad.tipo,
      porcentaje_reconocimiento: String(entidad.porcentaje_reconocimiento),
      plazo_respuesta_dias: String(entidad.plazo_respuesta_dias),
      portal_url: entidad.portal_url ?? '',
      correo_radicacion: entidad.correo_radicacion ?? ''
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
    setMensaje('');
    setError('');

    const payload = {
      ...formulario,
      porcentaje_reconocimiento: Number(formulario.porcentaje_reconocimiento),
      plazo_respuesta_dias: Number(formulario.plazo_respuesta_dias),
      usuario_id: 1
    };

    const respuesta = await fetch(`${API_BASE}/eps-arl${editandoId ? `/${editandoId}` : ''}`, {
      method: editandoId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await respuesta.json();

    if (!respuesta.ok) {
      setError(data.error ?? 'No fue posible guardar la EPS/ARL.');
      return;
    }

    setMensaje(editandoId ? 'EPS/ARL actualizada.' : 'EPS/ARL creada.');
    limpiarFormulario();
    await cargarEntidades();
  }

  async function eliminar(entidad) {
    setMensaje('');
    setError('');
    const respuesta = await fetch(`${API_BASE}/eps-arl/${entidad.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: 1 })
    });

    if (!respuesta.ok) {
      const data = await respuesta.json();
      setError(data.error ?? 'No fue posible eliminar la EPS/ARL.');
      return;
    }

    setMensaje('EPS/ARL eliminada.');
    await cargarEntidades();
  }

  return (
    <section className="page wide-page">
      <header className="page-header">
        <div>
          <p>Administracion</p>
          <h1>EPS / ARL</h1>
        </div>
      </header>

      <div className="admin-layout">
        <div className="panel">
          <form className="toolbar" onSubmit={buscar}>
            <label className="search-field">
              Buscar entidad
              <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Sanitas" />
            </label>
            <label>
              Tipo
              <select value={tipo} onChange={(event) => setTipo(event.target.value)}>
                <option value="">Todos</option>
                <option value="EPS">EPS</option>
                <option value="ARL">ARL</option>
              </select>
            </label>
            <button type="submit" className="primary-button">Filtrar</button>
          </form>

          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Reconocimiento</th>
                <th>Plazo respuesta</th>
                <th>Correo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entidades.map((entidad) => (
                <tr key={entidad.id}>
                  <td>{entidad.nombre}</td>
                  <td><span className="status">{entidad.tipo}</span></td>
                  <td>{Number(entidad.porcentaje_reconocimiento).toFixed(2)}%</td>
                  <td>{entidad.plazo_respuesta_dias} dias</td>
                  <td>{entidad.correo_radicacion ?? 'Sin correo'}</td>
                  <td className="actions-cell">
                    <button type="button" className="secondary-button" onClick={() => editar(entidad)}>Editar</button>
                    <button type="button" className="danger-button" onClick={() => eliminar(entidad)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="panel form-grid admin-form" onSubmit={guardar}>
          <h2>{editandoId ? 'Editar EPS/ARL' : 'Crear EPS/ARL'}</h2>
          {mensaje && <p className="feedback success">{mensaje}</p>}
          {error && <p className="feedback error">{error}</p>}

          <label>
            Nombre
            <input name="nombre" value={formulario.nombre} onChange={actualizarCampo} required />
          </label>
          <label>
            Tipo
            <select name="tipo" value={formulario.tipo} onChange={actualizarCampo} required>
              <option value="EPS">EPS</option>
              <option value="ARL">ARL</option>
            </select>
          </label>
          <label>
            Porcentaje de reconocimiento
            <input name="porcentaje_reconocimiento" type="number" min="0" step="0.01" value={formulario.porcentaje_reconocimiento} onChange={actualizarCampo} required />
          </label>
          <label>
            Plazo de respuesta en dias
            <input name="plazo_respuesta_dias" type="number" min="1" value={formulario.plazo_respuesta_dias} onChange={actualizarCampo} required />
          </label>
          <label>
            Portal
            <input name="portal_url" type="url" value={formulario.portal_url} onChange={actualizarCampo} placeholder="https://..." />
          </label>
          <label>
            Correo radicacion
            <input name="correo_radicacion" type="email" value={formulario.correo_radicacion} onChange={actualizarCampo} />
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button">Guardar</button>
            <button type="button" className="secondary-button" onClick={limpiarFormulario}>Limpiar</button>
          </div>
        </form>
      </div>
    </section>
  );
}
