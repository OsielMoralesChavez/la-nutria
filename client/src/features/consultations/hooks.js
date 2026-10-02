import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useToast } from '../../components/ui/index.js';
import { api, http } from '../../lib/http.js';
import { patientScopedKeys, qk } from '../../lib/queryKeys.js';

export const consultationPath = (patientId, consultationId) => `/pacientes/${patientId}/consulta/${consultationId}`;

/**
 * Inicia (o reanuda) una consulta y abre el modo consulta.
 * Acepta `{ patientId }` o `{ appointmentId }` (desde la agenda).
 */
export function useStartConsultation() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, appointmentId }) => {
      const res = appointmentId
        ? await http.post(`/appointments/${appointmentId}/start-consultation`)
        : await http.post(`/patients/${patientId}/consultations`, {});
      return { consultation: res.data, resumed: res.meta?.resumed };
    },
    onSuccess: ({ consultation, resumed }) => {
      if (resumed) toast.info('Continuando la consulta en borrador.');
      qc.invalidateQueries({ queryKey: ['appointments'] });
      navigate(consultationPath(consultation.patient, consultation.id));
    },
    onError: (err) => toast.error(err.message),
  });
}

export const useConsultationContext = (id) =>
  useQuery({ queryKey: qk.consultationContext(id), queryFn: () => api.get(`/consultations/${id}/context`), staleTime: Infinity, enabled: Boolean(id) });

export const useConsultation = (id) => useQuery({ queryKey: qk.consultation(id), queryFn: () => api.get(`/consultations/${id}`), enabled: Boolean(id) });

export const saveDraft = (id, body) => api.patch(`/consultations/${id}`, body);

export function useCloseConsultation(patientId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/consultations/${id}/close`),
    onSuccess: () => patientScopedKeys(patientId).forEach((queryKey) => qc.invalidateQueries({ queryKey })),
  });
}

export function useDiscardConsultation(patientId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.del(`/consultations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useAddAddendum(consultationId, patientId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text) => api.post(`/consultations/${consultationId}/addenda`, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.consultation(consultationId) });
      qc.invalidateQueries({ queryKey: ['patient', patientId] });
    },
  });
}
