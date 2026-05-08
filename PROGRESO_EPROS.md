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

### Siguiente sesion sugerida

Implementar el CRUD completo de incapacidades desde el frontend y conectarlo con el flujo de estados, validacion documental y auditoria.
