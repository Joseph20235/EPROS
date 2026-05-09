import { Router } from 'express';

import { all, db, get, run, transaction } from '../db.js';

const router = Router();

const estadosActivos = [
  'Registrada',
  'En_Validacion',
  'Transcrita',
  'Radicada',
  'En_Revision_EPS',
  'Aprobada',
  'Rechazada',
  'En_Cobro',
  'En_Conciliacion',
  'Cobro_Juridico'
];

const accionesPorNivel = {
  1: [
    'Generar reporte mensual',
    'Notificar a Gestion Humana',
    'Actualizar informe de ausentismo'
  ],
  2: [
    'Solicitar concepto de rehabilitacion a EPS',
    'Radicar requerimiento formal EPS',
    'Escalar seguimiento con entidad'
  ],
  3: [
    'Enviar concepto de rehabilitacion a AFP',
    'Preparar soporte para AFP',
    'Confirmar recibido por AFP'
  ],
  4: [
    'Suspender pago de nomina',
    'Gestionar tramite ante AFP',
    'Citar revision con colaborador'
  ],
  5: [
    'Activar comite de caso critico',
    'Revisar acumulado 540 dias en tres anios',
    'Definir plan juridico y prestacional'
  ]
};

let alertasSchemaVerificado = false;

function columnaExiste(tabla, columna) {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().some((item) => item.name === columna);
}

function asegurarSchemaAlertas() {
  if (alertasSchemaVerificado) return;

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

  if (!columnaExiste('alertas_prolongadas', 'dias_ultimos_3_anios')) {
    run('ALTER TABLE alertas_prolongadas ADD COLUMN dias_ultimos_3_anios INTEGER NOT NULL DEFAULT 0');
  }

  run('CREATE INDEX IF NOT EXISTS idx_alertas_prolongadas_nivel ON alertas_prolongadas (nivel_alerta)');
  run('CREATE INDEX IF NOT EXISTS idx_alertas_prolongadas_estado ON alertas_prolongadas (estado)');
  run('CREATE INDEX IF NOT EXISTS idx_acciones_alerta_alerta_id ON acciones_alerta_prolongada (alerta_id)');
  run('CREATE INDEX IF NOT EXISTS idx_acciones_alerta_incapacidad_id ON acciones_alerta_prolongada (incapacidad_id)');

  alertasSchemaVerificado = true;
}

function obtenerNivelAlerta(diasAcumulados, diasUltimosTresAnios) {
  if (diasUltimosTresAnios >= 540) return 5;
  if (diasAcumulados >= 180) return 4;
  if (diasAcumulados >= 150) return 3;
  if (diasAcumulados >= 120) return 2;
  if (diasAcumulados >= 90) return 1;
  return 0;
}

function construirRecomendaciones(nivel) {
  const textos = {
    1: ['Generar reporte mensual de incapacidad prolongada.', 'Programar seguimiento antes de llegar a 120 dias.'],
    2: ['Solicitar concepto de rehabilitacion a la EPS.', 'Dejar evidencia del radicado en el expediente.'],
    3: ['Enviar concepto de rehabilitacion a la AFP.', 'Confirmar recibido y fecha de respuesta.'],
    4: ['Suspender pago por nomina desde el dia 181 si aplica.', 'Gestionar el caso ante AFP con soporte completo.'],
    5: ['Tratar como caso critico por 540 dias en tres anios.', 'Convocar revision juridica y prestacional.']
  };

  return textos[nivel] ?? [];
}

function proximoHitoSugerido(nivel, diasAcumulados) {
  const hoy = new Date();
  const diasParaHito = nivel === 1
    ? Math.max(120 - diasAcumulados, 7)
    : nivel === 2
      ? Math.max(150 - diasAcumulados, 7)
      : nivel === 3
        ? Math.max(180 - diasAcumulados, 7)
        : 30;

  hoy.setDate(hoy.getDate() + diasParaHito);
  return hoy.toISOString().slice(0, 10);
}

function parametrosEstadosActivos() {
  return estadosActivos.map(() => '?').join(', ');
}

function calcularCasosProlongados() {
  const params = [...estadosActivos, ...estadosActivos];
  const casos = all(
    `
      SELECT
        c.id AS colaborador_id,
        c.nombre_completo,
        c.numero_identificacion,
        c.area,
        c.cargo,
        ea.id AS eps_arl_id,
        ea.nombre AS eps_arl_nombre,
        ea.tipo AS eps_arl_tipo,
        SUM(i.numero_dias) AS dias_acumulados,
        SUM(CASE WHEN DATE(i.fecha_fin) >= DATE('now', '-3 years') THEN i.numero_dias ELSE 0 END) AS dias_ultimos_3_anios,
        (
          SELECT i2.id
          FROM incapacidades i2
          JOIN estados e2 ON e2.id = i2.estado_actual_id
          WHERE i2.colaborador_id = c.id AND e2.estado IN (${parametrosEstadosActivos()})
          ORDER BY i2.numero_dias DESC, i2.fecha_inicio DESC, i2.id DESC
          LIMIT 1
        ) AS incapacidad_principal_id,
        (
          SELECT i2.diagnostico_cie10
          FROM incapacidades i2
          JOIN estados e2 ON e2.id = i2.estado_actual_id
          WHERE i2.colaborador_id = c.id AND e2.estado IN (${parametrosEstadosActivos()})
          ORDER BY i2.numero_dias DESC, i2.fecha_inicio DESC, i2.id DESC
          LIMIT 1
        ) AS diagnostico_principal
      FROM colaboradores c
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
      JOIN incapacidades i ON i.colaborador_id = c.id
      JOIN estados e ON e.id = i.estado_actual_id
      WHERE c.activo = 1 AND e.estado IN (${parametrosEstadosActivos()})
      GROUP BY c.id
    `,
    [...params, ...estadosActivos]
  );

  return casos
    .map((caso) => {
      const diasAcumulados = Number(caso.dias_acumulados ?? 0);
      const diasUltimosTresAnios = Number(caso.dias_ultimos_3_anios ?? 0);
      const nivel = obtenerNivelAlerta(diasAcumulados, diasUltimosTresAnios);

      return {
        ...caso,
        dias_acumulados: diasAcumulados,
        dias_ultimos_3_anios: diasUltimosTresAnios,
        nivel_alerta: nivel,
        recomendaciones: construirRecomendaciones(nivel),
        acciones_disponibles: accionesPorNivel[nivel] ?? [],
        proximo_hito_sugerido: nivel ? proximoHitoSugerido(nivel, diasAcumulados) : null
      };
    })
    .filter((caso) => caso.nivel_alerta > 0)
    .sort((a, b) => b.nivel_alerta - a.nivel_alerta || b.dias_acumulados - a.dias_acumulados);
}

function listarAlertas() {
  asegurarSchemaAlertas();
  return all(`
    SELECT
      a.*,
      c.nombre_completo,
      c.numero_identificacion,
      c.area,
      c.cargo,
      ea.nombre AS eps_arl_nombre,
      ea.tipo AS eps_arl_tipo
    FROM alertas_prolongadas a
    JOIN colaboradores c ON c.id = a.colaborador_id
    JOIN eps_arl ea ON ea.id = a.eps_arl_id
    WHERE a.estado IN ('activa', 'reprogramada')
    ORDER BY a.nivel_alerta DESC, a.dias_acumulados DESC, a.updated_at DESC
  `).map((alerta) => ({
    ...alerta,
    recomendaciones: construirRecomendaciones(alerta.nivel_alerta),
    acciones_disponibles: accionesPorNivel[alerta.nivel_alerta] ?? []
  }));
}

router.get('/', (_req, res) => {
  res.json(listarAlertas());
});

router.post('/monitorear', (req, res) => {
  asegurarSchemaAlertas();
  const { usuario_id = 1 } = req.body ?? {};
  const casos = calcularCasosProlongados();

  const ejecutarMonitoreo = transaction(() => {
    for (const caso of casos) {
      run(
        `
          INSERT INTO alertas_prolongadas (
            colaborador_id,
            incapacidad_principal_id,
            eps_arl_id,
            nivel_alerta,
            dias_acumulados,
            dias_ultimos_3_anios,
            diagnostico_principal,
            estado,
            proximo_hito
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'activa', ?)
          ON CONFLICT (colaborador_id) DO UPDATE SET
            incapacidad_principal_id = excluded.incapacidad_principal_id,
            eps_arl_id = excluded.eps_arl_id,
            nivel_alerta = excluded.nivel_alerta,
            dias_acumulados = excluded.dias_acumulados,
            dias_ultimos_3_anios = excluded.dias_ultimos_3_anios,
            diagnostico_principal = excluded.diagnostico_principal,
            estado = CASE
              WHEN alertas_prolongadas.estado = 'reprogramada' THEN 'reprogramada'
              ELSE 'activa'
            END,
            proximo_hito = COALESCE(alertas_prolongadas.proximo_hito, excluded.proximo_hito),
            ultima_ejecucion = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          caso.colaborador_id,
          caso.incapacidad_principal_id,
          caso.eps_arl_id,
          caso.nivel_alerta,
          caso.dias_acumulados,
          caso.dias_ultimos_3_anios,
          caso.diagnostico_principal,
          caso.proximo_hito_sugerido
        ]
      );
    }

    const ids = casos.map((caso) => caso.colaborador_id);
    if (ids.length) {
      run(
        `
          UPDATE alertas_prolongadas
          SET estado = 'cerrada', updated_at = CURRENT_TIMESTAMP
          WHERE colaborador_id NOT IN (${ids.map(() => '?').join(', ')})
        `,
        ids
      );
    } else {
      run("UPDATE alertas_prolongadas SET estado = 'cerrada', updated_at = CURRENT_TIMESTAMP");
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
        ) VALUES (?, 'EJECUTAR_MONITOREO_INCAPACIDADES_PROLONGADAS', 'alertas_prolongadas', 0, ?, NULL)
      `,
      [usuario_id, JSON.stringify({ alertas_generadas: casos.length })]
    );

    return listarAlertas();
  });

  res.json({ alertas: ejecutarMonitoreo(), total: casos.length });
});

router.get('/:id', (req, res) => {
  asegurarSchemaAlertas();
  const alerta = get(
    `
      SELECT
        a.*,
        c.nombre_completo,
        c.numero_identificacion,
        c.area,
        c.cargo,
        ea.nombre AS eps_arl_nombre,
        ea.tipo AS eps_arl_tipo
      FROM alertas_prolongadas a
      JOIN colaboradores c ON c.id = a.colaborador_id
      JOIN eps_arl ea ON ea.id = a.eps_arl_id
      WHERE a.id = ?
    `,
    [req.params.id]
  );

  if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });

  const incapacidades = all(
    `
      SELECT
        i.id,
        i.numero_incapacidad,
        i.fecha_inicio,
        i.fecha_fin,
        i.numero_dias,
        i.diagnostico_cie10,
        i.tipo,
        e.estado AS estado_actual
      FROM incapacidades i
      JOIN estados e ON e.id = i.estado_actual_id
      WHERE i.colaborador_id = ? AND e.estado IN (${parametrosEstadosActivos()})
      ORDER BY i.fecha_inicio DESC, i.id DESC
    `,
    [alerta.colaborador_id, ...estadosActivos]
  );
  const acciones = all(
    `
      SELECT
        aa.*,
        u.nombre_completo AS usuario_nombre
      FROM acciones_alerta_prolongada aa
      LEFT JOIN usuarios u ON u.id = aa.usuario_id
      WHERE aa.alerta_id = ?
      ORDER BY aa.fecha DESC, aa.id DESC
    `,
    [alerta.id]
  );

  res.json({
    alerta: {
      ...alerta,
      recomendaciones: construirRecomendaciones(alerta.nivel_alerta),
      acciones_disponibles: accionesPorNivel[alerta.nivel_alerta] ?? []
    },
    incapacidades,
    acciones
  });
});

router.post('/:id/acciones', (req, res) => {
  asegurarSchemaAlertas();
  const alerta = get('SELECT * FROM alertas_prolongadas WHERE id = ?', [req.params.id]);
  if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });

  const {
    tipo_accion,
    fecha,
    responsable,
    observaciones = '',
    proximo_hito,
    incapacidad_id = alerta.incapacidad_principal_id,
    usuario_id = 1
  } = req.body;
  const tipoAccion = String(tipo_accion ?? '').trim();
  const accionesValidas = accionesPorNivel[alerta.nivel_alerta] ?? [];
  const responsableNormalizado = String(responsable ?? '').trim();
  const observacionesNormalizadas = String(observaciones ?? '').trim();
  const errores = [];

  if (!accionesValidas.includes(tipoAccion)) errores.push('El tipo de accion no corresponde al nivel de alerta.');
  if (!fecha) errores.push('La fecha de la accion es obligatoria.');
  if (!responsableNormalizado) errores.push('El responsable es obligatorio.');
  if (!proximo_hito) errores.push('El proximo hito es obligatorio.');

  const incapacidad = get(
    'SELECT id FROM incapacidades WHERE id = ? AND colaborador_id = ?',
    [incapacidad_id, alerta.colaborador_id]
  );
  if (!incapacidad) errores.push('La incapacidad seleccionada no pertenece al colaborador alertado.');

  if (errores.length) return res.status(400).json({ error: errores.join(' ') });

  const registrarAccion = transaction(() => {
    const accionResult = run(
      `
        INSERT INTO acciones_alerta_prolongada (
          alerta_id,
          incapacidad_id,
          tipo_accion,
          fecha,
          responsable,
          observaciones,
          proximo_hito,
          usuario_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        alerta.id,
        incapacidad_id,
        tipoAccion,
        fecha,
        responsableNormalizado,
        observacionesNormalizadas || null,
        proximo_hito,
        usuario_id
      ]
    );

    run(
      `
        UPDATE alertas_prolongadas
        SET estado = 'reprogramada',
            proximo_hito = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [proximo_hito, alerta.id]
    );

    run(
      `
        INSERT INTO seguimientos (
          incapacidad_id,
          fecha_contacto,
          canal_contacto,
          resultado_gestion,
          proximo_paso,
          auxiliar_id
        ) VALUES (?, ?, 'alerta_prolongada', ?, ?, ?)
      `,
      [
        incapacidad_id,
        fecha,
        `${tipoAccion}. ${observacionesNormalizadas || 'Accion registrada desde panel de alertas prolongadas.'}`,
        `Proximo hito: ${proximo_hito}`,
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
        ) VALUES (?, 'REGISTRAR_ACCION_ALERTA_PROLONGADA', 'acciones_alerta_prolongada', ?, ?, NULL)
      `,
      [
        usuario_id,
        accionResult.lastInsertRowid,
        JSON.stringify({
          alerta_id: alerta.id,
          incapacidad_id,
          tipo_accion: tipoAccion,
          proximo_hito
        })
      ]
    );

    return accionResult.lastInsertRowid;
  });

  registrarAccion();
  const detalle = all(
    `
      SELECT *
      FROM acciones_alerta_prolongada
      WHERE alerta_id = ?
      ORDER BY fecha DESC, id DESC
    `,
    [alerta.id]
  );

  res.status(201).json({
    alerta: get('SELECT * FROM alertas_prolongadas WHERE id = ?', [alerta.id]),
    acciones: detalle
  });
});

export default router;
