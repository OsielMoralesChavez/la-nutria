import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Avatar } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { api } from '../../../lib/http.js';

/** Selector de paciente con búsqueda (nombre o teléfono). */
export function PatientCombobox({ value, onChange, inputProps }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({
    queryKey: ['patient-combobox', term],
    queryFn: () => api.get('/patients', { q: term, limit: 8 }),
    enabled: term.length >= 2,
  });
  const items = results.data ?? [];

  if (value) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-2">
        <Avatar name={value.fullName} size="sm" />
        <span className="flex-1 truncate text-sm font-medium text-ink">{value.fullName}</span>
        <button type="button" aria-label="Cambiar paciente" onClick={() => onChange(null)} className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-slate-900/5">
          <X aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  const pick = (p) => {
    onChange(p);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <input
        {...inputProps}
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(items.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter' && items[active]) {
            e.preventDefault();
            pick(items[active]);
          }
        }}
        placeholder="Busca por nombre o teléfono…"
        className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/15"
        autoComplete="off"
      />
      {open && term.length >= 2 && (
        <ul id={listId} role="listbox" className="glass-strong absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-white/60 p-1 shadow-[var(--shadow-pop)]">
          {results.isFetching && items.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">Buscando…</li>}
          {results.isSuccess && items.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">Sin coincidencias.</li>}
          {items.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5', i === active && 'bg-brand-700/10')}
            >
              <Avatar name={p.fullName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{p.fullName}</span>
                <span className="block text-xs text-ink-3">
                  {p.age} años · {p.contact?.phone}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
