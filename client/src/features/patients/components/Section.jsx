import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../../../lib/cn.js';

/**
 * Sección de la ficha identificada por su pregunta (①②③④). El número y la
 * pregunta se repiten en el Hilo y en cada bloque para orientar siempre.
 */
export function QuestionSection({ n, question, subtitle, to, linkLabel = 'Ver detalle', children, className, emphasis }) {
  return (
    <section className={cn('card', emphasis && 'ring-1 ring-brand-200', className)} aria-label={question}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className={cn('grid size-6 place-items-center rounded-full text-xs', emphasis ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-800')}>{n}</span>
            {question}
          </h2>
          {subtitle && <p className="mt-0.5 pl-8 text-xs text-ink-3">{subtitle}</p>}
        </div>
        {to && (
          <Link to={to} className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand-700 hover:underline">
            {linkLabel} <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        )}
      </header>
      <div className="p-4 pt-3 sm:p-5 sm:pt-3">{children}</div>
    </section>
  );
}
