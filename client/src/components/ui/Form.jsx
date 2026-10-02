import { forwardRef, useId } from 'react';
import { cn } from '../../lib/cn.js';

const control =
  'block w-full rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 shadow-xs transition-colors ' +
  'hover:border-slate-300 focus:border-brand-600 focus:ring-3 focus:ring-brand-600/15 focus:outline-none ' +
  'disabled:bg-slate-50 disabled:text-ink-3 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/15';

/**
 * Campo de formulario: etiqueta, ayuda y error asociados por aria.
 * El hijo recibe `id`, `aria-invalid` y `aria-describedby` vía render prop.
 */
export function Field({ label, hint, error, required, className, children, labelHidden, inline }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn(inline ? 'flex items-center gap-3' : 'flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className={cn('text-sm font-medium text-ink-2', labelHidden && 'sr-only')}>
          {label}
          {required && (
            <span className="text-red-600" aria-hidden>
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'py-2 leading-relaxed resize-y min-h-20', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, 'h-10 pr-8 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  );
});

/**
 * Entrada numérica tolerante: acepta coma o punto como separador decimal y
 * abre el teclado numérico en tablet/móvil. `onValue` recibe number | null.
 */
export const NumberInput = forwardRef(function NumberInput({ value, onValue, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn(control, 'h-10 tabular text-right', className)}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.').replace(/[^\d.-]/g, '');
        onValue?.(raw, raw === '' || raw === '-' || raw === '.' ? null : Number(raw));
      }}
      {...props}
    />
  );
});

export function Checkbox({ label, description, className, ...props }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 rounded border-slate-300 text-brand-700 accent-brand-700 focus-visible:outline-2" {...props} />
      <label htmlFor={id} className="text-sm leading-tight text-ink-2">
        {label}
        {description && <span className="block text-xs text-ink-3">{description}</span>}
      </label>
    </div>
  );
}

/** Interruptor accesible (role="switch"). */
export function Switch({ checked, onChange, label, disabled, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-brand-700' : 'bg-slate-300',
        className,
      )}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
    </button>
  );
}

/** Control segmentado (p. ej. Libre | SOAP | Ambos, Día | Semana | Lista). */
export function SegmentedControl({ value, onChange, options, label, size = 'md', className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-xl bg-slate-900/5 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
            )}
          >
            {Icon && <Icon aria-hidden className="size-4" />}
            <span className={cn(o.icon && o.hideLabelOnMobile && 'max-sm:sr-only')}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
