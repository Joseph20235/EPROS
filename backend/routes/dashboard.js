import { Router } from 'express';

import { all } from '../db.js';

const router = Router();

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

function clasificarAlerta(fila) {
  const dias = diasHasta(fila.fecha_limite_respuesta);

  if (dias === null) {
    return null;
  }

  if (dias < 0) {
    return { ...fila, tipo_alerta: 'rojo', etiqueta_alerta: 'Vencida', dias_restantes: dias };
  }

  if (dias <= 5) {
    return {
      ...fila,
      tipo_alerta: 'amarillo',
      etiqueta_alerta: dias === 0 ? 'Vence hoy' : `Vence en ${dias} dia${dias === 1 ? '' : 's'}`,
      dias_restantes: dias
    };
  }

  return null;
}

router.get('/', (_req, res) => {
  const estados = all(`
    SELECT
      e.estado,
      COUNT(*) AS total
    FROM incapacidades i
    JOIN estados e ON e.id = i.estado_actual_id
    GROUP BY e.estado
    ORDER BY total DESC, e.estado ASC
  `);

  const seguimientoActivo = all(`
    SELECT
      i.id,
      i.numero_incapacidad,
      c.nombre_completo AS colaborador_nombre,
      ea.nombre AS eps_arl_nombre,
      e.estado AS estado_actual,
      r.fecha_limite_respuesta_eps AS fecha_limite_respuesta
    FROM incapacidades i
    JOIN colaboradores c ON c.id = i.colaborador_id
    JOIN eps_arl ea ON ea.id = c.eps_arl_id
    JOIN estados e ON e.id = i.estado_actual_id
    LEFT JOIN radicaciones r ON r.incapacidad_id = i.id
    WHERE e.estado IN ('Radicada', 'En_Revision_EPS')
  `);

  const alertasUrgentes = seguimientoActivo
    .map(clasificarAlerta)
    .filter(Boolean)
    .sort((a, b) => {
      const prioridadA = a.tipo_alerta === 'rojo' ? 1 : 2;
      const prioridadB = b.tipo_alerta === 'rojo' ? 1 : 2;
      if (prioridadA !== prioridadB) return prioridadA - prioridadB;
      return String(a.fecha_limite_respuesta ?? '').localeCompare(String(b.fecha_limite_respuesta ?? ''));
    });

  const ultimasIncapacidades = all(`
    SELECT
      i.id,
      i.numero_incapacidad,
      i.fecha_inicio,
      i.fecha_fin,
      i.created_at,
      c.nombre_completo AS colaborador_nombre,
      ea.nombre AS eps_arl_nombre,
      e.estado AS estado_actual
    FROM incapacidades i
    JOIN colaboradores c ON c.id = i.colaborador_id
    JOIN eps_arl ea ON ea.id = c.eps_arl_id
    JOIN estados e ON e.id = i.estado_actual_id
    ORDER BY i.created_at DESC, i.id DESC
    LIMIT 5
  `);

  res.json({
    estados,
    alertasUrgentes,
    ultimasIncapacidades
  });
});

export default router;
