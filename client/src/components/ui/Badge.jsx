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
  neutral: 'bg-white/10 text-ink-2 ring-white/20',
  brand: 'bg-brand-50 text-accent ring-brand-200',
  green: 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30',
  amber: 'bg-amber-400/15 text-amber-200 ring-amber-300/30',
  red: 'bg-red-400/15 text-red-200 ring-red-300/30',
  sky: 'bg-sky-400/15 text-sky-200 ring-sky-300/30',
  violet: 'bg-violet-400/15 text-violet-200 ring-violet-300/30',
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
