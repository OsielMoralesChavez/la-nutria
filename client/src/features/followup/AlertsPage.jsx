import { ALERT_SEVERITY } from '@lanutria/shared';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, PageHeader, SegmentedControl, Select } from '../../components/ui/index.js';
import { api } from '../../lib/http.js';
import { qk } from '../../lib/queryKeys.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { AlertList } from './AlertList.jsx';

/** Centro de alertas: todas las alertas operativas con filtros. */
export function AlertsPage() {
  const { can } = useAuth();
  const rules = useQuery({ queryKey: qk.alertRules(), queryFn: () => api.get('/alert-rules'), staleTime: 5 * 60_000 });
  const [status, setStatus] = useState('activas');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [mine, setMine] = useState('');

  return (
    <div>
      <PageHeader
        back={{ to: '/seguimiento', label: 'Seguimiento' }}
        title="Alertas"
        description="Generadas por reglas operativas configurables. Muchas se resuelven solas cuando desaparece la causa."
        actions={
          can('alerts:manage') && (
            <Button variant="secondary" icon={Settings2} to="/configuracion/alertas">
              Configurar reglas
            </Button>
          )
        }
      />
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SegmentedControl
            size="sm"
            label="Estado"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'activas', label: 'Activas' },
              { value: 'atendida', label: 'Atendidas' },
              { value: 'descartada', label: 'Descartadas' },
            ]}
          />
          <Select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-auto">
            <option value="">Todos los tipos</option>
            {rules.data?.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Severidad" value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-9 w-auto">
            <option value="">Toda severidad</option>
            {ALERT_SEVERITY.values.map((s) => (
              <option key={s} value={s}>
                {ALERT_SEVERITY.labels[s]}
              </option>
            ))}
          </Select>
          <Select aria-label="Asignación" value={mine} onChange={(e) => setMine(e.target.value)} className="h-9 w-auto">
            <option value="">Todas</option>
            <option value="me">Asignadas a mí</option>
          </Select>
        </div>
        <AlertList params={{ status, type: type || undefined, severity: severity || undefined, assignedTo: mine || undefined }} />
      </Card>
    </div>
  );
}
