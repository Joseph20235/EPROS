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
