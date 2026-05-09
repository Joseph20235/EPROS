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
**Commit funcional:** `Implementar CU-09 historial y CU-10 reportes`

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

---

## Sesion 9 - CU-09 Historial y CU-10 Reportes

**Estado:** completada
**Commit funcional:** pendiente

### Hecho

- Se implemento CU-09 en `/historial` con filtros por colaborador, rango de fechas, estado, tipo, EPS/ARL y area.
- El historial usa paginacion fija de 20 registros y muestra el total encontrado.
- Se agregaron endpoints backend:
  - `GET /api/incapacidades/historial`
  - `GET /api/incapacidades/historial/exportar`
- La exportacion del historial genera CSV compatible con Excel solo con los datos del listado.
- El expediente abierto desde historial queda en modo solo lectura en `/historial/:id`.
- `GET /api/incapacidades/:id` ahora devuelve expediente completo con estados, seguimientos, cobros, pagos, radicacion, validacion, transcripcion, rechazos, conciliacion, cobro juridico y documentos descargables.
- Se implemento CU-10 en `/reportes` con parametros configurables, previsualizacion y exportacion a PDF mediante impresion del navegador.
- Se agrego `POST /api/reportes/generar` con los 4 reportes solicitados:
  - Incapacidades por periodo, con totales por estado y tipo.
  - Cobros y pagos pendientes, para incapacidades `En_Cobro` y dias desde el cobro.
  - Reporte por colaborador, con historial, total de dias y diagnosticos frecuentes.
  - Incapacidades prolongadas, con colaboradores que acumulan mas de 90 dias.
- Cada generacion de reporte registra auditoria con accion `GENERAR_REPORTE`.
- Se corrigio la navegacion de Reportes para apuntar a `/reportes`.

### Archivos principales modificados

- `backend/routes/incapacidades.js`
- `backend/routes/reportes.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/Historial.jsx`
- `frontend/src/pages/ExpedienteIncapacidad.jsx`
- `frontend/src/pages/Reportes.jsx`
- `frontend/src/styles.css`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/routes/incapacidades.js
node --check backend/routes/reportes.js
npm.cmd run build
```

El build se ejecuto desde `frontend/`. Tambien se validaron por HTTP:

- `GET /api/incapacidades/historial?pagina=1`
- `GET /api/incapacidades/8`
- `GET /api/incapacidades/historial/exportar?estado=En_Cobro`
- `POST /api/reportes/generar` para los 4 tipos de reporte

### Comandos utiles

```bash
npm.cmd run dev --prefix backend
npm.cmd run dev --prefix frontend
```

---

## Sesion 10 - CU-12 Rechazo, CU-14 Conciliacion y CU-13 Cobro Juridico

**Estado:** completada
**Commit funcional:** pendiente

### Hecho

- Se implemento CU-12 en `/incapacidades/:id/rechazo`.
- El rechazo solo se registra desde `Radicada` o `En_Revision_EPS`.
- El formulario de rechazo incluye motivo configurable, otro motivo libre, fecha de notificacion, codigo de rechazo, observaciones y adjunto de notificacion EPS.
- Al registrar rechazo:
  - se guarda/actualiza `rechazos`
  - se cambia el estado a `Rechazada`
  - se registra auditoria con accion `REGISTRAR_RECHAZO`
- Se agregaron las acciones posteriores:
  - corregir y re-radicar cambia a `Transcrita`
  - impugnar guarda fecha de decision y plazo legal
  - cobro juridico redirige a CU-13
- Se implemento CU-14 en `/incapacidades/:id/conciliacion`.
- La conciliacion solo opera en `En_Conciliacion` y muestra valor cobrado, valor pagado y diferencia.
- Se agrego registro de gestiones con fecha de contacto, respuesta EPS y documentos intercambiados.
- Se agrego acuerdo final con valor acordado, justificacion y resultado:
  - pago adicional redirige a CU-08
  - aceptar diferencia cambia a `Pagada`
  - sin acuerdo redirige a CU-13
- Se implemento CU-13 en `/incapacidades/:id/juridico`.
- El cobro juridico se habilita desde rechazo, conciliacion, estado juridico o cobro vencido por mas de 180 dias.
- Se agrego formulario de proceso juridico con apoderado, fecha inicio, valor en disputa y radicado judicial opcional.
- Se agrego seccion de novedades juridicas.
- Se agrego resultado final:
  - exito redirige a CU-08 para registrar pago
  - acuerdo cierra como `Pagada`
  - desistimiento y perdida cierran como `Cerrada_Sin_Pago`
  - perdida genera alerta de revision interna en seguimientos
- El expediente y el historial muestran accesos contextuales a rechazo, conciliacion y juridico.
- Se amplio el esquema de SQLite para soportar decision de rechazo, gestiones de conciliacion y motivo de cierre juridico.

### Archivos principales modificados

- `backend/db/migrations/001_create_epros_schema.sql`
- `backend/routes/incapacidades.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/RechazoIncapacidad.jsx`
- `frontend/src/pages/ConciliacionIncapacidad.jsx`
- `frontend/src/pages/JuridicoIncapacidad.jsx`
- `frontend/src/pages/ExpedienteIncapacidad.jsx`
- `frontend/src/pages/Historial.jsx`
- `frontend/src/pages/PagoIncapacidad.jsx`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/routes/incapacidades.js
node --check backend/server.js
npm.cmd run build --prefix frontend
```

Tambien se valido la migracion y el seeder contra una base SQLite temporal:

```bash
$env:SQLITE_DB_PATH='D:\USER\Documents\EPROS\backend\database\epros-cu10-test.sqlite'
npm.cmd run db:init --prefix backend
```

Prueba real por HTTP en puerto temporal:

- `GET /api/incapacidades/4/rechazo` devolvio `disponible: true`
- `GET /api/incapacidades/9/conciliacion` devolvio `disponible: true`
- `GET /api/incapacidades/10/juridico` devolvio `disponible: true`

---

## Sesion 11 - CU-11 Monitorear Incapacidades Prolongadas

**Estado:** completada
**Commit funcional:** `Implementar CU-11 monitoreo de incapacidades prolongadas`

### Hecho

- Se implemento CU-11 en la ruta frontend `/alertas`.
- Se agrego el backend `/api/alertas` con:
  - listado de alertas activas/reprogramadas
  - ejecucion manual del monitoreo con `POST /api/alertas/monitorear`
  - detalle de caso alertado
  - registro de acciones por alerta
- El monitoreo calcula dias acumulados por colaborador sumando incapacidades activas.
- Se aplican los umbrales normativos:
  - nivel 1 desde 90 dias
  - nivel 2 desde 120 dias
  - nivel 3 desde 150 dias
  - nivel 4 desde 180 dias
  - nivel 5 desde 540 dias en los ultimos 3 anios
- Se agregaron las tablas:
  - `alertas_prolongadas`
  - `acciones_alerta_prolongada`
- El panel `/alertas` muestra colaboradores criticos con nombre, dias acumulados, diagnostico principal, EPS/ARL y nivel.
- El listado se ordena por nivel descendente y luego por dias acumulados.
- El detalle muestra historial activo del colaborador y acciones recomendadas segun el umbral.
- El formulario de accion incluye tipo de accion por nivel, fecha, responsable, observaciones y proximo hito.
- Al registrar una accion:
  - se guarda en `acciones_alerta_prolongada`
  - se reprograma la alerta con el proximo hito
  - se registra una novedad en `seguimientos` para verla en el expediente
  - se registra auditoria con accion `REGISTRAR_ACCION_ALERTA_PROLONGADA`
- El expediente muestra las acciones registradas por alertas prolongadas.
- Se agregaron datos semilla para probar alertas de niveles 1 a 5.

### Archivos principales modificados

- `backend/db/migrations/001_create_epros_schema.sql`
- `backend/db/seeders/001_seed_epros_demo_data.sql`
- `backend/routes/alertas.js`
- `backend/routes/incapacidades.js`
- `backend/server.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/Alertas.jsx`
- `frontend/src/pages/ExpedienteIncapacidad.jsx`
- `frontend/src/styles.css`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/routes/alertas.js
node --check backend/routes/incapacidades.js
node --check backend/server.js
npm.cmd run build --prefix frontend
```

Tambien se valido la migracion y el seeder contra una base SQLite temporal:

```bash
$env:SQLITE_DB_PATH='D:\USER\Documents\EPROS\backend\database\epros-cu11-test.sqlite'
npm.cmd run db:init --prefix backend
```

Prueba real por HTTP en puerto temporal `4111`:

- `POST /api/alertas/monitorear` genero 5 alertas.
- `GET /api/alertas` devolvio primero el caso nivel 5.
- `GET /api/alertas/:id` devolvio acciones disponibles por umbral.
- `POST /api/alertas/:id/acciones` registro una accion y reprogramo el proximo hito a `2026-06-08`.


---

## Sesion 12 - Autenticacion y control de acceso

**Estado:** completada

### Hecho

- Se implemento el sistema de autenticacion JWT sin dependencias externas en `backend/auth.js`:
  - Firma HMAC-SHA256 implementada manualmente con `node:crypto`
  - Hashing de passwords con PBKDF2 (120000 iteraciones)
  - Generacion y verificacion de tokens con soporte de revocacion en base de datos
- Se implemento el middleware de autenticacion y control de acceso en `backend/middleware/auth.js`:
  - `autenticar`: verifica el token Bearer en cada peticion a `/api/*`
  - `controlarAcceso`: aplica guards por rol antes de dejar pasar la solicitud
- Se agregaron las rutas `/api/auth/login` y `/api/auth/logout` en `backend/routes/auth.js`:
  - Login valida credenciales, genera JWT y registra auditoria con accion `LOGIN`
  - Logout revoca el token insertandolo en `tokens_revocados` y registra auditoria con accion `LOGOUT`
- Se aplico proteccion global sobre todas las rutas `/api/*` incluyendo `/api/health`, que ahora exige token valido
- Se implementaron guards por rol:
  - `ADMIN`: acceso total a todos los modulos y operaciones
  - `AUXILIAR`: gestion completa de incapacidades, seguimiento, alertas y reportes; solo lectura en catalogos administrativos (colaboradores y EPS/ARL)
  - `READONLY`: acceso unicamente a historial, expediente individual y reportes
- Se actualizaron los seeders con tres usuarios de prueba:
  - `admin@epros.com` / `Admin123!` — rol ADMIN
  - `auxiliar@epros.com` / `Aux123!` — rol AUXILIAR
  - `consulta@epros.com` / `Con123!` — rol READONLY
- Se implemento el login real en `frontend/src/pages/Login.jsx` con encabezado EPROS y subtitulo Sistema de Gestion de Incapacidades
- Se implemento la gestion de sesion en `frontend/src/auth.js`:
  - Sesion persistida en `localStorage` con verificacion de expiración al leer
  - Interceptor global de `fetch` que inyecta el header `Authorization: Bearer <token>` en todas las peticiones a la API
  - Redireccion automatica al login cuando el servidor responde 401
  - Funcion `logout` que llama a `/api/auth/logout` y limpia la sesion local
  - Funcion `puedeAcceder` para filtrar elementos de navegacion segun el rol del usuario
- La navegacion del sidebar se filtra dinamicamente segun el rol de la sesion activa

### Archivos principales modificados

- `backend/auth.js`
- `backend/middleware/auth.js`
- `backend/routes/auth.js`
- `backend/server.js`
- `backend/db/seeders/001_seed_epros_demo_data.sql`
- `frontend/src/auth.js`
- `frontend/src/pages/Login.jsx`
- `frontend/src/main.jsx`
- `PROGRESO_EPROS.md`

### Verificacion

```bash
node --check backend/auth.js
node --check backend/middleware/auth.js
node --check backend/routes/auth.js
node --check backend/server.js
npm.cmd run build --prefix frontend
```