import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn.js';

const ToastContext = createContext(null);

const ICONS = { success: [CheckCircle2, 'text-emerald-300'], error: [XCircle, 'text-red-300'], info: [Info, 'text-sky-300'] };

/**
 * Notificaciones efímeras (4 s). Admiten una acción (p. ej. "Deshacer").
 * Anunciadas a lectores de pantalla vía aria-live.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (toast) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, tone: 'success', ...toast }]);
      timers.current.set(id, setTimeout(() => dismiss(id), toast.duration ?? 4000));
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      show,
      success: (message, opts) => show({ message, tone: 'success', ...opts }),
      error: (message, opts) => show({ message, tone: 'error', duration: 6000, ...opts }),
      info: (message, opts) => show({ message, tone: 'info', ...opts }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6">
          {toasts.map((t) => {
            const [Icon, color] = ICONS[t.tone];
            return (
              <div
                key={t.id}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className="glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-white/15 px-4 py-3 text-sm shadow-[var(--shadow-pop)] animate-slide-up"
              >
                <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', color)} />
                <div className="min-w-0 flex-1">
                  {t.title && <p className="font-semibold text-ink">{t.title}</p>}
                  <p className="text-ink-2">{t.message}</p>
                </div>
                {t.action && (
                  <button
                    type="button"
                    className="shrink-0 font-semibold text-accent hover:underline"
                    onClick={() => {
                      t.action.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button type="button" aria-label="Cerrar notificación" onClick={() => dismiss(t.id)} className="shrink-0 text-ink-3 hover:text-ink">
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
