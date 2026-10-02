/**
 * Enumeraciones de dominio. Valores en español porque se guardan en la BD y
 * aparecen en la bitácora; las etiquetas son para mostrar.
 */

const toEnum = (labels) => Object.freeze({ values: Object.freeze(Object.keys(labels)), labels: Object.freeze(labels) });

export const SEX = toEnum({ femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro' });

export const PATIENT_STATUS = toEnum({
  activo: 'Activo',
  en_pausa: 'En pausa',
  alta: 'Alta (meta cumplida)',
  abandono: 'Abandono',
});

export const CONSULTATION_TYPE = toEnum({ inicial: 'Consulta inicial', seguimiento: 'Seguimiento' });

export const CONSULTATION_STATUS = toEnum({ borrador: 'Borrador', cerrada: 'Cerrada' });

export const NOTE_FORMAT = toEnum({ libre: 'Texto libre', soap: 'SOAP', ambos: 'Libre + SOAP' });

export const GOAL_STATUS = toEnum({
  en_curso: 'En curso',
  logrado: 'Logrado',
  no_logrado: 'No logrado',
  cancelado: 'Cancelado',
});

export const GOAL_KIND = toEnum({ metrica: 'Basado en métrica', cualitativo: 'Cualitativo' });

export const GOAL_DIRECTION = toEnum({ bajar: 'Disminuir', subir: 'Aumentar', mantener: 'Mantener' });

export const FOLLOWUP_STATUS = toEnum({ pendiente: 'Pendiente', realizado: 'Realizado', cancelado: 'Cancelado' });

export const APPOINTMENT_STATUS = toEnum({
  programada: 'Programada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
});

/** Transiciones válidas de una cita. Reprogramar crea una cita nueva y cancela la anterior. */
export const APPOINTMENT_TRANSITIONS = Object.freeze({
  programada: ['confirmada', 'cancelada', 'realizada', 'no_asistio'],
  confirmada: ['programada', 'cancelada', 'realizada', 'no_asistio'],
  realizada: [],
  cancelada: [],
  no_asistio: [],
});

export const canTransitionAppointment = (from, to) => APPOINTMENT_TRANSITIONS[from]?.includes(to) ?? false;

export const ALERT_STATUS = toEnum({ abierta: 'Abierta', pospuesta: 'Pospuesta', atendida: 'Atendida', descartada: 'Descartada' });

export const ALERT_SEVERITY = toEnum({ alta: 'Alta', media: 'Media', baja: 'Baja' });

export const ATTACHMENT_KIND = toEnum({ foto: 'Fotografía', documento: 'Documento' });

/** Tipos de la colección genérica `catalogs`. */
export const CATALOG_TYPES = toEnum({
  measurement_method: 'Métodos de medición',
  appointment_type: 'Tipos de cita',
  attachment_category: 'Categorías de archivo',
  patient_tag: 'Etiquetas de paciente',
  cancel_reason: 'Motivos de cancelación',
});

export const METRIC_CATEGORY = toEnum({ antropometria: 'Antropometría', composicion: 'Composición corporal', otra: 'Otra' });

/** Secciones de la historia clínica. Todas opcionales. */
export const CLINICAL_SECTIONS = Object.freeze([
  { key: 'motivo', label: 'Motivo de consulta' },
  { key: 'heredofamiliares', label: 'Antecedentes heredofamiliares' },
  { key: 'patologicos', label: 'Antecedentes personales patológicos' },
  { key: 'medicamentos', label: 'Medicamentos y suplementos' },
  { key: 'alergias', label: 'Alergias e intolerancias' },
  { key: 'estiloVida', label: 'Estilo de vida (actividad física, sueño, estrés, tabaco, alcohol)' },
  { key: 'habitos', label: 'Hábitos alimentarios' },
  { key: 'ginecoobstetricos', label: 'Antecedentes ginecoobstétricos' },
  { key: 'laboratorios', label: 'Estudios de laboratorio' },
]);

export const CLINICAL_SECTION_KEYS = Object.freeze(CLINICAL_SECTIONS.map((s) => s.key));

/** Tipos de evento de la línea de tiempo. */
export const TIMELINE_TYPES = toEnum({
  consulta: 'Consultas',
  medicion: 'Mediciones',
  objetivo: 'Objetivos',
  expediente: 'Expediente',
  cita: 'Citas',
  archivo: 'Archivos',
  estado: 'Estado',
});
