import { requireSupabase, databaseError } from './supabase';

export interface AnalyticsFilters { from: string; to: string; disease: string; province: string; unit: string }
export const EMPTY_FILTERS: AnalyticsFilters = { from: '', to: '', disease: '', province: '', unit: '' };
export interface CountGroup { name: string; count: number }
export interface Analytics {
  totalRecords: number; distinctDiseases: number; confirmedCases: number; missingValueRecords: number;
  undatedRecords: number; latestReportDate: string | null; currentWeekCount: number; previousWeekCount: number; weeklyChange: number | null;
  byDisease: CountGroup[]; byProvince: CountGroup[]; byUnit: CountGroup[];
  trend: { week: string; disease: string; count: number }[];
  options: { diseases: string[]; provinces: string[]; units: string[] };
}

function argumentsFor(filters: AnalyticsFilters) {
  if (filters.from && filters.to && filters.from > filters.to) throw new Error('Start date must be on or before end date.');
  return { p_from: filters.from || null, p_to: filters.to || null, p_disease: filters.disease || null, p_province: filters.province || null, p_unit: filters.unit || null };
}

export async function loadAnalytics(filters: AnalyticsFilters): Promise<Analytics> {
  const { data, error } = await requireSupabase().rpc('get_surveillance_analytics', argumentsFor(filters));
  if (error) throw databaseError(error.message, error.code);
  return data as Analytics;
}

export async function exportAnalytics(filters: AnalyticsFilters, format: 'csv' | 'xlsx'): Promise<Record<string, string | number>[]> {
  const { data, error } = await requireSupabase().rpc('export_surveillance_analytics', { ...argumentsFor(filters), p_format: format });
  if (error) throw databaseError(error.message, error.code);
  return data;
}

export function trendSeries(data: Analytics) {
  const names = data.byDisease.filter(row => row.name !== '(missing)').slice(0, 5).map(row => row.name);
  const weeks = new Map<string, Record<string, string | number>>();
  for (const row of data.trend) {
    const week = weeks.get(row.week) ?? Object.fromEntries([['week', row.week], ...names.map((_, i) => [`series_${i}`, 0])]);
    const index = names.indexOf(row.disease);
    if (index >= 0) week[`series_${index}`] = row.count;
    weeks.set(row.week, week);
  }
  return { names, rows: [...weeks.values()].sort((a, b) => String(a.week).localeCompare(String(b.week))) };
}
