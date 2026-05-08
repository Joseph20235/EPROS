import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import colaboradoresRouter from './routes/colaboradores.js';
import epsArlRouter from './routes/epsArl.js';
import incapacidadesRouter from './routes/incapacidades.js';
import reportesRouter from './routes/reportes.js';

const app = express();
const port = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'epros-backend' });
});

app.use('/api/colaboradores', colaboradoresRouter);
app.use('/api/eps-arl', epsArlRouter);
app.use('/api/incapacidades', incapacidadesRouter);
app.use('/api/reportes', reportesRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(port, () => {
  console.log(`EPROS backend escuchando en http://localhost:${port}`);
});
