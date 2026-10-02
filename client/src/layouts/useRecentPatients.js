import { useCallback, useEffect, useState } from 'react';

/**
 * Últimos pacientes abiertos (acceso de 1 clic desde el sidebar).
 * Es una comodidad por navegador: sólo guarda id y nombre, nunca datos
 * clínicos, y tolera que el almacenamiento no esté disponible.
 */
const KEY = 'ln.recentPatients';
const MAX = 3;
const EVENT = 'ln:recent-patients';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function useRecentPatients() {
  const [items, setItems] = useState(read);

  useEffect(() => {
    const sync = () => setItems(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const push = useCallback((patient) => {
    if (!patient?.id) return;
    const next = [{ id: patient.id, name: patient.fullName }, ...read().filter((p) => p.id !== patient.id)].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { items, push, clear };
}
