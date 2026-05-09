import { Router } from 'express';

import { generarJwt, normalizarUsuario, revocarToken, verificarJwt, verificarPassword } from '../auth.js';
import { get, run } from '../db.js';

const router = Router();

router.post('/login', (req, res) => {
  const correo = String(req.body.correo ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contrasena son obligatorios.' });
  }

  const usuario = get(
    'SELECT id, nombre_completo, correo, password_hash, rol, activo FROM usuarios WHERE lower(correo) = ?',
    [correo]
  );

  if (!usuario || !usuario.activo || !verificarPassword(password, usuario.password_hash)) {
    return res.status(401).json({ error: 'Credenciales invalidas.' });
  }

  const jwt = generarJwt(usuario);

  run(
    `
      INSERT INTO auditorias (
        usuario_id,
        accion,
        entidad_afectada,
        entidad_id,
        detalle,
        ip_address
      ) VALUES (?, 'LOGIN', 'usuarios', ?, ?, ?)
    `,
    [usuario.id, usuario.id, JSON.stringify({ correo: usuario.correo, rol: usuario.rol }), req.ip]
  );

  return res.json({
    token: jwt.token,
    expira_en: jwt.expira_en,
    usuario: normalizarUsuario(usuario)
  });
});

router.post('/logout', (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verificarJwt(token);

  if (payload) {
    revocarToken(payload);
    run(
      `
        INSERT INTO auditorias (
          usuario_id,
          accion,
          entidad_afectada,
          entidad_id,
          detalle,
          ip_address
        ) VALUES (?, 'LOGOUT', 'usuarios', ?, '{}', ?)
      `,
      [payload.sub, payload.sub, req.ip]
    );
  }

  return res.status(204).send();
});

export default router;