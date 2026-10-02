import { AlertTriangle, CheckCircle2, Copy, Info, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.jsx';

const ALERT_TONES = {
  info: ['bg-sky-50 border-sky-200 text-sky-900', Info, 'text-sky-600'],
  success: ['bg-emerald-50 border-emerald-200 text-emerald-900', CheckCircle2, 'text-emerald-600'],
  warning: ['bg-amber-50 border-amber-200 text-amber-900', AlertTriangle, 'text-amber-600'],
  error: ['bg-red-50 border-red-200 text-red-900', XCircle, 'text-red-600'],
};

/** Mensaje en línea (no confundir con las alertas clínico-operativas del sistema). */
export function Alert({ tone = 'info', title, children, action, className }) {
  const [classes, Icon, iconColor] = ALERT_TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', classes, className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', iconColor)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** Estado vacío: explica en una línea y ofrece la acción que lo resuelve. */
export function EmptyState({ icon: Icon, title, description, action, className, compact }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-12', className)}>
      {Icon && (
        <div className={cn('grid place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100', compact ? 'size-10' : 'size-14')}>
          <Icon aria-hidden className={compact ? 'size-5' : 'size-7'} />
        </div>
      )}
      <div className="max-w-sm">
        <p className={cn('font-semibold text-ink', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />;
}

/** Skeleton con forma de lista/tabla (mientras carga). */
export function LoadingState({ rows = 4, className, label = 'Cargando…' }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Error de carga con reintento y requestId copiable (para soporte). */
export function ErrorState({ error, onRetry, className, title = 'No se pudo cargar la información' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(error.requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* el portapapeles puede no estar disponible */
    }
  };
  return (
    <Alert
      tone="error"
      title={title}
      className={className}
      action={
        onRetry && (
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Reintentar
          </Button>
        )
      }
    >
      <p>{error?.message ?? 'Ocurrió un error inesperado.'}</p>
      {error?.requestId && (
        <button type="button" onClick={copy} className="mt-1 inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">
          <Copy aria-hidden className="size-3" />
          {copied ? 'Copiado' : `Código: ${error.requestId.slice(0, 8)}`}
        </button>
      )}
    </Alert>
  );
}

/** Wrapper estándar para queries: loading → error → empty → contenido. */
export function QueryState({ query, loading, empty, isEmpty, children }) {
  if (query.isPending) return loading ?? <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (isEmpty?.(query.data)) return empty ?? null;
  return children(query.data);
}
