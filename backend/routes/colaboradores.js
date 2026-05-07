import { Router } from 'express';

import { all, get, run } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const colaboradores = all(`
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
    ORDER BY c.nombre_completo
  `);

  res.json(colaboradores);
});

router.get('/:id', (req, res) => {
  const colaborador = get(
    `
      SELECT
        c.*,
        e.nombre AS eps_arl_nombre,
        e.tipo AS eps_arl_tipo
      FROM colaboradores c
      JOIN eps_arl e ON e.id = c.eps_arl_id
      WHERE c.id = ?
    `,
    [req.params.id]
  );

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
    [numero_identificacion, nombre_completo, cargo, area, eps_arl_id, salario_base, activo ? 1 : 0]
  );

  return res.status(201).json(get('SELECT * FROM colaboradores WHERE id = ?', [result.lastInsertRowid]));
});

export default router;
