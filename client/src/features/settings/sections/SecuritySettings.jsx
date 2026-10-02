import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut } from 'lucide-react';
import { Badge, Button, Card, LoadingState, useToast } from '../../../components/ui/index.js';
import { fmtRelative } from '../../../lib/format.js';
import { api } from '../../../lib/http.js';
import { qk } from '../../../lib/queryKeys.js';
import { ChangePasswordForm } from '../../auth/ChangePasswordForm.jsx';

/** Resume el user-agent en algo legible ("Chrome · Windows"). */
function describeAgent(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}

export function SecuritySettings() {
  const toast = useToast();
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: qk.sessions(), queryFn: () => api.get('/auth/sessions') });
  const revoke = useMutation({
    mutationFn: (id) => api.del(`/auth/sessions/${id}`),
    onSuccess: () => {
      toast.success('Sesión cerrada');
      qc.invalidateQueries({ queryKey: qk.sessions() });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <Card title="Cambiar contraseña" description="Al cambiarla se cierran tus otras sesiones abiertas.">
        <div className="max-w-md">
          <ChangePasswordForm onDone={() => qc.invalidateQueries({ queryKey: qk.sessions() })} />
        </div>
      </Card>
      <Card title="Sesiones activas" description="Dispositivos donde tu cuenta tiene una sesión abierta.">
        {sessions.isPending && <LoadingState rows={2} />}
        <ul className="divide-y divide-line/70">
          {sessions.data?.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <Laptop aria-hidden className="size-5 text-ink-3" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {describeAgent(s.userAgent)} {s.current && <Badge tone="green" size="sm">Esta sesión</Badge>}
                </p>
                <p className="text-xs text-ink-3">
                  Último uso {fmtRelative(s.lastUsedAt)} · iniciada {fmtRelative(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="danger-ghost" icon={LogOut} loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                  Cerrar
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
