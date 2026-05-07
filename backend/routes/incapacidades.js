import { Router } from 'express';

import { all, get, run, transaction } from '../db.js';

const router = Router();

function obtenerIncapacidad(id) {
  return get(
    `
      SELECT
        i.*,
        c.nombre_completo AS colaborador_nombre,
        c.numero_identificacion AS colaborador_identificacion,
        e.estado AS estado_actual
      FROM incapacidades i
      JOIN colaboradores c ON c.id = i.colaborador_id
      LEFT JOIN estados e ON e.id = i.estado_actual_id
      WHERE i.id = ?
    `,
    [id]
  );
}

router.get('/', (_req, res) => {
  const incapacidades = all(`
    SELECT
      i.id,
      i.numero_incapacidad,
      i.colaborador_id,
      c.nombre_completo AS colaborador_nombre,
      i.fecha_inicio,
      i.fecha_fin,
      i.numero_dias,
      i.diagnostico_cie10,
      i.tipo,
      e.estado AS estado_actual
    FROM incapacidades i
    JOIN colaboradores c ON c.id = i.colaborador_id
    LEFT JOIN estados e ON e.id = i.estado_actual_id
    ORDER BY i.fecha_inicio DESC, i.id DESC
  `);

  res.json(incapacidades);
});

router.get('/:id', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const estados = all(
    `
      SELECT *
      FROM estados
      WHERE incapacidad_id = ?
      ORDER BY fecha_cambio ASC, id ASC
    `,
    [req.params.id]
  );

  return res.json({ ...incapacidad, estados });
});

router.post('/', (req, res) => {
  const {
    numero_incapacidad,
    colaborador_id,
    fecha_inicio,
    fecha_fin,
    numero_dias,
    diagnostico_cie10,
    entidad_emisora,
    tipo,
    documento_adjunto = null,
    observaciones = null,
    created_by = 1
  } = req.body;

  const crearIncapacidad = transaction(() => {
    const incapacidadResult = run(
      `
        INSERT INTO incapacidades (
          numero_incapacidad,
          colaborador_id,
          fecha_inicio,
          fecha_fin,
          numero_dias,
          diagnostico_cie10,
          entidad_emisora,
          tipo,
          documento_adjunto,
          observaciones,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        numero_incapacidad,
        colaborador_id,
        fecha_inicio,
        fecha_fin,
        numero_dias,
        diagnostico_cie10,
        entidad_emisora,
        tipo,
        documento_adjunto,
        observaciones,
        created_by
      ]
    );

    const estadoResult = run(
      `
        INSERT INTO estados (
          incapacidad_id,
          estado,
          usuario_id,
          justificacion,
          es_estado_actual
        ) VALUES (?, 'Registrada', ?, 'Registro inicial de incapacidad.', 1)
      `,
      [incapacidadResult.lastInsertRowid, created_by]
    );

    run('UPDATE incapacidades SET estado_actual_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      estadoResult.lastInsertRowid,
      incapacidadResult.lastInsertRowid
    ]);

    run(
      `
        INSERT INTO auditorias (
          usuario_id,
          accion,
          entidad_afectada,
          entidad_id,
          detalle,
          ip_address
        ) VALUES (?, 'CREAR_INCAPACIDAD', 'incapacidades', ?, ?, NULL)
      `,
      [
        created_by,
        incapacidadResult.lastInsertRowid,
        JSON.stringify({ numero_incapacidad, estado: 'Registrada' })
      ]
    );

    return obtenerIncapacidad(incapacidadResult.lastInsertRowid);
  });

  return res.status(201).json(crearIncapacidad());
});

router.patch('/:id/estado', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const { estado, usuario_id = 1, justificacion = 'Cambio manual de estado.' } = req.body;

  const cambiarEstado = transaction(() => {
    run('UPDATE estados SET es_estado_actual = 0, updated_at = CURRENT_TIMESTAMP WHERE incapacidad_id = ?', [
      req.params.id
    ]);

    const estadoResult = run(
      `
        INSERT INTO estados (
          incapacidad_id,
          estado,
          usuario_id,
          justificacion,
          es_estado_actual
        ) VALUES (?, ?, ?, ?, 1)
      `,
      [req.params.id, estado, usuario_id, justificacion]
    );

    run('UPDATE incapacidades SET estado_actual_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      estadoResult.lastInsertRowid,
      req.params.id
    ]);

    run(
      `
        INSERT INTO auditorias (
          usuario_id,
          accion,
          entidad_afectada,
          entidad_id,
          detalle,
          ip_address
        ) VALUES (?, 'CAMBIAR_ESTADO_INCAPACIDAD', 'incapacidades', ?, ?, NULL)
      `,
      [
        usuario_id,
        req.params.id,
        JSON.stringify({ estado_anterior: incapacidad.estado_actual, estado_nuevo: estado })
      ]
    );

    return obtenerIncapacidad(req.params.id);
  });

  return res.json(cambiarEstado());
});

export default router;
