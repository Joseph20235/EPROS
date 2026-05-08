# Progreso EPROS

## Sesion 1 - Configuracion base y SQLite

**Estado:** completada  
**Commit:** `4213752 Configurar SQLite y datos base de EPROS`

### Hecho

- Se mantuvo el stack React + Vite en `frontend/`.
- Se mantuvo Node.js + Express en `backend/`.
- Se reemplazo PostgreSQL (`pg`) por SQLite con `better-sqlite3`.
- Se creo la configuracion de base de datos local en `backend/db.js`.
- Se creo la migracion SQLite principal en `backend/db/migrations/001_create_epros_schema.sql`.
- Se creo el seeder demo en `backend/db/seeders/001_seed_epros_demo_data.sql`.
- Se agrego el script `npm.cmd run db:init --prefix backend` para recrear la base.
- Se conectaron las rutas principales del backend a SQLite:
  - `/api/colaboradores`
  - `/api/incapacidades`
  - `/api/reportes/resumen`
  - `/api/reportes/mensual`
- Se verifico que la base carga:
  - 5 colaboradores
  - 4 EPS/ARL
  - 12 incapacidades, una por cada estado del flujo
- Se actualizo `.gitignore` para no subir `backend/database/epros.sqlite`.

### Comandos utiles

```bash
npm.cmd install --prefix backend
npm.cmd run db:init --prefix backend
npm.cmd run dev --prefix backend
```

### Siguiente sesion sugerida

Implementar el CRUD real de incapacidades desde el frontend usando el backend SQLite.

---

## Sesion 2 - Modulo de administracion

**Estado:** completada  
**Commit funcional:** `d20c580 Implementar modulo de administracion`

### Hecho

- Se implemento el CRUD administrativo de colaboradores en backend:
  - listado paginado
  - busqueda por nombre o numero de identificacion
  - consulta individual
  - creacion
  - edicion
  - desactivacion por soft delete usando `activo`
- Se agregaron validaciones de negocio para colaboradores:
  - `numero_identificacion` unico
  - `salario_base` mayor a 0
  - existencia de la EPS/ARL seleccionada
- Se implemento el CRUD administrativo de EPS/ARL en backend:
  - listado con filtros por nombre y tipo
  - consulta individual
  - creacion
  - edicion
  - eliminacion controlada cuando no hay colaboradores asociados
- Se agrego la ruta `/api/eps-arl` en `backend/server.js`.
- Todas las acciones administrativas nuevas registran auditoria en la tabla `auditorias`.
- Se precargaron EPS/ARL segun la tabla de plazos de transcripcion:
  - Salud Total
  - Nueva EPS
  - SOS
  - Sanitas
  - SURA EPS
  - Asmet Salud
  - ARL SURA
- Se agregaron las pantallas frontend de administracion:
  - `/admin/colaboradores`
  - `/admin/eps-arl`
- Se agregaron formularios crear/editar para las entidades `Colaborador` y `EPS_ARL`.
- Se conectaron las pantallas al backend mediante `fetch`.
- Se actualizaron estilos para tablas administrativas, acciones, formularios, paginacion, estados y mensajes de validacion.

### Archivos principales modificados

- `backend/routes/colaboradores.js`
- `backend/routes/epsArl.js`
- `backend/server.js`
- `backend/db/seeders/001_seed_epros_demo_data.sql`
- `frontend/src/pages/AdminColaboradores.jsx`
- `frontend/src/pages/AdminEpsArl.jsx`
- `frontend/src/main.jsx`
- `frontend/src/styles.css`

### Verificacion

```bash
npm.cmd run db:init --prefix backend
npm.cmd run build --prefix frontend
```

Adicionalmente se valido el healthcheck del backend en:

```bash
http://localhost:4000/api/health
```

### Comandos utiles

```bash
npm.cmd run start --prefix backend
npm.cmd run dev --prefix frontend
```

---

## Sesion 3 - CU-01 Registrar Incapacidad

**Estado:** completada  
**Commit funcional:** `Implementar CU-01 registro de incapacidades`

### Hecho

- Se implemento el caso de uso CU-01 en la ruta frontend `/incapacidades/nueva`.
- Se reemplazo el boceto de registro por un formulario funcional conectado al backend.
- Se agrego buscador/autocompletado de colaborador por numero de identificacion o nombre.
- Se autocompleta la EPS/ARL desde el perfil del colaborador seleccionado.
- Se agregaron los campos requeridos del modelo:
  - `numero_incapacidad`
  - `fecha_inicio`
  - `fecha_fin`
  - `numero_dias`
  - `diagnostico_cie10`
  - `entidad_emisora`
  - `tipo`
  - `observaciones`
- Se calcula automaticamente `numero_dias` entre fecha inicio y fecha fin.
- Se agrego selector de tipo usando el ENUM definido para incapacidades.
- Se implemento carga de adjunto PDF, JPG o PNG con limite de 5MB.
- El backend guarda los adjuntos en `backend/uploads/incapacidades/:id/` y expone `/uploads` como ruta estatica.
- Se agregaron validaciones en frontend y backend:
  - colaborador obligatorio
  - numero de incapacidad obligatorio
  - fechas obligatorias
  - fecha fin mayor o igual a fecha inicio
  - CIE-10 con formato valido, por ejemplo `A09` o `J11.1`
  - entidad emisora obligatoria
  - tipo obligatorio
  - adjunto obligatorio y con tipo/tamano permitido
  - no duplicar incapacidad para el mismo colaborador y numero
- Al guardar, el backend crea:
  - registro en `incapacidades`
  - primer registro en `estados` con estado `Registrada`
  - auditoria con accion `CREAR_INCAPACIDAD`
- Se muestra mensaje de exito con el ID generado y boton para ir a validar.
- Se ajusto la navegacion para que Registro apunte a `/incapacidades/nueva`.

### Archivos principales modificados

- `backend/server.js`
- `backend/routes/incapacidades.js`
- `backend/routes/colaboradores.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/Registro.jsx`
- `frontend/src/styles.css`

### Verificacion

```bash
node --check backend/server.js
node --check backend/routes/incapacidades.js
npm.cmd run build --prefix frontend
```

Tambien se hizo una prueba real del endpoint `POST /api/incapacidades` usando una base SQLite temporal:

- creo la incapacidad con estado inicial `Registrada`
- calculo `numero_dias`
- guardo el adjunto en `/uploads/incapacidades/:id/`
- rechazo correctamente un duplicado por colaborador y numero de incapacidad

### Comandos utiles

```bash
npm.cmd run dev --prefix backend
npm.cmd run dev --prefix frontend
```

---

## Sesion 4 - CU-02 Validar Documentacion

**Estado:** completada  
**Commit funcional:** `Implementar CU-02 validacion documental`

### Hecho

- Se implemento el caso de uso CU-02 en la ruta frontend `/incapacidades/:id/validar`.
- Se agrego una pantalla de validacion documental con:
  - detalle completo de la incapacidad
  - datos del colaborador y EPS/ARL
  - estado actual de la incapacidad
  - visor del documento adjunto PDF/JPG/PNG
  - checklist editable
  - observacion por item
  - observacion general
- Se implemento checklist dinamico en backend segun tipo y numero de dias:
  - todos los tipos incluyen firma medico, sello IPS, fechas coherentes, CIE-10 valido y numero legible
  - epicrisis se agrega si dias > 2, accidente laboral/transito o licencia
  - FURIPS se agrega para `ACCIDENTE_TRANSITO`
  - licencia de maternidad agrega certificado nacido vivo, registro civil y fotocopia documento identidad
  - licencia de paternidad agrega epicrisis semanas gestacion, certificado nacido vivo, registro civil y fotocopia documento identidad madre
- Cada item maneja los estados `Cumple`, `No cumple` y `Pendiente`.
- Se agrego persistencia del checklist completo en `validaciones.checklist_detalle` como JSON para conservar observaciones y estados por item.
- Se conservaron los campos booleanos existentes de `validaciones` para compatibilidad con el modelo previo.
- Se agregaron endpoints backend:
  - `GET /api/incapacidades/:id/validacion`
  - `PUT /api/incapacidades/:id/validacion`
  - `PUT /api/incapacidades/:id/validacion/aprobar`
- La aprobacion valida que todos los items criticos esten en `Cumple`.
- Si la validacion pasa:
  - se registra/actualiza la validacion
  - se cambia el estado a `En_Validacion`
  - se registra historial en `estados`
  - se registra auditoria con accion `APROBAR_VALIDACION_DOCUMENTAL`
- Si la validacion falla:
  - se bloquea la aprobacion
  - se devuelven y muestran los items criticos faltantes
  - el estado permanece en `Registrada`
  - se registra auditoria con accion `VALIDACION_DOCUMENTAL_BLOQUEADA`
- Se ajusto la navegacion SPA para reconocer rutas dinamicas de validacion.
- El boton `Ir a validar` despues de registrar una incapacidad abre la pantalla real de CU-02.

### Archivos principales modificados

- `backend/db/migrations/001_create_epros_schema.sql`
- `backend/routes/incapacidades.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/Registro.jsx`
- `frontend/src/pages/ValidarIncapacidad.jsx`
- `frontend/src/styles.css`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/server.js
node --check backend/routes/incapacidades.js
npm.cmd run build
```

El build se ejecuto desde `frontend/`. Tambien se valido la migracion y el seeder contra una base SQLite temporal:

```bash
$env:SQLITE_DB_PATH='D:\USER\Documents\EPROS\backend\database\epros-cu02-test.sqlite'
npm.cmd run db:init --prefix backend
```

### Comandos utiles

```bash
npm.cmd run dev --prefix backend
npm.cmd run dev --prefix frontend
```

---

## Sesion 5 - CU-03 Transcribir y CU-04 Radicar

**Estado:** completada  
**Commit funcional:** pendiente

### Hecho

- Se implemento el caso de uso CU-03 en la ruta frontend `/incapacidades/:id/transcribir`.
- Se agrego la tabla `transcripciones` al esquema SQLite con los campos:
  - `codigo_cie10_detallado`
  - `tipo_licencia_medica`
  - `medico_tratante`
  - `numero_registro_medico`
  - `ips_institucion`
  - `auxiliar_id`
  - `fecha_transcripcion`
- Se agregaron endpoints backend:
  - `GET /api/incapacidades/:id/transcripcion`
  - `PUT /api/incapacidades/:id/transcripcion`
- La transcripcion solo se permite cuando el estado actual es `En_Validacion`.
- El formulario de transcripcion se precarga con datos de la incapacidad y conserva borrador en `localStorage` con autoguardado cada 2 minutos.
- Al guardar la transcripcion:
  - se crea o actualiza el registro en `transcripciones`
  - el estado cambia a `Transcrita`
  - se registra historial en `estados`
  - se registra auditoria con accion `TRANSCRIBIR_INCAPACIDAD`
- Se implemento el caso de uso CU-04 en la ruta frontend `/incapacidades/:id/radicar`.
- Se agregaron endpoints backend:
  - `GET /api/incapacidades/:id/radicacion`
  - `PUT /api/incapacidades/:id/radicacion`
- La radicacion solo se permite cuando el estado actual es `Transcrita`.
- La radicacion valida:
  - `numero_radicado` obligatorio y unico frente a otras incapacidades
  - `fecha_radicacion` obligatoria
  - `canal` dentro de `presencial`, `virtual`, `correo`
  - comprobante PDF/JPG/PNG hasta 5MB
- La fecha limite de respuesta se calcula automaticamente usando `eps_arl.plazo_respuesta_dias` de la EPS/ARL del colaborador.
- Al confirmar la radicacion:
  - se crea o actualiza el registro en `radicaciones`
  - se guarda el comprobante en `backend/uploads/incapacidades/:id/`
  - el estado cambia a `Radicada`
  - se crea un registro de seguimiento tipo alerta para la fecha limite de respuesta
  - se registra auditoria con accion `RADICAR_INCAPACIDAD`
- Se conecto el Historial al endpoint real `/api/incapacidades`.
- El Historial ahora muestra acciones contextuales para validar, transcribir o radicar segun el estado actual.
- Se agregaron datos semilla para transcripciones de incapacidades ya avanzadas.

### Archivos principales modificados

- `backend/db/migrations/001_create_epros_schema.sql`
- `backend/db/seeders/001_seed_epros_demo_data.sql`
- `backend/routes/incapacidades.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/Historial.jsx`
- `frontend/src/pages/TranscribirIncapacidad.jsx`
- `frontend/src/pages/RadicarIncapacidad.jsx`
- `frontend/src/styles.css`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/routes/incapacidades.js
node --check backend/server.js
npm.cmd run build --prefix frontend
```

Tambien se valido la migracion y el seeder contra una base SQLite temporal:

```bash
$env:SQLITE_DB_PATH='D:\USER\Documents\EPROS\backend\database\epros-cu03-cu04-test.sqlite'
npm.cmd run db:init --prefix backend
```

Prueba real por HTTP usando el backend en puerto temporal `4104`:

- `PUT /api/incapacidades/2/transcripcion` cambio el estado a `Transcrita`
- `PUT /api/incapacidades/2/radicacion` cambio el estado a `Radicada`
- la fecha limite calculada para Nueva EPS fue `2027-05-07`
- el historial termino con 3 estados para la incapacidad probada

### Comandos utiles

```bash
npm.cmd run dev --prefix backend
npm.cmd run dev --prefix frontend
```

---

## Sesion 6 - CU-05 Gestionar Estado

**Estado:** completada  
**Commit funcional:** pendiente

### Hecho

- Se implemento la matriz de transiciones validas como constante en `backend/routes/incapacidades.js`.
- El endpoint `PATCH /api/incapacidades/:id/estado` ahora:
  - valida que el estado destino exista
  - bloquea saltos no definidos en la matriz
  - exige justificacion para todo cambio manual
  - mantiene el historial en `estados`
  - actualiza `incapacidades.estado_actual_id`
  - registra auditoria con accion `CAMBIAR_ESTADO_INCAPACIDAD`
- El endpoint `GET /api/incapacidades/:id` devuelve:
  - expediente completo
  - timeline de estados con usuario
  - transiciones validas desde el estado actual
- Se agrego la pantalla `/incapacidades/:id` para consultar el expediente completo.
- El expediente muestra:
  - estado actual con color segun el diagrama de estados
  - boton `Cambiar estado` con solo estados validos
  - justificacion obligatoria
  - timeline visual con fecha, hora, usuario y justificacion
  - boton `Iniciar cobro` cuando la incapacidad esta `Aprobada`
- El Historial ahora permite abrir el expediente desde cada fila y aplica colores a los estados.

### Archivos principales modificados

- `backend/routes/incapacidades.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/Historial.jsx`
- `frontend/src/pages/ExpedienteIncapacidad.jsx`
- `frontend/src/styles.css`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/routes/incapacidades.js
node --check backend/server.js
npm.cmd run build --prefix frontend
```

Tambien se valido por HTTP en puerto temporal `4105` con base SQLite temporal:

- `GET /api/incapacidades/4` devolvio estado `Radicada` y transicion valida `En_Revision_EPS`
- `PATCH /api/incapacidades/4/estado` intentando saltar a `Pagada` respondio `400`

---

## Sesion 7 - CU-06 Seguimiento y Dashboard

**Estado:** completada
**Commit funcional:** `Implementar CU-06 seguimiento y dashboard`

### Hecho

- Se implemento el caso de uso CU-06 en la ruta frontend `/seguimiento`.
- Se agrego la columna `fecha_ultimo_seguimiento` a `incapacidades`.
- Se agrego la ruta backend `/api/seguimiento` con:
  - listado de incapacidades en estado `Radicada` o `En_Revision_EPS`
  - calculo de semaforo por `fecha_limite_respuesta`
  - orden por prioridad: rojo, amarillo, verde
  - consulta de historial completo por incapacidad
  - registro de novedades de seguimiento
- Al registrar una novedad:
  - se guarda en `seguimientos`
  - se actualiza `incapacidades.fecha_ultimo_seguimiento`
  - se registra auditoria con accion `REGISTRAR_SEGUIMIENTO`
- El panel de seguimiento muestra:
  - tabla priorizada con semaforo visual
  - detalle e historial de la incapacidad seleccionada
  - formulario con `fecha_contacto`, `canal_contacto`, `resultado_gestion` y `proximo_paso`
  - enlace al expediente completo
- Se implemento el dashboard principal en `/dashboard`.
- Se agrego la ruta backend `/api/dashboard` con:
  - contador de incapacidades por estado
  - alertas urgentes rojas y amarillas
  - ultimas 5 incapacidades registradas
- El dashboard incluye accesos rapidos a:
  - Registrar nueva
  - Ver seguimiento
  - Ver historial
- Se ajustaron las semillas demo para incluir casos visibles de seguimiento vencido y por vencer.

### Archivos principales modificados

- `backend/db/migrations/001_create_epros_schema.sql`
- `backend/db/seeders/001_seed_epros_demo_data.sql`
- `backend/routes/seguimiento.js`
- `backend/routes/dashboard.js`
- `backend/server.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/Seguimiento.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/styles.css`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/routes/seguimiento.js
node --check backend/routes/dashboard.js
node --check backend/server.js
npm.cmd run build --prefix frontend
```

Tambien se valido la migracion y el seeder contra una base SQLite temporal:

```bash
$env:SQLITE_DB_PATH='D:\USER\Documents\EPROS\backend\database\epros-cu06-test.sqlite'
npm.cmd run db:init --prefix backend
```

Prueba real por HTTP usando el backend en puerto temporal `4106`:

- `GET /api/seguimiento` devolvio 2 incapacidades activas y la primera prioridad fue `rojo`
- `POST /api/seguimiento/5` creo una novedad de seguimiento
- el historial de la incapacidad quedo actualizado
- `GET /api/dashboard` devolvio 2 alertas urgentes y 5 ultimas incapacidades

---

## Sesion 8 - CU-07 Gestionar Cobro y CU-08 Registrar Pago

**Estado:** completada  
**Commit funcional:** pendiente

### Hecho

- Se implemento CU-07 en la ruta frontend `/incapacidades/:id/cobro`.
- Se agregaron endpoints backend:
  - `GET /api/incapacidades/:id/cobro`
  - `POST /api/incapacidades/:id/cobro`
- El cobro solo se permite cuando la incapacidad esta `Aprobada`.
- El backend calcula automaticamente el valor a cobrar con:
  - dias 1 a 2 excluidos del cobro EPS
  - dias 3 a 90 al 67% del IBC diario
  - dias 91 a 180 al 50% del IBC diario
  - dias mayores a 180 excluidos con alerta
  - ARL o accidente laboral al 100% desde el dia 1
- La pantalla de cobro muestra salario base, IBC diario, desglose por tramo, alertas y valor final.
- Se permite ajuste manual del valor; si difiere del calculado, exige justificacion.
- Al registrar cobro:
  - se crea registro en `cobros`
  - el estado cambia a `En_Cobro`
  - se registra auditoria con accion `REGISTRAR_COBRO`
- Se implemento CU-08 en la ruta frontend `/incapacidades/:id/pago`.
- Se agregaron endpoints backend:
  - `GET /api/incapacidades/:id/pago`
  - `POST /api/incapacidades/:id/pago`
- El pago solo se permite cuando la incapacidad esta `En_Cobro`.
- El registro de pago incluye:
  - `valor_pagado`
  - `fecha_pago`
  - `numero_referencia`
  - `entidad_pagadora`
  - comprobante PDF/JPG/PNG hasta 5MB
- Al registrar pago:
  - se guarda en `pagos`
  - si la diferencia con el valor cobrado es menor o igual a $1, cambia a `Pagada`
  - si hay diferencia mayor a $1, cambia a `En_Conciliacion` y crea/actualiza `conciliaciones`
  - se actualiza el estado del cobro a `Pagado` o `En_Conciliacion`
  - se registra auditoria con accion `REGISTRAR_PAGO`
- El Historial y el Expediente muestran acciones contextuales para cobro y pago.

### Archivos principales modificados

- `backend/routes/incapacidades.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/CobroIncapacidad.jsx`
- `frontend/src/pages/PagoIncapacidad.jsx`
- `frontend/src/pages/Historial.jsx`
- `frontend/src/pages/ExpedienteIncapacidad.jsx`
- `frontend/src/styles.css`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/server.js
node --check backend/routes/incapacidades.js
npm.cmd run build --prefix frontend
```
