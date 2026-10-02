import { Camera, Columns2, FileText, ImageOff, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Button, EmptyState, ErrorState, Field, IconButton, LoadingState, Modal, Select, Skeleton, useConfirm, useToast } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { fmtDate, toInputDate } from '../../../lib/format.js';
import { api } from '../../../lib/http.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useCatalog, useLabels } from '../../catalogs/hooks.js';
import { useAttachments, useAttachmentUrl, useDeleteAttachment, useUploadAttachment } from '../hooks.js';

/**
 * Fotos y documentos (módulo modular). Los archivos se sirven con URL
 * firmada de 5 minutos; nunca hay enlaces públicos permanentes.
 */
export function Attachments({ patientId, kind, consultationId, readOnly }) {
  const { can, user } = useAuth();
  const query = useAttachments(patientId);
  const labels = useLabels('attachment_category');
  const del = useDeleteAttachment(patientId);
  const confirm = useConfirm();
  const toast = useToast();
  const [upload, setUpload] = useState(false);
  const [compare, setCompare] = useState([]);
  const [viewer, setViewer] = useState(null);

  if (query.isPending) return <LoadingState rows={2} />;
  if (query.isError) {
    if (query.error.status === 404) return <Alert tone="info">El módulo de fotos y documentos está desactivado en este servidor.</Alert>;
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const items = query.data.filter((a) => (!kind || a.kind === kind) && (!consultationId || a.consultation === consultationId));
  const photos = kind === 'foto';

  const remove = async (a) => {
    if (!(await confirm({ title: '¿Eliminar este archivo?', description: 'Dejará de mostrarse en el expediente. La acción queda registrada.', confirmLabel: 'Eliminar', danger: true }))) return;
    del.mutate(a.id, { onSuccess: () => toast.success('Archivo eliminado'), onError: (e) => toast.error(e.message) });
  };
  const toggleCompare = (id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-3">{items.length ? `${items.length} archivo${items.length > 1 ? 's' : ''}` : ''}</p>
        <div className="flex gap-2">
          {photos && items.length >= 2 && (
            <Button size="sm" variant="ghost" icon={Columns2} disabled={compare.length !== 2} onClick={() => setViewer({ compare })}>
              Comparar ({compare.length}/2)
            </Button>
          )}
          {can('attachments:create') && !readOnly && (
            <Button size="sm" variant="secondary" icon={photos ? Camera : Upload} onClick={() => setUpload(true)}>
              {photos ? 'Agregar foto' : 'Subir documento'}
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState compact icon={photos ? Camera : FileText} title={photos ? 'Sin fotografías de progreso' : 'Sin documentos'} description={photos ? 'Agrega fotos para comparar la evolución visualmente.' : 'Sube estudios de laboratorio, planes u otros archivos.'} />
      ) : photos ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => (
            <li key={a.id} className={cn('group relative overflow-hidden rounded-xl border bg-white', compare.includes(a.id) ? 'border-brand-600 ring-2 ring-brand-600/30' : 'border-line')}>
              <button type="button" className="block w-full" onClick={() => setViewer({ single: a })} aria-label={`Ver foto del ${fmtDate(a.takenAt)}`}>
                <Thumb patientId={patientId} attachment={a} />
              </button>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="min-w-0 truncate text-xs text-ink-2">
                  {fmtDate(a.takenAt)}
                  {a.category && <span className="text-ink-3"> · {labels[a.category]}</span>}
                </span>
                <label className="flex items-center gap-1 text-[11px] text-ink-3">
                  <input type="checkbox" checked={compare.includes(a.id)} onChange={() => toggleCompare(a.id)} className="accent-brand-700" />
                  <span className="sr-only">Seleccionar para comparar</span>
                </label>
              </div>
              {(a.uploadedBy?.id === user?.id || can('attachments:manage')) && can('attachments:delete') && !readOnly && (
                <IconButton icon={Trash2} label="Eliminar foto" size="sm" variant="secondary" onClick={() => remove(a)} className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2">
              <FileText aria-hidden className="size-5 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <OpenFile patientId={patientId} attachment={a} />
                <p className="text-xs text-ink-3">
                  {fmtDate(a.takenAt)} · {labels[a.category] ?? 'Sin categoría'} · {(a.size / 1024).toFixed(0)} KB
                </p>
              </div>
              {(a.uploadedBy?.id === user?.id || can('attachments:manage')) && can('attachments:delete') && !readOnly && (
                <IconButton icon={Trash2} label={`Eliminar ${a.originalName}`} size="sm" onClick={() => remove(a)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {upload && <UploadModal patientId={patientId} kind={kind} consultationId={consultationId} onClose={() => setUpload(false)} />}
      {viewer && (
        <Modal open onClose={() => setViewer(null)} title={viewer.compare ? 'Comparar fotografías' : 'Fotografía'} size="xl">
          <div className={cn('grid gap-3', viewer.compare && 'sm:grid-cols-2')}>
            {(viewer.compare ? items.filter((i) => viewer.compare.includes(i.id)).sort((x, y) => new Date(x.takenAt) - new Date(y.takenAt)) : [viewer.single]).map((a) => (
              <figure key={a.id}>
                <Thumb patientId={patientId} attachment={a} large />
                <figcaption className="mt-1 text-center text-sm text-ink-2">
                  {fmtDate(a.takenAt)} {a.category && `· ${labels[a.category]}`}
                </figcaption>
              </figure>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Thumb({ patientId, attachment, large }) {
  const url = useAttachmentUrl(patientId, attachment.id);
  const [failed, setFailed] = useState(false);
  if (url.isPending) return <Skeleton className={cn('w-full rounded-none', large ? 'h-[60vh]' : 'aspect-[3/4]')} />;
  if (url.isError || failed)
    return (
      <div className={cn('grid w-full place-items-center bg-slate-100 text-ink-3', large ? 'h-64' : 'aspect-[3/4]')}>
        <ImageOff aria-hidden className="size-6" />
      </div>
    );
  return (
    <img
      src={url.data.url}
      alt={`Fotografía del ${fmtDate(attachment.takenAt)}`}
      onError={() => setFailed(true)}
      className={cn('w-full bg-slate-100 object-cover', large ? 'max-h-[70vh] object-contain' : 'aspect-[3/4]')}
      loading="lazy"
    />
  );
}

/**
 * Abre el documento en otra pestaña con una URL firmada. La pestaña se abre
 * de forma síncrona (antes del await) para que el navegador no la bloquee.
 */
function OpenFile({ patientId, attachment }) {
  const toast = useToast();
  const open = async () => {
    const win = window.open('', '_blank');
    try {
      const { url } = await api.get(`/patients/${patientId}/attachments/${attachment.id}/url`);
      if (win) {
        win.opener = null;
        win.location.href = url;
      }
    } catch (e) {
      win?.close();
      toast.error(e.message);
    }
  };
  return (
    <button type="button" onClick={open} className="truncate text-left text-sm font-medium text-brand-700 hover:underline">
      {attachment.originalName ?? 'Documento'}
    </button>
  );
}

function UploadModal({ patientId, kind, consultationId, onClose }) {
  const upload = useUploadAttachment(patientId);
  const categories = useCatalog('attachment_category');
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('');
  const [takenAt, setTakenAt] = useState(toInputDate(new Date()));
  const [error, setError] = useState(null);
  const photos = kind === 'foto';
  const options = (categories.data ?? []).filter((c) => (photos ? c.key.startsWith('foto') : !c.key.startsWith('foto')));

  const submit = () => {
    if (!file) return setError('Selecciona un archivo');
    const fd = new FormData();
    fd.append('file', file);
    if (category) fd.append('category', category);
    if (consultationId) fd.append('consultation', consultationId);
    fd.append('takenAt', new Date(`${takenAt}T12:00:00`).toISOString());
    upload.mutate(fd, {
      onSuccess: () => {
        toast.success(photos ? 'Foto agregada' : 'Documento subido');
        onClose();
      },
      onError: (e) => setError(e.message),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={photos ? 'Agregar fotografía de progreso' : 'Subir documento'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={Upload} loading={upload.isPending} onClick={submit}>
            Subir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Archivo" hint={photos ? 'JPG, PNG o WEBP · máx. 10 MB' : 'PDF, JPG o PNG · máx. 10 MB'}>
          {(p) => (
            <input
              {...p}
              ref={fileRef}
              type="file"
              accept={photos ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png'}
              capture={photos ? 'environment' : undefined}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
              className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-100"
            />
          )}
        </Field>
        <Field label="Categoría">
          {(p) => (
            <Select {...p} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Sin categoría</option>
              {options.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fecha">{(p) => <input {...p} type="date" value={takenAt} max={toInputDate(new Date())} onChange={(e) => setTakenAt(e.target.value)} className="h-10 w-full rounded-xl border border-line px-3 text-sm" />}</Field>
      </div>
    </Modal>
  );
}
