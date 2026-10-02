import { forwardRef } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn.js';
import { Spinner } from './Spinner.jsx';

const VARIANTS = {
  primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-700/50',
  secondary: 'bg-white text-ink border border-line shadow-sm hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100',
  ghost: 'text-ink-2 hover:bg-slate-900/5 active:bg-slate-900/10',
  subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 disabled:bg-red-600/50',
  'danger-ghost': 'text-red-700 hover:bg-red-50 active:bg-red-100',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

const base =
  'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Botón base. Con `to` se renderiza como enlace (navegación), con `loading`
 * se deshabilita y muestra un spinner conservando el ancho.
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading, to, className, children, type = 'button', disabled, ...props },
  ref,
) {
  const classes = cn(base, VARIANTS[variant], SIZES[size], className);
  const content = (
    <>
      {loading ? <Spinner className="size-4" /> : Icon && <Icon aria-hidden className="size-4 shrink-0" />}
      {children}
      {IconRight && !loading && <IconRight aria-hidden className="size-4 shrink-0" />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
});

/** Botón sólo-ícono: `label` es obligatorio (accesibilidad y tooltip). */
export const IconButton = forwardRef(function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', className, badge, ...props }, ref) {
  const dims = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-12 rounded-xl' }[size];
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={cn(base, VARIANTS[variant], dims, 'relative', className)} {...props}>
      <Icon aria-hidden className={size === 'sm' ? 'size-4' : 'size-5'} />
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-[18px] text-center ring-2 ring-white tabular">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
});
