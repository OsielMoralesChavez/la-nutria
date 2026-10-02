# Fase 3 — Arquitectura

> Estado: **propuesta en validación**. No se implementa hasta su aprobación.

## 1. Vista general

```
┌──────────────────────── client/ (Vista) ────────────────────────┐
│ React 19 + Vite · React Router 7 · TanStack Query · Tailwind 4  │
│ features/ (pacientes, seguimiento…) → api/ → fetch con JWT      │
│ En modo demo: MSW intercepta fetch y responde con mocks/        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS · JSON · /api/v1
┌──────────────────────── server/ (Modelo + Controlador) ─────────┐
│ routes → middleware (auth, rbac, validate) → controllers        │
│        → services (reglas de negocio) → models (Mongoose)       │
│ transversal: errores, logger, auditoría, rate limit, helmet     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ MONGODB_URI (.env)
                        MongoDB Atlas
```

`shared/` contiene lo que **cliente y servidor deben interpretar igual**: catálogo de permisos, roles base, enumeraciones (estados, tipos de consulta). Así un permiso nunca se escribe distinto en frontend y backend.

## 2. Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Build | Vite | Arranque y HMR rápidos; estándar actual para React. |
| UI | React 19 + Tailwind CSS 4 | Solicitado. Tokens de diseño en CSS. |
| Ruteo | React Router 7 | Solicitado; rutas anidadas para el layout y la ficha del paciente. |
| Estado de servidor | **TanStack Query** | Caché, reintentos, estados de carga/error e invalidación. Evita reimplementar esto con Context. |
| Estado de UI/sesión | Context API | Sesión del usuario, permisos, sidebar, tema. Poco y global. |
| Formularios | react-hook-form + zod | Formularios largos de consulta sin re-render masivo; validación declarativa. |
| Gráficas | Recharts | Tendencias de mediciones, responsive. |
| Íconos | lucide-react | Ligeros, consistentes. |
| Mocks | **MSW** (Mock Service Worker) | Intercepta las llamadas HTTP reales: el código del cliente es el mismo con mocks o con API. Quitar mocks = cambiar una variable. |
| API | Node 24 + Express 5 | Solicitado. Express 5 propaga errores async al manejador central. |
| ODM | Mongoose 8 | Solicitado. |
| Validación | zod | Esquemas por endpoint; rechaza campos no declarados. |
| Auth | jsonwebtoken + bcrypt | Ver §6. |
| Seguridad | helmet, cors, express-rate-limit, cookie-parser | Ver §8. |
| Logs | pino + pino-http | Logs JSON con **redacción** de campos sensibles. |
| Pruebas | Vitest (cliente y servidor), Supertest (API), mongodb-memory-server | Pruebas sin tocar Atlas. |

Monorepo con **npm workspaces** (`client`, `server`, `shared`): un solo `npm install`, scripts unificados.

## 3. Estructura de carpetas

```
La Nutria/
├── package.json              # workspaces + scripts (dev, test, lint)
├── README.md
├── docs/
│   ├── 01-analisis.md
│   ├── 02-arquitectura.md
│   ├── 03-ux.md
│   └── adr/                  # decisiones de arquitectura (una por archivo)
├── shared/
│   └── src/
│       ├── permissions.js    # catálogo recurso:acción
│       ├── roles.js          # roles base y sus permisos por defecto
│       └── enums.js          # estados de paciente, consulta, objetivo, alerta
├── server/
│   ├── .env.example
│   ├── src/
│   │   ├── config/           # env (validado con zod), db, cors, logger
│   │   ├── models/           # Mongoose schemas (M)
│   │   ├── controllers/      # HTTP in/out, sin lógica de negocio (C)
│   │   ├── services/         # reglas de negocio, cálculos, alcance de datos
│   │   ├── routes/           # /api/v1/<recurso>
│   │   ├── middleware/       # authenticate, authorize, validate, errorHandler, audit, rateLimit
│   │   ├── validators/       # esquemas zod por recurso
│   │   ├── alerts/           # motor de reglas (rules/*.js), desactivadas por defecto
│   │   ├── utils/            # ApiError, asyncPaging, calculos (IMC)
│   │   ├── seeds/            # roles, superusuario inicial, catálogo de métricas
│   │   ├── app.js            # composición de Express (testeable sin red)
│   │   └── server.js         # conexión a BD + listen
│   └── tests/
└── client/
    ├── .env.example
    ├── index.html
    └── src/
        ├── app/              # router, providers (Query, Auth, Theme)
        ├── layouts/          # AppLayout, AuthLayout
        ├── components/       # UI reutilizable: Button, Modal, FormField, Badge, StatCard,
        │                     #   EmptyState, LoadingState, Timeline, ProgressChart…
        ├── features/         # por dominio: auth, dashboard, patients, consultations,
        │   └── patients/     #   measurements, goals, followup, users, settings
        │       ├── api.js        # llamadas HTTP del dominio
        │       ├── hooks.js      # usePatients, usePatient… (TanStack Query)
        │       ├── components/   # PatientCard, PatientTable, PatientSummary…
        │       └── pages/        # PatientsPage, PatientDetailPage…
        ├── navigation/       # config del sidebar (array declarativo, filtrado por permisos)
        ├── lib/              # httpClient (fetch + refresh), formatters, can()
        ├── mocks/            # MSW: handlers/ + data/ (aislados; no se importan en componentes)
        └── styles/           # tokens Tailwind, tema
```

**Backend organizado por capa (MVC)**, como pediste. **Frontend organizado por dominio**, porque ahí es donde crece el sistema (agregar "Planes" = agregar `features/plans/` y una entrada en `navigation/`).

## 4. Modelo de datos

### 4.1 Diagrama conceptual

```
Role ◄── User ──┐ (nutriólogo responsable / autor)
                │
           Patient ──1:1── ClinicalRecord ──1:N── ClinicalRecordRevision
              │
              ├──1:N── Consultation ──1:0..1── Measurement ──N── MetricDefinition
              ├──1:N── Measurement   (también puede existir sin consulta: remoto, futuro)
              ├──1:N── Goal
              ├──1:N── FollowUp
              └──1:N── Alert
AuditLog (independiente) · Setting (clave/valor) · RefreshSession (sesiones)
```

### 4.2 Colecciones

| Colección | Campos principales | Notas |
|---|---|---|
| **roles** | `key`, `name`, `permissions: [String]`, `level`, `isSystem` | Permisos **embebidos** como strings (`patients:read`). Son pocos y siempre se leen junto al rol. `level` impide asignar un rol superior al propio. |
| **users** | `name`, `email` (único), `passwordHash`, `role` (ref), `status`, `lastLoginAt`, `failedLogins`, `lockedUntil` | `passwordHash` con `select: false`. |
| **refreshsessions** | `user`, `tokenHash`, `expiresAt`, `revokedAt`, `userAgent` | Permite cerrar sesión de verdad y revocar. Índice TTL en `expiresAt`. |
| **patients** | `firstName`, `lastName`, `birthDate`, `sex`, `contact{phone,email}`, `occupation`, `status`, `statusHistory[]`, `primaryNutritionist` (ref), `tags[]`, `lastConsultationAt`, `nextFollowUpAt`, `archivedAt/By` | `statusHistory` **embebido** (pocos cambios, siempre se lee con el paciente). `lastConsultationAt` y `nextFollowUpAt` se **desnormalizan** para que el dashboard y los listados no recorran todas las consultas. |
| **clinicalrecords** | `patient` (único), `sections{ motivo, heredofamiliares, patologicos, medicamentos, alergias, estiloVida, habitos, ginecoobstetricos, laboratorios }`, `version`, `updatedBy` | Estado **actual** del expediente. Secciones flexibles (subdocumentos) para cubrir todo tipo de paciente. |
| **clinicalrecordrevisions** | `patient`, `version`, `sections` (snapshot), `changedFields[]`, `changedBy`, `changedAt` | **Append-only**. Responde "qué decía antes y quién lo cambió". Colección aparte porque crece sin límite. |
| **consultations** | `patient`, `nutritionist`, `date`, `type` (`inicial`/`seguimiento`), `status` (`borrador`/`cerrada`), `notes` (estructura pendiente P3), `addenda[]`, `measurement` (ref), `closedAt` | Separada: crece sin límite por paciente. Cerrada = inmutable; correcciones vía `addenda` embebidas. |
| **measurements** | `patient`, `consultation?`, `takenAt`, `takenBy`, `values: [{ metric, value, unit }]` | **Una toma = un documento**; nunca se sobrescribe. Valores embebidos (se leen juntos). Índice `{patient, takenAt}` para series temporales. |
| **metricdefinitions** | `key` (`peso`, `cintura`…), `label`, `unit`, `category`, `min`, `max`, `decimals`, `derived` (fórmula registrada en código, p. ej. IMC), `active` | Catálogo editable: el nutriólogo agrega métricas sin tocar código. |
| **goals** | `patient`, `type` (`metrica`/`cualitativo`), `metric?`, `baseline`, `target`, `direction`, `startDate`, `dueDate`, `status`, `createdIn` (consulta), `notes` | Progreso **calculado** desde measurements, no guardado (evita incoherencias). |
| **followups** | `patient`, `dueDate`, `reason`, `status` (`pendiente`/`realizado`/`cancelado`), `assignedTo`, `originConsultation`, `resolvedBy` (consulta) | "Qué sigue". Base para la futura agenda (`appointments` será otra colección). |
| **alerts** | `type`, `patient`, `severity`, `status` (`abierta`/`atendida`/`descartada`), `ruleKey`, `dedupeKey`, `dueAt`, `assignedTo`, `resolvedBy/At` | `dedupeKey` evita alertas duplicadas. |
| **settings** | `key`, `value`, `updatedBy` | Umbrales de alertas, parámetros del consultorio. |
| **auditlogs** | `actor`, `action`, `resource`, `resourceId`, `result` (`ok`/`denegado`/`error`), `at`, `ip`, `userAgent`, `meta` | **Append-only**, nunca guarda valores clínicos, sólo **qué campos** cambiaron. |

### 4.3 Criterios embeber vs. referenciar

| Criterio | Decisión |
|---|---|
| Se lee siempre junto al padre y es acotado | **Embeber** (permisos en rol, historial de estados, valores de una medición, adendas). |
| Crece sin límite con el tiempo | **Colección aparte** (consultas, mediciones, revisiones, auditoría). Evita el límite de 16 MB por documento y documentos que se vuelven lentos. |
| Se consulta de forma independiente o transversal | **Colección aparte** (alertas y seguimientos del día de *todos* los pacientes). |
| Catálogo compartido | **Referencia** (métricas, roles). |
| Lecturas frecuentes que serían costosas | **Desnormalizar** con cuidado (`lastConsultationAt`, `nextFollowUpAt`), actualizado por el servicio. |

### 4.4 Línea de tiempo

No se guarda: el endpoint `GET /patients/:id/timeline` la **compone** desde consultas, mediciones, objetivos, seguimientos, revisiones de expediente y cambios de estado, ordenada por fecha y paginada. Una sola fuente de verdad, sin duplicar datos.

### 4.5 Ampliaciones aprobadas (P1–P7)

| Colección / cambio | Diseño |
|---|---|
| **metricdefinitions** (seed) | `peso` kg · `estatura` cm · `imc` kg/m² *(derivada)* · `grasa_pct` % · `masa_muscular` kg · `grasa_visceral` nivel · `agua_pct` % · `cintura` cm · `cadera` cm · `icc` *(derivada: cintura/cadera)*. Cada una con `min/max` de captura (validación de dedo, no clínica), `decimals`, `category` (`antropometria`, `composicion`), `order`, `active`. Las fórmulas derivadas viven en código (`server/src/utils/derivedMetrics.js`) y se referencian por clave. |
| **measurements** | `consultation` **obligatoria** en el MVP. `method` (ref catálogo `measurement_method`) a nivel toma y `values[].method` opcional para mezclar (p. ej. peso en báscula + grasa por pliegues). `device` opcional. |
| **catalogs** (nueva) | Listas simples editables: `{ type, key, label, order, active, meta }`. Tipos: `measurement_method`, `appointment_type`, `attachment_category`, `patient_tag`, `cancel_reason`. Una sola colección evita una colección por cada lista. |
| **goaltypes** (nueva) | `{ key, label, kind: 'metrica'|'cualitativo', defaultMetric?, direction: 'bajar'|'subir'|'mantener', tolerance? , active }`. Seed: `perdida_peso`, `aumento_peso`, `mantenimiento_peso` (con tolerancia), `reduccion_grasa`, `aumento_masa_muscular`, `mejora_composicion`, `cambio_habitos`, `adherencia_plan`, `personalizado`. |
| **goals** | `goalType` (ref) + `metric?`, `baseline`, `target`, `tolerance?`, `startDate`, `dueDate`, `status`. Métricos: progreso **calculado** de mediciones. Cualitativos (hábitos, adherencia): `checkpoints[{ consultation, date, score 0-100?, note }]` embebidos (uno por consulta, acotado). |
| **consultations.notes** | `{ freeText, soap: { s, o, a, p } \| null }`. Formato inicial tomado de `user.preferences.noteFormat`. |
| **alertrules** (nueva) | `{ key, enabled, params, severity, scope }`. Seed operativo (editable): `followup_overdue {graceDays}`, `appointment_upcoming {hoursBefore}`, `goal_due {daysBefore}` + `goal_overdue`, `measurement_missing {days}`, `patient_inactive {days}` (**desactivada** hasta configurar). Cada regla es un módulo en `server/src/alerts/rules/` con `evaluate(params) → alertas`; un *job* periódico (in-process, cada 15 min) las ejecuta de forma idempotente con `dedupeKey`. Agregar una regla = agregar un archivo + un documento. |
| **appointments** (nueva) | `{ patient, nutritionist, start, end, type (catálogo), status: programada|confirmada|realizada|cancelada|no_asistio, statusHistory[], consultation?, rescheduledFrom?, cancelReason?, notes, reminders: [] }`. Índice `{ nutritionist, start }` para detectar traslapes. `reminders[]` queda vacío en el MVP (preparado para correo/WhatsApp). Al cerrar una consulta iniciada desde la cita → `realizada`. |
| **followups** vs **appointments** | *Appointment* = horario concreto. *FollowUp* = tarea "qué sigue" sin hora (p. ej. "revisar laboratorios en 2 semanas"). Al cerrar consulta se elige cualquiera de los dos. |
| **attachments** (nueva, modular) | `{ patient, consultation?, kind: 'foto'|'documento', category (catálogo), storageKey, mimeType, size, takenAt, uploadedBy, notes }`. El archivo **no** va en Mongo: adaptador `storage` (`local` en desarrollo, fuera de la carpeta pública; S3/Cloudinary/GridFS después). Se sirven sólo vía endpoint autenticado con URL temporal. Bandera `FEATURE_ATTACHMENTS`. |
| **users.preferences** | `{ noteFormat, defaultAgendaView, dashboardScope }`. |
| **settings** | Consultorio (nombre, zona horaria `America/Mexico_City`, horario de atención), agenda (duración por defecto, intervalo), unidades. |

### 4.6 Extensiones futuras (sin tocar lo anterior)

`reminders`/`notifications` (consumen `appointments.reminders`) · `mealplans` + `recipes` · `reports` (PDF bajo demanda) · `patientaccounts` (portal). Todas cuelgan de `patient` y aparecen como nuevos eventos de la línea de tiempo.

## 5. API REST (`/api/v1`)

| Recurso | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `PATCH /auth/password` |
| Usuarios | `GET/POST /users` · `GET/PATCH /users/:id` · `PATCH /users/:id/status` |
| Roles | `GET /roles` · `PATCH /roles/:id/permissions` · `GET /permissions` |
| Pacientes | `GET/POST /patients` · `GET/PATCH /patients/:id` · `PATCH /patients/:id/status` · `PATCH /patients/:id/assign` · `POST /patients/:id/archive` · `POST /patients/:id/restore` |
| Resumen | `GET /patients/:id/summary` (inicio vs. actual, objetivos activos, próximo seguimiento) |
| Línea de tiempo | `GET /patients/:id/timeline?cursor=&types=` |
| Expediente | `GET/PUT /patients/:id/clinical-record` · `GET /patients/:id/clinical-record/revisions[/:version]` |
| Consultas | `GET/POST /patients/:id/consultations` · `GET/PATCH /consultations/:id` · `POST /consultations/:id/close` · `POST /consultations/:id/addenda` |
| Mediciones | `GET/POST /patients/:id/measurements` · `GET /patients/:id/measurements/series?metrics=peso,cintura` |
| Métricas | `GET/POST /metrics` · `PATCH /metrics/:id` |
| Objetivos | `GET/POST /patients/:id/goals` · `PATCH /goals/:id` |
| Seguimiento | `GET /followups?status=&due=` · `POST /patients/:id/followups` · `PATCH /followups/:id` |
| Alertas | `GET /alerts` · `PATCH /alerts/:id` (atender, posponer, descartar) · `GET/PATCH /alert-rules[/:key]` |
| Agenda | `GET /appointments?from=&to=&nutritionist=` · `POST /appointments` · `PATCH /appointments/:id` · `POST /appointments/:id/reschedule` · `POST /appointments/:id/status` · `POST /appointments/:id/start-consultation` |
| Archivos | `GET/POST /patients/:id/attachments` · `GET /attachments/:id/url` · `DELETE /attachments/:id` |
| Catálogos | `GET /catalogs?type=` · `POST /catalogs` · `PATCH /catalogs/:id` · `GET/POST/PATCH /goal-types` |
| Dashboard | `GET /dashboard` (un solo endpoint agregado) |
| Configuración | `GET/PATCH /settings` |
| Auditoría | `GET /audit-logs` |

Convenciones: respuestas `{ data, meta }`; errores `{ error: { code, message, requestId, details? } }`; paginación por cursor en historiales; fechas ISO 8601 UTC.

## 6. Autenticación

```
Login ──► valida credenciales (bcrypt, cost 12) ──► access token JWT (15 min, en memoria del cliente)
                                                └─► refresh token (7 días) en cookie httpOnly, Secure, SameSite=Strict
                                                    su hash se guarda en refreshsessions
401 en API ──► cliente llama /auth/refresh una vez ──► rota el refresh token (el anterior queda revocado)
Logout ──► revoca la sesión en BD y borra la cookie
```

- El access token **no** se guarda en `localStorage` (mitiga robo por XSS).
- Reutilizar un refresh token ya rotado revoca todas las sesiones del usuario (detección de robo).
- 5 intentos fallidos → bloqueo de 15 min. Mensaje de error genérico ("credenciales inválidas").
- El superusuario inicial se crea con un **script de seed** que lee la contraseña de `.env`; nunca hay contraseñas en el código.

## 7. RBAC

`Usuario → Rol → Permisos (recurso:acción) → validado en backend → reflejado en UI`

**Acciones:** `read`, `create`, `update`, `delete`, `manage`. **Alcance:** algunos permisos tienen variante `:all` (todos los pacientes) frente al alcance propio.

| Permiso | Usuario | Administrador | Superusuario |
|---|:-:|:-:|:-:|
| `patients:read` (todos los del consultorio) | ✅ | ✅ | ✅ |
| `patients:create` / `patients:update` | ✅ | ✅ | ✅ |
| `patients:assign` (reasignar responsable) | propios | ✅ | ✅ |
| `patients:archive` | propios | ✅ | ✅ |
| `patients:delete` (borrado físico) | — | — | ✅ |
| `clinical:read` / `clinical:update` | ✅ | ✅ | ✅ |
| `consultations:*`, `measurements:*`, `goals:*`, `followups:*` | ✅ | ✅ | ✅ |
| `metrics:manage` (catálogo) | — | ✅ | ✅ |
| `users:read` | — | ✅ | ✅ |
| `users:manage` | — | sólo rol Usuario | ✅ |
| `roles:manage` | — | — | ✅ |
| `settings:manage` | — | ✅ | ✅ |
| `alerts:read` / `alerts:update` | ✅ | ✅ | ✅ |
| `alerts:configure` (reglas) | — | ✅ | ✅ |
| `appointments:*` | ✅ | ✅ | ✅ |
| `attachments:read` / `attachments:create` | ✅ | ✅ | ✅ |
| `attachments:delete` | propios | ✅ | ✅ |
| `catalogs:manage` | — | ✅ | ✅ |
| `audit:read` | — | — | ✅ |

Implementación:
1. `authenticate` — verifica el JWT y carga usuario + permisos del rol (con caché corta).
2. `authorize('patients:archive')` — middleware por ruta; si falta el permiso → 403 y registro en auditoría.
3. **Reglas de propiedad** en el *service* (p. ej. "propios" = `primaryNutritionist === user.id` salvo que tenga `:all`). Nunca sólo en la UI.
4. Frontend: `usePermission('patients:archive')` y `<Can permission="…">` sólo para **ocultar** lo que de todas formas el backend rechazaría. El sidebar se filtra con la misma función.
5. Nuevos roles (p. ej. Asistente) = documento nuevo en `roles`, sin cambiar código.

## 8. Seguridad

| Medida | Implementación |
|---|---|
| Contraseñas | bcrypt cost 12; política mínima 10 caracteres. |
| Validación | zod en cada endpoint: tipos, longitudes, y **rechazo de campos no declarados** (evita mass-assignment, p. ej. enviar `role`). |
| Inyección NoSQL | `mongoose.set('sanitizeFilter', true)` + `strictQuery` + validación zod (los operadores `$` nunca llegan a la consulta). |
| Headers | helmet (CSP, HSTS en producción, noSniff, frameguard). |
| CORS | Lista blanca desde `CORS_ORIGINS`; `credentials: true` sólo para esos orígenes. |
| Rate limiting | Global moderado; estricto en `/auth/login` y `/auth/refresh`. |
| Errores | Manejador central: al cliente sólo `code`, mensaje genérico y `requestId`; el detalle va al log. Sin stack traces en producción. |
| Logs | pino con `redact` (password, tokens, cookies, `authorization`, datos clínicos). |
| Secretos | `.env` (ignorado por git) + `.env.example`; la app no arranca si falta una variable obligatoria. |
| Auditoría | Middleware/servicio `audit.record(...)` en login (ok/fallido), cambios de rol/permisos, edición de expediente, archivado/eliminación, cambios de configuración y 403. |
| Transporte | HTTPS en producción; cookies `Secure`. |

## 9. Variables de entorno

**server/.env.example**
```
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb+srv://<usuario>:<password>@<cluster>/la_nutria?retryWrites=true&w=majority
JWT_ACCESS_SECRET=<cadena-aleatoria-64>
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=<otra-cadena-aleatoria-64>
JWT_REFRESH_TTL=7d
CORS_ORIGINS=http://localhost:5173
SEED_SUPERUSER_EMAIL=
SEED_SUPERUSER_PASSWORD=
LOG_LEVEL=info
```

**client/.env.example**
```
VITE_API_URL=http://localhost:4000/api/v1
VITE_USE_MOCKS=true
```

## 10. Estrategia de mocks → API real

1. `client/src/mocks/data/` — datos simulados (pacientes, consultas, series de mediciones realistas).
2. `client/src/mocks/handlers/` — handlers MSW que imitan **exactamente** los endpoints de §5.
3. Los componentes sólo usan `features/*/hooks.js` → `api.js` → `httpClient`. Nunca importan mocks.
4. `VITE_USE_MOCKS=false` → MSW no se inicia y las mismas llamadas van al backend.
