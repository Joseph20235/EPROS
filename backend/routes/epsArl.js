import { Router } from 'express';

import { all, get, run } from '../db.js';

const router = Router();

function registrarAuditoria({ usuarioId = 1, accion, entidadId, detalle, ipAddress }) {
  run(
    `
      INSERT INTO auditorias (
        usuario_id,
        accion,
        entidad_afectada,
        entidad_id,
        detalle,
        ip_address
      ) VALUES (?, ?, 'eps_arl', ?, ?, ?)
    `,
    [usuarioId, accion, entidadId, JSON.stringify(detalle), ipAddress]
  );
}

function obtenerEntidad(id) {
  return get('SELECT * FROM eps_arl WHERE id = ?', [id]);
}

function validarEntidad(datos, idActual = null) {
  const errores = [];
  const porcentajeReconocimiento = Number(datos.porcentaje_reconocimiento);
  const plazoRespuestaDias = Number.parseInt(datos.plazo_respuesta_dias, 10);

  if (!datos.nombre?.trim()) errores.push('El nombre es obligatorio.');
  if (!['EPS', 'ARL'].includes(datos.tipo)) errores.push('El tipo debe ser EPS o ARL.');
  if (!Number.isFinite(porcentajeReconocimiento) || porcentajeReconocimiento < 0) {
    errores.push('El porcentaje de reconocimiento debe ser mayor o igual a 0.');
  }
  if (!Number.isInteger(plazoRespuestaDias) || plazoRespuestaDias <= 0) {
    errores.push('El plazo de respuesta debe ser mayor a 0 dias.');
  }

  if (datos.nombre?.trim()) {
    const existente = get(
      `
        SELECT id
        FROM eps_arl
        WHERE nombre = ?
          AND (? IS NULL OR id <> ?)
      `,
      [datos.nombre.trim(), idActual, idActual]
    );

    if (existente) {
      errores.push('Ya existe una EPS/ARL con ese nombre.');
    }
  }

  return errores;
}

router.get('/', (req, res) => {
  const busqueda = String(req.query.busqueda ?? '').trim();
  const tipo = String(req.query.tipo ?? '').trim();
  const filtros = [];
  const params = [];

  if (busqueda) {
    filtros.push('nombre LIKE ?');
    params.push(`%${busqueda}%`);
  }

  if (['EPS', 'ARL'].includes(tipo)) {
    filtros.push('tipo = ?');
    params.push(tipo);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const entidades = all(
    `
      SELECT *
      FROM eps_arl
      ${where}
      ORDER BY tipo DESC, nombre
    `,
    params
  );

  res.json(entidades);
});

router.get('/:id', (req, res) => {
  const entidad = obtenerEntidad(req.params.id);

  if (!entidad) {
    return res.status(404).json({ error: 'EPS/ARL no encontrada' });
  }

  return res.json(entidad);
});

router.post('/', (req, res) => {
  const errores = validarEntidad(req.body);
  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  const result = run(
    `
      INSERT INTO eps_arl (
        nombre,
        tipo,
        porcentaje_reconocimiento,
        plazo_respuesta_dias,
        portal_url,
        correo_radicacion
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      req.body.nombre.trim(),
      req.body.tipo,
      Number(req.body.porcentaje_reconocimiento),
      Number.parseInt(req.body.plazo_respuesta_dias, 10),
      req.body.portal_url?.trim() || null,
      req.body.correo_radicacion?.trim() || null
    ]
  );

  registrarAuditoria({
    usuarioId: req.body.usuario_id ?? 1,
    accion: 'CREAR_EPS_ARL',
    entidadId: result.lastInsertRowid,
    detalle: { nombre: req.body.nombre, tipo: req.body.tipo },
    ipAddress: req.ip
  });

  return res.status(201).json(obtenerEntidad(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const entidad = obtenerEntidad(req.params.id);

  if (!entidad) {
    return res.status(404).json({ error: 'EPS/ARL no encontrada' });
  }

  const errores = validarEntidad(req.body, Number(req.params.id));
  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  run(
    `
      UPDATE eps_arl
      SET
        nombre = ?,
        tipo = ?,
        porcentaje_reconocimiento = ?,
        plazo_respuesta_dias = ?,
        portal_url = ?,
        correo_radicacion = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      req.body.nombre.trim(),
      req.body.tipo,
      Number(req.body.porcentaje_reconocimiento),
      Number.parseInt(req.body.plazo_respuesta_dias, 10),
      req.body.portal_url?.trim() || null,
      req.body.correo_radicacion?.trim() || null,
      req.params.id
    ]
  );

  registrarAuditoria({
    usuarioId: req.body.usuario_id ?? 1,
    accion: 'ACTUALIZAR_EPS_ARL',
    entidadId: Number(req.params.id),
    detalle: { antes: entidad, despues: obtenerEntidad(req.params.id) },
    ipAddress: req.ip
  });

  return res.json(obtenerEntidad(req.params.id));
});

router.delete('/:id', (req, res) => {
  const entidad = obtenerEntidad(req.params.id);

  if (!entidad) {
    return res.status(404).json({ error: 'EPS/ARL no encontrada' });
  }

  const colaboradoresAsociados = get('SELECT COUNT(*) AS total FROM colaboradores WHERE eps_arl_id = ?', [
    req.params.id
  ]).total;

  if (colaboradoresAsociados > 0) {
    return res.status(409).json({ error: 'No se puede eliminar una EPS/ARL asociada a colaboradores.' });
  }

  run('DELETE FROM eps_arl WHERE id = ?', [req.params.id]);

  registrarAuditoria({
    usuarioId: req.body.usuario_id ?? 1,
    accion: 'ELIMINAR_EPS_ARL',
    entidadId: Number(req.params.id),
    detalle: entidad,
    ipAddress: req.ip
  });

  return res.status(204).send();
});

export default router;
