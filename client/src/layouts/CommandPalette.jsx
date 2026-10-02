import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarPlus, Search, Stethoscope, UserPlus, Workflow } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Avatar, Spinner, StatusBadge } from '../components/ui/index.js';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import { useStartConsultation } from '../features/consultations/hooks.js';
import { cn } from '../lib/cn.js';
import { fmtDate } from '../lib/format.js';
import { api } from '../lib/http.js';
import { NAV_GROUPS } from '../navigation/config.js';

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Paleta de comandos (Ctrl/⌘ K): busca pacientes por nombre o teléfono,
 * acciones y páginas. Enter abre; Alt+Enter (o el botón) inicia consulta.
 * En modo `consultation` elegir un paciente inicia la consulta directamente.
 */
export function CommandPalette({ open, mode = 'search', onClose }) {
  // Se monta al abrir: el estado (búsqueda, selección) empieza limpio cada vez.
  return open ? <PaletteBody mode={mode} onClose={onClose} /> : null;
}

function PaletteBody({ mode, onClose }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const start = useStartConsultation();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const term = useDebounced(q.trim());

  const patients = useQuery({
    queryKey: ['palette', term],
    queryFn: () => api.get('/patients', { q: term, limit: 6 }),
    enabled: term.length >= 2 && can('patients:read'),
    staleTime: 30_000,
  });

  const actions = useMemo(() => {
    if (mode === 'consultation') return [];
    const list = [
      can('patients:create') && { id: 'new-patient', label: 'Nuevo paciente', icon: UserPlus, run: () => navigate('/pacientes?nuevo=1') },
      can('appointments:create') && { id: 'new-appt', label: 'Nueva cita', icon: CalendarPlus, run: () => navigate('/agenda?nueva=1') },
      can('followups:read') && { id: 'pending', label: 'Ver pendientes de seguimiento', icon: Workflow, run: () => navigate('/seguimiento') },
      ...NAV_GROUPS.flatMap((g) => g.items)
        .filter((i) => can(i.permission))
        .map((i) => ({ id: `nav-${i.id}`, label: `Ir a ${i.label}`, icon: i.icon, run: () => navigate(i.path) })),
    ].filter(Boolean);
    const t = q.trim().toLowerCase();
    return t ? list.filter((a) => a.label.toLowerCase().includes(t)) : list.slice(0, 4);
  }, [mode, can, navigate, q]);

  const patientItems = (term.length >= 2 ? patients.data : null) ?? [];
  const items = [
    ...patientItems.map((p) => ({
      id: p.id,
      kind: 'patient',
      patient: p,
      run: (consult) => (mode === 'consultation' || consult ? start.mutate({ patientId: p.id }) : navigate(`/pacientes/${p.id}`)),
    })),
    ...actions.map((a) => ({ ...a, kind: 'action' })),
  ];

  const select = (item, consult = false) => {
    if (!item) return;
    item.run(consult);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(items[active], e.altKey);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[10vh]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Buscar" className="glass-strong relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/60 shadow-[var(--shadow-pop)] animate-slide-up">
        <div className="flex items-center gap-3 border-b border-line/70 px-4">
          <Search aria-hidden className="size-5 text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `pal-${items[active].id}` : undefined}
            placeholder={mode === 'consultation' ? 'Nueva consulta: busca al paciente…' : 'Busca un paciente (nombre o teléfono) o una acción…'}
            className="h-14 flex-1 bg-transparent text-base text-ink placeholder:text-slate-400 focus:outline-none"
          />
          {(patients.isFetching || start.isPending) && <Spinner className="size-4 text-brand-700" />}
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2 scrollbar-thin">
          {term.length >= 2 && patients.isSuccess && patientItems.length === 0 && (
            <li className="px-3 py-3 text-sm text-ink-3">Ningún paciente coincide con “{term}”.</li>
          )}
          {term.length < 2 && mode === 'consultation' && <li className="px-3 py-3 text-sm text-ink-3">Escribe al menos 2 letras del nombre o del teléfono.</li>}
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`pal-${item.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => select(item)}
              className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', i === active && 'bg-brand-700/10')}
            >
              {item.kind === 'patient' ? (
                <>
                  <Avatar name={item.patient.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.patient.fullName}</p>
                    <p className="truncate text-xs text-ink-3">
                      {item.patient.age} años · {item.patient.contact?.phone}
                      {item.patient.lastConsultationAt && ` · última consulta ${fmtDate(item.patient.lastConsultationAt)}`}
                    </p>
                  </div>
                  <StatusBadge kind="patient" status={item.patient.status} size="sm" />
                  {mode !== 'consultation' && can('consultations:create') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        select(item, true);
                      }}
                      className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 sm:inline-flex"
                      title="Iniciar consulta (Alt+Enter)"
                    >
                      <Stethoscope aria-hidden className="size-3.5" /> Consulta
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="grid size-7 place-items-center rounded-lg bg-slate-900/5 text-ink-2">
                    <item.icon aria-hidden className="size-4" />
                  </span>
                  <span className="flex-1 text-sm text-ink-2">{item.label}</span>
                  <ArrowRight aria-hidden className="size-4 text-ink-3" />
                </>
              )}
            </li>
          ))}
        </ul>
        <footer className="hidden items-center gap-4 border-t border-line/70 px-4 py-2 text-[11px] text-ink-3 sm:flex">
          <span>↑↓ navegar</span>
          <span>Enter abrir</span>
          {mode !== 'consultation' && <span>Alt+Enter iniciar consulta</span>}
          <span>Esc cerrar</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
