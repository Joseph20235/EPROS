import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { all, get, run, transaction } from '../db.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const tiposIncapacidad = [
  'EPS',
  'ARL',
  'LICENCIA_MATERNIDAD',
  'LICENCIA_PATERNIDAD',
  'ACCIDENTE_TRANSITO',
  'ACCIDENTE_LABORAL',
  'ENFERMEDAD_GENERAL'
];
const mimePermitidos = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png'
};
const cincoMb = 5 * 1024 * 1024;

function calcularDias(fechaInicio, fechaFin) {
  const inicio = new Date(`${fechaInicio}T00:00:00`);
  const fin = new Date(`${fechaFin}T00:00:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;

  return Math.floor((fin - inicio) / 86400000) + 1;
}

function validarCie10(codigo) {
  return /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/.test(String(codigo ?? '').trim().toUpperCase());
}

function normalizarAdjunto(documentoAdjuntoData) {
  const match = String(documentoAdjuntoData ?? '').match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    return { error: 'El archivo adjunto no tiene un formato valido.' };
  }

  const [, mimeType, base64] = match;
  const extension = mimePermitidos[mimeType];

  if (!extension) {
    return { error: 'El adjunto debe ser PDF, JPG o PNG.' };
  }

  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    return { error: 'El archivo adjunto esta vacio.' };
  }

  if (buffer.length > cincoMb) {
    return { error: 'El archivo adjunto no puede superar 5MB.' };
  }

  return { buffer, extension, mimeType };
}

function guardarAdjunto({ incapacidadId, adjunto }) {
  const carpeta = path.join(backendDir, 'uploads', 'incapacidades', String(incapacidadId));
  const nombreArchivo = `soporte-${Date.now()}${adjunto.extension}`;
  const rutaDisco = path.join(carpeta, nombreArchivo);
  const rutaPublica = `/uploads/incapacidades/${incapacidadId}/${nombreArchivo}`;

  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(rutaDisco, adjunto.buffer);

  return rutaPublica;
}

function obtenerIncapacidad(id) {
  return get(
    `
      SELECT
        i.*,
        c.nombre_completo AS colaborador_nombre,
        c.numero_identificacion AS colaborador_identificacion,
        c.eps_arl_id AS colaborador_eps_arl_id,
        ea.nombre AS eps_arl_nombre,
        ea.tipo AS eps_arl_tipo,
        e.estado AS estado_actual
      FROM incapacidades i
      JOIN colaboradores c ON c.id = i.colaborador_id
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
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
      c.numero_identificacion AS colaborador_identificacion,
      ea.nombre AS eps_arl_nombre,
      i.fecha_inicio,
      i.fecha_fin,
      i.numero_dias,
      i.diagnostico_cie10,
      i.tipo,
      e.estado AS estado_actual
    FROM incapacidades i
    JOIN colaboradores c ON c.id = i.colaborador_id
    JOIN eps_arl ea ON ea.id = c.eps_arl_id
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
    documento_adjunto_data,
    observaciones = null,
    created_by = 1
  } = req.body;
  const errores = [];
  const numeroDiasCalculado = calcularDias(fecha_inicio, fecha_fin);
  const adjunto = normalizarAdjunto(documento_adjunto_data);

  if (!String(numero_incapacidad ?? '').trim()) errores.push('El numero de incapacidad es obligatorio.');
  if (!colaborador_id) errores.push('El colaborador es obligatorio.');
  if (!fecha_inicio) errores.push('La fecha de inicio es obligatoria.');
  if (!fecha_fin) errores.push('La fecha de fin es obligatoria.');
  if (!String(diagnostico_cie10 ?? '').trim()) errores.push('El diagnostico CIE-10 es obligatorio.');
  if (!String(entidad_emisora ?? '').trim()) errores.push('La entidad emisora es obligatoria.');
  if (!tiposIncapacidad.includes(tipo)) errores.push('El tipo de incapacidad no es valido.');
  if (adjunto.error) errores.push(adjunto.error);
  if (numeroDiasCalculado === null) errores.push('Las fechas no tienen un formato valido.');
  if (numeroDiasCalculado !== null && numeroDiasCalculado <= 0) {
    errores.push('La fecha fin debe ser mayor o igual a la fecha de inicio.');
  }
  if (!validarCie10(diagnostico_cie10)) {
    errores.push('El diagnostico CIE-10 debe tener formato valido, por ejemplo A09 o J11.1.');
  }

  const colaborador = colaborador_id ? get('SELECT id FROM colaboradores WHERE id = ? AND activo = 1', [colaborador_id]) : null;
  if (colaborador_id && !colaborador) errores.push('El colaborador seleccionado no existe o esta inactivo.');

  if (colaborador_id && numero_incapacidad) {
    const duplicado = get(
      'SELECT id FROM incapacidades WHERE colaborador_id = ? AND numero_incapacidad = ?',
      [colaborador_id, String(numero_incapacidad).trim()]
    );

    if (duplicado) {
      errores.push('Ya existe una incapacidad con ese numero para el colaborador seleccionado.');
    }
  }

  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

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
        String(numero_incapacidad).trim(),
        colaborador_id,
        fecha_inicio,
        fecha_fin,
        numeroDiasCalculado,
        String(diagnostico_cie10).trim().toUpperCase(),
        String(entidad_emisora).trim(),
        tipo,
        null,
        observaciones?.trim() || null,
        created_by
      ]
    );
    const documentoAdjunto = guardarAdjunto({ incapacidadId: incapacidadResult.lastInsertRowid, adjunto });

    run('UPDATE incapacidades SET documento_adjunto = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      documentoAdjunto,
      incapacidadResult.lastInsertRowid
    ]);

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
        JSON.stringify({
          numero_incapacidad: String(numero_incapacidad).trim(),
          estado: 'Registrada',
          documento_adjunto: documentoAdjunto
        })
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
