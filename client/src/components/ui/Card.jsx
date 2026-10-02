import { cn } from '../../lib/cn.js';

/**
 * Superficie de contenido. `glass` sólo para destacados/paneles (uso moderado).
 */
export function Card({ as: Tag = 'section', title, description, actions, icon: Icon, glass, className, bodyClassName, children, ...props }) {
  return (
    <Tag
      className={cn(
        glass ? 'glass rounded-[var(--radius-card)] border shadow-[var(--shadow-card)]' : 'card',
        'flex flex-col min-w-0',
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                {Icon && <Icon aria-hidden className="size-4 text-ink-3" />}
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', (title || actions) && 'pt-3 sm:pt-3', bodyClassName)}>{children}</div>
    </Tag>
  );
}
