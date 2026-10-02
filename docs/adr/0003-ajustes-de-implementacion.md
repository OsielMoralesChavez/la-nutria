# ADR 0003 — Ajustes menores durante la implementación

- **Estado:** aceptada

Cambios respecto a los documentos de las fases 3 y 4 que no alteran el diseño aprobado, pero conviene registrar.

| # | Tema | Documento original | Implementado | Motivo |
|---|---|---|---|---|
| 1 | Versiones | React Router 7, Mongoose 8 | React Router 8, Mongoose 9, Vite 8, Express 5, zod 4 | Eran las versiones estables vigentes al instalar (oct 2026). Se revisaron sus cambios incompatibles (p. ej. `RouterProvider` se importa de `react-router/dom`; hooks de Mongoose sin `next`). |
| 2 | Hash de contraseñas | bcrypt | **bcryptjs** (mismo algoritmo, cost 12) | Implementación en JS puro: evita compilar módulos nativos en Windows/OneDrive. |
| 3 | Gráficas con varias métricas | "hasta 2 métricas superpuestas con dos ejes" (UX §8) | **Gráficas pequeñas sincronizadas**, una por métrica | Un doble eje induce lecturas erróneas (escalas arbitrarias). Cada métrica tiene su escala y su meta. |
| 4 | Reglas de alerta | `server/src/alerts/rules/<regla>.js` | Un solo módulo `server/src/alerts/rules.js` con un objeto por regla | Son 6 reglas cortas; agregar una sigue siendo agregar un objeto. Se puede dividir en archivos cuando crezcan. |
| 5 | Refresh token | Rotación + revocación ante reutilización | + **ventana de gracia de 30 s** para el token inmediatamente anterior | Dos pestañas que renuevan a la vez enviaban el mismo token y la sesión se revocaba por error. Dentro de la ventana se entrega un access token sin rotar. |
| 6 | Iniciar consulta desde la ficha | Sólo desde la cita se vinculaba | Si el paciente tiene **cita hoy** con ese nutriólogo, la consulta se vincula sola | Al cerrar, la cita queda "realizada" aunque se haya iniciado desde la ficha. |
| 7 | `/auth/refresh` sin cookie | 401 | **204** | No tener sesión al abrir la app no es un error (evita ruido en consola y logs). |
| 8 | Selector de nutriólogo | Todos los usuarios activos | Sólo roles con `consultations:create`, excluyendo Superusuario | El Superusuario es una cuenta administrativa. |
| 9 | Clases CSS | `clsx` | `clsx` + **tailwind-merge** | Resolver conflictos (`hidden` vs `inline-flex`) al extender componentes; detectado en la prueba responsive. |
| 10 | Carga del frontend | Bundle único | **Carga diferida por sección** (`React.lazy`) | El bundle inicial bajó de ~1.1 MB a ~375 kB. |
