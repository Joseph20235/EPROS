# EPROS — Sistema de Gestión de Incapacidades Médicas
## Documento de Contexto para Desarrollo con Codex (VS Code)

> **Proyecto académico** | Ingeniería de Software | Entrega en ~1.5 semanas  
> **Equipo:** Joseph Osorio Cubillos · Meycol Kleym Quintero Castaño · Isabella Cardona Betancourt

---

## 1. RESUMEN EJECUTIVO DEL PROYECTO

**EPROS** es una aplicación web interna para digitalizar la gestión de incapacidades médicas y licencias laborales dentro del área de Gestión Humana de una organización. Actualmente el proceso es manual (archivos físicos, correos, hojas de cálculo), lo cual genera errores, pérdidas de información y falta de trazabilidad.

**El sistema debe permitir:**
- Registrar y validar incapacidades médicas (EPS / ARL / Licencias de maternidad y paternidad)
- Hacer seguimiento del ciclo de vida completo de cada incapacidad
- Gestionar cobros, pagos, rechazos, conciliaciones y cobro jurídico
- Consultar historial y generar reportes de ausentismo

---

## 2. STACK TECNOLÓGICO (a confirmar / continuar con el avance previo)

> El avance ya iniciado en el chat anterior usa este stack (ajustar si difiere):

```
Frontend:   React + Vite (o Next.js)
Backend:    Node.js / Express (o Laravel / Django — confirmar)
Base datos: PostgreSQL (o MySQL)
Auth:       JWT
Estilos:    Tailwind CSS
```

**Si el proyecto ya tiene estructura**, continuar respetando la arquitectura existente.

---

## 3. ACTORES DEL SISTEMA

| Actor | Rol |
|---|---|
| **Auxiliar de Talento Humano** | Usuario principal. Registra, valida, gestiona y hace seguimiento de incapacidades |
| **Colaborador** | Persona que presenta la incapacidad (usuario indirecto) |
| **EPS / ARL** | Entidad externa que aprueba, rechaza y paga |
| **Área Administrativa** | Consulta reportes y estadísticas |
| **Sistema (EPROS)** | Ejecuta monitoreos automáticos, genera alertas, cambia estados |

---

## 4. MODELO DE DATOS — ENTIDADES PRINCIPALES

### 4.1 Entidad `Incapacidad` (central)
```
- id
- numero_incapacidad (único por colaborador)
- colaborador_id (FK)
- fecha_inicio
- fecha_fin
- numero_dias
- diagnostico_cie10 (código CIE-10)
- entidad_emisora (nombre médico / IPS)
- tipo: ENUM('EPS', 'ARL', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD', 'ACCIDENTE_TRANSITO', 'ACCIDENTE_LABORAL', 'ENFERMEDAD_GENERAL')
- estado_actual (FK a Estado)
- documento_adjunto (ruta del archivo)
- observaciones
- created_at / updated_at
- created_by (FK Usuario)
```

### 4.2 Entidad `Colaborador`
```
- id
- numero_identificacion (único)
- nombre_completo
- cargo
- area
- eps_arl_id (FK)
- salario_base
- activo: boolean
```

### 4.3 Entidad `Estado` (historial de estados)
```
- id
- incapacidad_id (FK)
- estado: ENUM('Registrada','En_Validacion','Transcrita','Radicada','En_Revision_EPS','Aprobada','Rechazada','En_Cobro','En_Conciliacion','Cobro_Juridico','Pagada','Cerrada_Sin_Pago')
- fecha_cambio
- usuario_id (FK)
- justificacion
- es_estado_actual: boolean
```

### 4.4 Entidad `Validacion`
```
- id
- incapacidad_id (FK)
- firma_medico: boolean
- sello_ips: boolean
- fechas_coherentes: boolean
- codigo_cie10_valido: boolean
- numero_incapacidad_legible: boolean
- epicrisis_adjunta: boolean (requerida si días > 2, accidente tránsito/laboral, licencias)
- furips_adjunto: boolean (requerida en accidente tránsito)
- observaciones
- aprobada_por (FK Usuario)
- fecha_validacion
```

### 4.5 Entidad `Radicacion`
```
- id
- incapacidad_id (FK)
- numero_radicado (único)
- fecha_radicacion
- canal: ENUM('presencial','virtual','correo')
- funcionario_eps_receptor
- comprobante_adjunto
- fecha_limite_respuesta_eps
- auxiliar_id (FK Usuario)
```

### 4.6 Entidad `Cobro`
```
- id
- incapacidad_id (FK)
- valor_calculado
- valor_ajustado (si hubo ajuste manual)
- justificacion_ajuste
- fecha_cobro
- documento_cuenta_cobro (ruta PDF generado)
- estado: ENUM('Pendiente','En_Proceso','Pagado','En_Conciliacion','Juridico')
```

### 4.7 Entidad `Pago`
```
- id
- cobro_id (FK)
- valor_pagado
- fecha_pago
- numero_referencia
- entidad_pagadora
- comprobante_adjunto
- diferencia_detectada (valor_cobrado - valor_pagado)
```

### 4.8 Entidad `Seguimiento`
```
- id
- incapacidad_id (FK)
- fecha_contacto
- canal_contacto
- resultado_gestion
- proximo_paso
- auxiliar_id (FK Usuario)
- created_at
```

### 4.9 Entidad `EPS_ARL`
```
- id
- nombre
- tipo: ENUM('EPS','ARL')
- porcentaje_reconocimiento (ej: 66.67%)
- plazo_respuesta_dias
- portal_url
- correo_radicacion
```

### 4.10 Entidad `Rechazo`
```
- id
- incapacidad_id (FK)
- motivo_codigo
- motivo_descripcion
- fecha_notificacion
- documento_notificacion
- accion_seleccionada: ENUM('re_radicar','impugnar','cobro_juridico')
```

### 4.11 Entidad `CobroJuridico`
```
- id
- incapacidad_id (FK)
- apoderado_legal
- fecha_inicio
- valor_en_disputa
- numero_radicado_judicial
- estado_proceso
- resultado_final: ENUM('exito','desistimiento','acuerdo','perdida')
- novedades: JSON (array de {fecha, descripcion})
```

### 4.12 Entidad `Conciliacion`
```
- id
- incapacidad_id (FK)
- valor_cobrado
- valor_pagado
- diferencia
- valor_acordado
- justificacion_diferencia
- fecha_acuerdo
- documentos_soporte
```

### 4.13 Entidad `Auditoria`
```
- id
- usuario_id (FK)
- accion
- entidad_afectada
- entidad_id
- detalle: JSON
- ip_address
- created_at
```

---

## 5. FLUJO DE ESTADOS DE UNA INCAPACIDAD

```
REGISTRADA
    ↓ (CU-02 Validar)
EN_VALIDACION
    ↓ (CU-03 Transcribir)
TRANSCRITA
    ↓ (CU-04 Radicar)
RADICADA
    ↓ (EPS revisa)
EN_REVISION_EPS
    ↓              ↘
APROBADA        RECHAZADA
    ↓               ↓
EN_COBRO     [re-radicar → TRANSCRITA]
    ↓         [impugnar]
  PAGADA      [cobro jurídico → COBRO_JURIDICO]
    o
EN_CONCILIACION → PAGADA (acuerdo) o COBRO_JURIDICO (sin acuerdo)
COBRO_JURIDICO → PAGADA (éxito) o CERRADA_SIN_PAGO (pérdida)
```

**Transiciones válidas (matriz):**
- `Registrada` → `En_Validacion` | `Registrada` (si falla validación)
- `En_Validacion` → `Transcrita`
- `Transcrita` → `Radicada`
- `Radicada` → `En_Revision_EPS` → `Aprobada` | `Rechazada`
- `Aprobada` → `En_Cobro`
- `En_Cobro` → `Pagada` | `En_Conciliacion` | `Cobro_Juridico`
- `En_Conciliacion` → `Pagada` | `Cobro_Juridico`
- `Cobro_Juridico` → `Pagada` | `Cerrada_Sin_Pago`
- `Rechazada` → `Transcrita` (re-radicar) | `Cobro_Juridico`

---

## 6. CASOS DE USO — RESUMEN FUNCIONAL

### CU-01: Registrar Incapacidad
- **Actor:** Auxiliar TH
- **Campos:** número incapacidad, colaborador (buscar por ID/nombre), fecha inicio, fecha fin, días, CIE-10, entidad emisora, tipo, adjunto (PDF/JPG/PNG)
- **Validaciones:** no duplicados (mismo colaborador + número), formato CIE-10, archivo válido
- **Resultado:** estado `Registrada`, registro en auditoría

### CU-02: Validar Documentación
- **Actor:** Auxiliar TH
- **Checklist dinámico según tipo:**
  - Firma médico ✓, Sello IPS ✓, Fechas coherentes ✓, CIE-10 válido ✓, Número legible ✓
  - Epicrisis (obligatoria si días > 2, accidente, licencias)
  - FURIPS (obligatoria en accidente tránsito)
  - Certificado nacido vivo + registro civil (licencias maternidad/paternidad)
- **Resultado:** estado `En_Validacion` (si aprueba) | permanece `Registrada` (si hay ítems críticos sin cumplir)

### CU-03: Transcribir Incapacidad
- **Actor:** Auxiliar TH
- **Campos adicionales:** código CIE-10 detallado, tipo licencia médica, nombre médico tratante, registro médico, IPS
- **Resultado:** estado `Transcrita`

### CU-04: Radicar Incapacidad
- **Actor:** Auxiliar TH + EPS/ARL (externo)
- **Campos:** número radicado (único), fecha radicación, canal, funcionario EPS receptor, comprobante adjunto
- **Lógica:** calcular fecha límite respuesta según tabla de plazos por EPS; generar alerta de seguimiento
- **Resultado:** estado `Radicada`

### CU-05: Gestionar Estado
- **Actor:** Auxiliar TH + Sistema
- **Lógica:** mostrar solo transiciones válidas; justificación obligatoria en ciertos cambios; auditoría completa

### CU-06: Seguimiento
- **Actor:** Auxiliar TH + Sistema (automático diario)
- **Panel semáforo:** 🔴 vencida | 🟡 vence en ≤5 días | 🟢 en plazo
- **Registro novedades:** fecha contacto, resultado gestión, próximo paso

### CU-07: Gestionar Cobro
- **Cálculo automático:**
  - Días 1-2: 100% IBC → lo paga la empresa
  - Días 3-90: 67% IBC → lo paga EPS
  - Días 91-180: 50% IBC → lo paga EPS
  - Días > 180: trámite directo colaborador ante AFP
  - ARL: 100% desde día 1
- **Fórmula:** `valor = días_a_cobrar × (salario_base / 30) × porcentaje_reconocimiento`
- **Resultado:** estado `En_Cobro`, PDF cuenta de cobro generado

### CU-08: Registrar Pago
- **Actor:** Auxiliar TH
- **Lógica:** comparar `valor_pagado` vs `valor_cobrado`; si iguales → `Pagada`; si difieren → `En_Conciliacion`

### CU-09: Consultar Historial
- **Filtros:** colaborador, rango fechas, estado, tipo, EPS/ARL, área
- **Vista:** solo lectura, expediente completo con timeline de estados
- **Exportar:** Excel / PDF (opcional)

### CU-10: Generar Reportes
- **Tipos:** por período, por EPS/ARL, por colaborador, incapacidades prolongadas, cobros y pagos pendientes
- **Formatos:** PDF y Excel
- **Incluir:** gráficos estadísticos, resumen ejecutivo

### CU-11: Monitorear Incapacidades Prolongadas
- **Umbrales (normativa colombiana):**
  - Alerta 1: ≥ 90 días (reporte mensual)
  - Alerta 2: ≥ 120 días (solicitar concepto rehabilitación a EPS)
  - Alerta 3: ≥ 150 días (enviar concepto a AFP)
  - Alerta 4: ≥ 180 días (suspensión pago nómina, gestión ante AFP)
  - Alerta 5: ≥ 540 días en 3 años
- **Monitoreo:** job automático diario

### CU-12: Gestionar Rechazo
- **Campos:** motivo (catálogo configurable por EPS), fecha notificación, código rechazo, documento adjunto
- **Acciones posibles:** re-radicar | impugnar | cobro jurídico

### CU-13: Gestionar Cobro Jurídico
- **Escalamiento cuando:**
  - Cobro pendiente > 180 días sin pago
  - Rechazo injustificado
- **Proceso:** derecho de petición → acción de tutela
- **Campos:** apoderado, fecha inicio, radicado judicial, novedades de audiencias
- **Resultado:** `Pagada` | `Cerrada_Sin_Pago`

### CU-14: Conciliación
- **Activado por:** diferencia entre valor cobrado y pagado
- **Resultado:** pago adicional (→ CU-08) | aceptar diferencia con justificación | escalar a jurídico (→ CU-13)

---

## 7. REGLAS DE NEGOCIO CLAVE

```
RN-01: Los primeros 2 días de incapacidad los paga la empresa (100% IBC)
RN-02: Del día 3 al 90 la EPS paga el 67% del IBC
RN-03: Del día 91 al 180 la EPS paga el 50% del IBC
RN-04: Desde el día 181, el colaborador gestiona el pago ante su AFP
RN-05: La ARL paga el 100% desde el día 1 en accidentes laborales
RN-06: Epicrisis es OBLIGATORIA si días > 2, accidente tránsito/laboral, licencias
RN-07: FURIPS es OBLIGATORIA solo en accidentes de tránsito
RN-08: La licencia de paternidad solo tiene 30 días calendario desde el nacimiento para tramitar
RN-09: Plazo máximo de las EPS para pagar: 3 años desde la radicación
RN-10: Si cobro supera 180 días sin pago → escalar a cobro jurídico (persuasivo primero)
RN-11: Las transiciones de estado deben seguir la matriz definida (no saltos directos)
RN-12: Todo cambio de estado queda registrado con fecha, hora y usuario (auditoría)
```

### Tabla de plazos de transcripción por EPS
| EPS | Plazo transcripción | Observación |
|---|---|---|
| Salud Total | 12 meses (accidentes tránsito: 15 días) | |
| Nueva EPS | 12 meses | |
| SOS | 12 meses | Solo por correo/personal |
| Sanitas | 3 años | Solo por correo/personal |
| SURA EPS | 150 días calendario | |
| Asmet Salud | 12 meses | |
| ARL SURA | 12 meses | |
| Licencia paternidad | 30 días calendario desde nacimiento | Aplica todas las EPS |

---

## 8. MÓDULOS DE LA APLICACIÓN

```
/auth           → Login, sesión JWT, roles
/dashboard      → Panel resumen: alertas semáforo, métricas, accesos rápidos
/incapacidades
  /nueva        → CU-01: Formulario registro
  /lista        → Listado con filtros y estados
  /:id          → Expediente completo (timeline de estados, documentos, novedades)
  /:id/validar  → CU-02: Checklist validación
  /:id/transcribir → CU-03
  /:id/radicar  → CU-04
  /:id/estado   → CU-05: Cambio de estado
  /:id/seguimiento → CU-06: Registrar novedad
  /:id/cobro    → CU-07: Gestionar cobro
  /:id/pago     → CU-08: Registrar pago
  /:id/rechazo  → CU-12
  /:id/juridico → CU-13
  /:id/conciliacion → CU-14
/seguimiento    → Panel semáforo de seguimiento activo
/historial      → CU-09: Búsqueda y consulta histórica
/reportes       → CU-10: Generación de reportes
/alertas        → CU-11: Panel incapacidades prolongadas
/admin
  /colaboradores → CRUD colaboradores
  /eps-arl      → CRUD entidades
  /usuarios     → Gestión de usuarios y permisos
```

---

## 9. DIAGRAMAS UML — RESUMEN

### Diagrama de Clases (núcleo)
- **Azul (núcleo):** Usuario, Colaborador, Incapacidad, Estado, Validacion, EPS_ARL, Cobro, Pago
- **Rojo (excepciones):** Rechazo, CobroJuridico, Conciliacion
- **Verde (consulta):** Seguimiento, Reporte, Auditoria
- **Violeta (utilitaria):** Filtro

**Relaciones:**
- `Colaborador (1) → Incapacidad (*)` — "Tiene"
- `Usuario (1) → Incapacidad (*)` — "Gestiona"
- `Incapacidad (*) → Estado (1)` — "pertenece a"
- `Incapacidad ◆→ Validacion` (composición)
- `Incapacidad ◆→ Cobro (1..*)` (composición)
- `Cobro ◆→ Pago (0..1)` (composición)
- `Incapacidad → EPS_ARL` — "radica en"
- `Incapacidad --→ Rechazo / CobroJuridico / Conciliacion (0..1)` (dependencia)
- `Incapacidad → Seguimiento (1..*)` (asociación)

### Diagrama de Estados
Los colores del diagrama original:
- 🟢 Verde: Registrada, Aprobada, Pagada
- 🟠 Naranja: Estados de proceso inicial
- 🔵 Azul: En Cobro
- 🔴 Rojo: Rechazada
- 🟡 Amarillo: En Conciliación
- 🟣 Lila: Cobro Jurídico
- ⚪ Gris: Cerrada

---

## 10. PROCEDIMIENTO REAL DE NEGOCIO (del manual interno)

El proceso real documentado por la organización es:

1. **Colaborador informa** al jefe inmediato y a Gestión Humana (dentro de 2 días)
2. **Recepcionista recibe** documentos físicos y diligencia formato de seguimiento
3. **Auxiliar verifica** documentación completa (3 días hábiles para subsanar si hay faltantes)
4. **Auxiliar transcribe** en portal de la EPS correspondiente (o por correo en SOS/Sanitas/Famisanar)
5. **Auxiliar remite** al SG-SST informe de ausentismo los primeros 3 días de cada mes
6. **Auxiliar radica** ante EPS (web o físico) con escaneo de documentos
7. **EPS notifica** aceptación y tiempo de pago por correo
8. **Auxiliar gestiona cobro** semanalmente por canales de la EPS
9. **EPS transfiere** pago a cuenta de tesorería
10. **Auxiliar hace seguimiento** semanal, lleva registro de saldos adeudados
11. **Auxiliar identifica pagos** recibidos por EPS/ARL
12. **Conciliación contable** con el área de contabilidad
13. **Cobro jurídico** si hay negativa injustificada (derecho de petición → tutela)
14. **Archivo** de incapacidades pagadas (destruir epicrisis/historia clínica)

---

## 11. ENTREGABLES PENDIENTES (para la semana y media restante)

Basado en el avance existente, priorizar en este orden:

### Prioridad ALTA (sin esto no funciona el sistema)
- [ ] CRUD completo de Incapacidades (CU-01)
- [ ] Módulo de Validación con checklist dinámico (CU-02)
- [ ] Gestión de estados con matriz de transiciones (CU-05)
- [ ] Seguimiento con panel semáforo (CU-06)
- [ ] Historial / expediente completo (CU-09)
- [ ] Dashboard con métricas básicas

### Prioridad MEDIA
- [ ] Módulo de Cobro con cálculo automático (CU-07)
- [ ] Registro de Pago (CU-08)
- [ ] Reportes básicos (CU-10)
- [ ] Gestión de Rechazo (CU-12)

### Prioridad BAJA (si alcanza el tiempo)
- [ ] Conciliación (CU-14)
- [ ] Cobro Jurídico (CU-13)
- [ ] Monitoreo incapacidades prolongadas con job automático (CU-11)
- [ ] Exportación de reportes PDF/Excel

---

## 12. INSTRUCCIONES PARA CODEX

### Cómo trabajar con este proyecto

1. **Revisar la estructura existente** antes de generar código nuevo. Respetar el stack y convenciones ya usadas.

2. **Al implementar el modelo de datos:**
   - Crear migraciones para cada entidad descrita en la sección 4
   - La entidad `Estado` debe guardar el historial completo (no solo el estado actual)
   - La entidad `Auditoria` debe registrar automáticamente toda operación crítica

3. **Al implementar la lógica de estados (CU-05):**
   - Implementar la matriz de transiciones como una constante o tabla de configuración
   - Nunca permitir saltos directos que no estén en la matriz
   - Siempre registrar el cambio en la tabla `Estado`

4. **Al implementar el cálculo de cobro (CU-07):**
   ```
   días 1-2   → empresa paga (no cobrar a EPS)
   días 3-90  → 67% IBC por día a cobrar a EPS
   días 91-180 → 50% IBC por día a cobrar a EPS
   días > 180  → no aplica cobro a EPS (AFP)
   ARL: 100% desde día 1
   Fórmula: valor = dias_eps × (salario_base / 30) × porcentaje
   ```

5. **Al implementar el checklist de validación (CU-02):**
   - Los ítems del checklist deben ser dinámicos según el `tipo` de incapacidad
   - Usar la tabla de documentos requeridos de la sección 6 (CU-02)

6. **Al implementar alertas de seguimiento:**
   - Calcular `fecha_limite_respuesta` según tabla de plazos por EPS (sección 7)
   - Semáforo: rojo = vencida, amarillo = vence en ≤ 5 días, verde = en plazo

7. **Convenciones de código:**
   - Usar nombres en español para variables de negocio (siguiendo los documentos)
   - Toda acción sobre incapacidades debe registrarse en `Auditoria`
   - Los archivos adjuntos se guardan en `/uploads/incapacidades/:id/`

8. **Datos de prueba sugeridos:**
   - 3-5 colaboradores ficticios con diferentes EPS
   - Incapacidades en distintos estados del flujo
   - Al menos 1 caso en cada estado para poder probar el flujo completo

---

## 13. REFERENCIAS Y NORMATIVA

- **Ley 1822 de 2017** — Licencia de maternidad (18 semanas / 20 semanas parto múltiple)
- **Licencia de paternidad** — 14 días calendario
- **Porcentajes IBC:** días 1-2 (100% empresa), días 3-90 (67% EPS), días 91-180 (50% EPS)
- **Plazo EPS para pagar:** máximo 3 años
- **Cobro jurídico:** derecho de petición → acción de tutela si no hay respuesta
- **Monitoreo:** reportes mensuales a 90, 120, 150 y 180 días
- **Manual de referencia:** Procedimiento interno de incapacidades — Área Gestión Humana (14 páginas, versión 001)

---

*Documento generado a partir de: Taller Visión y Alcance, Acta Diagramas UML Entrega 2, y Manual de Procedimiento de Incapacidades.*
