import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { all, db, get, run, transaction } from '../db.js';

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
const estadosChecklist = ['Cumple', 'No cumple', 'Pendiente'];
const estadosIncapacidad = [
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
const transicionesValidas = Object.freeze({
  Registrada: ['En_Validacion'],
  En_Validacion: ['Transcrita'],
  Transcrita: ['Radicada'],
  Radicada: ['En_Revision_EPS'],
  En_Revision_EPS: ['Aprobada', 'Rechazada'],
  Aprobada: ['En_Cobro'],
  En_Cobro: ['Pagada', 'En_Conciliacion', 'Cobro_Juridico'],
  En_Conciliacion: ['Pagada', 'Cobro_Juridico'],
  Cobro_Juridico: ['Pagada', 'Cerrada_Sin_Pago'],
  Rechazada: ['Transcrita', 'Cobro_Juridico']
});
const estadosConJustificacionObligatoria = ['Rechazada', 'Cerrada_Sin_Pago'];
const checklistBase = [
  { clave: 'firma_medico', etiqueta: 'Firma medico' },
  { clave: 'sello_ips', etiqueta: 'Sello IPS' },
  { clave: 'fechas_coherentes', etiqueta: 'Fechas coherentes' },
  { clave: 'codigo_cie10_valido', etiqueta: 'CIE-10 valido' },
  { clave: 'numero_incapacidad_legible', etiqueta: 'Numero legible' }
];
const accidentes = ['ACCIDENTE_LABORAL', 'ACCIDENTE_TRANSITO'];
const licencias = ['LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD'];

let validacionesSchemaVerificado = false;
let transcripcionesSchemaVerificado = false;

function asegurarSchemaValidaciones() {
  if (validacionesSchemaVerificado) return;

  const columnas = db.prepare('PRAGMA table_info(validaciones)').all();
  const tieneChecklistDetalle = columnas.some((columna) => columna.name === 'checklist_detalle');

  if (!tieneChecklistDetalle) {
    run("ALTER TABLE validaciones ADD COLUMN checklist_detalle TEXT NOT NULL DEFAULT '[]'");
  }

  validacionesSchemaVerificado = true;
}

function asegurarSchemaTranscripciones() {
  if (transcripcionesSchemaVerificado) return;

  run(`
    CREATE TABLE IF NOT EXISTS transcripciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incapacidad_id INTEGER NOT NULL UNIQUE,
      codigo_cie10_detallado TEXT NOT NULL,
      tipo_licencia_medica TEXT NOT NULL,
      medico_tratante TEXT NOT NULL,
      numero_registro_medico TEXT NOT NULL,
      ips_institucion TEXT NOT NULL,
      auxiliar_id INTEGER,
      fecha_transcripcion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY (auxiliar_id) REFERENCES usuarios(id) ON UPDATE CASCADE
    )
  `);
  run('CREATE INDEX IF NOT EXISTS idx_transcripciones_incapacidad_id ON transcripciones (incapacidad_id)');

  transcripcionesSchemaVerificado = true;
}

function calcularDias(fechaInicio, fechaFin) {
  const inicio = new Date(`${fechaInicio}T00:00:00`);
  const fin = new Date(`${fechaFin}T00:00:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;

  return Math.floor((fin - inicio) / 86400000) + 1;
}

function validarCie10(codigo) {
  return /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/.test(String(codigo ?? '').trim().toUpperCase());
}

function sumarDias(fecha, dias) {
  const base = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;

  base.setDate(base.getDate() + Number(dias));
  return base.toISOString().slice(0, 10);
}

function construirChecklist(incapacidad) {
  const items = [...checklistBase];
  const requiereEpicrisis =
    Number(incapacidad.numero_dias) > 2 ||
    accidentes.includes(incapacidad.tipo) ||
    licencias.includes(incapacidad.tipo);

  if (requiereEpicrisis) {
    items.push({ clave: 'epicrisis_adjunta', etiqueta: 'Epicrisis adjunta' });
  }

  if (incapacidad.tipo === 'ACCIDENTE_TRANSITO') {
    items.push({ clave: 'furips_adjunto', etiqueta: 'FURIPS adjunto' });
  }

  if (incapacidad.tipo === 'LICENCIA_MATERNIDAD') {
    items.push(
      { clave: 'certificado_nacido_vivo', etiqueta: 'Certificado nacido vivo' },
      { clave: 'registro_civil', etiqueta: 'Registro civil' },
      { clave: 'fotocopia_documento_identidad', etiqueta: 'Fotocopia documento identidad' }
    );
  }

  if (incapacidad.tipo === 'LICENCIA_PATERNIDAD') {
    items.push(
      { clave: 'epicrisis_semanas_gestacion', etiqueta: 'Epicrisis semanas gestacion' },
      { clave: 'certificado_nacido_vivo', etiqueta: 'Certificado nacido vivo' },
      { clave: 'registro_civil', etiqueta: 'Registro civil' },
      { clave: 'fotocopia_documento_identidad_madre', etiqueta: 'Fotocopia documento identidad madre' }
    );
  }

  return items.map((item) => ({
    ...item,
    critico: true,
    estado: 'Pendiente',
    observacion: ''
  }));
}

function normalizarChecklist(incapacidad, itemsRecibidos = [], validacionExistente = null) {
  const plantilla = construirChecklist(incapacidad);
  let itemsGuardados = [];

  if (validacionExistente?.checklist_detalle) {
    try {
      itemsGuardados = JSON.parse(validacionExistente.checklist_detalle);
    } catch {
      itemsGuardados = [];
    }
  }

  const itemsFuente = Array.isArray(itemsRecibidos) && itemsRecibidos.length ? itemsRecibidos : itemsGuardados;

  return plantilla.map((item) => {
    const encontrado = itemsFuente.find((actual) => actual.clave === item.clave);
    const estado = estadosChecklist.includes(encontrado?.estado) ? encontrado.estado : item.estado;
    const observacion = String(encontrado?.observacion ?? '').trim();

    return {
      ...item,
      estado,
      observacion
    };
  });
}

function obtenerValidacion(incapacidadId) {
  asegurarSchemaValidaciones();
  return get('SELECT * FROM validaciones WHERE incapacidad_id = ?', [incapacidadId]);
}

function obtenerTranscripcion(incapacidadId) {
  asegurarSchemaTranscripciones();
  return get('SELECT * FROM transcripciones WHERE incapacidad_id = ?', [incapacidadId]);
}

function mapearChecklistABooleanos(items) {
  const cumple = (clave) => (items.find((item) => item.clave === clave)?.estado === 'Cumple' ? 1 : 0);

  return {
    firma_medico: cumple('firma_medico'),
    sello_ips: cumple('sello_ips'),
    fechas_coherentes: cumple('fechas_coherentes'),
    codigo_cie10_valido: cumple('codigo_cie10_valido'),
    numero_incapacidad_legible: cumple('numero_incapacidad_legible'),
    epicrisis_adjunta: cumple('epicrisis_adjunta'),
    furips_adjunto: cumple('furips_adjunto')
  };
}

function guardarValidacion({ incapacidadId, items, observacionGeneral, usuarioId, aprobada }) {
  asegurarSchemaValidaciones();

  const booleanos = mapearChecklistABooleanos(items);
  const existente = obtenerValidacion(incapacidadId);
  const valores = [
    booleanos.firma_medico,
    booleanos.sello_ips,
    booleanos.fechas_coherentes,
    booleanos.codigo_cie10_valido,
    booleanos.numero_incapacidad_legible,
    booleanos.epicrisis_adjunta,
    booleanos.furips_adjunto,
    JSON.stringify(items),
    observacionGeneral || null,
    aprobada ? usuarioId : null,
    aprobada ? new Date().toISOString() : null
  ];

  if (existente) {
    run(
      `
        UPDATE validaciones
        SET
          firma_medico = ?,
          sello_ips = ?,
          fechas_coherentes = ?,
          codigo_cie10_valido = ?,
          numero_incapacidad_legible = ?,
          epicrisis_adjunta = ?,
          furips_adjunto = ?,
          checklist_detalle = ?,
          observaciones = ?,
          aprobada_por = COALESCE(?, aprobada_por),
          fecha_validacion = COALESCE(?, fecha_validacion),
          updated_at = CURRENT_TIMESTAMP
        WHERE incapacidad_id = ?
      `,
      [...valores, incapacidadId]
    );
    return;
  }

  run(
    `
      INSERT INTO validaciones (
        incapacidad_id,
        firma_medico,
        sello_ips,
        fechas_coherentes,
        codigo_cie10_valido,
        numero_incapacidad_legible,
        epicrisis_adjunta,
        furips_adjunto,
        checklist_detalle,
        observaciones,
        aprobada_por,
        fecha_validacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [incapacidadId, ...valores]
  );
}

function obtenerFaltantesCriticos(items) {
  return items
    .filter((item) => item.critico && item.estado !== 'Cumple')
    .map((item) => item.etiqueta);
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

function guardarAdjunto({ incapacidadId, adjunto, prefijo = 'soporte' }) {
  const carpeta = path.join(backendDir, 'uploads', 'incapacidades', String(incapacidadId));
  const nombreArchivo = `${prefijo}-${Date.now()}${adjunto.extension}`;
  const rutaDisco = path.join(carpeta, nombreArchivo);
  const rutaPublica = `/uploads/incapacidades/${incapacidadId}/${nombreArchivo}`;

  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(rutaDisco, adjunto.buffer);

  return rutaPublica;
}

function cambiarEstadoIncapacidad({ incapacidadId, estadoNuevo, usuarioId, justificacion }) {
  const incapacidad = obtenerIncapacidad(incapacidadId);

  run('UPDATE estados SET es_estado_actual = 0, updated_at = CURRENT_TIMESTAMP WHERE incapacidad_id = ?', [
    incapacidadId
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
    [incapacidadId, estadoNuevo, usuarioId, justificacion]
  );

  run('UPDATE incapacidades SET estado_actual_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    estadoResult.lastInsertRowid,
    incapacidadId
  ]);

  return {
    estadoAnterior: incapacidad?.estado_actual ?? null,
    estadoNuevo
  };
}

function obtenerTransicionesValidas(estadoActual) {
  return transicionesValidas[estadoActual] ?? [];
}

function validarCambioEstado({ estadoActual, estadoNuevo, justificacion, esManual = false }) {
  const errores = [];
  const estadoDestino = String(estadoNuevo ?? '').trim();
  const justificacionNormalizada = String(justificacion ?? '').trim();

  if (!estadosIncapacidad.includes(estadoDestino)) {
    errores.push('El estado destino no es valido.');
  }

  const transiciones = obtenerTransicionesValidas(estadoActual);
  if (estadoDestino && !transiciones.includes(estadoDestino)) {
    errores.push(`No se permite cambiar de ${estadoActual} a ${estadoDestino}.`);
  }

  if ((esManual || estadosConJustificacionObligatoria.includes(estadoDestino)) && !justificacionNormalizada) {
    errores.push('La justificacion es obligatoria para este cambio de estado.');
  }

  return {
    errores,
    estadoDestino,
    justificacionNormalizada
  };
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
        ea.plazo_respuesta_dias AS plazo_respuesta_dias,
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
      SELECT
        e.*,
        u.nombre_completo AS usuario_nombre
      FROM estados e
      LEFT JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.incapacidad_id = ?
      ORDER BY e.fecha_cambio ASC, e.id ASC
    `,
    [req.params.id]
  );

  return res.json({
    ...incapacidad,
    estados,
    transiciones_validas: obtenerTransicionesValidas(incapacidad.estado_actual)
  });
});

router.get('/:id/validacion', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const validacion = obtenerValidacion(req.params.id);
  const checklist = normalizarChecklist(incapacidad, [], validacion);

  return res.json({
    incapacidad,
    validacion: validacion
      ? {
          ...validacion,
          checklist_detalle: checklist
        }
      : {
          incapacidad_id: Number(req.params.id),
          checklist_detalle: checklist,
          observaciones: ''
        }
  });
});

router.get('/:id/transcripcion', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const transcripcion = obtenerTranscripcion(req.params.id);

  return res.json({
    incapacidad,
    disponible: incapacidad.estado_actual === 'En_Validacion',
    transcripcion: transcripcion ?? {
      incapacidad_id: Number(req.params.id),
      codigo_cie10_detallado: incapacidad.diagnostico_cie10 ?? '',
      tipo_licencia_medica: incapacidad.tipo ? String(incapacidad.tipo).replaceAll('_', ' ') : '',
      medico_tratante: '',
      numero_registro_medico: '',
      ips_institucion: incapacidad.entidad_emisora ?? ''
    }
  });
});

router.put('/:id/transcripcion', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  if (incapacidad.estado_actual !== 'En_Validacion') {
    return res.status(409).json({
      error: `La transcripcion solo aplica a incapacidades En_Validacion. Estado actual: ${incapacidad.estado_actual}.`
    });
  }

  const {
    codigo_cie10_detallado,
    tipo_licencia_medica,
    medico_tratante,
    numero_registro_medico,
    ips_institucion,
    usuario_id = 1
  } = req.body;
  const errores = [];
  const cie10 = String(codigo_cie10_detallado ?? '').trim().toUpperCase();

  if (!cie10) errores.push('El codigo CIE-10 detallado es obligatorio.');
  if (cie10 && !validarCie10(cie10)) errores.push('El codigo CIE-10 detallado debe tener formato valido.');
  if (!String(tipo_licencia_medica ?? '').trim()) errores.push('El tipo de licencia medica es obligatorio.');
  if (!String(medico_tratante ?? '').trim()) errores.push('El nombre del medico tratante es obligatorio.');
  if (!String(numero_registro_medico ?? '').trim()) errores.push('El numero de registro medico es obligatorio.');
  if (!String(ips_institucion ?? '').trim()) errores.push('La IPS o institucion es obligatoria.');

  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  const guardarTranscripcion = transaction(() => {
    asegurarSchemaTranscripciones();

    const existente = obtenerTranscripcion(req.params.id);
    if (existente) {
      run(
        `
          UPDATE transcripciones
          SET
            codigo_cie10_detallado = ?,
            tipo_licencia_medica = ?,
            medico_tratante = ?,
            numero_registro_medico = ?,
            ips_institucion = ?,
            auxiliar_id = ?,
            fecha_transcripcion = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE incapacidad_id = ?
        `,
        [
          cie10,
          String(tipo_licencia_medica).trim(),
          String(medico_tratante).trim(),
          String(numero_registro_medico).trim(),
          String(ips_institucion).trim(),
          usuario_id,
          req.params.id
        ]
      );
    } else {
      run(
        `
          INSERT INTO transcripciones (
            incapacidad_id,
            codigo_cie10_detallado,
            tipo_licencia_medica,
            medico_tratante,
            numero_registro_medico,
            ips_institucion,
            auxiliar_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          req.params.id,
          cie10,
          String(tipo_licencia_medica).trim(),
          String(medico_tratante).trim(),
          String(numero_registro_medico).trim(),
          String(ips_institucion).trim(),
          usuario_id
        ]
      );
    }

    const cambio = cambiarEstadoIncapacidad({
      incapacidadId: req.params.id,
      estadoNuevo: 'Transcrita',
      usuarioId: usuario_id,
      justificacion: 'Transcripcion de incapacidad completada.'
    });

    run(
      `
        INSERT INTO auditorias (
          usuario_id,
          accion,
          entidad_afectada,
          entidad_id,
          detalle,
          ip_address
        ) VALUES (?, 'TRANSCRIBIR_INCAPACIDAD', 'incapacidades', ?, ?, NULL)
      `,
      [
        usuario_id,
        req.params.id,
        JSON.stringify({
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          codigo_cie10_detallado: cie10,
          ips_institucion: String(ips_institucion).trim()
        })
      ]
    );

    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      transcripcion: obtenerTranscripcion(req.params.id)
    };
  });

  return res.json(guardarTranscripcion());
});

router.get('/:id/radicacion', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const radicacion = get('SELECT * FROM radicaciones WHERE incapacidad_id = ?', [req.params.id]);

  return res.json({
    incapacidad,
    disponible: incapacidad.estado_actual === 'Transcrita',
    radicacion,
    plazo_respuesta_dias: incapacidad.plazo_respuesta_dias
  });
});

router.put('/:id/radicacion', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  if (incapacidad.estado_actual !== 'Transcrita') {
    return res.status(409).json({
      error: `La radicacion solo aplica a incapacidades Transcrita. Estado actual: ${incapacidad.estado_actual}.`
    });
  }

  const {
    numero_radicado,
    fecha_radicacion,
    canal,
    funcionario_eps_receptor = '',
    comprobante_adjunto_data,
    usuario_id = 1
  } = req.body;
  const canales = ['presencial', 'virtual', 'correo'];
  const errores = [];
  const numeroRadicado = String(numero_radicado ?? '').trim();
  const adjunto = normalizarAdjunto(comprobante_adjunto_data);
  const fechaLimite = sumarDias(fecha_radicacion, incapacidad.plazo_respuesta_dias);

  if (!numeroRadicado) errores.push('El numero radicado es obligatorio.');
  if (!fecha_radicacion) errores.push('La fecha de radicacion es obligatoria.');
  if (fecha_radicacion && !fechaLimite) errores.push('La fecha de radicacion no tiene un formato valido.');
  if (!canales.includes(canal)) errores.push('El canal de radicacion no es valido.');
  if (adjunto.error) errores.push(adjunto.error.replace('adjunto', 'comprobante adjunto'));

  const duplicado = numeroRadicado
    ? get('SELECT id FROM radicaciones WHERE numero_radicado = ? AND incapacidad_id <> ?', [
        numeroRadicado,
        req.params.id
      ])
    : null;

  if (duplicado) errores.push('Ya existe una radicacion con ese numero radicado.');

  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  const radicarIncapacidad = transaction(() => {
    const comprobanteAdjunto = guardarAdjunto({
      incapacidadId: req.params.id,
      adjunto,
      prefijo: 'radicacion'
    });

    const existente = get('SELECT id FROM radicaciones WHERE incapacidad_id = ?', [req.params.id]);
    if (existente) {
      run(
        `
          UPDATE radicaciones
          SET
            numero_radicado = ?,
            fecha_radicacion = ?,
            canal = ?,
            funcionario_eps_receptor = ?,
            comprobante_adjunto = ?,
            fecha_limite_respuesta_eps = ?,
            auxiliar_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE incapacidad_id = ?
        `,
        [
          numeroRadicado,
          fecha_radicacion,
          canal,
          String(funcionario_eps_receptor).trim() || null,
          comprobanteAdjunto,
          fechaLimite,
          usuario_id,
          req.params.id
        ]
      );
    } else {
      run(
        `
          INSERT INTO radicaciones (
            incapacidad_id,
            numero_radicado,
            fecha_radicacion,
            canal,
            funcionario_eps_receptor,
            comprobante_adjunto,
            fecha_limite_respuesta_eps,
            auxiliar_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          req.params.id,
          numeroRadicado,
          fecha_radicacion,
          canal,
          String(funcionario_eps_receptor).trim() || null,
          comprobanteAdjunto,
          fechaLimite,
          usuario_id
        ]
      );
    }

    const cambio = cambiarEstadoIncapacidad({
      incapacidadId: req.params.id,
      estadoNuevo: 'Radicada',
      usuarioId: usuario_id,
      justificacion: 'Radicacion de incapacidad confirmada ante EPS/ARL.'
    });

    run(
      `
        INSERT INTO seguimientos (
          incapacidad_id,
          fecha_contacto,
          canal_contacto,
          resultado_gestion,
          proximo_paso,
          auxiliar_id
        ) VALUES (?, ?, 'sistema', ?, ?, ?)
      `,
      [
        req.params.id,
        fechaLimite,
        `Alerta automatica: vence plazo de respuesta de ${incapacidad.eps_arl_nombre}.`,
        'Realizar seguimiento a respuesta de EPS/ARL.',
        usuario_id
      ]
    );

    run(
      `
        INSERT INTO auditorias (
          usuario_id,
          accion,
          entidad_afectada,
          entidad_id,
          detalle,
          ip_address
        ) VALUES (?, 'RADICAR_INCAPACIDAD', 'incapacidades', ?, ?, NULL)
      `,
      [
        usuario_id,
        req.params.id,
        JSON.stringify({
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          numero_radicado: numeroRadicado,
          fecha_radicacion,
          fecha_limite_respuesta: fechaLimite,
          eps_arl: incapacidad.eps_arl_nombre,
          plazo_respuesta_dias: incapacidad.plazo_respuesta_dias
        })
      ]
    );

    const radicacion = get('SELECT * FROM radicaciones WHERE incapacidad_id = ?', [req.params.id]);

    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      radicacion: {
        ...radicacion,
        fecha_limite_respuesta: radicacion.fecha_limite_respuesta_eps
      }
    };
  });

  return res.json(radicarIncapacidad());
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

router.put('/:id/validacion', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  if (!['Registrada', 'En_Validacion'].includes(incapacidad.estado_actual)) {
    return res.status(409).json({
      error: `La validacion documental solo aplica a incapacidades Registrada o En_Validacion. Estado actual: ${incapacidad.estado_actual}.`
    });
  }

  const { checklist = [], observaciones = '', usuario_id = 1 } = req.body;
  const validacionExistente = obtenerValidacion(req.params.id);
  const items = normalizarChecklist(incapacidad, checklist, validacionExistente);

  guardarValidacion({
    incapacidadId: req.params.id,
    items,
    observacionGeneral: String(observaciones ?? '').trim(),
    usuarioId: usuario_id,
    aprobada: false
  });

  run(
    `
      INSERT INTO auditorias (
        usuario_id,
        accion,
        entidad_afectada,
        entidad_id,
        detalle,
        ip_address
      ) VALUES (?, 'GUARDAR_VALIDACION_DOCUMENTAL', 'validaciones', ?, ?, NULL)
    `,
    [
      usuario_id,
      req.params.id,
      JSON.stringify({ estados: items.map((item) => ({ clave: item.clave, estado: item.estado })) })
    ]
  );

  return res.json({ checklist_detalle: items, observaciones: String(observaciones ?? '').trim() });
});

router.put('/:id/validacion/aprobar', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  if (!['Registrada', 'En_Validacion'].includes(incapacidad.estado_actual)) {
    return res.status(409).json({
      error: `La validacion documental solo aplica a incapacidades Registrada o En_Validacion. Estado actual: ${incapacidad.estado_actual}.`
    });
  }

  const { checklist = [], observaciones = '', usuario_id = 1 } = req.body;
  const validacionExistente = obtenerValidacion(req.params.id);
  const items = normalizarChecklist(incapacidad, checklist, validacionExistente);
  const faltantes = obtenerFaltantesCriticos(items);

  const aprobarValidacion = transaction(() => {
    guardarValidacion({
      incapacidadId: req.params.id,
      items,
      observacionGeneral: String(observaciones ?? '').trim(),
      usuarioId: usuario_id,
      aprobada: faltantes.length === 0
    });

    if (faltantes.length) {
      run(
        `
          INSERT INTO auditorias (
            usuario_id,
            accion,
            entidad_afectada,
            entidad_id,
            detalle,
            ip_address
          ) VALUES (?, 'VALIDACION_DOCUMENTAL_BLOQUEADA', 'incapacidades', ?, ?, NULL)
        `,
        [
          usuario_id,
          req.params.id,
          JSON.stringify({ estado_permanece: incapacidad.estado_actual, faltantes })
        ]
      );

      return { aprobada: false, faltantes };
    }

    if (incapacidad.estado_actual !== 'En_Validacion') {
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
          ) VALUES (?, 'En_Validacion', ?, 'Validacion documental aprobada.', 1)
        `,
        [req.params.id, usuario_id]
      );

      run('UPDATE incapacidades SET estado_actual_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        estadoResult.lastInsertRowid,
        req.params.id
      ]);
    }

    run(
      `
        INSERT INTO auditorias (
          usuario_id,
          accion,
          entidad_afectada,
          entidad_id,
          detalle,
          ip_address
        ) VALUES (?, 'APROBAR_VALIDACION_DOCUMENTAL', 'incapacidades', ?, ?, NULL)
      `,
      [
        usuario_id,
        req.params.id,
        JSON.stringify({
          estado_anterior: incapacidad.estado_actual,
          estado_nuevo: 'En_Validacion',
          checklist: items.map((item) => ({ clave: item.clave, estado: item.estado }))
        })
      ]
    );

    return { aprobada: true, incapacidad: obtenerIncapacidad(req.params.id) };
  });

  const resultado = aprobarValidacion();

  if (!resultado.aprobada) {
    return res.status(400).json({
      error: 'No es posible aprobar la validacion. Hay items criticos sin cumplir.',
      faltantes: resultado.faltantes,
      estado_permanece: incapacidad.estado_actual
    });
  }

  return res.json(resultado);
});

router.patch('/:id/estado', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const { estado, usuario_id = 1, justificacion = '' } = req.body;
  const validacion = validarCambioEstado({
    estadoActual: incapacidad.estado_actual,
    estadoNuevo: estado,
    justificacion,
    esManual: true
  });

  if (validacion.errores.length) {
    return res.status(400).json({
      error: validacion.errores.join(' '),
      estado_actual: incapacidad.estado_actual,
      transiciones_validas: obtenerTransicionesValidas(incapacidad.estado_actual)
    });
  }

  const cambiarEstado = transaction(() => {
    const cambio = cambiarEstadoIncapacidad({
      incapacidadId: req.params.id,
      estadoNuevo: validacion.estadoDestino,
      usuarioId: usuario_id,
      justificacion: validacion.justificacionNormalizada
    });

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
        JSON.stringify({
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          justificacion: validacion.justificacionNormalizada,
          origen: 'manual'
        })
      ]
    );

    const actualizada = obtenerIncapacidad(req.params.id);
    const estados = all(
      `
        SELECT
          e.*,
          u.nombre_completo AS usuario_nombre
        FROM estados e
        LEFT JOIN usuarios u ON u.id = e.usuario_id
        WHERE e.incapacidad_id = ?
        ORDER BY e.fecha_cambio ASC, e.id ASC
      `,
      [req.params.id]
    );

    return {
      ...actualizada,
      estados,
      transiciones_validas: obtenerTransicionesValidas(actualizada.estado_actual)
    };
  });

  return res.json(cambiarEstado());
});

export default router;
