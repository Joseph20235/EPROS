import { Router } from 'express';

import { all, get } from '../db.js';

const router = Router();

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

export default router;
