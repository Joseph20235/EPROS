import { Router } from 'express';

const router = Router();

const incapacidades = [
  {
    id: 1,
    colaboradorId: 1,
    fechaInicio: '2026-05-01',
    fechaFin: '2026-05-05',
    diagnostico: 'Enfermedad general',
    estado: 'En seguimiento'
  }
];

router.get('/', (_req, res) => {
  res.json(incapacidades);
});

router.get('/:id', (req, res) => {
  const incapacidad = incapacidades.find((item) => item.id === Number(req.params.id));

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  return res.json(incapacidad);
});

router.post('/', (req, res) => {
  const nuevaIncapacidad = {
    id: incapacidades.length + 1,
    ...req.body
  };

  incapacidades.push(nuevaIncapacidad);
  res.status(201).json(nuevaIncapacidad);
});

router.patch('/:id/estado', (req, res) => {
  const incapacidad = incapacidades.find((item) => item.id === Number(req.params.id));

  if (!incapacidad) {
    return res.status(404).json({ error: 'Incapacidad no encontrada' });
  }

  incapacidad.estado = req.body.estado ?? incapacidad.estado;
  return res.json(incapacidad);
});

export default router;
