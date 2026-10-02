# Fase 2 — Análisis de requisitos

> Estado: **propuesta en validación**. Los puntos marcados como **[SUPUESTO]** son decisiones por defecto tomadas por el arquitecto (el Bloque 2 del levantamiento se delegó a esta fase). Se pueden cambiar sin rehacer la arquitectura.
> Los puntos **[PENDIENTE]** requieren confirmación del nutriólogo antes de implementar el módulo correspondiente.

## 1. Contexto confirmado

| Tema | Confirmado |
|---|---|
| Usuarios | Varios nutriólogos, un solo consultorio |
| Pacientes | Todo tipo (peso, deportistas, crónicos, embarazo, pediatría, TCA…) |
| Captura | En la aplicación, durante la consulta |
| Dispositivos | Escritorio, laptop, tablet y móvil (responsive) |
| Base de datos | MongoDB Atlas |
| Patrón | MVC (+ capa de servicios) |
| Prioridad #1 | **Evolución del paciente** |

## 2. Actores

| Actor | Descripción |
|---|---|
| Nutriólogo | Atiende pacientes, registra consultas, mediciones, objetivos y seguimiento. |
| Nutriólogo administrador | Además gestiona usuarios nutriólogos, catálogos (métricas) y configuración del consultorio. |
| Superusuario | Control global: roles, permisos, auditoría, configuración del sistema. |
| Sistema | Calcula métricas derivadas (IMC), genera alertas según reglas **configuradas**, registra auditoría. |
| *(Futuro)* Asistente / recepción | Rol adicional sin acceso clínico. Se crea como datos, sin cambiar código. |
| *(Futuro)* Paciente | Portal del paciente. Fuera de alcance. |

## 3. Roles (mapeo a los roles solicitados)

| Rol del sistema | Quién lo usa | Alcance de pacientes |
|---|---|---|
| **Usuario** | Nutriólogo | Sus pacientes asignados + lectura de pacientes del consultorio **[SUPUESTO, opción c]** |
| **Administrador** | Nutriólogo coordinador | Todos los pacientes; gestiona usuarios con rol *Usuario* |
| **Superusuario** | Dueño / responsable técnico | Todo, incluyendo roles, permisos y auditoría |

## 4. Decisiones por defecto del Bloque 2 [SUPUESTO]

1. **Propiedad de pacientes:** cada paciente tiene un *nutriólogo responsable*. Cualquier nutriólogo puede **consultar** y **atender** pacientes de otros (cobertura de ausencias); sólo el responsable o un administrador puede **reasignar o archivar**. Cada consulta/medición guarda quién la registró.
2. **Personal de apoyo:** no existe en el MVP. El modelo RBAC permite crear un rol "Asistente" sin permisos clínicos más adelante.
3. **Alta mínima de paciente:** nombre, apellidos, fecha de nacimiento, sexo, teléfono. El resto se completa en la evaluación inicial.
4. **Historia clínica:** secciones modulares (ver §6). Todas opcionales; el nutriólogo llena las que apliquen.
5. **Historia clínica versionada:** sí. Cada modificación crea una revisión; se puede ver qué decía antes y quién/cuándo lo cambió.
6. **Estados del paciente:** `activo`, `en_pausa`, `alta` (meta cumplida), `abandono`, `archivado`. El umbral de "sin seguimiento" **no se fija en código**: es configurable y la alerta queda **desactivada** hasta que el nutriólogo defina el valor.
7. **Eliminación:** borrado lógico (archivado) con auditoría. Borrado físico sólo por Superusuario, con confirmación y registro. *(En México, la NOM-004-SSA3-2012 exige conservar el expediente clínico mínimo 5 años, y la LFPDPPP da derecho de cancelación; el borrado físico debe ser excepcional.)*

## 5. Requerimientos funcionales (MVP)

### Autenticación y acceso
- RF-01 Inicio de sesión con correo y contraseña.
- RF-02 Cierre de sesión e invalidación de la sesión en servidor.
- RF-03 Renovación de sesión transparente (refresh token).
- RF-04 Bloqueo temporal tras intentos fallidos.
- RF-05 Cambio de contraseña por el propio usuario.

### Usuarios y permisos
- RF-10 Alta, edición, desactivación de usuarios (según rol del que opera).
- RF-11 Asignación de rol a usuario.
- RF-12 Superusuario puede editar los permisos de cada rol.
- RF-13 Un usuario no puede elevar su propio rol ni asignar un rol superior al suyo.

### Pacientes
- RF-20 Alta rápida de paciente (datos mínimos).
- RF-21 Búsqueda por nombre/teléfono/correo con filtros (estado, responsable, etiquetas).
- RF-22 Ficha del paciente con resumen de evolución.
- RF-23 Cambio de estado con motivo; se conserva el historial de estados.
- RF-24 Reasignación de nutriólogo responsable.
- RF-25 Archivado (borrado lógico) y restauración.

### Expediente (historia clínica)
- RF-30 Registro de historia clínica por secciones.
- RF-31 Cada edición genera una revisión consultable (quién, cuándo, qué cambió).

### Consultas
- RF-40 Crear consulta (inicial o de seguimiento) ligada a paciente y nutriólogo.
- RF-41 Guardado como borrador y cierre de consulta; una consulta cerrada no se edita, sólo se le agregan **adendas**.
- RF-42 Durante la consulta se muestran los valores de la medición anterior como referencia.

### Mediciones
- RF-50 Registrar mediciones históricas (una toma = un registro; nunca se sobrescribe la anterior).
- RF-51 Catálogo configurable de métricas (nombre, unidad, rango válido, categoría).
- RF-52 Cálculo automático de métricas derivadas (IMC; otras sólo si el nutriólogo las valida).
- RF-53 Gráficas de tendencia por métrica y comparación entre fechas.

### Objetivos
- RF-60 Definir objetivos (métrica + valor meta + fecha) o cualitativos.
- RF-61 Progreso calculado contra la línea base y la última medición.
- RF-62 Estados: `en_curso`, `logrado`, `no_logrado`, `cancelado`.

### Seguimiento
- RF-70 Línea de tiempo del paciente (consultas, mediciones, objetivos, cambios de expediente, notas).
- RF-71 Programar el próximo seguimiento (fecha + motivo) al cerrar una consulta.
- RF-72 Lista de seguimientos pendientes/vencidos.

### Alertas
- RF-80 Motor de alertas basado en reglas configurables, **desactivadas por defecto**.
- RF-81 Atender/descartar alerta con registro de quién lo hizo.

### Dashboard
- RF-90 Indicadores operativos (definición final pendiente con el nutriólogo).

### Auditoría
- RF-100 Bitácora de accesos, cambios de permisos, cambios de expediente, archivado/eliminación y cambios administrativos.
- RF-101 Consulta de bitácora (sólo Superusuario).

## 6. Secciones propuestas de la historia clínica [PENDIENTE de validar contenido]

Motivo de consulta · Antecedentes heredofamiliares · Antecedentes personales patológicos · Medicamentos y suplementos · Alergias e intolerancias · Estilo de vida (actividad física, sueño, estrés, tabaco, alcohol) · Hábitos alimentarios (horarios, preferencias, aversiones, recordatorio 24 h) · Antecedentes ginecoobstétricos (si aplica) · Laboratorios.

## 7. Requerimientos no funcionales

| Id | Requisito |
|---|---|
| RNF-01 | Responsive: 360 px a escritorio. Tablet como dispositivo principal de captura. |
| RNF-02 | Accesibilidad WCAG 2.1 AA: contraste, foco visible, navegación por teclado, etiquetas. |
| RNF-03 | Seguridad: contraseñas con bcrypt, JWT de corta duración, refresh token rotativo en cookie httpOnly, RBAC validado en backend, rate limiting, headers de seguridad, CORS restringido. |
| RNF-04 | Privacidad: datos clínicos nunca en logs, URLs ni mensajes de error. |
| RNF-05 | Integridad histórica: mediciones, consultas cerradas y revisiones de expediente son inmutables (sólo se agregan registros). |
| RNF-06 | Auditoría de acciones sensibles. |
| RNF-07 | Rendimiento: listados paginados; ficha del paciente < 1 s con 5 años de historial. |
| RNF-08 | Mantenibilidad: módulos con responsabilidades claras; datos mock separados y reemplazables. |
| RNF-09 | Extensibilidad: agenda, planes, documentos, fotos, PDF, portal del paciente sin rediseñar el núcleo. |
| RNF-10 | Configuración por variables de entorno; sin credenciales en el repositorio. |

## 8. Flujos principales

**F1 — Paciente nuevo**
Alta rápida → Consulta inicial (borrador) → Historia clínica → Mediciones base → Objetivos → Próximo seguimiento → Cerrar consulta.

**F2 — Consulta de seguimiento**
Buscar paciente → Ver resumen (última medición, objetivos activos, notas previas) → Nueva consulta → Mediciones (con valor anterior al lado) → Notas / ajustes → Actualizar objetivos → Programar siguiente seguimiento → Cerrar.

**F3 — Revisar evolución**
Ficha → Resumen (inicio vs. hoy) → Línea de tiempo → Gráficas por métrica → Objetivos.

**F4 — Operación diaria**
Dashboard → Seguimientos de hoy / vencidos → Alertas → Abrir paciente.

**F5 — Administración**
Usuarios → Alta/rol → (Superusuario) Permisos por rol → Auditoría.

## 9. Definiciones aprobadas (antes "pendientes P1–P7")

> Las decisiones por defecto de §4 fueron **aprobadas**.

**Principio transversal:** los parámetros clínicos y operativos que puedan variar entre nutriólogos **no se codifican**: van en catálogos, configuración o estructuras extensibles.

| # | Tema | Requisito |
|---|---|---|
| P1 | Mediciones | Catálogo inicial: peso, estatura, IMC, % grasa, masa muscular, grasa visceral, agua corporal, cintura, cadera, relación cintura/cadera. Cada medición registra **método** (bioimpedancia, antropometría/pliegues, otro — catálogo editable), **fecha** y **consulta**. |
| P2 | Objetivos | Tipos (catálogo): pérdida / aumento / mantenimiento de peso, reducción de grasa, aumento de masa muscular, mejora de composición corporal, cambio de hábitos, adherencia al plan, personalizado. Con valor inicial, meta, fecha objetivo, progreso y estado. |
| P3 | Notas | Híbrido: texto libre + SOAP **opcional** por consulta. Formato por defecto configurable por nutriólogo. |
| P4 | Alertas | Motor configurable sin umbrales clínicos rígidos. Reglas operativas iniciales: seguimiento pendiente, próxima consulta, objetivo vencido / por vencer, sin mediciones recientes, paciente sin actividad. Umbrales editables. |
| P5 | Dashboard | Pacientes activos, nuevos, consultas/seguimientos próximos, seguimientos pendientes, sin seguimiento reciente, objetivos activos, objetivos alcanzados, alertas pendientes + actividad reciente + gráficas sólo si aportan. |
| P6 | Fotos y documentos | En el MVP, **modular**: modelo e interfaz para asociarlos a paciente y consulta. No bloquea el núcleo (se activa por bandera). |
| P7 | Agenda | Básica en el MVP: programar, consultar, reprogramar, cancelar. Estados: programada, confirmada, realizada, cancelada, no asistió. Ligada a paciente y consulta; preparada para recordatorios. |

### Requerimientos funcionales añadidos

- RF-54 Registrar el método de medición por toma (y opcionalmente por valor).
- RF-55 Métricas derivadas automáticas: IMC y relación cintura/cadera.
- RF-63 Catálogo de tipos de objetivo; objetivos cualitativos con registro de avance por consulta.
- RF-43 Notas híbridas (libre + SOAP opcional); formato preferido por usuario.
- RF-110 Agenda: crear, ver (día/semana/lista), reprogramar, cancelar, confirmar, marcar no asistió; iniciar consulta desde la cita.
- RF-111 Validar traslapes de citas por nutriólogo.
- RF-120 Adjuntar fotografías y documentos a paciente y, opcionalmente, a consulta; comparar fotografías entre fechas.
- RF-130 Catálogos editables: métricas, métodos, tipos de objetivo, tipos de cita, categorías de archivo, etiquetas.
- RF-131 Configuración de reglas de alerta (activar, umbral, severidad).
