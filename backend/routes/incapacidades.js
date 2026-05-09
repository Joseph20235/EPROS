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
let excepcionesSchemaVerificado = false;

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

function columnaExiste(tabla, columna) {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().some((item) => item.name === columna);
}

function asegurarSchemaExcepciones() {
  if (excepcionesSchemaVerificado) return;

  const columnasRechazos = db.prepare('PRAGMA table_info(rechazos)').all();
  const accionRequerida = columnasRechazos.some((columna) => columna.name === 'accion_seleccionada' && columna.notnull === 1);

  if (accionRequerida) {
    run(`
      CREATE TABLE IF NOT EXISTS rechazos_nueva (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incapacidad_id INTEGER NOT NULL UNIQUE,
        motivo_codigo TEXT NOT NULL,
        motivo_descripcion TEXT NOT NULL,
        fecha_notificacion TEXT NOT NULL,
        codigo_rechazo TEXT,
        observaciones TEXT,
        documento_notificacion TEXT,
        accion_seleccionada TEXT CHECK (accion_seleccionada IS NULL OR accion_seleccionada IN ('re_radicar', 'impugnar', 'cobro_juridico')),
        decision_fecha TEXT,
        plazo_impugnacion TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    run(`
      INSERT OR IGNORE INTO rechazos_nueva (
        id,
        incapacidad_id,
        motivo_codigo,
        motivo_descripcion,
        fecha_notificacion,
        documento_notificacion,
        accion_seleccionada,
        created_at,
        updated_at
      )
      SELECT
        id,
        incapacidad_id,
        motivo_codigo,
        motivo_descripcion,
        fecha_notificacion,
        documento_notificacion,
        accion_seleccionada,
        created_at,
        updated_at
      FROM rechazos
    `);
    run('DROP TABLE rechazos');
    run('ALTER TABLE rechazos_nueva RENAME TO rechazos');
  }

  if (!columnaExiste('rechazos', 'codigo_rechazo')) run('ALTER TABLE rechazos ADD COLUMN codigo_rechazo TEXT');
  if (!columnaExiste('rechazos', 'observaciones')) run('ALTER TABLE rechazos ADD COLUMN observaciones TEXT');
  if (!columnaExiste('rechazos', 'decision_fecha')) run('ALTER TABLE rechazos ADD COLUMN decision_fecha TEXT');
  if (!columnaExiste('rechazos', 'plazo_impugnacion')) run('ALTER TABLE rechazos ADD COLUMN plazo_impugnacion TEXT');
  if (!columnaExiste('conciliaciones', 'gestiones')) {
    run("ALTER TABLE conciliaciones ADD COLUMN gestiones TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columnaExiste('conciliaciones', 'resultado')) run('ALTER TABLE conciliaciones ADD COLUMN resultado TEXT');
  if (!columnaExiste('cobros_juridicos', 'motivo_cierre')) run('ALTER TABLE cobros_juridicos ADD COLUMN motivo_cierre TEXT');

  excepcionesSchemaVerificado = true;
}

function asegurarSchemaAlertasProlongadas() {
  run(`
    CREATE TABLE IF NOT EXISTS alertas_prolongadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      colaborador_id INTEGER NOT NULL UNIQUE,
      incapacidad_principal_id INTEGER NOT NULL,
      eps_arl_id INTEGER NOT NULL,
      nivel_alerta INTEGER NOT NULL CHECK (nivel_alerta BETWEEN 1 AND 5),
      dias_acumulados INTEGER NOT NULL CHECK (dias_acumulados >= 0),
      dias_ultimos_3_anios INTEGER NOT NULL DEFAULT 0 CHECK (dias_ultimos_3_anios >= 0),
      diagnostico_principal TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'reprogramada', 'cerrada')),
      proximo_hito TEXT,
      fecha_generacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ultima_ejecucion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON UPDATE CASCADE,
      FOREIGN KEY (incapacidad_principal_id) REFERENCES incapacidades(id) ON UPDATE CASCADE,
      FOREIGN KEY (eps_arl_id) REFERENCES eps_arl(id) ON UPDATE CASCADE
    )
  `);
  run(`
    CREATE TABLE IF NOT EXISTS acciones_alerta_prolongada (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alerta_id INTEGER NOT NULL,
      incapacidad_id INTEGER NOT NULL,
      tipo_accion TEXT NOT NULL,
      fecha TEXT NOT NULL,
      responsable TEXT NOT NULL,
      observaciones TEXT,
      proximo_hito TEXT NOT NULL,
      usuario_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (alerta_id) REFERENCES alertas_prolongadas(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE
    )
  `);
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

function fechaActualIso() {
  return new Date().toISOString().slice(0, 10);
}

function parsearJsonArray(valor) {
  try {
    const datos = JSON.parse(valor ?? '[]');
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
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
        c.salario_base AS salario_base,
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

function redondearPesos(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function calcularCobroIncapacidad(incapacidad) {
  const dias = Number(incapacidad.numero_dias);
  const salarioBase = Number(incapacidad.salario_base);
  const ibcDia = salarioBase / 30;
  const esArl =
    incapacidad.tipo === 'ARL' ||
    incapacidad.tipo === 'ACCIDENTE_LABORAL' ||
    incapacidad.eps_arl_tipo === 'ARL';

  if (!Number.isFinite(dias) || dias <= 0 || !Number.isFinite(salarioBase) || salarioBase < 0) {
    return {
      valor_calculado: 0,
      salario_base: salarioBase || 0,
      ibc_dia: 0,
      es_arl: esArl,
      desglose: [],
      alertas: ['No fue posible calcular el cobro con los datos actuales.']
    };
  }

  if (esArl) {
    const valor = redondearPesos(dias * ibcDia);

    return {
      valor_calculado: valor,
      salario_base: salarioBase,
      ibc_dia: redondearPesos(ibcDia),
      es_arl: true,
      desglose: [
        {
          tramo: 'ARL dia 1 en adelante',
          dias,
          porcentaje: 1,
          valor
        }
      ],
      alertas: []
    };
  }

  const diasEmpresa = Math.min(dias, 2);
  const diasEps67 = Math.max(Math.min(dias, 90) - 2, 0);
  const diasEps50 = Math.max(Math.min(dias, 180) - 90, 0);
  const diasNoCobrables = Math.max(dias - 180, 0);
  const valorEps67 = redondearPesos(diasEps67 * ibcDia * 0.67);
  const valorEps50 = redondearPesos(diasEps50 * ibcDia * 0.5);
  const alertas = [];

  if (diasNoCobrables > 0) {
    alertas.push(`${diasNoCobrables} dia(s) superan el dia 180 y no aplican para cobro a EPS.`);
  }

  return {
    valor_calculado: redondearPesos(valorEps67 + valorEps50),
    salario_base: salarioBase,
    ibc_dia: redondearPesos(ibcDia),
    es_arl: false,
    desglose: [
      {
        tramo: 'Dias 1 a 2 - empresa',
        dias: diasEmpresa,
        porcentaje: 1,
        valor: redondearPesos(diasEmpresa * ibcDia),
        excluido_cobro_eps: true
      },
      {
        tramo: 'Dias 3 a 90 - EPS 67%',
        dias: diasEps67,
        porcentaje: 0.67,
        valor: valorEps67
      },
      {
        tramo: 'Dias 91 a 180 - EPS 50%',
        dias: diasEps50,
        porcentaje: 0.5,
        valor: valorEps50
      },
      {
        tramo: 'Dias 181 en adelante - AFP',
        dias: diasNoCobrables,
        porcentaje: 0,
        valor: 0,
        excluido_cobro_eps: true
      }
    ],
    alertas
  };
}

function obtenerCobroActual(incapacidadId) {
  return get(
    `
      SELECT *
      FROM cobros
      WHERE incapacidad_id = ?
      ORDER BY fecha_cobro DESC, id DESC
      LIMIT 1
    `,
    [incapacidadId]
  );
}

function cobroVencido(cobro) {
  if (!cobro?.fecha_cobro) return false;
  const fechaCobro = new Date(`${cobro.fecha_cobro}T00:00:00`);
  if (Number.isNaN(fechaCobro.getTime())) return false;

  const limite = new Date(fechaCobro);
  limite.setDate(limite.getDate() + 180);
  return limite <= new Date();
}

function obtenerValorCobrado(cobro) {
  return Number(cobro.valor_ajustado ?? cobro.valor_calculado);
}

function construirFiltrosHistorial(query) {
  const filtros = [];
  const params = [];
  const colaborador = String(query.colaborador ?? '').trim();
  const fechaInicio = String(query.fecha_inicio ?? '').trim();
  const fechaFin = String(query.fecha_fin ?? '').trim();
  const estado = String(query.estado ?? '').trim();
  const tipo = String(query.tipo ?? '').trim();
  const epsArlId = String(query.eps_arl_id ?? '').trim();
  const area = String(query.area ?? '').trim();

  if (colaborador) {
    filtros.push('(c.nombre_completo LIKE ? OR c.numero_identificacion LIKE ?)');
    params.push(`%${colaborador}%`, `%${colaborador}%`);
  }

  if (fechaInicio) {
    filtros.push('i.fecha_inicio >= ?');
    params.push(fechaInicio);
  }

  if (fechaFin) {
    filtros.push('i.fecha_fin <= ?');
    params.push(fechaFin);
  }

  if (estado && estadosIncapacidad.includes(estado)) {
    filtros.push('e.estado = ?');
    params.push(estado);
  }

  if (tipo && tiposIncapacidad.includes(tipo)) {
    filtros.push('i.tipo = ?');
    params.push(tipo);
  }

  if (epsArlId) {
    filtros.push('ea.id = ?');
    params.push(epsArlId);
  }

  if (area) {
    filtros.push('c.area LIKE ?');
    params.push(`%${area}%`);
  }

  return {
    where: filtros.length ? `WHERE ${filtros.join(' AND ')}` : '',
    params
  };
}

function consultaHistorialBase(where) {
  return `
    SELECT
      i.id,
      i.numero_incapacidad,
      i.colaborador_id,
      c.nombre_completo AS colaborador_nombre,
      c.numero_identificacion AS colaborador_identificacion,
      c.area AS colaborador_area,
      ea.id AS eps_arl_id,
      ea.nombre AS eps_arl_nombre,
      ea.tipo AS eps_arl_tipo,
      i.fecha_inicio,
      i.fecha_fin,
      i.numero_dias,
      i.diagnostico_cie10,
      i.tipo,
      e.estado AS estado_actual,
      i.created_at
    FROM incapacidades i
    JOIN colaboradores c ON c.id = i.colaborador_id
    JOIN eps_arl ea ON ea.id = c.eps_arl_id
    LEFT JOIN estados e ON e.id = i.estado_actual_id
    ${where}
  `;
}

function escaparCsv(valor) {
  const texto = String(valor ?? '');
  return `"${texto.replaceAll('"', '""')}"`;
}

function obtenerExpedienteCompleto(incapacidadId) {
  const incapacidad = obtenerIncapacidad(incapacidadId);

  if (!incapacidad) return null;

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
    [incapacidadId]
  );
  const seguimientos = all(
    `
      SELECT
        s.*,
        u.nombre_completo AS auxiliar_nombre
      FROM seguimientos s
      LEFT JOIN usuarios u ON u.id = s.auxiliar_id
      WHERE s.incapacidad_id = ?
      ORDER BY s.fecha_contacto DESC, s.id DESC
    `,
    [incapacidadId]
  );
  const cobros = all(
    `
      SELECT
        c.*,
        COALESCE(c.valor_ajustado, c.valor_calculado) AS valor_cobrado
      FROM cobros c
      WHERE c.incapacidad_id = ?
      ORDER BY c.fecha_cobro DESC, c.id DESC
    `,
    [incapacidadId]
  );
  const pagos = all(
    `
      SELECT
        p.*,
        c.incapacidad_id,
        c.fecha_cobro
      FROM pagos p
      JOIN cobros c ON c.id = p.cobro_id
      WHERE c.incapacidad_id = ?
      ORDER BY p.fecha_pago DESC, p.id DESC
    `,
    [incapacidadId]
  );
  const radicacion = get('SELECT * FROM radicaciones WHERE incapacidad_id = ?', [incapacidadId]);
  const validacion = get('SELECT * FROM validaciones WHERE incapacidad_id = ?', [incapacidadId]);
  const transcripcion = get('SELECT * FROM transcripciones WHERE incapacidad_id = ?', [incapacidadId]);
  const rechazo = get('SELECT * FROM rechazos WHERE incapacidad_id = ?', [incapacidadId]);
  const conciliacion = get('SELECT * FROM conciliaciones WHERE incapacidad_id = ?', [incapacidadId]);
  const cobroJuridico = get('SELECT * FROM cobros_juridicos WHERE incapacidad_id = ?', [incapacidadId]);
  asegurarSchemaAlertasProlongadas();
  const accionesAlerta = all(
    `
      SELECT
        aa.*,
        ap.nivel_alerta,
        ap.dias_acumulados,
        u.nombre_completo AS usuario_nombre
      FROM acciones_alerta_prolongada aa
      JOIN alertas_prolongadas ap ON ap.id = aa.alerta_id
      LEFT JOIN usuarios u ON u.id = aa.usuario_id
      WHERE aa.incapacidad_id = ?
      ORDER BY aa.fecha DESC, aa.id DESC
    `,
    [incapacidadId]
  );
  const documentos = [
    { etiqueta: 'Incapacidad original', url: incapacidad.documento_adjunto },
    { etiqueta: 'Comprobante de radicacion', url: radicacion?.comprobante_adjunto },
    ...cobros.map((cobro, indice) => ({
      etiqueta: `Cuenta de cobro ${indice + 1}`,
      url: cobro.documento_cuenta_cobro
    })),
    ...pagos.map((pago, indice) => ({
      etiqueta: `Comprobante de pago ${indice + 1}`,
      url: pago.comprobante_adjunto
    })),
    { etiqueta: 'Notificacion de rechazo', url: rechazo?.documento_notificacion },
    { etiqueta: 'Soporte conciliacion', url: conciliacion?.documentos_soporte }
  ].filter((documento) => documento.url);

  return {
    ...incapacidad,
    estados,
    seguimientos,
    cobros,
    pagos,
    radicacion,
    validacion,
    transcripcion,
    rechazo,
    conciliacion,
    cobro_juridico: cobroJuridico,
    acciones_alerta: accionesAlerta,
    documentos,
    transiciones_validas: obtenerTransicionesValidas(incapacidad.estado_actual)
  };
}

router.get('/historial', (req, res) => {
  const pagina = Math.max(Number.parseInt(req.query.pagina ?? '1', 10), 1);
  const limite = 20;
  const offset = (pagina - 1) * limite;
  const { where, params } = construirFiltrosHistorial(req.query);
  const total = get(
    `
      SELECT COUNT(*) AS total
      FROM incapacidades i
      JOIN colaboradores c ON c.id = i.colaborador_id
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
      LEFT JOIN estados e ON e.id = i.estado_actual_id
      ${where}
    `,
    params
  ).total;
  const registros = all(
    `
      ${consultaHistorialBase(where)}
      ORDER BY i.fecha_inicio DESC, i.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limite, offset]
  );

  res.json({
    data: registros,
    pagination: {
      pagina,
      limite,
      total,
      total_paginas: Math.max(Math.ceil(total / limite), 1)
    }
  });
});

router.get('/historial/exportar', (req, res) => {
  const { where, params } = construirFiltrosHistorial(req.query);
  const registros = all(
    `
      ${consultaHistorialBase(where)}
      ORDER BY i.fecha_inicio DESC, i.id DESC
    `,
    params
  );
  const encabezados = [
    'Numero incapacidad',
    'Colaborador',
    'Identificacion',
    'Area',
    'EPS/ARL',
    'Fecha inicio',
    'Fecha fin',
    'Dias',
    'Estado',
    'Tipo',
    'CIE-10'
  ];
  const filas = registros.map((registro) => [
    registro.numero_incapacidad,
    registro.colaborador_nombre,
    registro.colaborador_identificacion,
    registro.colaborador_area,
    registro.eps_arl_nombre,
    registro.fecha_inicio,
    registro.fecha_fin,
    registro.numero_dias,
    registro.estado_actual,
    registro.tipo,
    registro.diagnostico_cie10
  ]);
  const csv = [encabezados, ...filas].map((fila) => fila.map(escaparCsv).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="historial-incapacidades.csv"');
  res.send(`\uFEFF${csv}`);
});

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
  const incapacidad = obtenerExpedienteCompleto(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  return res.json(incapacidad);
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

router.get('/:id/cobro', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const calculo = calcularCobroIncapacidad(incapacidad);
  const cobro = obtenerCobroActual(req.params.id);

  return res.json({
    incapacidad,
    disponible: incapacidad.estado_actual === 'Aprobada',
    calculo,
    cobro
  });
});

router.post('/:id/cobro', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  if (incapacidad.estado_actual !== 'Aprobada') {
    return res.status(409).json({
      error: `El cobro solo aplica a incapacidades Aprobada. Estado actual: ${incapacidad.estado_actual}.`
    });
  }

  const { valor_ajustado = null, justificacion_ajuste = '', usuario_id = 1 } = req.body;
  const calculo = calcularCobroIncapacidad(incapacidad);
  const errores = [];
  const ajusteFueEnviado = valor_ajustado !== null && valor_ajustado !== undefined && valor_ajustado !== '';
  const valorAjustado = ajusteFueEnviado ? Number(valor_ajustado) : null;
  const justificacionAjuste = String(justificacion_ajuste ?? '').trim();
  const hayAjusteManual = ajusteFueEnviado && Math.abs(valorAjustado - calculo.valor_calculado) > 1;

  if (ajusteFueEnviado && (!Number.isFinite(valorAjustado) || valorAjustado < 0)) {
    errores.push('El valor ajustado debe ser un numero mayor o igual a cero.');
  }

  if (hayAjusteManual && !justificacionAjuste) {
    errores.push('La justificacion del ajuste es obligatoria cuando el valor manual difiere del calculado.');
  }

  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  const registrarCobro = transaction(() => {
    const cobroResult = run(
      `
        INSERT INTO cobros (
          incapacidad_id,
          valor_calculado,
          valor_ajustado,
          justificacion_ajuste,
          fecha_cobro,
          documento_cuenta_cobro,
          estado
        ) VALUES (?, ?, ?, ?, DATE('now'), NULL, 'En_Proceso')
      `,
      [
        req.params.id,
        calculo.valor_calculado,
        hayAjusteManual ? redondearPesos(valorAjustado) : null,
        hayAjusteManual ? justificacionAjuste : null
      ]
    );

    const cambio = cambiarEstadoIncapacidad({
      incapacidadId: req.params.id,
      estadoNuevo: 'En_Cobro',
      usuarioId: usuario_id,
      justificacion: 'Cuenta de cobro registrada para gestion ante EPS/ARL.'
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
        ) VALUES (?, 'REGISTRAR_COBRO', 'cobros', ?, ?, NULL)
      `,
      [
        usuario_id,
        cobroResult.lastInsertRowid,
        JSON.stringify({
          incapacidad_id: Number(req.params.id),
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          valor_calculado: calculo.valor_calculado,
          valor_ajustado: hayAjusteManual ? redondearPesos(valorAjustado) : null,
          justificacion_ajuste: hayAjusteManual ? justificacionAjuste : null,
          desglose: calculo.desglose,
          alertas: calculo.alertas
        })
      ]
    );

    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      cobro: get('SELECT * FROM cobros WHERE id = ?', [cobroResult.lastInsertRowid]),
      calculo
    };
  });

  return res.status(201).json(registrarCobro());
});

router.get('/:id/pago', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const cobro = obtenerCobroActual(req.params.id);
  const pagos = cobro ? all('SELECT * FROM pagos WHERE cobro_id = ? ORDER BY fecha_pago DESC, id DESC', [cobro.id]) : [];

  return res.json({
    incapacidad,
    disponible: ['En_Cobro', 'En_Conciliacion', 'Cobro_Juridico'].includes(incapacidad.estado_actual),
    cobro,
    valor_cobrado: cobro ? obtenerValorCobrado(cobro) : null,
    pagos
  });
});

router.post('/:id/pago', (req, res) => {
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  if (!['En_Cobro', 'En_Conciliacion', 'Cobro_Juridico'].includes(incapacidad.estado_actual)) {
    return res.status(409).json({
      error: `El pago solo aplica a incapacidades En_Cobro, En_Conciliacion o Cobro_Juridico. Estado actual: ${incapacidad.estado_actual}.`
    });
  }

  const cobro = obtenerCobroActual(req.params.id);
  if (!cobro) {
    return res.status(409).json({ error: 'No existe un cobro registrado para esta incapacidad.' });
  }

  const {
    valor_pagado,
    fecha_pago,
    numero_referencia,
    entidad_pagadora,
    comprobante_adjunto_data,
    usuario_id = 1
  } = req.body;
  const errores = [];
  const valorPagado = Number(valor_pagado);
  const valorCobrado = obtenerValorCobrado(cobro);
  const numeroReferencia = String(numero_referencia ?? '').trim();
  const entidadPagadora = String(entidad_pagadora ?? '').trim();
  const adjunto = normalizarAdjunto(comprobante_adjunto_data);

  if (!Number.isFinite(valorPagado) || valorPagado < 0) errores.push('El valor pagado debe ser mayor o igual a cero.');
  if (!fecha_pago) errores.push('La fecha de pago es obligatoria.');
  if (!numeroReferencia) errores.push('El numero de referencia es obligatorio.');
  if (!entidadPagadora) errores.push('La entidad pagadora es obligatoria.');
  if (adjunto.error) errores.push(adjunto.error.replace('adjunto', 'comprobante adjunto'));

  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  const registrarPago = transaction(() => {
    const comprobanteAdjunto = guardarAdjunto({
      incapacidadId: req.params.id,
      adjunto,
      prefijo: 'pago'
    });
    const diferencia = redondearPesos(valorCobrado - valorPagado);
    const pagoCuadrado = Math.abs(diferencia) <= 1;
    const estadoNuevo = pagoCuadrado ? 'Pagada' : 'En_Conciliacion';
    const estadoCobro = pagoCuadrado ? 'Pagado' : 'En_Conciliacion';
    const pagoResult = run(
      `
        INSERT INTO pagos (
          cobro_id,
          valor_pagado,
          fecha_pago,
          numero_referencia,
          entidad_pagadora,
          comprobante_adjunto,
          diferencia_detectada
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        cobro.id,
        redondearPesos(valorPagado),
        fecha_pago,
        numeroReferencia,
        entidadPagadora,
        comprobanteAdjunto,
        diferencia
      ]
    );

    run('UPDATE cobros SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [estadoCobro, cobro.id]);

    if (!pagoCuadrado) {
      run(
        `
          INSERT INTO conciliaciones (
            incapacidad_id,
            valor_cobrado,
            valor_pagado,
            diferencia,
            justificacion_diferencia,
            documentos_soporte
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (incapacidad_id) DO UPDATE SET
            valor_cobrado = excluded.valor_cobrado,
            valor_pagado = excluded.valor_pagado,
            diferencia = excluded.diferencia,
            justificacion_diferencia = excluded.justificacion_diferencia,
            documentos_soporte = excluded.documentos_soporte,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          req.params.id,
          valorCobrado,
          redondearPesos(valorPagado),
          diferencia,
          'Diferencia detectada automaticamente al registrar pago.',
          comprobanteAdjunto
        ]
      );
    }

    const cambio = cambiarEstadoIncapacidad({
      incapacidadId: req.params.id,
      estadoNuevo,
      usuarioId: usuario_id,
      justificacion: pagoCuadrado
        ? 'Pago registrado por el valor total cobrado. Expediente financiero cerrado.'
        : 'Pago registrado con diferencia frente al valor cobrado. Se abre conciliacion.'
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
        ) VALUES (?, 'REGISTRAR_PAGO', 'pagos', ?, ?, NULL)
      `,
      [
        usuario_id,
        pagoResult.lastInsertRowid,
        JSON.stringify({
          incapacidad_id: Number(req.params.id),
          cobro_id: cobro.id,
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          valor_cobrado: valorCobrado,
          valor_pagado: redondearPesos(valorPagado),
          diferencia,
          tolerancia: 1,
          numero_referencia: numeroReferencia,
          entidad_pagadora: entidadPagadora
        })
      ]
    );

    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      cobro: get('SELECT * FROM cobros WHERE id = ?', [cobro.id]),
      pago: get('SELECT * FROM pagos WHERE id = ?', [pagoResult.lastInsertRowid]),
      conciliacion: pagoCuadrado ? null : get('SELECT * FROM conciliaciones WHERE incapacidad_id = ?', [req.params.id]),
      diferencia,
      estado_nuevo: estadoNuevo
    };
  });

  return res.status(201).json(registrarPago());
});

router.get('/:id/rechazo', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const rechazo = get('SELECT * FROM rechazos WHERE incapacidad_id = ?', [req.params.id]);
  const motivos = [
    { codigo: 'DOC-001', descripcion: 'Documento ilegible o incompleto' },
    { codigo: 'RAD-002', descripcion: 'Radicacion fuera de plazo' },
    { codigo: 'CIE-003', descripcion: 'Diagnostico CIE-10 no reconocido por la EPS' },
    { codigo: 'DAT-004', descripcion: 'Datos del colaborador no coinciden' },
    { codigo: 'OTRO', descripcion: 'Otro motivo' }
  ];

  return res.json({
    incapacidad,
    disponible: ['Radicada', 'En_Revision_EPS'].includes(incapacidad.estado_actual),
    rechazo,
    motivos
  });
});

router.post('/:id/rechazo', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  if (!['Radicada', 'En_Revision_EPS'].includes(incapacidad.estado_actual)) {
    return res.status(409).json({
      error: `El rechazo solo aplica a incapacidades Radicada o En_Revision_EPS. Estado actual: ${incapacidad.estado_actual}.`
    });
  }

  const {
    motivo_codigo,
    motivo_descripcion,
    fecha_notificacion,
    codigo_rechazo,
    observaciones = '',
    documento_notificacion_data,
    usuario_id = 1
  } = req.body;
  const errores = [];
  const motivoCodigo = String(motivo_codigo ?? '').trim();
  const motivoDescripcion = String(motivo_descripcion ?? '').trim();
  const codigoRechazo = String(codigo_rechazo ?? '').trim();
  const adjunto = normalizarAdjunto(documento_notificacion_data);

  if (!motivoCodigo) errores.push('El motivo del rechazo es obligatorio.');
  if (!motivoDescripcion) errores.push('La descripcion del motivo es obligatoria.');
  if (!fecha_notificacion) errores.push('La fecha de notificacion es obligatoria.');
  if (!codigoRechazo) errores.push('El codigo de rechazo es obligatorio.');
  if (adjunto.error) errores.push(adjunto.error.replace('adjunto', 'adjunto de notificacion'));

  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  const registrarRechazo = transaction(() => {
    const documentoNotificacion = guardarAdjunto({
      incapacidadId: req.params.id,
      adjunto,
      prefijo: 'rechazo'
    });

    run(
      `
        INSERT INTO rechazos (
          incapacidad_id,
          motivo_codigo,
          motivo_descripcion,
          fecha_notificacion,
          codigo_rechazo,
          observaciones,
          documento_notificacion,
          accion_seleccionada
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT (incapacidad_id) DO UPDATE SET
          motivo_codigo = excluded.motivo_codigo,
          motivo_descripcion = excluded.motivo_descripcion,
          fecha_notificacion = excluded.fecha_notificacion,
          codigo_rechazo = excluded.codigo_rechazo,
          observaciones = excluded.observaciones,
          documento_notificacion = excluded.documento_notificacion,
          accion_seleccionada = NULL,
          decision_fecha = NULL,
          plazo_impugnacion = NULL,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        req.params.id,
        motivoCodigo,
        motivoDescripcion,
        fecha_notificacion,
        codigoRechazo,
        String(observaciones ?? '').trim() || null,
        documentoNotificacion
      ]
    );

    const cambio = cambiarEstadoIncapacidad({
      incapacidadId: req.params.id,
      estadoNuevo: 'Rechazada',
      usuarioId: usuario_id,
      justificacion: `Rechazo registrado por EPS/ARL: ${codigoRechazo}.`
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
        ) VALUES (?, 'REGISTRAR_RECHAZO', 'rechazos', ?, ?, NULL)
      `,
      [
        usuario_id,
        req.params.id,
        JSON.stringify({
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          motivo_codigo: motivoCodigo,
          codigo_rechazo: codigoRechazo
        })
      ]
    );

    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      rechazo: get('SELECT * FROM rechazos WHERE incapacidad_id = ?', [req.params.id])
    };
  });

  return res.status(201).json(registrarRechazo());
});

router.post('/:id/rechazo/accion', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  if (incapacidad.estado_actual !== 'Rechazada') {
    return res.status(409).json({ error: `Las acciones de rechazo requieren estado Rechazada. Estado actual: ${incapacidad.estado_actual}.` });
  }

  const rechazo = get('SELECT * FROM rechazos WHERE incapacidad_id = ?', [req.params.id]);
  if (!rechazo) {
    return res.status(409).json({ error: 'Primero registra los datos del rechazo.' });
  }

  const { accion, fecha_decision = fechaActualIso(), plazo_impugnacion, usuario_id = 1 } = req.body;
  const accionNormalizada = String(accion ?? '').trim();
  const acciones = ['re_radicar', 'impugnar', 'cobro_juridico'];

  if (!acciones.includes(accionNormalizada)) {
    return res.status(400).json({ error: 'La accion seleccionada no es valida.' });
  }

  const aplicarAccion = transaction(() => {
    let estadoNuevo = incapacidad.estado_actual;
    let redirect_to = null;
    let justificacion = 'Decision registrada sobre rechazo.';

    if (accionNormalizada === 're_radicar') {
      estadoNuevo = 'Transcrita';
      justificacion = 'Se corregira la incapacidad para re-radicar desde transcripcion.';
    }

    if (accionNormalizada === 'cobro_juridico') {
      estadoNuevo = 'Cobro_Juridico';
      redirect_to = `/incapacidades/${req.params.id}/juridico`;
      justificacion = 'Rechazo escalado a cobro juridico.';
    }

    if (accionNormalizada === 'impugnar') {
      justificacion = 'Decision de impugnar el rechazo registrada.';
    }

    run(
      `
        UPDATE rechazos
        SET accion_seleccionada = ?,
            decision_fecha = ?,
            plazo_impugnacion = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE incapacidad_id = ?
      `,
      [
        accionNormalizada,
        fecha_decision,
        accionNormalizada === 'impugnar' ? String(plazo_impugnacion ?? '').trim() || null : null,
        req.params.id
      ]
    );

    let cambio = { estadoAnterior: incapacidad.estado_actual, estadoNuevo: incapacidad.estado_actual };
    if (estadoNuevo !== incapacidad.estado_actual) {
      cambio = cambiarEstadoIncapacidad({
        incapacidadId: req.params.id,
        estadoNuevo,
        usuarioId: usuario_id,
        justificacion
      });
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
        ) VALUES (?, 'DECIDIR_ACCION_RECHAZO', 'rechazos', ?, ?, NULL)
      `,
      [
        usuario_id,
        rechazo.id,
        JSON.stringify({
          accion_seleccionada: accionNormalizada,
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          plazo_impugnacion: accionNormalizada === 'impugnar' ? plazo_impugnacion : null
        })
      ]
    );

    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      rechazo: get('SELECT * FROM rechazos WHERE incapacidad_id = ?', [req.params.id]),
      redirect_to
    };
  });

  return res.json(aplicarAccion());
});

router.get('/:id/conciliacion', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  const cobro = obtenerCobroActual(req.params.id);
  const pago = cobro
    ? get('SELECT * FROM pagos WHERE cobro_id = ? ORDER BY fecha_pago DESC, id DESC LIMIT 1', [cobro.id])
    : null;
  const conciliacion = get('SELECT * FROM conciliaciones WHERE incapacidad_id = ?', [req.params.id]);

  return res.json({
    incapacidad,
    disponible: incapacidad.estado_actual === 'En_Conciliacion',
    cobro,
    pago,
    valor_cobrado: conciliacion?.valor_cobrado ?? (cobro ? obtenerValorCobrado(cobro) : 0),
    valor_pagado: conciliacion?.valor_pagado ?? pago?.valor_pagado ?? 0,
    diferencia: conciliacion?.diferencia ?? (cobro && pago ? redondearPesos(obtenerValorCobrado(cobro) - Number(pago.valor_pagado)) : 0),
    conciliacion: conciliacion
      ? { ...conciliacion, gestiones: parsearJsonArray(conciliacion.gestiones) }
      : null
  });
});

router.post('/:id/conciliacion/gestiones', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) return res.status(404).json({ error: 'Incapacidad no encontrada' });
  if (incapacidad.estado_actual !== 'En_Conciliacion') {
    return res.status(409).json({ error: `La conciliacion solo aplica a incapacidades En_Conciliacion. Estado actual: ${incapacidad.estado_actual}.` });
  }

  const { fecha_contacto, respuesta_eps, documentos_intercambiados = '', usuario_id = 1 } = req.body;
  const errores = [];
  if (!fecha_contacto) errores.push('La fecha de contacto es obligatoria.');
  if (!String(respuesta_eps ?? '').trim()) errores.push('La respuesta de la EPS es obligatoria.');
  if (errores.length) return res.status(400).json({ error: errores.join(' ') });

  const guardarGestion = transaction(() => {
    const cobro = obtenerCobroActual(req.params.id);
    const pago = cobro ? get('SELECT * FROM pagos WHERE cobro_id = ? ORDER BY fecha_pago DESC, id DESC LIMIT 1', [cobro.id]) : null;
    const valorCobrado = cobro ? obtenerValorCobrado(cobro) : 0;
    const valorPagado = Number(pago?.valor_pagado ?? 0);
    const existente = get('SELECT * FROM conciliaciones WHERE incapacidad_id = ?', [req.params.id]);
    const gestiones = parsearJsonArray(existente?.gestiones);
    const nuevaGestion = {
      fecha_contacto,
      respuesta_eps: String(respuesta_eps).trim(),
      documentos_intercambiados: String(documentos_intercambiados ?? '').trim()
    };
    gestiones.push(nuevaGestion);

    run(
      `
        INSERT INTO conciliaciones (
          incapacidad_id,
          valor_cobrado,
          valor_pagado,
          diferencia,
          justificacion_diferencia,
          gestiones
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (incapacidad_id) DO UPDATE SET
          gestiones = excluded.gestiones,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        req.params.id,
        valorCobrado,
        valorPagado,
        redondearPesos(valorCobrado - valorPagado),
        existente?.justificacion_diferencia ?? 'Conciliacion abierta por diferencia entre cobro y pago.',
        JSON.stringify(gestiones)
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
        ) VALUES (?, 'REGISTRAR_GESTION_CONCILIACION', 'conciliaciones', ?, ?, NULL)
      `,
      [usuario_id, req.params.id, JSON.stringify(nuevaGestion)]
    );

    const conciliacion = get('SELECT * FROM conciliaciones WHERE incapacidad_id = ?', [req.params.id]);
    return { conciliacion: { ...conciliacion, gestiones: parsearJsonArray(conciliacion.gestiones) } };
  });

  return res.status(201).json(guardarGestion());
});

router.put('/:id/conciliacion/acuerdo', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) return res.status(404).json({ error: 'Incapacidad no encontrada' });
  if (incapacidad.estado_actual !== 'En_Conciliacion') {
    return res.status(409).json({ error: `El acuerdo final requiere estado En_Conciliacion. Estado actual: ${incapacidad.estado_actual}.` });
  }

  const { valor_acordado, justificacion_diferencia, resultado, fecha_acuerdo = fechaActualIso(), usuario_id = 1 } = req.body;
  const resultadoNormalizado = String(resultado ?? '').trim();
  const valorAcordado = Number(valor_acordado);
  const errores = [];
  if (!['pago_adicional', 'aceptar_diferencia', 'sin_acuerdo'].includes(resultadoNormalizado)) errores.push('El resultado del acuerdo no es valido.');
  if (!Number.isFinite(valorAcordado) || valorAcordado < 0) errores.push('El valor acordado debe ser mayor o igual a cero.');
  if (!String(justificacion_diferencia ?? '').trim()) errores.push('La justificacion de la diferencia es obligatoria.');
  if (errores.length) return res.status(400).json({ error: errores.join(' ') });

  const registrarAcuerdo = transaction(() => {
    const cobro = obtenerCobroActual(req.params.id);
    const pago = cobro ? get('SELECT * FROM pagos WHERE cobro_id = ? ORDER BY fecha_pago DESC, id DESC LIMIT 1', [cobro.id]) : null;
    const valorCobrado = cobro ? obtenerValorCobrado(cobro) : 0;
    const valorPagado = Number(pago?.valor_pagado ?? 0);
    const diferencia = redondearPesos(valorCobrado - valorPagado);
    const existente = get('SELECT * FROM conciliaciones WHERE incapacidad_id = ?', [req.params.id]);

    run(
      `
        INSERT INTO conciliaciones (
          incapacidad_id,
          valor_cobrado,
          valor_pagado,
          diferencia,
          valor_acordado,
          justificacion_diferencia,
          fecha_acuerdo,
          gestiones,
          resultado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (incapacidad_id) DO UPDATE SET
          valor_acordado = excluded.valor_acordado,
          justificacion_diferencia = excluded.justificacion_diferencia,
          fecha_acuerdo = excluded.fecha_acuerdo,
          resultado = excluded.resultado,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        req.params.id,
        valorCobrado,
        valorPagado,
        diferencia,
        redondearPesos(valorAcordado),
        String(justificacion_diferencia).trim(),
        fecha_acuerdo,
        existente?.gestiones ?? '[]',
        resultadoNormalizado
      ]
    );

    let estadoNuevo = incapacidad.estado_actual;
    let redirect_to = null;
    let cambio = { estadoAnterior: incapacidad.estado_actual, estadoNuevo: incapacidad.estado_actual };

    if (resultadoNormalizado === 'aceptar_diferencia') {
      estadoNuevo = 'Pagada';
      cambio = cambiarEstadoIncapacidad({
        incapacidadId: req.params.id,
        estadoNuevo,
        usuarioId: usuario_id,
        justificacion: `Diferencia aceptada en conciliacion: ${String(justificacion_diferencia).trim()}`
      });
      if (cobro) run("UPDATE cobros SET estado = 'Pagado', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [cobro.id]);
    }

    if (resultadoNormalizado === 'pago_adicional') {
      redirect_to = `/incapacidades/${req.params.id}/pago`;
    }

    if (resultadoNormalizado === 'sin_acuerdo') {
      redirect_to = `/incapacidades/${req.params.id}/juridico`;
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
        ) VALUES (?, 'REGISTRAR_ACUERDO_CONCILIACION', 'conciliaciones', ?, ?, NULL)
      `,
      [
        usuario_id,
        req.params.id,
        JSON.stringify({
          resultado: resultadoNormalizado,
          valor_acordado: redondearPesos(valorAcordado),
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo
        })
      ]
    );

    const conciliacion = get('SELECT * FROM conciliaciones WHERE incapacidad_id = ?', [req.params.id]);
    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      conciliacion: { ...conciliacion, gestiones: parsearJsonArray(conciliacion.gestiones) },
      redirect_to
    };
  });

  return res.json(registrarAcuerdo());
});

router.get('/:id/juridico', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) return res.status(404).json({ error: 'Incapacidad no encontrada' });

  const cobro = obtenerCobroActual(req.params.id);
  const juridico = get('SELECT * FROM cobros_juridicos WHERE incapacidad_id = ?', [req.params.id]);
  const disponible =
    ['Rechazada', 'Cobro_Juridico', 'En_Conciliacion'].includes(incapacidad.estado_actual) ||
    (incapacidad.estado_actual === 'En_Cobro' && cobroVencido(cobro));

  return res.json({
    incapacidad,
    cobro,
    disponible,
    cobro_vencido: cobroVencido(cobro),
    juridico: juridico ? { ...juridico, novedades: parsearJsonArray(juridico.novedades) } : null
  });
});

router.post('/:id/juridico', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);

  if (!incapacidad) return res.status(404).json({ error: 'Incapacidad no encontrada' });

  const cobro = obtenerCobroActual(req.params.id);
  const disponible =
    ['Rechazada', 'Cobro_Juridico', 'En_Conciliacion'].includes(incapacidad.estado_actual) ||
    (incapacidad.estado_actual === 'En_Cobro' && cobroVencido(cobro));

  if (!disponible) {
    return res.status(409).json({ error: `CU-13 no esta disponible para el estado actual: ${incapacidad.estado_actual}.` });
  }

  const {
    apoderado_legal,
    fecha_inicio,
    valor_en_disputa,
    numero_radicado_judicial = '',
    estado_proceso = 'Inicio de cobro juridico',
    usuario_id = 1
  } = req.body;
  const valorDisputa = Number(valor_en_disputa);
  const errores = [];
  if (!String(apoderado_legal ?? '').trim()) errores.push('El apoderado legal es obligatorio.');
  if (!fecha_inicio) errores.push('La fecha de inicio es obligatoria.');
  if (!Number.isFinite(valorDisputa) || valorDisputa < 0) errores.push('El valor en disputa debe ser mayor o igual a cero.');
  if (!String(estado_proceso ?? '').trim()) errores.push('El estado del proceso es obligatorio.');
  if (errores.length) return res.status(400).json({ error: errores.join(' ') });

  const registrarJuridico = transaction(() => {
    run(
      `
        INSERT INTO cobros_juridicos (
          incapacidad_id,
          apoderado_legal,
          fecha_inicio,
          valor_en_disputa,
          numero_radicado_judicial,
          estado_proceso,
          novedades
        ) VALUES (?, ?, ?, ?, ?, ?, '[]')
        ON CONFLICT (incapacidad_id) DO UPDATE SET
          apoderado_legal = excluded.apoderado_legal,
          fecha_inicio = excluded.fecha_inicio,
          valor_en_disputa = excluded.valor_en_disputa,
          numero_radicado_judicial = excluded.numero_radicado_judicial,
          estado_proceso = excluded.estado_proceso,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        req.params.id,
        String(apoderado_legal).trim(),
        fecha_inicio,
        redondearPesos(valorDisputa),
        String(numero_radicado_judicial ?? '').trim() || null,
        String(estado_proceso).trim()
      ]
    );

    let cambio = { estadoAnterior: incapacidad.estado_actual, estadoNuevo: incapacidad.estado_actual };
    if (incapacidad.estado_actual !== 'Cobro_Juridico') {
      cambio = cambiarEstadoIncapacidad({
        incapacidadId: req.params.id,
        estadoNuevo: 'Cobro_Juridico',
        usuarioId: usuario_id,
        justificacion: 'Expediente escalado a cobro juridico.'
      });
    }
    if (cobro) run("UPDATE cobros SET estado = 'Juridico', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [cobro.id]);

    const juridico = get('SELECT * FROM cobros_juridicos WHERE incapacidad_id = ?', [req.params.id]);
    run(
      `
        INSERT INTO auditorias (
          usuario_id,
          accion,
          entidad_afectada,
          entidad_id,
          detalle,
          ip_address
        ) VALUES (?, 'REGISTRAR_COBRO_JURIDICO', 'cobros_juridicos', ?, ?, NULL)
      `,
      [
        usuario_id,
        juridico.id,
        JSON.stringify({
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          valor_en_disputa: redondearPesos(valorDisputa)
        })
      ]
    );

    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      juridico: { ...juridico, novedades: parsearJsonArray(juridico.novedades) }
    };
  });

  return res.status(201).json(registrarJuridico());
});

router.post('/:id/juridico/novedades', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);
  if (!incapacidad) return res.status(404).json({ error: 'Incapacidad no encontrada' });
  if (incapacidad.estado_actual !== 'Cobro_Juridico') {
    return res.status(409).json({ error: `Las novedades juridicas requieren estado Cobro_Juridico. Estado actual: ${incapacidad.estado_actual}.` });
  }

  const juridico = get('SELECT * FROM cobros_juridicos WHERE incapacidad_id = ?', [req.params.id]);
  if (!juridico) return res.status(409).json({ error: 'Primero registra el cobro juridico.' });

  const { fecha, descripcion, usuario_id = 1 } = req.body;
  if (!fecha || !String(descripcion ?? '').trim()) {
    return res.status(400).json({ error: 'La fecha y la descripcion de la novedad son obligatorias.' });
  }

  const novedades = parsearJsonArray(juridico.novedades);
  const novedad = { fecha, descripcion: String(descripcion).trim() };
  novedades.push(novedad);

  run('UPDATE cobros_juridicos SET novedades = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    JSON.stringify(novedades),
    juridico.id
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
      ) VALUES (?, 'REGISTRAR_NOVEDAD_JURIDICA', 'cobros_juridicos', ?, ?, NULL)
    `,
    [usuario_id, juridico.id, JSON.stringify(novedad)]
  );

  const actualizado = get('SELECT * FROM cobros_juridicos WHERE id = ?', [juridico.id]);
  return res.status(201).json({ juridico: { ...actualizado, novedades: parsearJsonArray(actualizado.novedades) } });
});

router.put('/:id/juridico/resultado', (req, res) => {
  asegurarSchemaExcepciones();
  const incapacidad = obtenerIncapacidad(req.params.id);
  if (!incapacidad) return res.status(404).json({ error: 'Incapacidad no encontrada' });
  if (incapacidad.estado_actual !== 'Cobro_Juridico') {
    return res.status(409).json({ error: `El resultado juridico requiere estado Cobro_Juridico. Estado actual: ${incapacidad.estado_actual}.` });
  }

  const juridico = get('SELECT * FROM cobros_juridicos WHERE incapacidad_id = ?', [req.params.id]);
  if (!juridico) return res.status(409).json({ error: 'Primero registra el cobro juridico.' });

  const { resultado_final, motivo_cierre = '', usuario_id = 1 } = req.body;
  const resultado = String(resultado_final ?? '').trim();
  if (!['exito', 'desistimiento', 'acuerdo', 'perdida'].includes(resultado)) {
    return res.status(400).json({ error: 'El resultado final juridico no es valido.' });
  }
  if (['desistimiento', 'perdida'].includes(resultado) && !String(motivo_cierre ?? '').trim()) {
    return res.status(400).json({ error: 'El motivo de cierre es obligatorio para desistimiento o perdida.' });
  }

  const cerrarJuridico = transaction(() => {
    run('UPDATE cobros_juridicos SET resultado_final = ?, motivo_cierre = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      resultado,
      String(motivo_cierre ?? '').trim() || null,
      juridico.id
    ]);

    let redirect_to = null;
    let cambio = { estadoAnterior: incapacidad.estado_actual, estadoNuevo: incapacidad.estado_actual };

    if (resultado === 'exito') {
      redirect_to = `/incapacidades/${req.params.id}/pago`;
    }

    if (resultado === 'acuerdo') {
      cambio = cambiarEstadoIncapacidad({
        incapacidadId: req.params.id,
        estadoNuevo: 'Pagada',
        usuarioId: usuario_id,
        justificacion: 'Cobro juridico cerrado por acuerdo.'
      });
    }

    if (resultado === 'desistimiento' || resultado === 'perdida') {
      cambio = cambiarEstadoIncapacidad({
        incapacidadId: req.params.id,
        estadoNuevo: 'Cerrada_Sin_Pago',
        usuarioId: usuario_id,
        justificacion: resultado === 'perdida'
          ? `Perdida del proceso juridico: ${String(motivo_cierre).trim()}`
          : `Desistimiento del cobro juridico: ${String(motivo_cierre).trim()}`
      });

      if (resultado === 'perdida') {
        run(
          `
            INSERT INTO seguimientos (
              incapacidad_id,
              fecha_contacto,
              canal_contacto,
              resultado_gestion,
              proximo_paso,
              auxiliar_id
            ) VALUES (?, DATE('now'), 'sistema', 'Alerta por perdida en cobro juridico.', 'Revision interna del expediente y causas de perdida.', ?)
          `,
          [req.params.id, usuario_id]
        );
      }
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
        ) VALUES (?, 'REGISTRAR_RESULTADO_JURIDICO', 'cobros_juridicos', ?, ?, NULL)
      `,
      [
        usuario_id,
        juridico.id,
        JSON.stringify({
          resultado_final: resultado,
          estado_anterior: cambio.estadoAnterior,
          estado_nuevo: cambio.estadoNuevo,
          redirect_to
        })
      ]
    );

    const actualizado = get('SELECT * FROM cobros_juridicos WHERE id = ?', [juridico.id]);
    return {
      incapacidad: obtenerIncapacidad(req.params.id),
      juridico: { ...actualizado, novedades: parsearJsonArray(actualizado.novedades) },
      redirect_to
    };
  });

  return res.json(cerrarJuridico());
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
