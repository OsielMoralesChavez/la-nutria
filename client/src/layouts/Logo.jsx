import { cn } from '../lib/cn.js';

/** Marca: ícono + nombre. `compact` muestra sólo el ícono (sidebar contraído). */
export function Logo({ compact, size = 'md', className }) {
  const box = size === 'lg' ? 'size-11 rounded-2xl' : 'size-8 rounded-xl';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className={cn('grid shrink-0 place-items-center bg-brand-700 text-white shadow-sm', box)} aria-hidden>
        <svg viewBox="0 0 32 32" className={size === 'lg' ? 'size-8' : 'size-6'}>
          <path d="M9 20c0-5 3.1-9 7-9s7 4 7 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="13" cy="16" r="1.4" fill="currentColor" />
          <circle cx="19" cy="16" r="1.4" fill="currentColor" />
          <path d="M14.5 19.5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && <span className={cn('font-semibold tracking-tight text-ink', size === 'lg' ? 'text-2xl' : 'text-base')}>La Nutria</span>}
    </span>
  );
}
