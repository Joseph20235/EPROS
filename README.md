# EPROS — Sistema de Gestión de Incapacidades Médicas

Aplicación web interna para digitalizar y gestionar el proceso de recepción, verificación, seguimiento y cobro de incapacidades médicas y licencias laborales dentro del área de Gestión Humana.

> Proyecto académico — Ingeniería de Software

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express |
| Base de datos | SQLite (better-sqlite3) |
| Autenticación | JWT (implementación propia con HMAC-SHA256) |

---

## Requisitos previos

Antes de instalar el proyecto asegúrate de tener:

- **Node.js 20.x o 22.x** — requerido por `better-sqlite3 12.9.0`. Verifica tu versión con:
  ```bash
  node --version
  ```
- **Git**

> **Usuarios de Windows:** si al ejecutar `npm` obtienes un error de comando no reconocido, reemplaza `npm` por `npm.cmd` en todos los comandos del proyecto. Por ejemplo:
> ```bash
> npm.cmd install --prefix backend
> npm.cmd run db:init --prefix backend
> npm.cmd run dev
> ```

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd epros
```

### 2. Instalar dependencias

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 3. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
```

El archivo `.env` generado contiene:

```
PORT=4000
```

No se requiere configuración adicional. La base de datos SQLite se crea automáticamente en el paso siguiente.

### 4. Inicializar la base de datos

```bash
npm run db:init --prefix backend
```

Este comando crea el archivo `backend/database/epros.sqlite` con:
- Todas las tablas del esquema
- Datos de prueba: 5 colaboradores, 7 EPS/ARL, 17 incapacidades cubriendo todos los estados del flujo

---

## Ejecución

### Desarrollo (frontend + backend simultáneo)

```bash
npm run dev
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |

### Solo backend

```bash
npm run dev --prefix backend
```

### Solo frontend

```bash
npm run dev --prefix frontend
```

---

## Verificación

Confirma que el backend está activo:

```
GET http://localhost:4000/api/health
```

Respuesta esperada:
```json
{ "status": "ok", "service": "epros-backend" }
```

Luego abre http://localhost:5173 en el navegador.

---

## Usuarios de prueba

| Correo | Contraseña | Rol | Permisos |
|--------|-----------|-----|----------|
| admin@epros.com | Admin123! | ADMIN | Acceso total |
| auxiliar@epros.com | Aux123! | AUXILIAR | Gestión de incapacidades, seguimiento, alertas, reportes. Solo lectura en catálogos |
| consulta@epros.com | Con123! | READONLY | Historial, expediente y reportes |

---

## Estructura del proyecto

```
epros/
├── backend/
│   ├── db/
│   │   ├── migrations/        # Esquema SQL
│   │   └── seeders/           # Datos de prueba
│   ├── middleware/
│   │   └── auth.js            # Guards por rol
│   ├── routes/                # Endpoints REST
│   ├── uploads/               # Adjuntos de incapacidades
│   ├── auth.js                # JWT y hashing
│   ├── db.js                  # Conexión SQLite
│   └── server.js              # Entrada del servidor
├── frontend/
│   └── src/
│       ├── pages/             # Vistas por módulo
│       ├── auth.js            # Sesión y fetch autenticado
│       ├── main.jsx           # Shell y enrutamiento SPA
│       └── styles.css
└── package.json               # Scripts raíz con concurrently
```

---

## Módulos del sistema

| Módulo | Ruta | Caso de uso |
|--------|------|-------------|
| Dashboard | `/dashboard` | Métricas y alertas urgentes |
| Registro | `/incapacidades/nueva` | CU-01 Registrar incapacidad |
| Validación | `/incapacidades/:id/validar` | CU-02 Validar documentación |
| Transcripción | `/incapacidades/:id/transcribir` | CU-03 Transcribir |
| Radicación | `/incapacidades/:id/radicar` | CU-04 Radicar ante EPS/ARL |
| Expediente | `/incapacidades/:id` | CU-05 Gestionar estado |
| Seguimiento | `/seguimiento` | CU-06 Panel semáforo |
| Cobro | `/incapacidades/:id/cobro` | CU-07 Gestionar cobro |
| Pago | `/incapacidades/:id/pago` | CU-08 Registrar pago |
| Historial | `/historial` | CU-09 Consultar historial |
| Reportes | `/reportes` | CU-10 Generar reportes |
| Alertas | `/alertas` | CU-11 Incapacidades prolongadas |
| Rechazo | `/incapacidades/:id/rechazo` | CU-12 Gestionar rechazo |
| Cobro jurídico | `/incapacidades/:id/juridico` | CU-13 Cobro jurídico |
| Conciliación | `/incapacidades/:id/conciliacion` | CU-14 Conciliación |
| Colaboradores | `/admin/colaboradores` | CRUD colaboradores |
| EPS/ARL | `/admin/eps-arl` | CRUD entidades |

---

## Reiniciar la base de datos

Si necesitas volver al estado inicial con los datos de prueba:

```bash
npm run db:init --prefix backend
```

> Este comando borra y recrea la base de datos desde cero.

---

## Autores

- Joseph Osorio Cubillos — 1137059196
- Meycol Kleym Quintero Castaño — 1089931356
- Isabella Cardona Betancourt — 1087992113

Ingeniería de Software — Curso académico 2026
