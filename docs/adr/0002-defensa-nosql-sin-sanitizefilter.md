# ADR 0002 — Defensa contra inyección NoSQL sin `sanitizeFilter` global

- **Estado:** aceptada
- **Modifica:** fila "Inyección NoSQL" de §8 en `02-arquitectura.md`

## Contexto

Se propuso `mongoose.set('sanitizeFilter', true)`. Al implementarlo se comprobó que esa opción también neutraliza los operadores **legítimos** que construyen los servicios (`$gt`, `$in`, `$ne`…), obligando a envolver cada consulta en `mongoose.trusted()`. Eso es frágil: olvidar un `trusted()` produce consultas que silenciosamente no devuelven nada.

`express-mongo-sanitize` tampoco es opción: en Express 5 `req.query` es de sólo lectura.

## Decisión

Defensa en dos capas, ambas en la **entrada**:

1. `middleware/sanitize.js` elimina de `body` y `params` toda clave que empiece con `$` o contenga `.`.
2. Todos los endpoints validan con **zod estricto** (`z.strictObject`): tipos primitivos esperados, longitudes máximas y rechazo de campos no declarados. La query string sólo se lee desde `req.valid.query` (ya validada).

Se mantiene `strictQuery: true` (campos no declarados en el schema se ignoran en filtros).

## Consecuencias

- Ningún objeto controlado por el usuario llega a un filtro de Mongo: sólo strings, números, fechas e ids validados.
- Prueba de regresión: `rbac.test.js › elimina operadores de MongoDB en el cuerpo`.
