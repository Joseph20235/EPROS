import crypto from 'node:crypto';

import { get, run } from './db.js';

const jwtSecret = process.env.JWT_SECRET || 'epros-dev-secret-cambiar-en-produccion';
const jwtTtlSeconds = Number(process.env.JWT_TTL_SECONDS || 8 * 60 * 60);
let authSchemaVerificado = false;

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function firmar(data) {
  return crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url');
}

function asegurarSchemaAuth() {
  if (authSchemaVerificado) return;

  run(`
    CREATE TABLE IF NOT EXISTS tokens_revocados (
      jti TEXT PRIMARY KEY,
      usuario_id INTEGER,
      expira_en TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE
    )
  `);
  run('CREATE INDEX IF NOT EXISTS idx_tokens_revocados_usuario_id ON tokens_revocados (usuario_id)');

  authSchemaVerificado = true;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const iteraciones = 120000;
  const hash = crypto.pbkdf2Sync(String(password), salt, iteraciones, 32, 'sha256').toString('hex');
  return `pbkdf2$${iteraciones}$${salt}$${hash}`;
}

export function verificarPassword(password, passwordHash) {
  const [algoritmo, iteracionesTexto, salt, hashGuardado] = String(passwordHash ?? '').split('$');
  if (algoritmo !== 'pbkdf2' || !iteracionesTexto || !salt || !hashGuardado) return false;

  const iteraciones = Number(iteracionesTexto);
  const hash = crypto.pbkdf2Sync(String(password), salt, iteraciones, 32, 'sha256');
  const hashGuardadoBuffer = Buffer.from(hashGuardado, 'hex');

  return hashGuardadoBuffer.length === hash.length && crypto.timingSafeEqual(hash, hashGuardadoBuffer);
}

export function generarJwt(usuario) {
  asegurarSchemaAuth();

  const ahora = Math.floor(Date.now() / 1000);
  const payload = {
    sub: usuario.id,
    correo: usuario.correo,
    nombre_completo: usuario.nombre_completo,
    rol: usuario.rol,
    iat: ahora,
    exp: ahora + jwtTtlSeconds,
    jti: crypto.randomUUID()
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const data = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;

  return {
    token: `${data}.${firmar(data)}`,
    expira_en: new Date(payload.exp * 1000).toISOString(),
    payload
  };
}

export function verificarJwt(token) {
  asegurarSchemaAuth();

  const partes = String(token ?? '').split('.');
  if (partes.length !== 3) return null;

  const [header, payload, signature] = partes;
  const data = `${header}.${payload}`;
  const firmaEsperada = firmar(data);
  const firmaBuffer = Buffer.from(signature);
  const firmaEsperadaBuffer = Buffer.from(firmaEsperada);

  if (firmaBuffer.length !== firmaEsperadaBuffer.length || !crypto.timingSafeEqual(firmaBuffer, firmaEsperadaBuffer)) {
    return null;
  }

  try {
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!datos.exp || datos.exp < Math.floor(Date.now() / 1000)) return null;
    if (get('SELECT jti FROM tokens_revocados WHERE jti = ?', [datos.jti])) return null;
    return datos;
  } catch {
    return null;
  }
}

export function revocarToken(payload) {
  asegurarSchemaAuth();
  if (!payload?.jti || !payload?.exp) return;

  run(
    `
      INSERT OR IGNORE INTO tokens_revocados (jti, usuario_id, expira_en)
      VALUES (?, ?, ?)
    `,
    [payload.jti, payload.sub ?? null, new Date(payload.exp * 1000).toISOString()]
  );
}

export function normalizarUsuario(usuario) {
  return {
    id: usuario.id,
    nombre_completo: usuario.nombre_completo,
    correo: usuario.correo,
    rol: usuario.rol
  };
}