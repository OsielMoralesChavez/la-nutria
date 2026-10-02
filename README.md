# La Nutria

Sistema web para nutriólogos centrado en el **seguimiento longitudinal** del paciente. No es un CRUD genérico: todo gira alrededor del ciclo

```
Paciente → Expediente → Evaluación inicial → Consulta → Mediciones → Objetivos → Plan → Seguimiento → Evolución
```

y de una **Ficha 360°** que responde cuatro preguntas: **¿Cómo inició? → ¿Qué se hizo? → ¿Cómo va? → ¿Qué sigue?**

---

## Contenido

- [Funcionalidades](#funcionalidades)
- [Tecnologías](#tecnologías)
- [Arquitectura](#arquitectura)
- [Inicio rápido (modo demo, sin base de datos)](#inicio-rápido-modo-demo-sin-base-de-datos)
- [Instalación con MongoDB Atlas](#instalación-con-mongodb-atlas)
- [Variables de entorno](#variables-de-entorno)
- [Scripts](#scripts)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Roles y permisos](#roles-y-permisos)
- [Seguridad](#seguridad)
- [Pruebas y calidad](#pruebas-y-calidad)
- [Documentación de diseño](#documentación-de-diseño)

---

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Dashboard** | KPIs operativos (activos, nuevos, citas de hoy, seguimientos pendientes/vencidos, sin seguimiento reciente, objetivos activos/logrados, alertas), agenda del día con "Iniciar" en 1 clic, "Requiere atención" y actividad reciente. Alcance: *mis pacientes* / *consultorio*. |
| **Pacientes** | Búsqueda sin acentos (nombre, teléfono, correo), filtros en la URL, vistas rápidas, tendencia de peso en el listado, alta rápida con detección de duplicados. |
| **Ficha 360°** | El **Hilo** ①→④ como navegación; ③ *¿Cómo va?* con tabla Inicio · Anterior · Actual · Meta y gráfica; ① línea base y expediente **versionado**; ② línea de tiempo agrupada por consulta; ④ panel fijo con próxima cita, seguimientos, objetivos por vencer y alertas. |
| **Modo consulta** | Pasos como pestañas (Notas libres/SOAP · Expediente · Mediciones · Objetivos · Qué sigue · Revisar). Valor anterior e inicial junto a cada campo, IMC e ICC en vivo, autoguardado del borrador, próxima cita con horarios libres reales. Al cerrar, la evolución se actualiza sola. |
| **Agenda** | Vistas día / semana / lista, clic en hueco para agendar, confirmar, reprogramar, cancelar, no asistió, iniciar consulta desde la cita; detección de traslapes. |
| **Seguimiento** | Bandeja transversal: pendientes, sin seguimiento reciente, objetivos por vencer, alertas. |
| **Alertas** | Motor de reglas **operativas** configurables (sin umbrales clínicos fijos), con vista previa y resolución automática. |
| **Fotos y documentos** | Módulo opcional: fotos de progreso con comparación lado a lado, documentos; servidos con URL firmada de 5 min. |
| **Usuarios y roles** | Matriz de permisos Recurso × Acción, contraseñas temporales, desactivación con reasignación de pacientes. |
| **Configuración** | Consultorio y horario, agenda, catálogos (métricas, métodos, tipos de objetivo, tipos de cita…), reglas de alerta, sesiones activas, auditoría. |

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 8, TanStack Query 5, react-hook-form + zod, Recharts 3, lucide-react |
| Backend | Node.js ≥ 22, Express 5, Mongoose 9, zod 4, JWT (jsonwebtoken), bcryptjs, helmet, cors, express-rate-limit, pino |
| Base de datos | MongoDB (Atlas en producción; en memoria para demo y pruebas) |
| Compartido | Paquete `@lanutria/shared`: permisos, roles, enumeraciones y fórmulas (IMC, ICC, progreso) usadas igual en cliente y servidor |
| Calidad | Vitest, Supertest, mongodb-memory-server, ESLint 10 |

## Arquitectura

```
client/  (Vista)  React ──► /api/v1 (proxy de Vite en desarrollo)
server/  (MVC)    routes → middleware (auth · RBAC · validación) → controllers → services → models (Mongoose)
shared/           contratos comunes: permisos, roles, enums, cálculos
```

- **Backend por capas (MVC + services)**: controladores delgados; reglas de negocio en `services/`.
- **Frontend por dominio**: `features/<dominio>/` con su API, hooks y componentes. Agregar un módulo nuevo (p. ej. Planes) = una carpeta + una entrada en `navigation/config.js` + su ruta.
- **Historial inmutable**: cada toma de mediciones es un documento nuevo; las consultas cerradas no se editan (se agregan adendas); el expediente guarda revisiones.

Detalle completo en [docs/02-arquitectura.md](docs/02-arquitectura.md) y decisiones en [docs/adr/](docs/adr/).

## Inicio rápido (modo demo, sin base de datos)

Levanta la API real contra un **MongoDB en memoria** con datos ficticios. No necesita Atlas ni archivo `.env`; todo se borra al cerrar.

```bash
npm install
```

```bash
npm run dev:demo
```

- Abre http://localhost:5173
- Usuarios demo (uno por rol) y su contraseña: ver `DEMO_USERS` y `DEMO_PASSWORD` en [server/src/seeds/demo.js](server/src/seeds/demo.js).
- La primera vez descarga el binario de MongoDB (descarga grande, ~780 MB; sólo una vez). Después queda en caché en `node_modules/.cache`.

> **Nota sobre OneDrive:** el proyecto vive en una carpeta sincronizada. `node_modules` contiene miles de archivos y hace lenta la sincronización (y a veces bloquea archivos durante `npm install`). Se recomienda pausar la sincronización al instalar dependencias o mover el proyecto fuera de OneDrive.

## Instalación con MongoDB Atlas

1. **Atlas → Database Access**: crea un usuario de base de datos con rol *readWrite* sólo sobre la base `la_nutria`.
2. **Atlas → Network Access**: agrega la IP desde la que correrá el servidor.
3. **Atlas → Connect → Drivers**: copia la cadena de conexión.
4. Crea `server/.env` a partir del ejemplo y llena los valores (ver tabla abajo):

   ```bash
   cp server/.env.example server/.env
   ```

   Genera los secretos JWT con:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Siembra roles, catálogos, reglas de alerta y el superusuario inicial (`SEED_SUPERUSER_*`):

   ```bash
   npm run seed
   ```

6. Inicia API y cliente:

   ```bash
   npm run dev
   ```

El superusuario entra con la contraseña de `SEED_SUPERUSER_PASSWORD` y debe cambiarla en el primer acceso. Después puedes borrar esas variables del `.env`.

## Variables de entorno

`server/.env` (nunca se sube al repositorio; plantilla en [server/.env.example](server/.env.example)):

| Variable | Obligatoria | Descripción |
|---|:-:|---|
| `MONGODB_URI` | ✅ | Cadena de conexión de Atlas |
| `JWT_ACCESS_SECRET` | ✅ | ≥ 32 caracteres aleatorios |
| `JWT_REFRESH_SECRET` | ✅ | ≥ 32 caracteres aleatorios, distinto del anterior |
| `JWT_ACCESS_TTL` | | Vida del access token (por defecto `15m`) |
| `JWT_REFRESH_TTL_DAYS` | | Vida de la sesión (por defecto `7`) |
| `TZ` | | Zona horaria del consultorio (`America/Mexico_City`) |
| `PORT` | | Puerto de la API (`4000`) |
| `CORS_ORIGINS` | | Orígenes permitidos, separados por coma |
| `LOG_LEVEL` | | `info` por defecto |
| `ALERTS_JOB_MINUTES` | | Cada cuánto se evalúan las alertas (`15`; `0` = desactivado) |
| `FEATURE_ATTACHMENTS` | | `true`/`false`: módulo de fotos y documentos |
| `UPLOAD_DIR`, `UPLOAD_MAX_MB` | | Carpeta y tamaño máximo de archivos |
| `SEED_SUPERUSER_NAME/EMAIL/PASSWORD` | | Sólo para `npm run seed` |
| `SEED_DEMO_PASSWORD` | | Sólo para `npm run seed:demo` contra una BD real |

`client/.env` es opcional ([client/.env.example](client/.env.example)): `VITE_API_URL` (por defecto `/api/v1`).

La API **no arranca** si falta una variable obligatoria; el mensaje indica cuál (sin mostrar valores).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev:demo` | API + cliente con MongoDB en memoria y datos demo |
| `npm run dev` | API (con recarga) + cliente contra la BD de `server/.env` |
| `npm run seed` | Datos base + superusuario inicial |
| `npm run seed:demo` | Lo anterior + pacientes ficticios (requiere `SEED_DEMO_PASSWORD`) |
| `npm test` | Pruebas de `shared`, `server` (integración con Mongo en memoria) y `client` |
| `npm run lint` | ESLint en todo el monorepo |
| `npm run build` | Build de producción del cliente (`client/dist`) |

## Estructura del proyecto

```
La Nutria/
├── shared/src/          permisos, roles, enums, cálculos (IMC, ICC, progreso)
├── server/
│   ├── src/
│   │   ├── config/      env (validado), db, logger
│   │   ├── models/      schemas Mongoose
│   │   ├── controllers/ HTTP in/out
│   │   ├── services/    reglas de negocio (consultas, evolución, agenda, alertas…)
│   │   ├── routes/      mapa de la API v1 con permiso por ruta
│   │   ├── middleware/  authenticate, authorize, validate, sanitize, errores, rate limit
│   │   ├── validators/  esquemas zod estrictos
│   │   ├── alerts/      reglas de alerta operativas
│   │   ├── storage/     adaptador de archivos (local; S3/Cloudinary después)
│   │   ├── seeds/       datos base y demo
│   │   ├── app.js       composición de Express
│   │   ├── server.js    arranque
│   │   └── demo.js      modo demo (Mongo en memoria)
│   └── tests/           integración (auth, RBAC, flujo clínico, agenda, alertas)
├── client/src/
│   ├── app/             router (carga diferida por sección)
│   ├── layouts/         AppLayout, Topbar, Sidebar, BottomNav, CommandPalette
│   ├── navigation/      menú declarativo filtrado por permisos
│   ├── components/      ui/ (Button, Modal, Field…) y charts/
│   ├── features/        auth, dashboard, patients, consultations, agenda, followup, users, settings, catalogs
│   ├── lib/             http (tokens + refresh), formato, claves de caché
│   └── styles/          tokens de diseño (Tailwind 4)
└── docs/                análisis, arquitectura, UX y ADRs
```

## Roles y permisos

Modelo: `Usuario → Rol → Permisos (recurso:acción) → validado en el backend → reflejado en la UI`.

| Rol | Para quién | Alcance |
|---|---|---|
| **Usuario** | Nutriólogo | Operación clínica diaria. Ve y atiende a todos los pacientes; reasigna/archiva sólo los suyos. |
| **Administrador** | Nutriólogo coordinador | Todo lo anterior + todos los pacientes, usuarios de rol inferior, catálogos, reglas de alerta y configuración. |
| **Superusuario** | Responsable del sistema | Control total: roles y permisos, auditoría, borrado físico excepcional. |

- Acciones: `read` (ver), `create`, `update` (editar), `delete` (eliminar), `manage` (administrar).
- El catálogo completo está en [shared/src/permissions.js](shared/src/permissions.js); los roles base en [shared/src/roles.js](shared/src/roles.js).
- El Superusuario puede editar permisos de los demás roles desde **Usuarios → Roles y permisos** o crear roles nuevos (p. ej. *Asistente*) sin tocar código.
- Reglas anti-escalada: nadie asigna un rol de nivel ≥ al propio, nadie cambia su propio rol, no se puede otorgar un permiso que uno no tiene, y el rol Superusuario no es editable.

## Seguridad

- Contraseñas con bcrypt (cost 12); bloqueo de 15 min tras 5 intentos fallidos; mensaje de error genérico.
- Access token JWT de 15 min **sólo en memoria**; refresh token rotativo en cookie `httpOnly` + `SameSite=Strict`; detección de reutilización (revoca la sesión) con ventana de gracia de 30 s para pestañas simultáneas.
- Permisos validados en **cada ruta** del backend; reglas de propiedad en los servicios.
- Validación zod **estricta** (rechaza campos no declarados) + eliminación de operadores `$`/`.` en la entrada.
- helmet, CORS con lista blanca, rate limiting (general y de login).
- Errores: al cliente sólo código, mensaje y `requestId`; el detalle va al log. Los logs **redactan** credenciales y cuerpos de petición.
- Auditoría append-only de accesos, permisos, expediente, archivado/eliminación y configuración; nunca guarda valores clínicos.
- Archivos verificados por *magic bytes* y servidos con URL firmada temporal.

## Pruebas y calidad

```bash
npm test
```

- **shared**: fórmulas, progreso de objetivos, coherencia de roles y permisos.
- **server**: 31 pruebas de integración (auth y sesiones, RBAC y mass-assignment, flujo clínico completo con transacción, agenda, alertas, dashboard).
- **client**: formato, serialización del borrador de consulta, fusión de clases.

```bash
npm run lint
```

## Documentación de diseño

| Documento | Contenido |
|---|---|
| [docs/01-analisis.md](docs/01-analisis.md) | Requerimientos funcionales y no funcionales, actores, flujos |
| [docs/02-arquitectura.md](docs/02-arquitectura.md) | Stack, modelo de datos, API, autenticación, RBAC, seguridad |
| [docs/03-ux.md](docs/03-ux.md) | Mapa del sitio, layout, Ficha 360°, flujo de consulta, acciones de 1–2 clics |
| [docs/adr/](docs/adr/) | Decisiones de arquitectura tomadas durante la implementación |
