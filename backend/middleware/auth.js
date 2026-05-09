import { get } from '../db.js';
import { verificarJwt } from '../auth.js';

const rutasReadonly = [
  /^\/api\/incapacidades\/historial(?:\/exportar)?(?:\?|$)/,
  /^\/api\/incapacidades\/\d+(?:\?|$)/,
  /^\/api\/reportes(?:\/|$)/,
  /^\/api\/eps-arl(?:\?|$)/,
  /^\/api\/colaboradores(?:\?|$)/
];

function estaPermitidaReadonly(req) {
  if (req.method !== 'GET' && !(req.method === 'POST' && req.path === '/api/reportes/generar')) return false;
  return rutasReadonly.some((patron) => patron.test(req.originalUrl));
}

function estaPermitidaAuxiliar(req) {
  const ruta = req.originalUrl.split('?')[0];

  if (['/api/colaboradores', '/api/eps-arl'].some((prefijo) => ruta.startsWith(prefijo))) {
    return req.method === 'GET';
  }

  return true;
}

export function autenticar(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.access_token;
  const payload = verificarJwt(token);

  if (!payload) {
    return res.status(401).json({ error: 'Sesion no autenticada o expirada.' });
  }

  const usuario = get(
    'SELECT id, nombre_completo, correo, rol, activo FROM usuarios WHERE id = ? AND activo = 1',
    [payload.sub]
  );

  if (!usuario || usuario.rol !== payload.rol) {
    return res.status(401).json({ error: 'El usuario ya no esta activo o su sesion no es valida.' });
  }

  req.usuario = usuario;

  if (req.body && typeof req.body === 'object') {
    req.body.usuario_id = usuario.id;
    req.body.created_by = usuario.id;
  }

  return next();
}

export function controlarAcceso(req, res, next) {
  const rol = req.usuario?.rol;
  const ruta = req.originalUrl.split('?')[0];

  if (ruta === '/api/health') return next();
  if (rol === 'ADMIN') return next();
  if (rol === 'AUXILIAR' && estaPermitidaAuxiliar(req)) return next();
  if (rol === 'READONLY' && estaPermitidaReadonly(req)) return next();

  return res.status(403).json({ error: 'No tienes permisos para acceder a este modulo.' });
}