import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/http.js';
import { qk } from '../../lib/queryKeys.js';

/**
 * Catálogos de referencia (cambian poco): caché de 10 min.
 * Se usan en formularios y para mostrar etiquetas legibles.
 */
const STALE = 10 * 60_000;

export const useMetrics = (includeInactive = false) =>
  useQuery({ queryKey: qk.metrics(includeInactive), queryFn: () => api.get('/metrics', { includeInactive }), staleTime: STALE });

export const useGoalTypes = (includeInactive = false) =>
  useQuery({ queryKey: qk.goalTypes(includeInactive), queryFn: () => api.get('/goal-types', { includeInactive }), staleTime: STALE });

export const useCatalog = (type, includeInactive = false) =>
  useQuery({ queryKey: qk.catalogs(type, includeInactive), queryFn: () => api.get('/catalogs', { type, includeInactive }), staleTime: STALE });

export const useNutritionists = () =>
  useQuery({ queryKey: qk.nutritionists(), queryFn: () => api.get('/users/nutritionists'), staleTime: STALE });

export const useSettings = () => useQuery({ queryKey: qk.settings(), queryFn: () => api.get('/settings'), staleTime: STALE });

/** `{ key: label }` para mostrar etiquetas de catálogo. */
export function useLabels(type) {
  const { data } = useCatalog(type, true);
  return Object.fromEntries((data ?? []).map((c) => [c.key, c.label]));
}

export function useMetricMap() {
  const { data } = useMetrics(true);
  return Object.fromEntries((data ?? []).map((m) => [m.key, m]));
}
