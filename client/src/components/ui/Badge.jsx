import {
  AlertTriangle,
  Ban,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  CircleSlash,
  Clock,
  Flag,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import {
  ALERT_SEVERITY,
  APPOINTMENT_STATUS,
  FOLLOWUP_STATUS,
  GOAL_STATUS,
  PATIENT_STATUS,
} from '@lanutria/shared';
import { cn } from '../../lib/cn.js';

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
};

export function Badge({ tone = 'neutral', icon: Icon, children, className, size = 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0 text-[11px]' : 'px-2 py-0.5 text-xs',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} />}
      {children}
    </span>
  );
}

/**
 * Estados de dominio: siempre con ícono + texto (nunca sólo color).
 */
const STATUS_MAP = {
  patient: {
    labels: PATIENT_STATUS.labels,
    activo: ['green', CircleDot],
    en_pausa: ['amber', PauseCircle],
    alta: ['brand', Flag],
    abandono: ['neutral', CircleSlash],
  },
  appointment: {
    labels: APPOINTMENT_STATUS.labels,
    programada: ['neutral', CircleDashed],
    confirmada: ['brand', CalendarCheck],
    realizada: ['green', CheckCircle2],
    cancelada: ['neutral', XCircle],
    no_asistio: ['amber', Ban],
  },
  goal: {
    labels: GOAL_STATUS.labels,
    en_curso: ['sky', CircleDot],
    logrado: ['green', CheckCircle2],
    no_logrado: ['amber', XCircle],
    cancelado: ['neutral', CircleSlash],
  },
  followup: {
    labels: FOLLOWUP_STATUS.labels,
    pendiente: ['amber', Clock],
    realizado: ['green', CheckCircle2],
    cancelado: ['neutral', XCircle],
  },
  severity: {
    labels: ALERT_SEVERITY.labels,
    alta: ['red', AlertTriangle],
    media: ['amber', CalendarClock],
    baja: ['neutral', Clock],
  },
};

export function StatusBadge({ kind, status, size, className, label }) {
  const map = STATUS_MAP[kind];
  const [tone, icon] = map?.[status] ?? ['neutral', CircleDot];
  return (
    <Badge tone={tone} icon={icon} size={size} className={className}>
      {label ?? map?.labels?.[status] ?? status}
    </Badge>
  );
}
