import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases condicionales y resuelve conflictos de Tailwind: la clase
 * pasada después gana (p. ej. `hidden lg:inline-flex` sobre el `inline-flex`
 * base de un botón).
 */
export const cn = (...args) => twMerge(clsx(...args));
