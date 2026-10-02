import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Save, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Badge, Button, ErrorState, LoadingState, Modal, PageHeader, useToast } from '../../components/ui/index.js';
import { cn } from '../../lib/cn.js';
import { api } from '../../lib/http.js';
import { qk } from '../../lib/queryKeys.js';
import { useAuth } from '../auth/AuthProvider.jsx';

/**
 * Roles y matriz de permisos (Recurso × Acción). Sólo el Superusuario
 * edita; el resto la consulta. Al guardar se muestra el diff y queda en
 * la bitácora. El rol Superusuario no es editable.
 */
export function RolesPage() {
  const { can, user } = useAuth();
  const roles = useQuery({ queryKey: qk.roles(), queryFn: () => api.get('/roles') });
  const catalog = useQuery({ queryKey: qk.permissionCatalog(), queryFn: () => api.get('/permissions'), staleTime: Infinity });
  const [selectedId, setSelectedId] = useState(null);

  if (roles.isPending || catalog.isPending) return <LoadingState rows={5} />;
  if (roles.isError) return <ErrorState error={roles.error} onRetry={() => roles.refetch()} />;
  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />;

  const role = roles.data.find((r) => r.id === selectedId) ?? roles.data.find((r) => r.key !== 'superusuario') ?? roles.data[0];
  const editable = can('roles:manage') && role.key !== 'superusuario' && (user.role.key === 'superusuario' || role.level < user.role.level);

  return (
    <div>
      <PageHeader back={{ to: '/usuarios', label: 'Usuarios' }} title="Roles y permisos" description="Qué puede ver y hacer cada rol. El servidor valida estos permisos en cada acción." />
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Roles" className="card h-fit p-2">
          {roles.data.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              aria-current={r.id === role.id}
              className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm', r.id === role.id ? 'bg-brand-700/10 font-semibold text-brand-800' : 'text-ink-2 hover:bg-slate-900/5')}
            >
              <ShieldCheck aria-hidden className="size-4" />
              <span className="flex-1">{r.name}</span>
              <span className="text-xs text-ink-3 tabular">{r.userCount}</span>
            </button>
          ))}
        </nav>
        <PermissionMatrix key={role.id} role={role} catalog={catalog.data} editable={editable} />
      </div>
    </div>
  );
}

function PermissionMatrix({ role, catalog, editable }) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [perms, setPerms] = useState(() => new Set(role.permissions));
  const [review, setReview] = useState(false);
  const { resources, actions } = catalog;
  const own = useMemo(() => new Set(user.permissions), [user.permissions]);

  const added = [...perms].filter((p) => !role.permissions.includes(p));
  const removed = role.permissions.filter((p) => !perms.has(p));
  const dirty = added.length + removed.length > 0;
  const label = (p) => {
    const [r, a] = p.split(':');
    return `${actions[a]} · ${resources[r]?.label ?? r}`;
  };

  const save = useMutation({
    mutationFn: () => api.put(`/roles/${role.id}/permissions`, { permissions: [...perms] }),
    onSuccess: () => {
      toast.success(`Permisos de ${role.name} actualizados`);
      qc.invalidateQueries({ queryKey: qk.roles() });
      setReview(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (p) =>
    setPerms((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  return (
    <section className="card min-w-0" aria-label={`Permisos de ${role.name}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            {role.name}
            {role.isSystem && <Badge size="sm">Rol del sistema</Badge>}
            <Badge size="sm" tone="neutral">Nivel {role.level}</Badge>
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">{role.description}</p>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!dirty} onClick={() => setPerms(new Set(role.permissions))}>
              Descartar
            </Button>
            <Button icon={Save} disabled={!dirty} onClick={() => setReview(true)}>
              Guardar cambios {dirty ? `(${added.length + removed.length})` : ''}
            </Button>
          </div>
        )}
      </header>
      {!editable && (
        <Alert tone="info" className="mx-5 mt-4">
          <span className="inline-flex items-center gap-1.5">
            <Lock aria-hidden className="size-3.5" />
            {role.key === 'superusuario' ? 'El Superusuario tiene todos los permisos y no se puede modificar.' : 'Sólo lectura: no tienes permiso para editar este rol.'}
          </span>
        </Alert>
      )}
      <div className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-xs text-ink-3">
              <th scope="col" className="px-3 py-2 text-left font-medium">Recurso</th>
              {Object.entries(actions).map(([a, l]) => (
                <th key={a} scope="col" className="px-2 py-2 text-center font-medium">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {Object.entries(resources).map(([r, def]) => (
              <tr key={r} className="hover:bg-slate-900/[0.02]">
                <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
                  {def.label}
                </th>
                {Object.keys(actions).map((a) => {
                  const p = `${r}:${a}`;
                  if (!def.actions.includes(a)) {
                    return (
                      <td key={a} className="px-2 py-2 text-center text-ink-3" aria-label="No aplica">
                        —
                      </td>
                    );
                  }
                  const checked = perms.has(p);
                  const grantable = own.has(p);
                  const note = def.notes?.[a];
                  return (
                    <td key={a} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!editable || (!checked && !grantable)}
                        onChange={() => toggle(p)}
                        aria-label={`${actions[a]} ${def.label}`}
                        title={note ?? (!grantable && !checked ? 'No puedes otorgar un permiso que no tienes' : undefined)}
                        className="size-4 accent-brand-700 disabled:opacity-40"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 px-3 text-xs text-ink-3">Pasa el cursor sobre una casilla para ver detalles. “—” = la acción no existe para ese recurso.</p>
      </div>

      <Modal
        open={review}
        onClose={() => setReview(false)}
        title={`Confirmar cambios en ${role.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(false)}>
              Volver
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Confirmar
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {added.length > 0 && (
            <div>
              <p className="font-semibold text-emerald-800">Se agregará</p>
              <ul className="mt-1 list-inside list-disc text-ink-2">
                {added.map((p) => (
                  <li key={p}>{label(p)}</li>
                ))}
              </ul>
            </div>
          )}
          {removed.length > 0 && (
            <div>
              <p className="font-semibold text-red-800">Se quitará</p>
              <ul className="mt-1 list-inside list-disc text-ink-2">
                {removed.map((p) => (
                  <li key={p}>{label(p)}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-ink-3">Afecta a {role.userCount} usuario(s) de inmediato y queda registrado en la bitácora.</p>
        </div>
      </Modal>
    </section>
  );
}
