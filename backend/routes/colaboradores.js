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
      ) VALUES (?, ?, 'colaboradores', ?, ?, ?)
    `,
    [usuarioId, accion, entidadId, JSON.stringify(detalle), ipAddress]
  );
}

function obtenerColaborador(id) {
  return get(
    `
      SELECT
        c.*,
        e.nombre AS eps_arl_nombre,
        e.tipo AS eps_arl_tipo
      FROM colaboradores c
      JOIN eps_arl e ON e.id = c.eps_arl_id
      WHERE c.id = ?
    `,
    [id]
  );
}

function validarColaborador(datos, idActual = null) {
  const errores = [];

  if (!datos.numero_identificacion?.trim()) errores.push('El numero de identificacion es obligatorio.');
  if (!datos.nombre_completo?.trim()) errores.push('El nombre completo es obligatorio.');
  if (!datos.cargo?.trim()) errores.push('El cargo es obligatorio.');
  if (!datos.area?.trim()) errores.push('El area es obligatoria.');
  if (!datos.eps_arl_id) errores.push('La EPS/ARL es obligatoria.');

  const salarioBase = Number(datos.salario_base);
  if (!Number.isFinite(salarioBase) || salarioBase <= 0) {
    errores.push('El salario base debe ser mayor a 0.');
  }

  if (datos.eps_arl_id && !get('SELECT id FROM eps_arl WHERE id = ?', [datos.eps_arl_id])) {
    errores.push('La EPS/ARL seleccionada no existe.');
  }

  if (datos.numero_identificacion?.trim()) {
    const existente = get(
      `
        SELECT id
        FROM colaboradores
        WHERE numero_identificacion = ?
          AND (? IS NULL OR id <> ?)
      `,
      [datos.numero_identificacion.trim(), idActual, idActual]
    );

    if (existente) {
      errores.push('Ya existe un colaborador con ese numero de identificacion.');
    }
  }

  return errores;
}

router.get('/', (req, res) => {
  const pagina = Math.max(Number.parseInt(req.query.pagina ?? '1', 10), 1);
  const limite = Math.min(Math.max(Number.parseInt(req.query.limite ?? '10', 10), 1), 50);
  const offset = (pagina - 1) * limite;
  const busqueda = String(req.query.busqueda ?? '').trim();
  const soloActivos = req.query.activo === '1' || req.query.activo === 'true';

  const filtros = [];
  const params = [];

  if (busqueda) {
    filtros.push('(c.nombre_completo LIKE ? OR c.numero_identificacion LIKE ?)');
    params.push(`%${busqueda}%`, `%${busqueda}%`);
  }

  if (soloActivos) {
    filtros.push('c.activo = 1');
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const total = get(`SELECT COUNT(*) AS total FROM colaboradores c ${where}`, params).total;
  const colaboradores = all(
    `
    SELECT
      c.id,
      c.numero_identificacion,
      c.nombre_completo,
      c.cargo,
      c.area,
      c.salario_base,
      c.activo,
      e.nombre AS eps_arl_nombre,
      e.tipo AS eps_arl_tipo
    FROM colaboradores c
    JOIN eps_arl e ON e.id = c.eps_arl_id
    ${where}
    ORDER BY c.nombre_completo
    LIMIT ? OFFSET ?
  `,
    [...params, limite, offset]
  );

  res.json({
    data: colaboradores,
    pagination: {
      pagina,
      limite,
      total,
      total_paginas: Math.ceil(total / limite)
    }
  });
});

router.get('/:id', (req, res) => {
  const colaborador = obtenerColaborador(req.params.id);

  if (!colaborador) {
    return res.status(404).json({ error: 'Colaborador no encontrado' });
  }

  return res.json(colaborador);
});

router.post('/', (req, res) => {
  const {
    numero_identificacion,
    nombre_completo,
    cargo,
    area,
    eps_arl_id,
    salario_base,
    activo = 1
  } = req.body;

  const errores = validarColaborador(req.body);
  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  const result = run(
    `
      INSERT INTO colaboradores (
        numero_identificacion,
        nombre_completo,
        cargo,
        area,
        eps_arl_id,
        salario_base,
        activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      numero_identificacion.trim(),
      nombre_completo.trim(),
      cargo.trim(),
      area.trim(),
      eps_arl_id,
      Number(salario_base),
      activo ? 1 : 0
    ]
  );

  registrarAuditoria({
    usuarioId: req.body.usuario_id ?? 1,
    accion: 'CREAR_COLABORADOR',
    entidadId: result.lastInsertRowid,
    detalle: { numero_identificacion, nombre_completo },
    ipAddress: req.ip
  });

  return res.status(201).json(obtenerColaborador(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const colaborador = obtenerColaborador(req.params.id);

  if (!colaborador) {
    return res.status(404).json({ error: 'Colaborador no encontrado' });
  }

  const datos = {
    numero_identificacion: req.body.numero_identificacion,
    nombre_completo: req.body.nombre_completo,
    cargo: req.body.cargo,
    area: req.body.area,
    eps_arl_id: req.body.eps_arl_id,
    salario_base: req.body.salario_base,
    activo: req.body.activo ?? colaborador.activo
  };

  const errores = validarColaborador(datos, Number(req.params.id));
  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  run(
    `
      UPDATE colaboradores
      SET
        numero_identificacion = ?,
        nombre_completo = ?,
        cargo = ?,
        area = ?,
        eps_arl_id = ?,
        salario_base = ?,
        activo = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      datos.numero_identificacion.trim(),
      datos.nombre_completo.trim(),
      datos.cargo.trim(),
      datos.area.trim(),
      datos.eps_arl_id,
      Number(datos.salario_base),
      datos.activo ? 1 : 0,
      req.params.id
    ]
  );

  registrarAuditoria({
    usuarioId: req.body.usuario_id ?? 1,
    accion: 'ACTUALIZAR_COLABORADOR',
    entidadId: Number(req.params.id),
    detalle: { antes: colaborador, despues: obtenerColaborador(req.params.id) },
    ipAddress: req.ip
  });

  return res.json(obtenerColaborador(req.params.id));
});

router.patch('/:id/desactivar', (req, res) => {
  const colaborador = obtenerColaborador(req.params.id);

  if (!colaborador) {
    return res.status(404).json({ error: 'Colaborador no encontrado' });
  }

  run('UPDATE colaboradores SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

  registrarAuditoria({
    usuarioId: req.body.usuario_id ?? 1,
    accion: 'DESACTIVAR_COLABORADOR',
    entidadId: Number(req.params.id),
    detalle: { numero_identificacion: colaborador.numero_identificacion, nombre_completo: colaborador.nombre_completo },
    ipAddress: req.ip
  });

  return res.json(obtenerColaborador(req.params.id));
});

export default router;
