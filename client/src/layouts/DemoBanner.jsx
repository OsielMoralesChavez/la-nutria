import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { fmtDateFull } from '../lib/format.js';
import { snapshotInfo } from '../lib/staticDemo.js';

/** Aviso permanente en la demo estática de GitHub Pages. */
export function DemoBanner() {
  const info = useQuery({ queryKey: ['demo-info'], queryFn: snapshotInfo, staleTime: Infinity });
  return (
    <div role="note" className="border-b border-amber-300/30 bg-amber-400/15 px-4 py-1.5 text-center text-xs text-amber-200">
      <Eye aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
      <strong>Demo de sólo lectura</strong> con datos ficticios
      {info.data?.generatedAt && <> · instantánea del {fmtDateFull(info.data.generatedAt)}</>}
      {info.data?.repoUrl && (
        <>
          {' · '}
          <a href={info.data.repoUrl} className="font-semibold underline" target="_blank" rel="noreferrer">
            código en GitHub
          </a>
        </>
      )}
    </div>
  );
}
