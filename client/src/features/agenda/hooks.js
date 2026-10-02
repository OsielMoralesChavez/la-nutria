import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/http.js';
import { qk } from '../../lib/queryKeys.js';

export const useAppointments = (params) =>
  useQuery({ queryKey: qk.appointments(params), queryFn: () => api.get('/appointments', params), placeholderData: (prev) => prev });

export const useAppointment = (id) => useQuery({ queryKey: qk.appointment(id), queryFn: () => api.get(`/appointments/${id}`), enabled: Boolean(id) });

export const useSlots = (params, enabled = true) =>
  useQuery({ queryKey: qk.slots(params), queryFn: () => api.get('/appointments/slots', params), enabled: enabled && Boolean(params.date) });

/** Mutaciones de agenda: todas invalidan agenda, dashboard y la ficha del paciente. */
export function useAppointmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id, body }) =>
      ({
        create: () => api.post('/appointments', body),
        status: () => api.post(`/appointments/${id}/status`, body),
        reschedule: () => api.post(`/appointments/${id}/reschedule`, body),
        update: () => api.patch(`/appointments/${id}`, body),
      })[action](),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['appointment'] });
      qc.invalidateQueries({ queryKey: ['slots'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      const pid = data?.patient?.id ?? data?.patient;
      if (pid) qc.invalidateQueries({ queryKey: ['patient', pid] });
    },
  });
}
