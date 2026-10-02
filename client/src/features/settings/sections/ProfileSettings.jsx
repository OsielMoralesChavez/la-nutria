import { NOTE_FORMAT } from '@lanutria/shared';
import { useState } from 'react';
import { Badge, Button, Card, DataList, Field, Select, useToast } from '../../../components/ui/index.js';
import { api } from '../../../lib/http.js';
import { useAuth } from '../../auth/AuthProvider.jsx';

export function ProfileSettings() {
  const { user, reloadUser } = useAuth();
  const toast = useToast();
  const [prefs, setPrefs] = useState(user.preferences ?? {});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(user.preferences ?? {});

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/auth/preferences', prefs);
      await reloadUser();
      toast.success('Preferencias guardadas');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card title="Mi perfil">
        <DataList
          items={[
            { label: 'Nombre', value: user.name },
            { label: 'Correo', value: user.email },
            { label: 'Rol', value: <Badge tone="brand">{user.role.name}</Badge> },
          ]}
        />
        <p className="mt-3 text-xs text-ink-3">Para cambiar tu nombre o correo, pide ayuda a un administrador.</p>
      </Card>
      <Card title="Preferencias de trabajo" description="Se aplican sólo a tu usuario.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formato de nota por defecto" hint="Siempre puedes cambiarlo dentro de cada consulta.">
            {(p) => (
              <Select {...p} value={prefs.noteFormat ?? 'libre'} onChange={(e) => setPrefs({ ...prefs, noteFormat: e.target.value })}>
                {NOTE_FORMAT.values.map((v) => (
                  <option key={v} value={v}>
                    {NOTE_FORMAT.labels[v]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Vista de agenda (escritorio)">
            {(p) => (
              <Select {...p} value={prefs.defaultAgendaView ?? 'semana'} onChange={(e) => setPrefs({ ...prefs, defaultAgendaView: e.target.value })}>
                <option value="dia">Día</option>
                <option value="semana">Semana</option>
                <option value="lista">Lista</option>
              </Select>
            )}
          </Field>
          <Field label="Alcance del dashboard">
            {(p) => (
              <Select {...p} value={prefs.dashboardScope ?? 'mine'} onChange={(e) => setPrefs({ ...prefs, dashboardScope: e.target.value })}>
                <option value="mine">Mis pacientes</option>
                <option value="all">Todo el consultorio</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={!dirty} loading={saving} onClick={save}>
            Guardar preferencias
          </Button>
        </div>
      </Card>
    </div>
  );
}
