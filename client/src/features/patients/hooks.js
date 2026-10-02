import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, http } from '../../lib/http.js';
import { patientScopedKeys, qk } from '../../lib/queryKeys.js';

// ── Lecturas ──
export const usePatients = (params) =>
  useQuery({
    queryKey: qk.patients(params),
    queryFn: async () => {
      const res = await http.get('/patients', params);
      return { items: res.data, meta: res.meta };
    },
    placeholderData: keepPreviousData,
  });

export const usePatientSummary = (id) => useQuery({ queryKey: qk.patientSummary(id), queryFn: () => api.get(`/patients/${id}/summary`) });

export const usePatientGoals = (id) => useQuery({ queryKey: qk.patientGoals(id), queryFn: () => api.get(`/patients/${id}/goals`) });

export const useClinicalRecord = (id) => useQuery({ queryKey: qk.patientClinical(id), queryFn: () => api.get(`/patients/${id}/clinical-record`) });

export const useRevisions = (id, enabled = true) =>
  useQuery({ queryKey: qk.patientRevisions(id), queryFn: () => api.get(`/patients/${id}/clinical-record/revisions`), enabled });

export const useSeries = (id, metrics) =>
  useQuery({
    queryKey: qk.patientSeries(id, metrics?.join(',') ?? 'all'),
    queryFn: () => api.get(`/patients/${id}/measurements/series`, { metrics: metrics?.join(',') }),
  });

export const useConsultations = (id) =>
  useQuery({ queryKey: qk.patientConsultations(id), queryFn: () => api.get(`/patients/${id}/consultations`, { status: 'cerrada', limit: 100 }) });

export const useAttachments = (id, enabled = true) =>
  useQuery({ queryKey: qk.patientAttachments(id), queryFn: () => api.get(`/patients/${id}/attachments`), enabled, retry: false });

// ── Mutaciones ──
function useInvalidatePatient(id) {
  const qc = useQueryClient();
  return () => patientScopedKeys(id).forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/patients', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdatePatient(id) {
  const invalidate = useInvalidatePatient(id);
  return useMutation({ mutationFn: (body) => api.patch(`/patients/${id}`, body), onSuccess: invalidate });
}

export function usePatientAction(id) {
  const invalidate = useInvalidatePatient(id);
  return useMutation({
    mutationFn: ({ action, body }) =>
      ({
        status: () => api.patch(`/patients/${id}/status`, body),
        assign: () => api.patch(`/patients/${id}/assign`, body),
        archive: () => api.post(`/patients/${id}/archive`),
        restore: () => api.post(`/patients/${id}/restore`),
      })[action](),
    onSuccess: invalidate,
  });
}

export function useUpdateClinical(id) {
  const invalidate = useInvalidatePatient(id);
  return useMutation({ mutationFn: (sections) => api.put(`/patients/${id}/clinical-record`, sections), onSuccess: invalidate });
}

export function useGoalMutation(patientId) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({
    mutationFn: ({ goalId, body, checkpoint }) =>
      goalId
        ? checkpoint
          ? api.post(`/goals/${goalId}/checkpoints`, checkpoint)
          : api.patch(`/goals/${goalId}`, body)
        : api.post(`/patients/${patientId}/goals`, body),
    onSuccess: invalidate,
  });
}

export function useCreateFollowUp(patientId) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({ mutationFn: (body) => api.post(`/patients/${patientId}/followups`, body), onSuccess: invalidate });
}

export function useUpdateFollowUp(patientId) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({ mutationFn: ({ id, body }) => api.patch(`/followups/${id}`, body), onSuccess: invalidate });
}

export function useUploadAttachment(patientId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => api.post(`/patients/${patientId}/attachments`, formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', patientId] }),
  });
}

export function useDeleteAttachment(patientId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId) => api.del(`/patients/${patientId}/attachments/${attachmentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', patientId] }),
  });
}

/** URL firmada temporal (5 min) para mostrar una foto/documento. */
export const useAttachmentUrl = (patientId, attachmentId) =>
  useQuery({
    queryKey: ['attachment-url', attachmentId],
    queryFn: () => api.get(`/patients/${patientId}/attachments/${attachmentId}/url`),
    staleTime: 4 * 60_000,
    enabled: Boolean(attachmentId),
  });
