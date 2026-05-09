PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE eps_arl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('EPS', 'ARL')),
  porcentaje_reconocimiento REAL NOT NULL CHECK (porcentaje_reconocimiento >= 0),
  plazo_respuesta_dias INTEGER NOT NULL CHECK (plazo_respuesta_dias > 0),
  portal_url TEXT,
  correo_radicacion TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_completo TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'AUXILIAR' CHECK (rol IN ('ADMIN', 'AUXILIAR', 'READONLY')),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tokens_revocados (
  jti TEXT PRIMARY KEY,
  usuario_id INTEGER,
  expira_en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE TABLE colaboradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_identificacion TEXT NOT NULL UNIQUE,
  nombre_completo TEXT NOT NULL,
  cargo TEXT NOT NULL,
  area TEXT NOT NULL,
  eps_arl_id INTEGER NOT NULL,
  salario_base REAL NOT NULL CHECK (salario_base >= 0),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eps_arl_id) REFERENCES eps_arl(id) ON UPDATE CASCADE
);

CREATE TABLE incapacidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_incapacidad TEXT NOT NULL,
  colaborador_id INTEGER NOT NULL,
  fecha_inicio TEXT NOT NULL,
  fecha_fin TEXT NOT NULL,
  numero_dias INTEGER NOT NULL CHECK (numero_dias > 0),
  diagnostico_cie10 TEXT NOT NULL,
  entidad_emisora TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (
    tipo IN (
      'EPS',
      'ARL',
      'LICENCIA_MATERNIDAD',
      'LICENCIA_PATERNIDAD',
      'ACCIDENTE_TRANSITO',
      'ACCIDENTE_LABORAL',
      'ENFERMEDAD_GENERAL'
    )
  ),
  estado_actual_id INTEGER,
  documento_adjunto TEXT,
  observaciones TEXT,
  fecha_ultimo_seguimiento TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (colaborador_id, numero_incapacidad),
  CHECK (fecha_fin >= fecha_inicio),
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON UPDATE CASCADE,
  FOREIGN KEY (estado_actual_id) REFERENCES estados(id) ON UPDATE CASCADE,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE TABLE estados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL,
  estado TEXT NOT NULL CHECK (
    estado IN (
      'Registrada',
      'En_Validacion',
      'Transcrita',
      'Radicada',
      'En_Revision_EPS',
      'Aprobada',
      'Rechazada',
      'En_Cobro',
      'En_Conciliacion',
      'Cobro_Juridico',
      'Pagada',
      'Cerrada_Sin_Pago'
    )
  ),
  fecha_cambio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id INTEGER,
  justificacion TEXT,
  es_estado_actual INTEGER NOT NULL DEFAULT 0 CHECK (es_estado_actual IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE UNIQUE INDEX estados_unico_actual_por_incapacidad
  ON estados (incapacidad_id)
  WHERE es_estado_actual = 1;

CREATE TABLE validaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL UNIQUE,
  firma_medico INTEGER NOT NULL DEFAULT 0 CHECK (firma_medico IN (0, 1)),
  sello_ips INTEGER NOT NULL DEFAULT 0 CHECK (sello_ips IN (0, 1)),
  fechas_coherentes INTEGER NOT NULL DEFAULT 0 CHECK (fechas_coherentes IN (0, 1)),
  codigo_cie10_valido INTEGER NOT NULL DEFAULT 0 CHECK (codigo_cie10_valido IN (0, 1)),
  numero_incapacidad_legible INTEGER NOT NULL DEFAULT 0 CHECK (numero_incapacidad_legible IN (0, 1)),
  epicrisis_adjunta INTEGER NOT NULL DEFAULT 0 CHECK (epicrisis_adjunta IN (0, 1)),
  furips_adjunto INTEGER NOT NULL DEFAULT 0 CHECK (furips_adjunto IN (0, 1)),
  checklist_detalle TEXT NOT NULL DEFAULT '[]',
  observaciones TEXT,
  aprobada_por INTEGER,
  fecha_validacion TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (aprobada_por) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE TABLE transcripciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL UNIQUE,
  codigo_cie10_detallado TEXT NOT NULL,
  tipo_licencia_medica TEXT NOT NULL,
  medico_tratante TEXT NOT NULL,
  numero_registro_medico TEXT NOT NULL,
  ips_institucion TEXT NOT NULL,
  auxiliar_id INTEGER,
  fecha_transcripcion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (auxiliar_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE TABLE radicaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL UNIQUE,
  numero_radicado TEXT NOT NULL UNIQUE,
  fecha_radicacion TEXT NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN ('presencial', 'virtual', 'correo')),
  funcionario_eps_receptor TEXT,
  comprobante_adjunto TEXT,
  fecha_limite_respuesta_eps TEXT NOT NULL,
  auxiliar_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (auxiliar_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE TABLE cobros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL,
  valor_calculado REAL NOT NULL CHECK (valor_calculado >= 0),
  valor_ajustado REAL CHECK (valor_ajustado IS NULL OR valor_ajustado >= 0),
  justificacion_ajuste TEXT,
  fecha_cobro TEXT NOT NULL,
  documento_cuenta_cobro TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En_Proceso', 'Pagado', 'En_Conciliacion', 'Juridico')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cobro_id INTEGER NOT NULL,
  valor_pagado REAL NOT NULL CHECK (valor_pagado >= 0),
  fecha_pago TEXT NOT NULL,
  numero_referencia TEXT NOT NULL,
  entidad_pagadora TEXT NOT NULL,
  comprobante_adjunto TEXT,
  diferencia_detectada REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cobro_id) REFERENCES cobros(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE seguimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL,
  fecha_contacto TEXT NOT NULL,
  canal_contacto TEXT NOT NULL,
  resultado_gestion TEXT NOT NULL,
  proximo_paso TEXT,
  auxiliar_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (auxiliar_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE TABLE alertas_prolongadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL UNIQUE,
  incapacidad_principal_id INTEGER NOT NULL,
  eps_arl_id INTEGER NOT NULL,
  nivel_alerta INTEGER NOT NULL CHECK (nivel_alerta BETWEEN 1 AND 5),
  dias_acumulados INTEGER NOT NULL CHECK (dias_acumulados >= 0),
  dias_ultimos_3_anios INTEGER NOT NULL DEFAULT 0 CHECK (dias_ultimos_3_anios >= 0),
  diagnostico_principal TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'reprogramada', 'cerrada')),
  proximo_hito TEXT,
  fecha_generacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_ejecucion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON UPDATE CASCADE,
  FOREIGN KEY (incapacidad_principal_id) REFERENCES incapacidades(id) ON UPDATE CASCADE,
  FOREIGN KEY (eps_arl_id) REFERENCES eps_arl(id) ON UPDATE CASCADE
);

CREATE TABLE acciones_alerta_prolongada (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alerta_id INTEGER NOT NULL,
  incapacidad_id INTEGER NOT NULL,
  tipo_accion TEXT NOT NULL,
  fecha TEXT NOT NULL,
  responsable TEXT NOT NULL,
  observaciones TEXT,
  proximo_hito TEXT NOT NULL,
  usuario_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alerta_id) REFERENCES alertas_prolongadas(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE TABLE rechazos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL UNIQUE,
  motivo_codigo TEXT NOT NULL,
  motivo_descripcion TEXT NOT NULL,
  fecha_notificacion TEXT NOT NULL,
  codigo_rechazo TEXT,
  observaciones TEXT,
  documento_notificacion TEXT,
  accion_seleccionada TEXT CHECK (accion_seleccionada IS NULL OR accion_seleccionada IN ('re_radicar', 'impugnar', 'cobro_juridico')),
  decision_fecha TEXT,
  plazo_impugnacion TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE cobros_juridicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL UNIQUE,
  apoderado_legal TEXT NOT NULL,
  fecha_inicio TEXT NOT NULL,
  valor_en_disputa REAL NOT NULL CHECK (valor_en_disputa >= 0),
  numero_radicado_judicial TEXT,
  estado_proceso TEXT NOT NULL,
  resultado_final TEXT CHECK (resultado_final IS NULL OR resultado_final IN ('exito', 'desistimiento', 'acuerdo', 'perdida')),
  motivo_cierre TEXT,
  novedades TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE conciliaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incapacidad_id INTEGER NOT NULL UNIQUE,
  valor_cobrado REAL NOT NULL CHECK (valor_cobrado >= 0),
  valor_pagado REAL NOT NULL CHECK (valor_pagado >= 0),
  diferencia REAL NOT NULL,
  valor_acordado REAL CHECK (valor_acordado IS NULL OR valor_acordado >= 0),
  justificacion_diferencia TEXT,
  fecha_acuerdo TEXT,
  documentos_soporte TEXT,
  gestiones TEXT NOT NULL DEFAULT '[]',
  resultado TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incapacidad_id) REFERENCES incapacidades(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE auditorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  accion TEXT NOT NULL,
  entidad_afectada TEXT NOT NULL,
  entidad_id INTEGER NOT NULL,
  detalle TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

CREATE INDEX idx_colaboradores_eps_arl_id ON colaboradores (eps_arl_id);
CREATE INDEX idx_tokens_revocados_usuario_id ON tokens_revocados (usuario_id);
CREATE INDEX idx_incapacidades_colaborador_id ON incapacidades (colaborador_id);
CREATE INDEX idx_incapacidades_estado_actual_id ON incapacidades (estado_actual_id);
CREATE INDEX idx_incapacidades_fecha_inicio ON incapacidades (fecha_inicio);
CREATE INDEX idx_incapacidades_tipo ON incapacidades (tipo);
CREATE INDEX idx_estados_incapacidad_id ON estados (incapacidad_id);
CREATE INDEX idx_estados_estado ON estados (estado);
CREATE INDEX idx_estados_fecha_cambio ON estados (fecha_cambio);
CREATE INDEX idx_transcripciones_incapacidad_id ON transcripciones (incapacidad_id);
CREATE INDEX idx_radicaciones_fecha_limite_respuesta_eps ON radicaciones (fecha_limite_respuesta_eps);
CREATE INDEX idx_cobros_incapacidad_id ON cobros (incapacidad_id);
CREATE INDEX idx_cobros_estado ON cobros (estado);
CREATE INDEX idx_pagos_cobro_id ON pagos (cobro_id);
CREATE INDEX idx_seguimientos_incapacidad_id ON seguimientos (incapacidad_id);
CREATE INDEX idx_alertas_prolongadas_nivel ON alertas_prolongadas (nivel_alerta);
CREATE INDEX idx_alertas_prolongadas_estado ON alertas_prolongadas (estado);
CREATE INDEX idx_acciones_alerta_alerta_id ON acciones_alerta_prolongada (alerta_id);
CREATE INDEX idx_acciones_alerta_incapacidad_id ON acciones_alerta_prolongada (incapacidad_id);
CREATE INDEX idx_auditorias_entidad ON auditorias (entidad_afectada, entidad_id);
CREATE INDEX idx_auditorias_usuario_id ON auditorias (usuario_id);

COMMIT;
