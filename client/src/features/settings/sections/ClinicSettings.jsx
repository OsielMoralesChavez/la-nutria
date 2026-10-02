import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, ErrorState, Field, Input, LoadingState, Switch, useToast } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { api } from '../../../lib/http.js';
import { qk } from '../../../lib/queryKeys.js';
import { useSettings } from '../../catalogs/hooks.js';

const DAYS = [
  [1, 'Lun'],
  [2, 'Mar'],
  [3, 'Mié'],
  [4, 'Jue'],
  [5, 'Vie'],
  [6, 'Sáb'],
  [0, 'Dom'],
];

/** Consultorio (horario, zona horaria) y parámetros operativos de agenda y dashboard. */
export function ClinicSettings() {
  const settings = useSettings();
  if (settings.isPending) return <LoadingState rows={4} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  return <ClinicForm initial={settings.data} />;
}

function ClinicForm({ initial }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => structuredClone(initial));

  const save = useMutation({
    mutationFn: () => api.patch('/settings', form),
    onSuccess: (data) => {
      qc.setQueryData(qk.settings(), data);
      qc.invalidateQueries({ queryKey: ['slots'] });
      toast.success('Configuración guardada');
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (section, patch) => setForm((f) => ({ ...f, [section]: { ...f[section], ...patch } }));
  const num = (v) => (v === '' ? '' : Number(v));

  return (
    <div className="space-y-5">
      <Card title="Consultorio">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">{(p) => <Input {...p} value={form.clinic.name} onChange={(e) => set('clinic', { name: e.target.value })} />}</Field>
          <Field label="Zona horaria" hint="Se usa para “hoy”, vencimientos y agenda.">
            {(p) => <Input {...p} value={form.clinic.timezone} onChange={(e) => set('clinic', { timezone: e.target.value })} />}
          </Field>
          <Field label="Abre">
            {(p) => <Input {...p} type="time" value={form.clinic.openingHours.start} onChange={(e) => set('clinic', { openingHours: { ...form.clinic.openingHours, start: e.target.value } })} />}
          </Field>
          <Field label="Cierra">
            {(p) => <Input {...p} type="time" value={form.clinic.openingHours.end} onChange={(e) => set('clinic', { openingHours: { ...form.clinic.openingHours, end: e.target.value } })} />}
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-ink-2">Días de atención</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(([d, label]) => {
                const on = form.clinic.openingHours.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set('clinic', {
                        openingHours: { ...form.clinic.openingHours, days: on ? form.clinic.openingHours.days.filter((x) => x !== d) : [...form.clinic.openingHours.days, d] },
                      })
                    }
                    className={cn('w-12 rounded-lg border py-1.5 text-sm font-medium', on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-3')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card title="Agenda" description="Las duraciones por tipo de cita se ajustan en Catálogos → Tipos de cita.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duración por defecto (min)">
            {(p) => <Input {...p} type="number" min={5} max={480} value={form.agenda.defaultDurationMin} onChange={(e) => set('agenda', { defaultDurationMin: num(e.target.value) })} />}
          </Field>
          <Field label="Intervalo entre horarios (min)">
            {(p) => <Input {...p} type="number" min={5} max={120} value={form.agenda.slotMinutes} onChange={(e) => set('agenda', { slotMinutes: num(e.target.value) })} />}
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium text-ink">Permitir citas traslapadas</p>
              <p className="text-xs text-ink-3">Si se activa, al detectar un traslape se puede agendar de todos modos.</p>
            </div>
            <Switch label="Permitir citas traslapadas" checked={form.agenda.allowOverlap} onChange={(v) => set('agenda', { allowOverlap: v })} />
          </div>
        </div>
      </Card>

      <Card title="Dashboard">
        <Field label="Periodo para “pacientes nuevos” (días)" className="max-w-xs">
          {(p) => <Input {...p} type="number" min={1} max={365} value={form.dashboard.newPatientsDays} onChange={(e) => set('dashboard', { newPatientsDays: num(e.target.value) })} />}
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
