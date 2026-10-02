import { ArrowLeft } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { cn } from '../../lib/cn.js';
import { initials } from '../../lib/format.js';

/** Encabezado de página: título, descripción, acciones y enlace de regreso opcional. */
export function PageHeader({ title, description, actions, back, className, children }) {
  return (
    <header className={cn('mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-1 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-accent">
            <ArrowLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const AVATAR_TONES = ['bg-brand-100 text-accent', 'bg-amber-400/25 text-amber-200', 'bg-sky-400/25 text-sky-200', 'bg-violet-400/25 text-violet-200', 'bg-rose-400/25 text-rose-200', 'bg-emerald-400/25 text-emerald-200'];

export function Avatar({ name, size = 'md', className }) {
  const tone = AVATAR_TONES[[...(name ?? '')].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const dims = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-base', xl: 'size-14 text-lg' }[size];
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-full font-semibold', tone, dims, className)}>
      {initials(name)}
    </span>
  );
}

/** Barra de progreso accesible (valor 0–1). */
export function ProgressBar({ value, tone = 'brand', label, className, size = 'md' }) {
  const pct = Math.round(Math.min(1, Math.max(0, value ?? 0)) * 100);
  const color = { brand: 'bg-brand-600', green: 'bg-emerald-600', amber: 'bg-amber-500', sky: 'bg-sky-600' }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-white/10', size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Minigráfica de tendencia (sin ejes). Una sola serie en color de marca;
 * el último punto se resalta. Decorativa: el valor va en texto al lado.
 */
export function Sparkline({ points, width = 84, height = 26, className }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 3;
  const x = (i) => pad + (i * (width - pad * 2)) / (points.length - 1);
  const y = (v) => pad + (height - pad * 2) * (1 - (v - min) / span);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className={cn('overflow-visible', className)}>
      <path d={d} fill="none" stroke="#a9a7ff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(points[last])} r="3" fill="#a9a7ff" stroke="#2b2766" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Tarjeta de indicador. Toda tarjeta con `to` es un enlace a la lista que
 * explica el número (principio del dashboard).
 */
export function StatCard({ label, value, sub, icon: Icon, to, tone = 'neutral', className }) {
  const tile = { neutral: 'bg-brand-400/20 text-accent', warning: 'bg-amber-400/20 text-amber-300', danger: 'bg-red-400/20 text-red-300' }[tone];
  const content = (
    <>
      {Icon && (
        <span aria-hidden className={cn('mb-3 grid size-11 place-items-center rounded-xl', tile)}>
          <Icon className="size-5" />
        </span>
      )}
      <p className="text-2xl font-semibold tracking-tight text-ink tabular">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-ink-2">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </>
  );
  const classes = cn('card block p-4 transition-all', to && 'hover:-translate-y-0.5 hover:bg-white/[0.11] hover:shadow-[var(--shadow-pop)]', className);
  return to ? (
    <Link to={to} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}

/** Pestañas como enlaces (secciones con URL propia). */
export function NavTabs({ items, className, label }) {
  return (
    <nav aria-label={label} className={cn('-mb-px flex gap-1 overflow-x-auto scrollbar-thin', className)}>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cn(
              'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'border-brand-700 text-accent' : 'border-transparent text-ink-3 hover:text-ink hover:border-white/20',
            )
          }
        >
          {it.icon && <it.icon aria-hidden className="size-4" />}
          {it.label}
          {it.badge ? <span className="rounded-full bg-white/15 px-1.5 text-[11px] tabular">{it.badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

/** Pestañas en el mismo lugar (estado local), con navegación por flechas. */
export function Tabs({ value, onChange, items, label, className }) {
  const onKey = (e, i) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
    onChange(next.value);
    document.getElementById(`tab-${next.value}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-line scrollbar-thin', className)}>
      {items.map((it, i) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            id={`tab-${it.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(it.value)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'border-brand-700 text-accent' : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {it.icon && <it.icon aria-hidden className="size-4" />}
            {it.label}
            {it.badge ? <span className="rounded-full bg-white/15 px-1.5 text-[11px] tabular">{it.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Lista definición compacta: etiqueta → valor. */
export function DataList({ items, className }) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm', className)}>
      {items
        .filter((i) => i.value !== undefined && i.value !== null && i.value !== '')
        .map((i) => (
          <div key={i.label} className="contents">
            <dt className="text-ink-3">{i.label}</dt>
            <dd className="min-w-0 text-ink break-words">{i.value}</dd>
          </div>
        ))}
    </dl>
  );
}
