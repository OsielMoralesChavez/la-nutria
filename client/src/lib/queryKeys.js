/**
 * Claves de caché centralizadas. Al mutar algo, se invalidan por prefijo:
 * p. ej. cerrar una consulta invalida qk.patient(id), dashboard, agenda y alertas.
 */
export const qk = {
  dashboard: (scope) => ['dashboard', scope],
  patients: (params) => ['patients', params],
  patient: (id) => ['patient', id],
  patientSummary: (id) => ['patient', id, 'summary'],
  patientTimeline: (id, types) => ['patient', id, 'timeline', types],
  patientSeries: (id, metrics) => ['patient', id, 'series', metrics],
  patientGoals: (id) => ['patient', id, 'goals'],
  patientClinical: (id) => ['patient', id, 'clinical'],
  patientRevisions: (id) => ['patient', id, 'revisions'],
  patientConsultations: (id) => ['patient', id, 'consultations'],
  patientMeasurements: (id) => ['patient', id, 'measurements'],
  patientAttachments: (id) => ['patient', id, 'attachments'],
  consultation: (id) => ['consultation', id],
  consultationContext: (id) => ['consultation', id, 'context'],
  appointments: (params) => ['appointments', params],
  appointment: (id) => ['appointment', id],
  slots: (params) => ['slots', params],
  followUps: (params) => ['followups', params],
  alerts: (params) => ['alerts', params],
  alertRules: () => ['alert-rules'],
  nutritionists: () => ['nutritionists'],
  users: (params) => ['users', params],
  roles: () => ['roles'],
  permissionCatalog: () => ['permission-catalog'],
  catalogs: (type, includeInactive) => ['catalogs', type, includeInactive],
  metrics: (includeInactive) => ['metrics', includeInactive],
  goalTypes: (includeInactive) => ['goal-types', includeInactive],
  settings: () => ['settings'],
  audit: (params) => ['audit', params],
  sessions: () => ['sessions'],
};

/** Prefijos que cambian cuando cambia algo clínico de un paciente. */
export const patientScopedKeys = (id) => [['patient', id], ['patients'], ['dashboard'], ['appointments'], ['alerts'], ['followups']];
