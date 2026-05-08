import { Router } from 'express';

import { all, db, get, run, transaction } from '../db.js';

const router = Router();
const estadosSeguimiento = ['Radicada', 'En_Revision_EPS'];

let schemaVerificado = false;

function asegurarSchemaSeguimiento() {
  if (schemaVerificado) return;

  const columnas = db.prepare('PRAGMA table_info(incapacidades)').all();
  const tieneFechaUltimoSeguimiento = columnas.some((columna) => columna.name === 'fecha_ultimo_seguimiento');

  if (!tieneFechaUltimoSeguimiento) {
    run('ALTER TABLE incapacidades ADD COLUMN fecha_ultimo_seguimiento TEXT');
  }

  schemaVerificado = true;
}

function normalizarFecha(fecha) {
  if (!fecha) return null;
  const texto = String(fecha).slice(0, 10);
  const parsed = new Date(`${texto}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : texto;
}

function diasHasta(fechaLimite) {
  const limiteNormalizada = normalizarFecha(fechaLimite);
  if (!limiteNormalizada) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const limite = new Date(`${limiteNormalizada}T00:00:00`);
  return Math.floor((limite - hoy) / 86400000);
}

function clasificarSemaforo(fechaLimite) {
  const dias = diasHasta(fechaLimite);

  if (dias === null) {
    return {
      nivel: 'sin_fecha',
      prioridad: 4,
      etiqueta: 'Sin fecha limite',
      dias_restantes: null
    };
  }

  if (dias < 0) {
    return {
      nivel: 'rojo',
      prioridad: 1,
      etiqueta: 'Vencida',
      dias_restantes: dias
    };
  }

  if (dias <= 5) {
    return {
      nivel: 'amarillo',
      prioridad: 2,
      etiqueta: dias === 0 ? 'Vence hoy' : `Vence en ${dias} dia${dias === 1 ? '' : 's'}`,
      dias_restantes: dias
    };
  }

  return {
    nivel: 'verde',
    prioridad: 3,
    etiqueta: `En plazo (${dias} dias)`,
    dias_restantes: dias
  };
}

function mapearFilaSeguimiento(fila) {
  const semaforo = clasificarSemaforo(fila.fecha_limite_respuesta);
  return {
    ...fila,
    semaforo
  };
}

function obtenerIncapacidadSeguimiento(incapacidadId) {
  return get(
    `
      SELECT
        i.id,
        i.numero_incapacidad,
        i.fecha_inicio,
        i.fecha_fin,
        i.numero_dias,
        i.tipo,
        i.fecha_ultimo_seguimiento,
        c.nombre_completo AS colaborador_nombre,
        c.numero_identificacion AS colaborador_identificacion,
        ea.nombre AS eps_arl_nombre,
        e.estado AS estado_actual,
        r.numero_radicado,
        r.fecha_radicacion,
        r.fecha_limite_respuesta_eps AS fecha_limite_respuesta
      FROM incapacidades i
      JOIN colaboradores c ON c.id = i.colaborador_id
      JOIN eps_arl ea ON ea.id = c.eps_arl_id
      LEFT JOIN estados e ON e.id = i.estado_actual_id
      LEFT JOIN radicaciones r ON r.incapacidad_id = i.id
      WHERE i.id = ?
    `,
    [incapacidadId]
  );
}

router.get('/', (_req, res) => {
  asegurarSchemaSeguimiento();

  const incapacidades = all(`
    SELECT
      i.id,
      i.numero_incapacidad,
      i.fecha_inicio,
      i.fecha_fin,
      i.numero_dias,
      i.tipo,
      i.fecha_ultimo_seguimiento,
      c.nombre_completo AS colaborador_nombre,
      c.numero_identificacion AS colaborador_identificacion,
      ea.nombre AS eps_arl_nombre,
      e.estado AS estado_actual,
      r.numero_radicado,
      r.fecha_radicacion,
      r.fecha_limite_respuesta_eps AS fecha_limite_respuesta,
      (
        SELECT COUNT(*)
        FROM seguimientos s
        WHERE s.incapacidad_id = i.id
      ) AS total_seguimientos
    FROM incapacidades i
    JOIN colaboradores c ON c.id = i.colaborador_id
    JOIN eps_arl ea ON ea.id = c.eps_arl_id
    JOIN estados e ON e.id = i.estado_actual_id
    LEFT JOIN radicaciones r ON r.incapacidad_id = i.id
    WHERE e.estado IN ('Radicada', 'En_Revision_EPS')
  `)
    .map(mapearFilaSeguimiento)
    .sort((a, b) => {
      if (a.semaforo.prioridad !== b.semaforo.prioridad) {
        return a.semaforo.prioridad - b.semaforo.prioridad;
      }

      return String(a.fecha_limite_respuesta ?? '').localeCompare(String(b.fecha_limite_respuesta ?? ''));
    });

  res.json(incapacidades);
});

router.get('/:id', (req, res) => {
  asegurarSchemaSeguimiento();

  const incapacidad = obtenerIncapacidadSeguimiento(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada.' });
  }

  const historial = all(
    `
      SELECT
        s.*,
        u.nombre_completo AS auxiliar_nombre
      FROM seguimientos s
      LEFT JOIN usuarios u ON u.id = s.auxiliar_id
      WHERE s.incapacidad_id = ?
      ORDER BY s.fecha_contacto DESC, s.id DESC
    `,
    [req.params.id]
  );

  res.json({
    incapacidad: mapearFilaSeguimiento(incapacidad),
    historial
  });
});

router.post('/:id', (req, res) => {
  asegurarSchemaSeguimiento();

  const incapacidad = obtenerIncapacidadSeguimiento(req.params.id);

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada.' });
  }

  if (!estadosSeguimiento.includes(incapacidad.estado_actual)) {
    return res.status(409).json({
      error: `El seguimiento solo aplica a incapacidades Radicada o En_Revision_EPS. Estado actual: ${incapacidad.estado_actual}.`
    });
  }

  const {
    fecha_contacto,
    canal_contacto,
    resultado_gestion,
    proximo_paso = '',
    usuario_id = 1
  } = req.body;
  const errores = [];
  const fechaContacto = normalizarFecha(fecha_contacto);
  const canal = String(canal_contacto ?? '').trim();
  const resultado = String(resultado_gestion ?? '').trim();
  const proximoPaso = String(proximo_paso ?? '').trim();

  if (!fechaContacto) errores.push('La fecha de contacto es obligatoria y debe tener formato valido.');
  if (!canal) errores.push('El canal de contacto es obligatorio.');
  if (!resultado) errores.push('El resultado de gestion es obligatorio.');

  if (errores.length) {
    return res.status(400).json({ error: errores.join(' ') });
  }

  const guardarSeguimiento = transaction(() => {
    const seguimientoResult = run(
      `
        INSERT INTO seguimientos (
          incapacidad_id,
          fecha_contacto,
          canal_contacto,
          resultado_gestion,
          proximo_paso,
          auxiliar_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [req.params.id, fechaContacto, canal, resultado, proximoPaso || null, usuario_id]
    );

    run('UPDATE incapacidades SET fecha_ultimo_seguimiento = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      fechaContacto,
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
        ) VALUES (?, 'REGISTRAR_SEGUIMIENTO', 'seguimientos', ?, ?, NULL)
      `,
      [
        usuario_id,
        seguimientoResult.lastInsertRowid,
        JSON.stringify({
          incapacidad_id: Number(req.params.id),
          numero_incapacidad: incapacidad.numero_incapacidad,
          fecha_contacto: fechaContacto,
          canal_contacto: canal,
          resultado_gestion: resultado,
          proximo_paso: proximoPaso || null
        })
      ]
    );

    const historial = all(
      `
        SELECT
          s.*,
          u.nombre_completo AS auxiliar_nombre
        FROM seguimientos s
        LEFT JOIN usuarios u ON u.id = s.auxiliar_id
        WHERE s.incapacidad_id = ?
        ORDER BY s.fecha_contacto DESC, s.id DESC
      `,
      [req.params.id]
    );

    return {
      incapacidad: mapearFilaSeguimiento(obtenerIncapacidadSeguimiento(req.params.id)),
      seguimiento: get('SELECT * FROM seguimientos WHERE id = ?', [seguimientoResult.lastInsertRowid]),
      historial
    };
  });

  return res.status(201).json(guardarSeguimiento());
});

export default router;
