# ADR 0004 — Tema oscuro de cristal (referencia visual del cliente)

- **Estado:** aceptada
- **Reemplaza:** la paleta clara verde azulado de `03-ux.md` §15 (el resto de la UX no cambia)

## Contexto

El cliente proporcionó una imagen de referencia: interfaz de **vidrio esmerilado sobre un paisaje difuminado al atardecer**, con acento violeta, un marco grande redondeado que contiene el menú lateral y el contenido, buscador tipo píldora, tarjetas con ícono en recuadro y avatar con aro.

## Decisión

- **Fondo:** `client/src/assets/scene.svg` (cielo violeta/rosa/ámbar, montañas y lago, con desenfoque). Propio, sin imágenes de terceros.
- **Marco** (`.frame`, sólo `lg+`): único elemento con `backdrop-filter`. Los elementos internos (`.card`, `.pane`) son translúcidos **sin blur propio**: se ve nítido y rinde mejor (los `backdrop-filter` anidados no filtran el fondo real). En móvil no hay marco y el contenido va directo sobre el fondo, para que los elementos `fixed` (barra inferior, barra ¿Qué sigue?) se posicionen respecto a la pantalla.
- **Tokens** en `styles/index.css`: escala de marca índigo/violeta (tintes oscuros 50–200, sólidos 500–900), `--color-accent` para texto/enlaces, tinta clara (`ink`, `ink-2`, `ink-3`) y `surface`/`surface-2` translúcidos.
- **Estados** (éxito, aviso, error) con tintes translúcidos (`bg-*-400/15`, `text-*-300`), siempre con ícono + texto.
- **Accesibilidad:** `color-scheme: dark`, contraste de texto ≥ 4.5:1 sobre las superficies, foco visible en `--color-accent`, y respeto a `prefers-reduced-transparency` (superficies opacas) y `prefers-reduced-motion`.

## Consecuencias

- El menú lateral pasa a ser parte del marco (logo arriba, elemento activo como píldora rellena); la barra superior deja de repetir el logo en escritorio.
- Los desplazamientos "pegajosos" (barra superior, columna ¿Qué sigue?, cabecera del modo consulta) usan offsets que consideran el margen del marco.
- Un tema claro requeriría redefinir los tokens (no hay estilos de color dispersos salvo los sólidos intencionales de botones y barras).
