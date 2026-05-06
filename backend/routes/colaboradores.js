import { Router } from 'express';

const router = Router();

const colaboradores = [
  {
    id: 1,
    nombre: 'Ana Torres',
    documento: '1000000001',
    cargo: 'Analista',
    area: 'Operaciones',
    estado: 'Activo'
  }
];

router.get('/', (_req, res) => {
  res.json(colaboradores);
});

router.get('/:id', (req, res) => {
  const colaborador = colaboradores.find((item) => item.id === Number(req.params.id));

  if (!colaborador) {
    return res.status(404).json({ error: 'Colaborador no encontrado' });
  }

  return res.json(colaborador);
});

router.post('/', (req, res) => {
  const nuevoColaborador = {
    id: colaboradores.length + 1,
    ...req.body
  };

  colaboradores.push(nuevoColaborador);
  res.status(201).json(nuevoColaborador);
});

export default router;
