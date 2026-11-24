-- Run after 202611240001_multi_select_analytics.sql. Safe to rerun.
--
-- 1. Opening or filtering the analytics dashboard no longer writes a
--    'View Analytics' audit event. The audit log keeps imports, deletions,
--    record edits, profile changes, exports, logins and logouts.
-- 2. The trend series is bucketed by day when the selected date range is
--    31 days or shorter, otherwise by week. The result reports which one
--    it used in 'trendInterval', and each trend row uses 'period'.
-- 3. The latest-week / preceding-week comparison ignores the date-range
--    filter (it still honors disease, province and unit), so a one-week
--    date range does not always report zero for the preceding week.

BEGIN;

CREATE OR REPLACE FUNCTION public.build_surveillance_analytics(
  p_from date,
  p_to date,
  p_disease text[],
  p_province text[],
  p_unit text,
  p_export boolean
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor public.profiles;
  permission text;
  result jsonb;
  trend_unit text := CASE
    WHEN p_from IS NOT NULL AND p_to IS NOT NULL AND p_to - p_from <= 31 THEN 'day'
    ELSE 'week'
  END;
BEGIN
  SELECT * INTO actor
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT grants->>'surveillance'
  INTO permission
  FROM public.roles
  WHERE id = actor.role_id;

  IF actor.id IS NULL
     OR permission IS NULL
     OR permission NOT IN ('view', 'full-access') THEN
    RAISE EXCEPTION 'Surveillance viewing permission required'
      USING errcode = '42501';
  END IF;

  IF p_from > p_to THEN
    RAISE EXCEPTION 'Start date must be on or before end date';
  END IF;

  WITH scoped AS (
    SELECT
      r.record_data d,
      i.assigned_unit,
      public.surveillance_date(r.record_data->>'RP DATE') report_date,
      coalesce(nullif(upper(btrim(r.record_data->>'DISEASE')), ''), '(missing)') disease,
      coalesce(nullif(upper(btrim(r.record_data->>'PROVINCE')), ''), '(missing)') province,
      coalesce(nullif(upper(btrim(r.record_data->>'CASE CL')), ''), '(missing)') classification
    FROM public.surveillance_records r
    JOIN public.surveillance_imports i ON i.id = r.import_id
    WHERE actor.role_id = 'it-personnel'
       OR i.assigned_unit = actor.assigned_unit
  ),

  -- Every filter except the reporting-date range.
  base AS (
    SELECT *
    FROM scoped
    WHERE (coalesce(cardinality(p_disease), 0) = 0 OR disease = ANY(p_disease))
      AND (coalesce(cardinality(p_province), 0) = 0 OR province = ANY(p_province))
      AND (p_unit IS NULL OR assigned_unit = p_unit)
  ),

  filtered AS (
    SELECT *
    FROM base
    WHERE (p_from IS NULL OR report_date >= p_from)
      AND (p_to IS NULL OR report_date <= p_to)
  ),

  stats AS (
    SELECT
      count(*) total,
      count(DISTINCT disease) FILTER (WHERE disease <> '(missing)') diseases,
      count(*) FILTER (WHERE classification = 'CONFIRMED') confirmed,
      count(*) FILTER (WHERE report_date IS NULL) undated,
      max(report_date) latest,
      count(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM jsonb_each(d) c
          WHERE public.surveillance_cell_missing(c.value)
        )
      ) missing
    FROM filtered
  ),

  weeks AS (
    SELECT
      count(*) FILTER (
        WHERE b.report_date >= date_trunc('week', s.latest)::date
          AND b.report_date < date_trunc('week', s.latest)::date + 7
      ) current_count,
      count(*) FILTER (
        WHERE b.report_date >= date_trunc('week', s.latest)::date - 7
          AND b.report_date < date_trunc('week', s.latest)::date
      ) previous_count
    FROM base b
    CROSS JOIN stats s
  ),

  diseases AS (
    SELECT disease name, count(*) count FROM filtered GROUP BY disease
  ),

  provinces AS (
    SELECT province name, count(*) count FROM filtered GROUP BY province
  ),

  units AS (
    SELECT assigned_unit name, count(*) count FROM filtered GROUP BY assigned_unit
  ),

  trend AS (
    SELECT
      date_trunc(trend_unit, report_date)::date period,
      disease,
      count(*) count
    FROM filtered
    WHERE report_date IS NOT NULL
    GROUP BY 1, 2
  ),

  export_data AS (
    SELECT
      coalesce(date_trunc('week', report_date)::date::text, 'Unknown') AS "Reporting Week",
      disease AS "Disease",
      province AS "Province",
      assigned_unit AS "Assigned Unit",
      coalesce(nullif(upper(btrim(d->>'RP UNIT')), ''), '(missing)') AS "Reporting Unit",
      classification AS "Classification",
      coalesce(nullif(upper(btrim(d->>'SEX')), ''), '(missing)') AS "Sex",
      CASE
        WHEN d->>'AGE' ~ '^\d{1,3}$' THEN
          CASE
            WHEN (d->>'AGE')::integer <= 130
            THEN ((d->>'AGE')::integer / 5 * 5)::text || '-' || ((d->>'AGE')::integer / 5 * 5 + 4)::text
            ELSE 'Unknown'
          END
        ELSE 'Unknown'
      END AS "Age Band",
      count(*) AS "Cases"
    FROM filtered
    WHERE p_export
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
  )

  SELECT jsonb_build_object(
    'totalRecords', s.total,
    'distinctDiseases', s.diseases,
    'confirmedCases', s.confirmed,
    'missingValueRecords', s.missing,
    'undatedRecords', s.undated,
    'latestReportDate', s.latest,
    'currentWeekCount', w.current_count,
    'previousWeekCount', w.previous_count,
    'weeklyChange', round((w.current_count - w.previous_count) * 100.0 / nullif(w.previous_count, 0), 1),
    'byDisease', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY count DESC, name) FROM diseases d), '[]'),
    'byProvince', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY count DESC, name) FROM provinces p), '[]'),
    'byUnit', coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY count DESC, name) FROM units u), '[]'),
    'trendInterval', trend_unit,
    'trend', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY period, disease) FROM trend t), '[]'),
    'options', jsonb_build_object(
      'diseases', coalesce((SELECT jsonb_agg(disease ORDER BY disease) FROM (SELECT DISTINCT disease FROM scoped) o), '[]'),
      'provinces', coalesce((SELECT jsonb_agg(province ORDER BY province) FROM (SELECT DISTINCT province FROM scoped) o), '[]'),
      'units', coalesce((SELECT jsonb_agg(assigned_unit ORDER BY assigned_unit) FROM (SELECT DISTINCT assigned_unit FROM scoped) o), '[]')
    ),
    'exportRows', CASE
      WHEN p_export THEN coalesce((
        SELECT jsonb_agg(to_jsonb(e) ORDER BY "Reporting Week", "Disease", "Province", "Assigned Unit",
                                            "Reporting Unit", "Classification", "Sex", "Age Band")
        FROM export_data e
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  )
  INTO result
  FROM stats s
  CROSS JOIN weeks w;

  RETURN result;
END;
$$;


-- Viewing analytics is a read of aggregate counts, not a data change, so it
-- is no longer written to audit_events. Exports are still audited by
-- export_surveillance_analytics.
CREATE OR REPLACE FUNCTION public.get_surveillance_analytics(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_disease text[] DEFAULT NULL,
  p_province text[] DEFAULT NULL,
  p_unit text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.build_surveillance_analytics(p_from, p_to, p_disease, p_province, p_unit, false);
END;
$$;


REVOKE ALL ON FUNCTION
  public.build_surveillance_analytics(date,date,text[],text[],text,boolean),
  public.get_surveillance_analytics(date,date,text[],text[],text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.get_surveillance_analytics(date,date,text[],text[],text)
TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
