import { requireSupabase, databaseError } from './supabase';

export interface AnalyticsFilters { from: string; to: string; disease: string[]; province: string[]; unit: string;}
export const EMPTY_FILTERS: AnalyticsFilters = {from: '', to: '', disease: [], province: [], unit: ''};
export type TrendInterval = 'day' | 'week';
export interface CountGroup { name: string; count: number }
export interface Analytics {
  totalRecords: number; distinctDiseases: number; confirmedCases: number; missingValueRecords: number;
  undatedRecords: number; latestReportDate: string | null; currentWeekCount: number; previousWeekCount: number; weeklyChange: number | null;
  byDisease: CountGroup[]; byProvince: CountGroup[]; byUnit: CountGroup[];
  /** 'day' when the date range is 31 days or shorter, otherwise 'week' (Monday start). */
  trendInterval?: TrendInterval;
  trend: { period: string; disease: string; count: number }[];
  options: { diseases: string[]; provinces: string[]; units: string[] };
}

function argumentsFor(filters: AnalyticsFilters) {
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new Error('Start date must be on or before end date.');
  }

  return {
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_disease: filters.disease,
    p_province: filters.province,
    p_unit: filters.unit || null
  };
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

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Monday of the week containing the date (UTC). */
const mondayMs = (ms: number) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;

/** Monday to Sunday of the week containing `iso` (YYYY-MM-DD). */
export function weekContaining(iso: string): { from: string; to: string } {
  const monday = mondayMs(dayMs(iso));
  return { from: isoDay(monday), to: isoDay(monday + 6 * DAY_MS) };
}

/**
 * One row per day or week, with a zero for every disease that has no records in that period.
 * Periods with no records at all are filled in so the line does not skip over them.
 */
export function trendSeries(data: Pick<Analytics, 'byDisease' | 'trend' | 'trendInterval'>, range: { from?: string; to?: string } = {}) {
  const names = data.byDisease.filter(row => row.name !== '(missing)').map(row => row.name);
  const interval: TrendInterval = data.trendInterval ?? 'week';
  const empty = (period: string) => Object.fromEntries([['period', period], ...names.map((_, i) => [`series_${i}`, 0])]) as Record<string, string | number>;
  const periods = new Map<string, Record<string, string | number>>();
  for (const row of data.trend) {
    // Databases without migration 202611240002 still return weekly rows keyed `week`.
    const key = row.period ?? (row as { week?: string }).week;
    if (!key) continue;
    const entry = periods.get(key) ?? empty(key);
    const index = names.indexOf(row.disease);
    if (index >= 0) entry[`series_${index}`] = row.count;
    periods.set(key, entry);
  }
  const known = [...periods.keys()].sort();
  const first = range.from || known[0];
  const last = range.to || known[known.length - 1];
  if (first && last && first <= last) {
    const step = interval === 'day' ? DAY_MS : 7 * DAY_MS;
    const start = interval === 'day' ? dayMs(first) : mondayMs(dayMs(first));
    for (let ms = start; ms <= dayMs(last); ms += step) {
      const period = isoDay(ms);
      if (!periods.has(period)) periods.set(period, empty(period));
    }
  }
  return { names, interval, rows: [...periods.values()].sort((a, b) => String(a.period).localeCompare(String(b.period))) };
}
