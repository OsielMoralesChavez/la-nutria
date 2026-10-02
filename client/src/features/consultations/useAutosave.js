import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Combina cambios pendientes; `draft` se combina por sección (measurement, goals…). */
const merge = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a, ...b };
  if (a.draft && b.draft) out.draft = { ...a.draft, ...b.draft };
  return out;
};

/**
 * Autoguardado del borrador de consulta.
 * - Guarda 2 s después del último cambio, y de inmediato con `flush()`.
 * - Si no hay conexión, reintenta al reconectar.
 * - Estado visible: 'saved' | 'dirty' | 'saving' | 'offline' | 'error'.
 */
export function useAutosave(save, { delay = 2000 } = {}) {
  const [status, setStatus] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const pending = useRef(null);
  const timer = useRef(null);
  const saving = useRef(false);
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  const run = useCallback(async () => {
    clearTimeout(timer.current);
    if (!pending.current || saving.current) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    const payload = pending.current;
    pending.current = null;
    let retry = true;
    saving.current = true;
    setStatus('saving');
    try {
      await saveRef.current(payload);
      setLastSavedAt(new Date());
      setStatus(pending.current ? 'dirty' : 'saved');
    } catch (err) {
      // Se conserva lo no guardado combinándolo con cambios posteriores.
      pending.current = merge(payload, pending.current);
      setStatus(err.code === 'NETWORK' ? 'offline' : 'error');
      // Un error de validación no se arregla reintentando: espera al siguiente cambio.
      retry = err.code === 'NETWORK';
    } finally {
      saving.current = false;
      if (retry && pending.current && navigator.onLine) timer.current = setTimeout(run, delay);
    }
  }, [delay]);

  /** Acumula un cambio parcial. */
  const queue = useCallback(
    (patch) => {
      pending.current = merge(pending.current, patch);
      setStatus('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(run, delay);
    },
    [run, delay],
  );

  useEffect(() => {
    const online = () => pending.current && run();
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      clearTimeout(timer.current);
    };
  }, [run]);

  // Aviso del navegador si se intenta cerrar con cambios sin guardar.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (pending.current || saving.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const flush = useCallback(async () => {
    while (saving.current) await new Promise((r) => setTimeout(r, 50));
    if (pending.current) await run();
    if (pending.current) throw new Error('No se pudieron guardar los últimos cambios');
  }, [run]);

  return { status, lastSavedAt, queue, flush };
}
