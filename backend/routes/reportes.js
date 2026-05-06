import { Router } from 'express';

const router = Router();

router.get('/resumen', (_req, res) => {
  res.json({
    totalIncapacidades: 1,
    enSeguimiento: 1,
    cerradas: 0,
    colaboradoresActivos: 1
  });
});

router.get('/mensual', (_req, res) => {
  res.json([
    {
      mes: '2026-05',
      incapacidades: 1,
      diasReportados: 5
    }
  ]);
});

export default router;
