import { Router } from 'express';

import { all, get, run } from '../db.js';

const router = Router();
const tiposReporte = [
  'incapacidades_periodo',
  'cobros_pagos_pendientes',
  'reporte_colaborador',
  'incapacidades_prolongadas'
];

function registrarAuditoriaReporte({ usuarioId = 1, tipo, parametros, ipAddress }) {
  const result = run(
    `
      INSERT INTO auditorias (
        usuario_id,
        accion,
        entidad_afectada,
        entidad_id,
        detalle,
        ip_address
      ) VALUES (?, 'GENERAR_REPORTE', 'reportes', 0, ?, ?)
    `,
    [usuarioId, JSON.stringify({ tipo, parametros }), ipAddress]
  );

  return result.lastInsertRowid;
}

function normalizarParametros(body) {
  return {
    fecha_inicio: String(body.fecha_inicio ?? '').trim(),
    fecha_fin: String(body.fecha_fin ?? '').trim(),
    estado: String(body.estado ?? '').trim(),
    tipo_incapacidad: String(body.tipo_incapacidad ?? '').trim(),
    colaborador_id: body.colaborador_id ? Number(body.colaborador_id) : null,
    eps_arl_id: body.eps_arl_id ? Number(body.eps_arl_id) : null,
    area: String(body.area ?? '').trim()
  };
}

function filtrosPeriodo(parametros) {
  const filtros = [];
  const params = [];

  if (parametros.fecha_inicio) {
    filtros.push('i.fecha_inicio >= ?');
    params.push(parametros.fecha_inicio);
  }

  if (parametros.fecha_fin) {
    filtros.push('i.fecha_fin <= ?');
    params.push(parametros.fecha_fin);
  }

  if (parametros.estado) {
    filtros.push('e.estado = ?');
    params.push(parametros.estado);
  }

  if (parametros.tipo_incapacidad) {
    filtros.push('i.tipo = ?');
    params.push(parametros.tipo_incapacidad);
  }

  if (parametros.eps_arl_id) {
    filtros.push('ea.id = ?');
    params.push(parametros.eps_arl_id);
  }

  if (parametros.area) {
    filtros.push('c.area LIKE ?');
    params.push(`%${parametros.area}%`);
  }

  return {
    where: filtros.length ? `WHERE ${filtros.join(' AND ')}` : '',
    params
  };
}

function consultaListadoBase(where) {
  return `
    SELECT
      i.id,
      i.numero_incapacidad,
      c.nombre_completo AS colaborador_nombre,
      c.numero_identificacion AS colaborador_identificacion,
      c.area AS colaborador_area,
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
    ${where}
  `;
}

function generarIncapacidadesPeriodo(parametros) {
  const { where, params } = filtrosPeriodo(parametros);
  const filas = all(
    `
      ${consultaListadoBase(where)}
      ORDER BY i.fecha_inicio DESC, i.id DESC
    `,
    params
  );
  const totalesPorEstado = all(
    `
      SELECT e.estado AS estado, COUNT(*) AS total, COALESCE(SUM(i.numero_dias), 0) AS dias
      FROM incapacidades i
      JOIN colaboradores c ON c.id = i.colaborador_id
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
      LEFT JOIN estados e ON e.id = i.estado_actual_id
      ${where}
      GROUP BY e.estado
      ORDER BY total DESC
    `,
    params
  );
  const totalesPorTipo = all(
    `
      SELECT i.tipo, COUNT(*) AS total, COALESCE(SUM(i.numero_dias), 0) AS dias
      FROM incapacidades i
      JOIN colaboradores c ON c.id = i.colaborador_id
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
      LEFT JOIN estados e ON e.id = i.estado_actual_id
      ${where}
      GROUP BY i.tipo
      ORDER BY total DESC
    `,
    params
  );

  return {
    titulo: 'Incapacidades por periodo',
    resumen: {
      total_incapacidades: filas.length,
      total_dias: filas.reduce((total, fila) => total + Number(fila.numero_dias ?? 0), 0),
      estados: totalesPorEstado,
      tipos: totalesPorTipo
    },
    columnas: ['numero_incapacidad', 'colaborador_nombre', 'fecha_inicio', 'fecha_fin', 'numero_dias', 'estado_actual', 'tipo'],
    filas
  };
}

function generarCobrosPendientes(parametros) {
  const filtros = ["e.estado = 'En_Cobro'"];
  const params = [];

  if (parametros.fecha_inicio) {
    filtros.push('co.fecha_cobro >= ?');
    params.push(parametros.fecha_inicio);
  }

  if (parametros.fecha_fin) {
    filtros.push('co.fecha_cobro <= ?');
    params.push(parametros.fecha_fin);
  }

  if (parametros.eps_arl_id) {
    filtros.push('ea.id = ?');
    params.push(parametros.eps_arl_id);
  }

  if (parametros.area) {
    filtros.push('c.area LIKE ?');
    params.push(`%${parametros.area}%`);
  }

  const where = `WHERE ${filtros.join(' AND ')}`;
  const filas = all(
    `
      SELECT
        i.id,
        i.numero_incapacidad,
        c.nombre_completo AS colaborador_nombre,
        c.numero_identificacion AS colaborador_identificacion,
        c.area AS colaborador_area,
        ea.nombre AS eps_arl_nombre,
        i.fecha_inicio,
        i.fecha_fin,
        i.numero_dias,
        i.tipo,
        e.estado AS estado_actual,
        co.fecha_cobro,
        COALESCE(co.valor_ajustado, co.valor_calculado) AS valor_cobrado,
        CAST(julianday('now') - julianday(co.fecha_cobro) AS INTEGER) AS dias_desde_cobro
      FROM incapacidades i
      JOIN colaboradores c ON c.id = i.colaborador_id
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
      JOIN estados e ON e.id = i.estado_actual_id
      JOIN cobros co ON co.id = (
        SELECT c2.id
        FROM cobros c2
        WHERE c2.incapacidad_id = i.id
        ORDER BY c2.fecha_cobro DESC, c2.id DESC
        LIMIT 1
      )
      ${where}
      ORDER BY dias_desde_cobro DESC, co.fecha_cobro ASC
    `,
    params
  );

  return {
    titulo: 'Cobros y pagos pendientes',
    resumen: {
      total_pendientes: filas.length,
      valor_total_cobrado: filas.reduce((total, fila) => total + Number(fila.valor_cobrado ?? 0), 0),
      max_dias_desde_cobro: Math.max(0, ...filas.map((fila) => Number(fila.dias_desde_cobro ?? 0)))
    },
    columnas: ['numero_incapacidad', 'colaborador_nombre', 'eps_arl_nombre', 'fecha_cobro', 'dias_desde_cobro', 'valor_cobrado'],
    filas
  };
}

function generarReporteColaborador(parametros) {
  if (!parametros.colaborador_id) {
    const error = new Error('Selecciona un colaborador para generar este reporte.');
    error.statusCode = 400;
    throw error;
  }

  const colaborador = get(
    `
      SELECT c.*, ea.nombre AS eps_arl_nombre
      FROM colaboradores c
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
      WHERE c.id = ?
    `,
    [parametros.colaborador_id]
  );

  if (!colaborador) {
    const error = new Error('Colaborador no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const filtros = ['i.colaborador_id = ?'];
  const params = [parametros.colaborador_id];

  if (parametros.fecha_inicio) {
    filtros.push('i.fecha_inicio >= ?');
    params.push(parametros.fecha_inicio);
  }

  if (parametros.fecha_fin) {
    filtros.push('i.fecha_fin <= ?');
    params.push(parametros.fecha_fin);
  }

  const where = `WHERE ${filtros.join(' AND ')}`;
  const filas = all(
    `
      ${consultaListadoBase(where)}
      ORDER BY i.fecha_inicio DESC, i.id DESC
    `,
    params
  );
  const diagnosticosFrecuentes = all(
    `
      SELECT diagnostico_cie10, COUNT(*) AS total, COALESCE(SUM(numero_dias), 0) AS dias
      FROM incapacidades i
      ${where}
      GROUP BY diagnostico_cie10
      ORDER BY total DESC, dias DESC
      LIMIT 5
    `,
    params
  );

  return {
    titulo: `Reporte por colaborador - ${colaborador.nombre_completo}`,
    resumen: {
      colaborador,
      total_incapacidades: filas.length,
      total_dias: filas.reduce((total, fila) => total + Number(fila.numero_dias ?? 0), 0),
      diagnosticos_frecuentes: diagnosticosFrecuentes
    },
    columnas: ['numero_incapacidad', 'fecha_inicio', 'fecha_fin', 'numero_dias', 'diagnostico_cie10', 'estado_actual', 'tipo'],
    filas
  };
}

function generarProlongadas(parametros) {
  const filtros = [];
  const params = [];

  if (parametros.fecha_inicio) {
    filtros.push('i.fecha_inicio >= ?');
    params.push(parametros.fecha_inicio);
  }

  if (parametros.fecha_fin) {
    filtros.push('i.fecha_fin <= ?');
    params.push(parametros.fecha_fin);
  }

  if (parametros.eps_arl_id) {
    filtros.push('ea.id = ?');
    params.push(parametros.eps_arl_id);
  }

  if (parametros.area) {
    filtros.push('c.area LIKE ?');
    params.push(`%${parametros.area}%`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const filas = all(
    `
      SELECT
        c.id AS colaborador_id,
        c.nombre_completo AS colaborador_nombre,
        c.numero_identificacion AS colaborador_identificacion,
        c.area AS colaborador_area,
        ea.nombre AS eps_arl_nombre,
        COUNT(i.id) AS total_incapacidades,
        COALESCE(SUM(i.numero_dias), 0) AS dias_acumulados,
        MIN(i.fecha_inicio) AS primera_incapacidad,
        MAX(i.fecha_fin) AS ultima_incapacidad,
        GROUP_CONCAT(DISTINCT i.diagnostico_cie10) AS diagnosticos
      FROM colaboradores c
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
      JOIN incapacidades i ON i.colaborador_id = c.id
      ${where}
      GROUP BY c.id
      HAVING dias_acumulados > 90
      ORDER BY dias_acumulados DESC, total_incapacidades DESC
    `,
    params
  );

  return {
    titulo: 'Incapacidades prolongadas',
    resumen: {
      total_colaboradores: filas.length,
      dias_acumulados: filas.reduce((total, fila) => total + Number(fila.dias_acumulados ?? 0), 0),
      umbral_dias: 90
    },
    columnas: [
      'colaborador_nombre',
      'colaborador_identificacion',
      'colaborador_area',
      'total_incapacidades',
      'dias_acumulados',
      'diagnosticos'
    ],
    filas
  };
}

function generarReporte(tipo, parametros) {
  if (tipo === 'incapacidades_periodo') return generarIncapacidadesPeriodo(parametros);
  if (tipo === 'cobros_pagos_pendientes') return generarCobrosPendientes(parametros);
  if (tipo === 'reporte_colaborador') return generarReporteColaborador(parametros);
  if (tipo === 'incapacidades_prolongadas') return generarProlongadas(parametros);

  const error = new Error('Tipo de reporte no valido.');
  error.statusCode = 400;
  throw error;
}

router.get('/resumen', (_req, res) => {
  const totalIncapacidades = get('SELECT COUNT(*) AS total FROM incapacidades').total;
  const colaboradoresActivos = get('SELECT COUNT(*) AS total FROM colaboradores WHERE activo = 1').total;
  const cerradas = get(`
    SELECT COUNT(*) AS total
    FROM incapacidades i
    JOIN estados e ON e.id = i.estado_actual_id
    WHERE e.estado IN ('Pagada', 'Cerrada_Sin_Pago')
  `).total;
  const enSeguimiento = totalIncapacidades - cerradas;

  res.json({
    totalIncapacidades,
    enSeguimiento,
    cerradas,
    colaboradoresActivos
  });
});

router.get('/mensual', (_req, res) => {
  const reporte = all(`
    SELECT
      substr(fecha_inicio, 1, 7) AS mes,
      COUNT(*) AS incapacidades,
      SUM(numero_dias) AS diasReportados
    FROM incapacidades
    GROUP BY substr(fecha_inicio, 1, 7)
    ORDER BY mes
  `);

  res.json(reporte);
});

router.get('/tipos', (_req, res) => {
  res.json(tiposReporte);
});

router.post('/generar', (req, res) => {
  const tipo = String(req.body.tipo ?? '').trim();
  const parametros = normalizarParametros(req.body.parametros ?? {});

  try {
    const reporte = generarReporte(tipo, parametros);
    const auditoriaId = registrarAuditoriaReporte({
      usuarioId: req.body.usuario_id ?? 1,
      tipo,
      parametros,
      ipAddress: req.ip
    });

    res.json({
      tipo,
      parametros,
      generado_en: new Date().toISOString(),
      auditoria_id: auditoriaId,
      ...reporte
    });
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ error: error.message ?? 'No fue posible generar el reporte.' });
  }
});

export default router;
