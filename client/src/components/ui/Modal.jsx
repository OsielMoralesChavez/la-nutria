import { X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn.js';
import { IconButton } from './Button.jsx';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Bloquea scroll del body, atrapa el foco y lo devuelve al cerrar. */
function useDialogBehavior(open, onClose, panelRef) {
  // onClose suele ser una función nueva en cada render: se guarda en ref para
  // que el efecto no se reejecute (y no robe el foco mientras se escribe).
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const first = panel?.querySelector('[data-autofocus]') ?? panel?.querySelector(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current?.();
      }
      if (e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const [head, tail] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === head) {
          e.preventDefault();
          tail.focus();
        } else if (!e.shiftKey && document.activeElement === tail) {
          e.preventDefault();
          head.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, panelRef]);
}

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * Modal accesible. En móvil se presenta como hoja inferior (bottom sheet).
 */
export function Modal({ open, onClose, title, description, size = 'md', footer, children, className }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  useDialogBehavior(open, onClose, panelRef);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'glass-strong relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-white/15 shadow-[var(--shadow-pop)] outline-none animate-slide-up sm:rounded-2xl',
          SIZES[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-sm text-ink-3">
                {description}
              </p>
            )}
          </div>
          <IconButton icon={X} label="Cerrar" size="sm" onClick={onClose} className="-mr-2 -mt-1" />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line/70 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Panel lateral derecho (detalle de cita, filtros…). */
export function Drawer({ open, onClose, title, children, footer, width = 'sm:w-[420px]' }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useDialogBehavior(open, onClose, panelRef);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 animate-fade-in" onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('glass-strong relative flex h-full w-full flex-col border-l border-white/15 shadow-[var(--shadow-pop)] outline-none animate-slide-in-right', width)}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <IconButton icon={X} label="Cerrar" size="sm" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && <footer className="border-t border-line/70 px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
