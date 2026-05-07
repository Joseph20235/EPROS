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
