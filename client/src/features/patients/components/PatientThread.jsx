import { CalendarClock, Flag, ListChecks, TrendingUp } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '../../../lib/cn.js';
import { fmtDate, fmtDelta, fmtNum } from '../../../lib/format.js';

/**
 * EL HILO: navegación principal de la ficha. Cuatro pasos conectados que
 * responden, cada uno con su respuesta corta, las preguntas:
 *   ① ¿Cómo inició? → ② ¿Qué se hizo? → ③ ¿Cómo va? → ④ ¿Qué sigue?
 * Cada paso es un enlace a su vista detallada (URL propia).
 */
export function buildThread(summary) {
  const { start, interventions, progress, next } = summary;
  const weight = progress.metrics.find((m) => m.key === 'peso');
  const goalsActive = progress.goalsActive;
  const reached = progress.goalsReached;
  const nextAppt = next.appointments[0];
  const pendingCount = next.followUps.length + next.alerts.length;

  return [
    {
      key: 'inicio',
      n: '①',
      question: '¿Cómo inició?',
      icon: Flag,
      to: 'inicio',
      answer: start.firstConsultation ? fmtDate(start.firstConsultation.date) : 'Sin consulta inicial',
      detail: start.baseline.find((b) => b.key === 'peso')
        ? `${fmtNum(start.baseline.find((b) => b.key === 'peso').value)} kg`
        : start.reason || 'Pendiente',
    },
    {
      key: 'intervenciones',
      n: '②',
      question: '¿Qué se hizo?',
      icon: ListChecks,
      to: 'intervenciones',
      answer: `${interventions.consultationCount} consulta${interventions.consultationCount === 1 ? '' : 's'}`,
      detail: interventions.consultationCount ? `${interventions.monthsInTreatment} mes${interventions.monthsInTreatment === 1 ? '' : 'es'} de seguimiento` : 'Aún sin intervenciones',
    },
    {
      key: 'evolucion',
      n: '③',
      question: '¿Cómo va?',
      icon: TrendingUp,
      to: 'evolucion',
      answer:
        weight?.baseline && weight?.current && weight.current.takenAt !== weight.baseline.takenAt
          ? `${fmtDelta(weight.current.value - weight.baseline.value)} kg`
          : 'Sin evolución aún',
      detail: goalsActive || reached ? `${goalsActive} meta${goalsActive === 1 ? '' : 's'} en curso · ${reached} lograda${reached === 1 ? '' : 's'}` : 'Sin objetivos',
    },
    {
      key: 'siguiente',
      n: '④',
      question: '¿Qué sigue?',
      icon: CalendarClock,
      to: 'siguiente',
      answer: nextAppt ? `Cita ${fmtDate(nextAppt.start)}` : 'Sin cita',
      detail: pendingCount ? `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}` : 'Nada pendiente',
      attention: !nextAppt || next.alerts.length > 0,
    },
  ];
}

export function PatientThread({ summary }) {
  const steps = buildThread(summary);
  return (
    <nav aria-label="Hilo del paciente" className="relative">
      <ol className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {steps.map((s, i) => (
          <li key={s.key} className="relative min-w-0">
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute right-[-10px] top-1/2 z-0 hidden h-0.5 w-3 -translate-y-1/2 bg-brand-200 sm:block" />
            )}
            <NavLink
              to={s.to}
              className={({ isActive }) =>
                cn(
                  'relative z-10 flex h-full flex-col rounded-xl border px-2.5 py-2 transition-all sm:px-3.5 sm:py-3',
                  isActive
                    ? 'border-brand-600 bg-brand-700 text-white shadow-[var(--shadow-pop)]'
                    : 'border-line bg-surface-2 hover:border-brand-300 hover:shadow-[var(--shadow-card)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide sm:text-xs', isActive ? 'text-white/80' : 'text-accent')}>
                    <s.icon aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate">
                      <span className="sm:hidden">{s.n}</span>
                      <span className="max-sm:hidden">{s.question}</span>
                    </span>
                  </span>
                  <span className={cn('mt-1 truncate text-xs font-semibold sm:text-base tabular', isActive ? 'text-white' : 'text-ink')}>{s.answer}</span>
                  <span className={cn('truncate text-[11px] max-sm:hidden sm:text-xs', isActive ? 'text-white/75' : 'text-ink-3')}>
                    {s.detail}
                    {s.attention && !isActive && <span aria-hidden className="ml-1 inline-block size-1.5 rounded-full bg-amber-500 align-middle" />}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}
