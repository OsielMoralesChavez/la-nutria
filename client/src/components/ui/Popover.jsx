import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn.js';

/**
 * Popover anclado a un disparador. Cierra con Esc, clic fuera o al navegar.
 * `trigger` es una función que recibe props para el botón disparador.
 */
export function Popover({ trigger, children, align = 'end', className, width = 'w-64' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ 'aria-expanded': open, 'aria-controls': id, 'aria-haspopup': 'true', onClick: () => setOpen((o) => !o) })}
      {open && (
        <div
          id={id}
          className={cn(
            'glass-strong absolute top-full z-40 mt-2 rounded-xl border border-white/60 p-1.5 shadow-[var(--shadow-pop)] animate-slide-up max-sm:fixed max-sm:inset-x-3 max-sm:top-16 max-sm:w-auto',
            align === 'end' ? 'right-0' : 'left-0',
            width,
            className,
          )}
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

/** Opción de menú: enlace (`to`) o acción (`onClick`). */
export function MenuItem({ icon: Icon, to, onClick, children, danger, hint, close }) {
  const classes = cn(
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
    danger ? 'text-red-700 hover:bg-red-50' : 'text-ink-2 hover:bg-slate-900/5 hover:text-ink',
  );
  const content = (
    <>
      {Icon && <Icon aria-hidden className="size-4 shrink-0 opacity-80" />}
      <span className="flex-1">{children}</span>
      {hint && <kbd className="rounded border border-line bg-white px-1.5 text-[10px] text-ink-3">{hint}</kbd>}
    </>
  );
  return to ? (
    <Link to={to} className={classes} onClick={close}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      className={classes}
      onClick={() => {
        close?.();
        onClick?.();
      }}
    >
      {content}
    </button>
  );
}
