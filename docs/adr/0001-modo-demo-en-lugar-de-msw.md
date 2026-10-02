# ADR 0001 — Modo demo con MongoDB en memoria en lugar de mocks MSW

- **Estado:** aceptada (implementación, Fase 6)
- **Reemplaza:** §10 "Estrategia de mocks → API real" de `02-arquitectura.md` (MSW en el navegador)

## Contexto

La arquitectura aprobada proponía que, mientras no hubiera MongoDB, el frontend trabajara con datos simulados servidos por MSW (Mock Service Worker), separados del código de las pantallas.

Durante la implementación el backend completo quedó listo antes que el frontend. Con MSW habría que **reimplementar en el navegador** la lógica del servidor (resumen 360°, línea de tiempo, cierre transaccional de consulta, motor de alertas, huecos de agenda…) sólo para tener datos de prueba. Eso duplica reglas de negocio y abre la puerta a que mocks y API se comporten distinto.

## Decisión

Se agrega un **modo demo** (`npm run dev:demo`) que:

1. Levanta un MongoDB **en memoria** (replica set de 1 nodo, para soportar transacciones) con `mongodb-memory-server`.
2. Siembra datos base y un conjunto de **datos ficticios** (`server/src/seeds/demo.js`): 4 usuarios (uno por rol) y 14 pacientes con historial, objetivos, agenda y alertas.
3. Arranca la **API real**. El frontend siempre hace llamadas HTTP reales a `/api/v1`.

## Consecuencias

- ✅ El requisito original se cumple: los datos simulados están **aislados** (`seeds/demo.js`) y **no hay datos dentro de los componentes**. Pasar a datos reales no requiere cambiar el frontend: sólo usar `npm run dev` con `server/.env`.
- ✅ Una sola implementación de la lógica de negocio; lo que se prueba en demo es lo que corre en producción.
- ✅ Las pruebas de integración usan la misma infraestructura.
- ⚠️ La primera ejecución descarga el binario de MongoDB (~780 MB; queda en caché).
- ⚠️ El modo demo requiere Node en la máquina (no corre sólo en el navegador). Se considera aceptable porque el proyecto ya lo requiere para la API.
- El modo demo se niega a arrancar con `NODE_ENV=production`, y `seed:demo` contra una BD real exige `SEED_DEMO_PASSWORD` (nunca usa la contraseña demo fija).
