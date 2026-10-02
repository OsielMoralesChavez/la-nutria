import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, MoreHorizontal, Pencil, Search, ShieldCheck, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { Alert, Avatar, Badge, Button, EmptyState, ErrorState, Field, IconButton, Input, LoadingState, MenuItem, Modal, PageHeader, Popover, Select, useConfirm, useToast } from '../../components/ui/index.js';
import { fmtRelative } from '../../lib/format.js';
import { api, http } from '../../lib/http.js';
import { qk } from '../../lib/queryKeys.js';
import { useAuth } from '../auth/AuthProvider.jsx';

/** Usuarios del sistema. Sólo se ofrecen roles de nivel inferior al propio. */
export function UsersPage() {
  const { user: me, can } = useAuth();
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [secret, setSecret] = useState(null);
  const params = { q: q || undefined, limit: 100 };
  const users = useQuery({ queryKey: qk.users(params), queryFn: async () => (await http.get('/users', params)).data });
  const roles = useQuery({ queryKey: qk.roles(), queryFn: () => api.get('/roles'), enabled: can('roles:read') });
  const assignable = (roles.data ?? []).filter((r) => me.role.key === 'superusuario' || r.level < me.role.level);

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Personas con acceso al sistema y su rol."
        actions={
          <>
            {can('roles:read') && (
              <Button variant="secondary" icon={ShieldCheck} to="/usuarios/roles">
                Roles y permisos
              </Button>
            )}
            {can('users:create') && (
              <Button icon={UserPlus} onClick={() => setModal({ kind: 'create' })}>
                Nuevo usuario
              </Button>
            )}
          </>
        }
      />
      <div className="relative mb-4 max-w-md">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo…" aria-label="Buscar usuarios" className="pl-9" />
      </div>

      {users.isPending && <div className="card p-5"><LoadingState rows={4} /></div>}
      {users.isError && <ErrorState error={users.error} onRetry={() => users.refetch()} />}
      {users.data?.length === 0 && <div className="card"><EmptyState title="Sin resultados" /></div>}
      {users.data?.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line bg-slate-50/70 text-left text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Usuario</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Rol</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Último acceso</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Pacientes</th>
                <th scope="col" className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {users.data.map((u) => {
                const manageable = can('users:update') && u.id !== me.id && (me.role.key === 'superusuario' || u.role?.level < me.role.level);
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <span>
                          <span className="block font-medium text-ink">
                            {u.name} {u.id === me.id && <span className="text-xs font-normal text-ink-3">(tú)</span>}
                          </span>
                          <span className="block text-xs text-ink-3">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={u.role?.key === 'superusuario' ? 'violet' : u.role?.key === 'administrador' ? 'brand' : 'neutral'}>{u.role?.name}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {u.status === 'activo' ? <Badge tone="green" icon={UserCheck}>Activo</Badge> : <Badge icon={UserX}>Inactivo</Badge>}
                      {u.mustChangePassword && <span className="ml-1 text-xs text-amber-700">· contraseña temporal</span>}
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{u.lastLoginAt ? fmtRelative(u.lastLoginAt) : 'Nunca'}</td>
                    <td className="px-3 py-2.5 text-right text-ink-2 tabular">{u.patientCount}</td>
                    <td className="px-3 py-2.5 text-right">
                      {manageable && (
                        <Popover width="w-56" trigger={(p) => <IconButton {...p} icon={MoreHorizontal} label={`Acciones para ${u.name}`} size="sm" />}>
                          {({ close }) => (
                            <>
                              <MenuItem icon={Pencil} close={close} onClick={() => setModal({ kind: 'edit', user: u })}>
                                Editar / cambiar rol
                              </MenuItem>
                              <MenuItem icon={KeyRound} close={close} onClick={() => setModal({ kind: 'reset', user: u })}>
                                Restablecer contraseña
                              </MenuItem>
                              <MenuItem icon={u.status === 'activo' ? UserX : UserCheck} close={close} onClick={() => setModal({ kind: 'status', user: u })} danger={u.status === 'activo'}>
                                {u.status === 'activo' ? 'Desactivar' : 'Reactivar'}
                              </MenuItem>
                            </>
                          )}
                        </Popover>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(modal?.kind === 'create' || modal?.kind === 'edit') && (
        <UserFormModal user={modal.user} roles={assignable} onClose={() => setModal(null)} onSecret={setSecret} />
      )}
      {modal?.kind === 'reset' && <ResetModal user={modal.user} onClose={() => setModal(null)} onSecret={setSecret} />}
      {modal?.kind === 'status' && <StatusModal user={modal.user} users={users.data} onClose={() => setModal(null)} />}
      {secret && <SecretModal secret={secret} onClose={() => setSecret(null)} />}
    </div>
  );
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: qk.nutritionists() });
    qc.invalidateQueries({ queryKey: qk.roles() });
  };
}

function UserFormModal({ user, roles, onClose, onSecret }) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState(user?.role?.id ?? roles.at(-1)?.id ?? '');
  const [errors, setErrors] = useState({});
  const invalidate = useInvalidateUsers();
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => (user ? api.patch(`/users/${user.id}`, { name, email, role }) : api.post('/users', { name, email, role })),
    onSuccess: (res) => {
      invalidate();
      if (!user) onSecret({ name, email, password: res.temporaryPassword });
      else toast.success('Usuario actualizado');
      onClose();
    },
    onError: (e) => setErrors(Object.keys(e.fieldErrors).length ? e.fieldErrors : { root: e.message }),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={user ? `Editar a ${user.name}` : 'Nuevo usuario'}
      description={user ? undefined : 'Se generará una contraseña temporal que deberá cambiar al entrar.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {user ? 'Guardar' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.root && <Alert tone="error">{errors.root}</Alert>}
        <Field label="Nombre completo" required error={errors.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} data-autofocus />}
        </Field>
        <Field label="Correo" required error={errors.email}>
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Rol" required error={errors.role} hint="Sólo puedes asignar roles de nivel inferior al tuyo.">
          {(p) => (
            <Select {...p} value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}

function ResetModal({ user, onClose, onSecret }) {
  const reset = useMutation({ mutationFn: () => api.post(`/users/${user.id}/reset-password`) });
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      title="Restablecer contraseña"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={reset.isPending}
            onClick={() =>
              reset.mutate(undefined, {
                onSuccess: (r) => {
                  onSecret({ name: user.name, email: user.email, password: r.temporaryPassword });
                  onClose();
                },
                onError: (e) => toast.error(e.message),
              })
            }
          >
            Generar contraseña temporal
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">Se cerrarán las sesiones abiertas de {user.name} y deberá crear una nueva contraseña al entrar.</p>
    </Modal>
  );
}

function StatusModal({ user, users, onClose }) {
  const deactivate = user.status === 'activo';
  const [reassignTo, setReassignTo] = useState('');
  const invalidate = useInvalidateUsers();
  const toast = useToast();
  const confirm = useConfirm();
  const mutate = useMutation({
    mutationFn: () => api.patch(`/users/${user.id}/status`, { status: deactivate ? 'inactivo' : 'activo', ...(reassignTo && { reassignTo }) }),
    onSuccess: () => {
      invalidate();
      toast.success(deactivate ? 'Usuario desactivado' : 'Usuario reactivado');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const needsReassign = deactivate && user.patientCount > 0;
  const others = users.filter((u) => u.id !== user.id && u.status === 'activo');
  return (
    <Modal
      open
      onClose={onClose}
      title={deactivate ? `Desactivar a ${user.name}` : `Reactivar a ${user.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={deactivate ? 'danger' : 'primary'}
            loading={mutate.isPending}
            disabled={needsReassign && !reassignTo}
            onClick={async () => {
              if (deactivate && !(await confirm({ title: '¿Confirmas la desactivación?', description: 'No podrá entrar al sistema. Su historial se conserva.', confirmLabel: 'Desactivar', danger: true }))) return;
              mutate.mutate();
            }}
          >
            {deactivate ? 'Desactivar' : 'Reactivar'}
          </Button>
        </>
      }
    >
      {deactivate ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Su historial (consultas atendidas) se conserva.</p>
          {needsReassign && (
            <Field label={`Reasignar sus ${user.patientCount} paciente(s) a`} required>
              {(p) => (
                <Select {...p} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-2">Podrá volver a iniciar sesión con su contraseña actual.</p>
      )}
    </Modal>
  );
}

/** Muestra la contraseña temporal UNA vez para entregarla al usuario. */
function SecretModal({ secret, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open onClose={onClose} title="Contraseña temporal" size="sm" footer={<Button onClick={onClose}>Listo</Button>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-2">
          Entrega esta contraseña a <strong>{secret.name}</strong> ({secret.email}) por un medio seguro. No se volverá a mostrar y deberá cambiarla al entrar.
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3 py-2">
          <code className="flex-1 select-all font-mono text-base tracking-wider text-ink">{secret.password}</code>
          <IconButton
            icon={Copy}
            label={copied ? 'Copiada' : 'Copiar'}
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(secret.password);
                setCopied(true);
              } catch {
                /* sin portapapeles: el texto es seleccionable */
              }
            }}
          />
        </div>
        {copied && <p className="text-xs text-emerald-700">Copiada al portapapeles.</p>}
      </div>
    </Modal>
  );
}
