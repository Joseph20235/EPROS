BEGIN;

INSERT INTO eps_arl (
  id,
  nombre,
  tipo,
  porcentaje_reconocimiento,
  plazo_respuesta_dias,
  portal_url,
  correo_radicacion
) VALUES
  (1, 'Salud Total', 'EPS', 66.67, 365, 'https://www.saludtotal.com.co', 'radicaciones@saludtotal.com.co'),
  (2, 'Nueva EPS', 'EPS', 66.67, 365, 'https://www.nuevaeps.com.co', 'incapacidades@nuevaeps.com.co'),
  (3, 'SURA EPS', 'EPS', 66.67, 150, 'https://www.epssura.com', 'radicacionincapacidades@epssura.com'),
  (4, 'ARL SURA', 'ARL', 100.00, 365, 'https://www.arlsura.com', 'radicaciones@arlsura.com'),
  (5, 'SOS', 'EPS', 66.67, 365, 'https://www.sos.com.co', 'radicaciones@sos.com.co'),
  (6, 'Sanitas', 'EPS', 66.67, 1095, 'https://www.epssanitas.com', 'radicaciones@epssanitas.com'),
  (7, 'Asmet Salud', 'EPS', 66.67, 365, 'https://www.asmetsalud.com', 'radicaciones@asmetsalud.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (
  id,
  nombre_completo,
  correo,
  password_hash,
  rol,
  activo
) VALUES
  (1, 'Administrador EPROS', 'admin@epros.com', 'pbkdf2$120000$09ff092ad4fb0c87187d36fa99f1217a$5874fea006a8d5a7fad0c30c9a4956cc57f2a85a06daddf79e14d3896af0a08e', 'ADMIN', TRUE),
  (2, 'Auxiliar EPROS', 'auxiliar@epros.com', 'pbkdf2$120000$541a7bcb2685f0fca528f8dae1099316$ec745054f39d73b38a7cf6e153f9fe6549bb7eb779d7bf7572c084465ee7e0cc', 'AUXILIAR', TRUE),
  (3, 'Consulta EPROS', 'consulta@epros.com', 'pbkdf2$120000$fd6b3f9f2375e09f7e7ecf2e49b7c7ce$c17ec4efc7290d7c502bba6c6165d87db4855941272b23d62ed5590bc69ef455', 'READONLY', TRUE)
ON CONFLICT (id) DO UPDATE SET
  nombre_completo = excluded.nombre_completo,
  correo = excluded.correo,
  password_hash = excluded.password_hash,
  rol = excluded.rol,
  activo = excluded.activo,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO colaboradores (
  id,
  numero_identificacion,
  nombre_completo,
  cargo,
  area,
  eps_arl_id,
  salario_base,
  activo
) VALUES
  (1, '1001001001', 'Laura Valentina Perez', 'Analista de Operaciones', 'Operaciones', 1, 2600000.00, TRUE),
  (2, '1001001002', 'Miguel Angel Torres', 'Auxiliar Logistico', 'Logistica', 2, 1800000.00, TRUE),
  (3, '1001001003', 'Diana Carolina Mejia', 'Coordinadora Comercial', 'Comercial', 3, 4200000.00, TRUE),
  (4, '1001001004', 'Santiago Herrera Gomez', 'Tecnico de Mantenimiento', 'Mantenimiento', 4, 2400000.00, TRUE),
  (5, '1001001005', 'Paula Andrea Castillo', 'Profesional de Talento Humano', 'Gestion Humana', 1, 3500000.00, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO incapacidades (
  id,
  numero_incapacidad,
  colaborador_id,
  fecha_inicio,
  fecha_fin,
  numero_dias,
  diagnostico_cie10,
  entidad_emisora,
  tipo,
  documento_adjunto,
  observaciones,
  fecha_ultimo_seguimiento,
  created_by
) VALUES
  (1, 'INC-REG-001', 1, '2026-01-02', '2026-01-04', 3, 'J00', 'IPS Norte', 'ENFERMEDAD_GENERAL', '/uploads/incapacidades/1/incapacidad.pdf', 'Caso semilla en estado Registrada.', NULL, 1),
  (2, 'INC-VAL-001', 2, '2026-01-06', '2026-01-10', 5, 'M545', 'Clinica Central', 'EPS', '/uploads/incapacidades/2/incapacidad.pdf', 'Caso semilla en validacion documental.', NULL, 1),
  (3, 'INC-TRA-001', 3, '2026-01-12', '2026-01-18', 7, 'A09', 'IPS San Rafael', 'EPS', '/uploads/incapacidades/3/incapacidad.pdf', 'Caso transcrito para prueba.', NULL, 1),
  (4, 'INC-RAD-001', 4, '2026-01-20', '2026-01-25', 6, 'S934', 'Clinica del Trabajo', 'ACCIDENTE_LABORAL', '/uploads/incapacidades/4/incapacidad.pdf', 'Caso radicado ante ARL.', '2026-05-01', 1),
  (5, 'INC-REV-001', 5, '2026-02-01', '2026-02-08', 8, 'K529', 'IPS Occidente', 'EPS', '/uploads/incapacidades/5/incapacidad.pdf', 'Caso en revision por EPS.', '2026-05-07', 1),
  (6, 'INC-APR-001', 1, '2026-02-10', '2026-02-14', 5, 'J029', 'IPS Norte', 'ENFERMEDAD_GENERAL', '/uploads/incapacidades/6/incapacidad.pdf', 'Caso aprobado por EPS.', NULL, 1),
  (7, 'INC-REC-001', 2, '2026-02-16', '2026-02-20', 5, 'R51', 'Clinica Central', 'EPS', '/uploads/incapacidades/7/incapacidad.pdf', 'Caso rechazado por inconsistencia documental.', NULL, 1),
  (8, 'INC-COB-001', 3, '2026-03-01', '2026-03-12', 12, 'M255', 'IPS San Rafael', 'EPS', '/uploads/incapacidades/8/incapacidad.pdf', 'Caso en cobro.', NULL, 1),
  (9, 'INC-CON-001', 4, '2026-03-14', '2026-03-20', 7, 'S800', 'Clinica del Trabajo', 'ACCIDENTE_LABORAL', '/uploads/incapacidades/9/incapacidad.pdf', 'Caso en conciliacion por diferencia de pago.', NULL, 1),
  (10, 'INC-JUR-001', 5, '2026-03-22', '2026-04-05', 15, 'N390', 'IPS Occidente', 'EPS', '/uploads/incapacidades/10/incapacidad.pdf', 'Caso escalado a cobro juridico.', NULL, 1),
  (11, 'INC-PAG-001', 1, '2026-04-08', '2026-04-10', 3, 'B349', 'IPS Norte', 'ENFERMEDAD_GENERAL', '/uploads/incapacidades/11/incapacidad.pdf', 'Caso pagado.', NULL, 1),
  (12, 'INC-CSP-001', 2, '2026-04-12', '2026-04-16', 5, 'G439', 'Clinica Central', 'EPS', '/uploads/incapacidades/12/incapacidad.pdf', 'Caso cerrado sin pago.', NULL, 1),
  (13, 'INC-PRO-090', 1, '2025-11-01', '2026-02-03', 95, 'M545', 'IPS Norte', 'ENFERMEDAD_GENERAL', '/uploads/incapacidades/13/incapacidad.pdf', 'Caso prolongado para alerta nivel 1.', NULL, 1),
  (14, 'INC-PRO-120', 2, '2025-10-01', '2026-02-02', 125, 'G560', 'Clinica Central', 'EPS', '/uploads/incapacidades/14/incapacidad.pdf', 'Caso prolongado para alerta nivel 2.', NULL, 1),
  (15, 'INC-PRO-150', 3, '2025-09-01', '2026-01-30', 152, 'F320', 'IPS San Rafael', 'EPS', '/uploads/incapacidades/15/incapacidad.pdf', 'Caso prolongado para alerta nivel 3.', NULL, 1),
  (16, 'INC-PRO-180', 4, '2025-08-01', '2026-01-28', 181, 'S832', 'Clinica del Trabajo', 'ACCIDENTE_LABORAL', '/uploads/incapacidades/16/incapacidad.pdf', 'Caso prolongado para alerta nivel 4.', NULL, 1),
  (17, 'INC-PRO-540', 5, '2024-09-01', '2026-02-27', 545, 'C509', 'IPS Occidente', 'EPS', '/uploads/incapacidades/17/incapacidad.pdf', 'Caso critico para alerta nivel 5.', NULL, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO estados (
  id,
  incapacidad_id,
  estado,
  fecha_cambio,
  usuario_id,
  justificacion,
  es_estado_actual
) VALUES
  (1, 1, 'Registrada', '2026-01-02 08:00:00-05', 1, 'Registro inicial de incapacidad.', TRUE),
  (2, 2, 'En_Validacion', '2026-01-06 09:00:00-05', 1, 'Documentacion recibida para validacion.', TRUE),
  (3, 3, 'Transcrita', '2026-01-12 10:00:00-05', 1, 'Incapacidad transcrita en portal EPS.', TRUE),
  (4, 4, 'Radicada', '2026-01-20 11:00:00-05', 1, 'Radicacion completada ante entidad.', TRUE),
  (5, 5, 'En_Revision_EPS', '2026-02-01 14:00:00-05', 1, 'Entidad confirma revision documental.', TRUE),
  (6, 6, 'Aprobada', '2026-02-10 15:00:00-05', 1, 'EPS aprueba reconocimiento economico.', TRUE),
  (7, 7, 'Rechazada', '2026-02-16 16:00:00-05', 1, 'EPS notifica rechazo documental.', TRUE),
  (8, 8, 'En_Cobro', '2026-03-01 08:30:00-05', 1, 'Cuenta de cobro generada.', TRUE),
  (9, 9, 'En_Conciliacion', '2026-03-14 09:30:00-05', 1, 'Diferencia detectada entre valor cobrado y pagado.', TRUE),
  (10, 10, 'Cobro_Juridico', '2026-03-22 10:30:00-05', 1, 'Escalamiento por rechazo injustificado.', TRUE),
  (11, 11, 'Pagada', '2026-04-08 11:30:00-05', 1, 'Pago identificado y conciliado.', TRUE),
  (12, 12, 'Cerrada_Sin_Pago', '2026-04-12 12:30:00-05', 1, 'Proceso cerrado sin recuperacion del valor.', TRUE),
  (13, 13, 'Aprobada', '2026-02-03 08:15:00-05', 1, 'Caso prolongado aprobado para monitoreo.', TRUE),
  (14, 14, 'En_Cobro', '2026-02-02 08:30:00-05', 1, 'Caso prolongado en cobro.', TRUE),
  (15, 15, 'En_Revision_EPS', '2026-01-30 09:10:00-05', 1, 'Caso prolongado en revision EPS.', TRUE),
  (16, 16, 'Cobro_Juridico', '2026-01-28 10:20:00-05', 1, 'Caso prolongado escalado a AFP/juridico.', TRUE),
  (17, 17, 'En_Cobro', '2026-02-27 11:20:00-05', 1, 'Caso critico por acumulado en tres anios.', TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE incapacidades SET estado_actual_id = 1 WHERE id = 1 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 2 WHERE id = 2 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 3 WHERE id = 3 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 4 WHERE id = 4 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 5 WHERE id = 5 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 6 WHERE id = 6 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 7 WHERE id = 7 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 8 WHERE id = 8 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 9 WHERE id = 9 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 10 WHERE id = 10 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 11 WHERE id = 11 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 12 WHERE id = 12 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 13 WHERE id = 13 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 14 WHERE id = 14 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 15 WHERE id = 15 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 16 WHERE id = 16 AND estado_actual_id IS NULL;
UPDATE incapacidades SET estado_actual_id = 17 WHERE id = 17 AND estado_actual_id IS NULL;

INSERT INTO validaciones (
  incapacidad_id,
  firma_medico,
  sello_ips,
  fechas_coherentes,
  codigo_cie10_valido,
  numero_incapacidad_legible,
  epicrisis_adjunta,
  furips_adjunto,
  observaciones,
  aprobada_por,
  fecha_validacion
) VALUES
  (2, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, 'Checklist completo para prueba.', 1, '2026-01-06 09:15:00-05'),
  (3, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, 'Validacion aprobada.', 1, '2026-01-12 09:15:00-05'),
  (4, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, 'Validacion aprobada para accidente laboral.', 1, '2026-01-20 09:15:00-05')
ON CONFLICT (incapacidad_id) DO NOTHING;

INSERT INTO transcripciones (
  incapacidad_id,
  codigo_cie10_detallado,
  tipo_licencia_medica,
  medico_tratante,
  numero_registro_medico,
  ips_institucion,
  auxiliar_id,
  fecha_transcripcion
) VALUES
  (3, 'A09.0', 'Incapacidad por enfermedad general', 'Julian Ramirez Mora', 'RM-458921', 'IPS San Rafael', 1, '2026-01-12 10:00:00-05'),
  (4, 'S93.4', 'Accidente laboral', 'Carolina Mejia Torres', 'RM-774120', 'Clinica del Trabajo', 1, '2026-01-20 10:15:00-05'),
  (5, 'K52.9', 'Incapacidad por enfermedad general', 'Andres Felipe Rojas', 'RM-630442', 'IPS Occidente', 1, '2026-02-01 13:30:00-05'),
  (6, 'J02.9', 'Incapacidad por enfermedad general', 'Natalia Duarte', 'RM-982114', 'IPS Norte', 1, '2026-02-10 14:20:00-05')
ON CONFLICT (incapacidad_id) DO NOTHING;

INSERT INTO radicaciones (
  incapacidad_id,
  numero_radicado,
  fecha_radicacion,
  canal,
  funcionario_eps_receptor,
  comprobante_adjunto,
  fecha_limite_respuesta_eps,
  auxiliar_id
) VALUES
  (4, 'RAD-ARL-2026-001', '2026-01-20', 'virtual', 'Mesa de servicio ARL', '/uploads/incapacidades/4/radicacion.pdf', '2026-05-01', 1),
  (5, 'RAD-EPS-2026-002', '2026-02-01', 'correo', 'Analista EPS', '/uploads/incapacidades/5/radicacion.pdf', '2026-05-12', 1),
  (6, 'RAD-EPS-2026-003', '2026-02-10', 'virtual', 'Portal EPS', '/uploads/incapacidades/6/radicacion.pdf', '2027-02-10', 1)
ON CONFLICT (numero_radicado) DO NOTHING;

INSERT INTO cobros (
  id,
  incapacidad_id,
  valor_calculado,
  valor_ajustado,
  justificacion_ajuste,
  fecha_cobro,
  documento_cuenta_cobro,
  estado
) VALUES
  (1, 8, 616056.00, NULL, NULL, '2026-03-04', '/uploads/incapacidades/8/cuenta-cobro.pdf', 'En_Proceso'),
  (2, 9, 560000.00, NULL, NULL, '2026-03-22', '/uploads/incapacidades/9/cuenta-cobro.pdf', 'En_Conciliacion'),
  (3, 10, 816708.00, NULL, NULL, '2026-04-06', '/uploads/incapacidades/10/cuenta-cobro.pdf', 'Juridico'),
  (4, 11, 57804.00, NULL, NULL, '2026-04-12', '/uploads/incapacidades/11/cuenta-cobro.pdf', 'Pagado')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pagos (
  id,
  cobro_id,
  valor_pagado,
  fecha_pago,
  numero_referencia,
  entidad_pagadora,
  comprobante_adjunto,
  diferencia_detectada
) VALUES
  (1, 2, 420000.00, '2026-03-29', 'PAGO-2026-009', 'ARL SURA', '/uploads/incapacidades/9/pago.pdf', 140000.00),
  (2, 4, 57804.00, '2026-04-20', 'PAGO-2026-011', 'Salud Total', '/uploads/incapacidades/11/pago.pdf', 0.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO seguimientos (
  id,
  incapacidad_id,
  fecha_contacto,
  canal_contacto,
  resultado_gestion,
  proximo_paso,
  auxiliar_id
) VALUES
  (1, 4, '2026-05-01', 'portal', 'ARL no ha emitido respuesta dentro del plazo esperado.', 'Escalar solicitud por canal virtual.', 1),
  (4, 5, '2026-05-07', 'correo', 'EPS confirma que el caso sigue en revision.', 'Revisar respuesta en cinco dias.', 1),
  (2, 8, '2026-03-08 08:00:00-05', 'portal', 'Cuenta de cobro enviada por portal.', 'Verificar pago semanalmente.', 1),
  (3, 10, '2026-04-09 08:00:00-05', 'telefono', 'Sin respuesta de la entidad.', 'Preparar derecho de peticion.', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rechazos (
  incapacidad_id,
  motivo_codigo,
  motivo_descripcion,
  fecha_notificacion,
  documento_notificacion,
  accion_seleccionada
) VALUES
  (7, 'DOC-001', 'Documento ilegible segun respuesta de la EPS.', '2026-02-21', '/uploads/incapacidades/7/rechazo.pdf', 're_radicar')
ON CONFLICT (incapacidad_id) DO NOTHING;

INSERT INTO cobros_juridicos (
  incapacidad_id,
  apoderado_legal,
  fecha_inicio,
  valor_en_disputa,
  numero_radicado_judicial,
  estado_proceso,
  resultado_final,
  novedades
) VALUES
  (10, 'Andrea Molina Restrepo', '2026-04-12', 816708.00, 'JUR-2026-010', 'Derecho de peticion radicado', NULL, '[{"fecha":"2026-04-12","descripcion":"Radicacion de derecho de peticion."}]')
ON CONFLICT (incapacidad_id) DO NOTHING;

INSERT INTO conciliaciones (
  incapacidad_id,
  valor_cobrado,
  valor_pagado,
  diferencia,
  valor_acordado,
  justificacion_diferencia,
  fecha_acuerdo,
  documentos_soporte
) VALUES
  (9, 560000.00, 420000.00, 140000.00, NULL, 'Entidad pago un valor inferior al cobrado.', NULL, '/uploads/incapacidades/9/conciliacion.pdf')
ON CONFLICT (incapacidad_id) DO NOTHING;

INSERT INTO auditorias (
  id,
  usuario_id,
  accion,
  entidad_afectada,
  entidad_id,
  detalle,
  ip_address
) VALUES
  (1, 1, 'SEED_DATOS_DEMO', 'incapacidades', 1, '{"descripcion":"Carga inicial de datos de prueba EPROS"}', '127.0.0.1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
