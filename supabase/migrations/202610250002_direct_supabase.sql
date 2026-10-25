-- Run AFTER 202610250001_surveillance_imports.sql. Safe to rerun.
-- The browser uses Supabase Auth + these database APIs; Express is unnecessary.
begin;

create table if not exists public.roles (
  id text primary key,
  label text not null,
  grants jsonb not null
);

insert into public.roles(id, label, grants) values
('admin-clerk', 'Admin / Information Clerk', '{"demographics":"create-edit-view","clinicalLab":"no-access","physicalExam":"view-status","surveillance":"view","audit":"no-access"}'),
('medtech', 'Medical Technologist', '{"demographics":"view","clinicalLab":"create-edit-view","physicalExam":"no-access","surveillance":"no-access","audit":"file-upload"}'),
('radtech', 'Radiologic Technologist', '{"demographics":"view","clinicalLab":"create-edit-view","physicalExam":"no-access","surveillance":"no-access","audit":"file-upload"}'),
('physical-therapist', 'Physical Therapist', '{"demographics":"view","clinicalLab":"create-edit-view","physicalExam":"create-edit-view","surveillance":"no-access","audit":"file-upload"}'),
('nurse', 'Nurse', '{"demographics":"edit-view","clinicalLab":"create-edit-view","physicalExam":"create-edit-view","surveillance":"view","audit":"file-upload"}'),
('medical-officer', 'Medical Officer (Doctor)', '{"demographics":"view","clinicalLab":"create-edit-view","physicalExam":"create-edit-view","surveillance":"view","audit":"view"}'),
('hseu-analyst', 'HSEU Epidemiologist / Analyst', '{"demographics":"view","clinicalLab":"view","physicalExam":"view","surveillance":"full-access","audit":"ingestion-errors"}'),
('it-personnel', 'I.T. Personnel', '{"demographics":"create-edit-view","clinicalLab":"create-edit-view","physicalExam":"create-edit-view","surveillance":"full-access","audit":"full-access"}')
on conflict (id) do update set label = excluded.label, grants = excluded.grants;

alter table public.profiles add column if not exists role_id text references public.roles(id);
-- Preserve existing profiles and map known role labels. Unmapped profiles get no permissions.
update public.profiles p set role_id = r.id from public.roles r where p.role_id is null and p.role_label = r.label;
alter table public.surveillance_imports add column if not exists upload_error text;
alter table public.roles enable row level security;
drop policy if exists read_role_definitions on public.roles;
create policy read_role_definitions on public.roles for select to authenticated using (true);
revoke all on public.roles from public, anon, authenticated;
grant select on public.roles to authenticated;

create or replace function public.can_read_unit_imports(p_unit text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and (
      r.grants->>'audit' = 'full-access' or
      (p.assigned_unit = p_unit and r.grants->>'audit' in ('file-upload', 'view'))
    )
  );
$$;

drop policy if exists read_own_imports on public.surveillance_imports;
drop policy if exists read_unit_imports on public.surveillance_imports;
create policy read_unit_imports on public.surveillance_imports for select to authenticated using (public.can_read_unit_imports(assigned_unit));
drop policy if exists delete_own_imports on public.surveillance_imports;
-- No direct table writes or deletes. The protected RPCs below enforce permissions.
revoke insert, update, delete on public.surveillance_imports from authenticated, anon;
drop policy if exists read_own_records on public.surveillance_records;
drop policy if exists read_unit_records on public.surveillance_records;
create policy read_unit_records on public.surveillance_records for select to authenticated using (
  exists (select 1 from public.surveillance_imports i where i.id = import_id and public.can_read_unit_imports(i.assigned_unit))
);

create or replace function public.surveillance_cell_missing(p_cell jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_cell is null or p_cell = 'null'::jsonb or btrim(regexp_replace(p_cell #>> '{}', '\s+', ' ', 'g')) = '';
$$;

-- Authoritative validation: never trust a browser-supplied status or record list.
create or replace function public.check_surveillance_workbook(p_workbook jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  expected text[] := array['CASE ID','RP DATE','RP UNIT','RANK','OS','SURNAME','FIRST NAME','MIDDLE NAME','SEX','AGE','DISEASE','CASE CL','DS DATE','PROVINCE'];
  s jsonb; row_value jsonb; cell jsonb; row_idx integer; col_idx integer;
  header_idx integer; best integer; matches integer; width integer; last_row integer;
  headers text[]; sheet_reasons jsonb; reasons jsonb := '[]';
  tables jsonb := '[]'; summaries jsonb := '[]'; names text[] := array[]::text[];
  sheet_status text; overall text := 'complete'; sheet_missing integer; sheet_count integer;
  total_missing integer := 0; total_records integer := 0; total_rows integer := 0;
  missing_headers text[]; extra_headers text[]; duplicate_headers text[]; reason text; name text;
begin
  if p_workbook is null or jsonb_typeof(p_workbook) <> 'object'
    or jsonb_typeof(p_workbook->'filename') is distinct from 'string'
    or jsonb_typeof(p_workbook->'sheets') is distinct from 'array' then
    raise exception 'Invalid workbook payload';
  end if;
  if length(p_workbook->>'filename') > 255 or octet_length(p_workbook::text) > 20971520
    or jsonb_array_length(p_workbook->'sheets') > 200 then raise exception 'Workbook exceeds supported limits'; end if;
  for s in select value from jsonb_array_elements(p_workbook->'sheets') loop
    if jsonb_typeof(s->'name') is distinct from 'string' or jsonb_typeof(s->'rows') is distinct from 'array'
      or coalesce(s->>'rowCount', '') !~ '^[0-9]+$' or coalesce(s->>'columnCount', '') !~ '^[0-9]+$' then
      raise exception 'Invalid worksheet payload';
    end if;
    name := s->>'name';
    if name = any(names) then raise exception 'Duplicate worksheet names'; end if;
    names := array_append(names, name);
    total_rows := total_rows + jsonb_array_length(s->'rows');
    if total_rows > 100000 or (s->>'columnCount')::numeric > 100 or (s->>'rowCount')::numeric <> jsonb_array_length(s->'rows') then
      raise exception 'Invalid worksheet dimensions or too many rows';
    end if;
    for row_value in select value from jsonb_array_elements(s->'rows') loop
      if jsonb_typeof(row_value) <> 'array' then raise exception 'Worksheet rows must be arrays'; end if;
      if jsonb_array_length(row_value) <> (s->>'columnCount')::integer then raise exception 'Worksheet columns are misaligned'; end if;
      for cell in select value from jsonb_array_elements(row_value) loop
        if jsonb_typeof(cell) not in ('string','number','boolean','null') then raise exception 'Unsupported cell value'; end if;
      end loop;
    end loop;
    if btrim(name) ~* '^(ref[ _-]|province[ _-]*lists?$|how\s+it\s+works$|instructions?$)' then continue; end if;
    header_idx := -1; best := 0; width := 0; row_idx := 0;
    for row_value in select value from jsonb_array_elements(s->'rows') loop
      matches := 0; col_idx := 0;
      for cell in select value from jsonb_array_elements(row_value) loop
        if not public.surveillance_cell_missing(cell) then width := greatest(width, col_idx + 1); end if;
        if upper(btrim(regexp_replace(cell #>> '{}', '\s+', ' ', 'g'))) = any(expected) then matches := matches + 1; end if;
        col_idx := col_idx + 1;
      end loop;
      if matches > best then best := matches; header_idx := row_idx; end if;
      row_idx := row_idx + 1;
    end loop;
    if best < 2 then
      header_idx := -1; row_idx := 0;
      for row_value in select value from jsonb_array_elements(s->'rows') loop
        select count(*) into matches from jsonb_array_elements(row_value) c where not public.surveillance_cell_missing(c.value);
        if matches >= 2 then header_idx := row_idx; exit; end if;
        row_idx := row_idx + 1;
      end loop;
    end if;
    headers := array[]::text[];
    if width > 0 then
      for col_idx in 0..width - 1 loop
        headers := array_append(headers, coalesce(upper(btrim(regexp_replace((s->'rows'->header_idx->col_idx) #>> '{}', '\s+', ' ', 'g'))), ''));
      end loop;
    end if;
    -- A negative JSON array index means "from the end" in PostgreSQL; override for no header.
    if header_idx < 0 then headers := array_fill(''::text, array[width]); end if;
    select coalesce(array_agg(h), array[]::text[]) into missing_headers from unnest(expected) h where not h = any(headers);
    select coalesce(array_agg(h), array[]::text[]) into extra_headers from unnest(headers) h where not h = any(expected);
    select coalesce(array_agg(h), array[]::text[]) into duplicate_headers from (select h from unnest(headers) h group by h having count(*) > 1) d;
    sheet_reasons := '[]';
    if header_idx < 0 then sheet_reasons := sheet_reasons || jsonb_build_array('No column header row found.'); end if;
    if cardinality(missing_headers) > 0 then sheet_reasons := sheet_reasons || jsonb_build_array('Missing columns: ' || array_to_string(missing_headers, ', ') || '.'); end if;
    if cardinality(extra_headers) > 0 then sheet_reasons := sheet_reasons || jsonb_build_array('Unexpected columns: ' || array_to_string(extra_headers, ', ') || '.'); end if;
    if cardinality(duplicate_headers) > 0 then sheet_reasons := sheet_reasons || jsonb_build_array('Duplicate columns: ' || array_to_string(duplicate_headers, ', ') || '.'); end if;
    if cardinality(missing_headers) = 0 and cardinality(extra_headers) = 0 and cardinality(duplicate_headers) = 0 and headers <> expected then
      sheet_reasons := sheet_reasons || jsonb_build_array('Columns must follow this order: ' || array_to_string(expected, ', ') || '.');
    end if;
    last_row := jsonb_array_length(s->'rows') - 1;
    while last_row > header_idx loop
      select count(*) into matches from jsonb_array_elements(s->'rows'->last_row) c where not public.surveillance_cell_missing(c.value);
      exit when matches > 0;
      last_row := last_row - 1;
    end loop;
    sheet_count := greatest(0, last_row - header_idx); sheet_missing := 0;
    if sheet_count > 0 and width > 0 then
      for row_idx in header_idx + 1..last_row loop
        for col_idx in 0..width - 1 loop
          if public.surveillance_cell_missing(s->'rows'->row_idx->col_idx) then sheet_missing := sheet_missing + 1; end if;
        end loop;
      end loop;
    end if;
    sheet_status := case when jsonb_array_length(sheet_reasons) > 0 then 'error'
      when sheet_missing > 0 or sheet_count = 0 then 'incomplete' else 'complete' end;
    if sheet_status = 'incomplete' then
      sheet_reasons := jsonb_build_array(case when sheet_count = 0 then 'No data records found.' else sheet_missing || ' missing value(s).' end);
    end if;
    if sheet_status = 'error' then overall := 'error'; elsif sheet_status = 'incomplete' and overall <> 'error' then overall := 'incomplete'; end if;
    total_records := total_records + sheet_count; total_missing := total_missing + sheet_missing;
    summaries := summaries || jsonb_build_array(jsonb_build_object('name', name, 'status', sheet_status, 'reasons', sheet_reasons, 'recordCount', sheet_count, 'missingCount', sheet_missing));
    tables := tables || jsonb_build_array(jsonb_build_object('name', name, 'headerIndex', header_idx, 'lastRow', last_row));
    for reason in select value from jsonb_array_elements_text(sheet_reasons) loop reasons := reasons || jsonb_build_array(name || ': ' || reason); end loop;
  end loop;
  if jsonb_array_length(summaries) = 0 then overall := 'error'; reasons := jsonb_build_array('No surveillance data worksheet found.'); end if;
  return jsonb_build_object('tables', tables, 'validation', jsonb_build_object(
    'schemaVersion', 1, 'status', overall, 'sheets', summaries, 'reasons', reasons,
    'recordCount', total_records, 'missingCount', total_missing
  ));
end;
$$;

-- Disable the old RPC, which accepted client-computed validation and records.
revoke all on function public.save_surveillance_import(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.save_surveillance_workbook(p_id uuid, p_workbook jsonb, p_error text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles; permission text; checked jsonb; validation jsonb; t jsonb; s jsonb;
  expected text[] := array['CASE ID','RP DATE','RP UNIT','RANK','OS','SURNAME','FIRST NAME','MIDDLE NAME','SEX','AGE','DISEASE','CASE CL','DS DATE','PROVINCE'];
begin
  select * into actor from public.profiles where id = auth.uid();
  select grants->>'audit' into permission from public.roles where id = actor.role_id;
  if actor.id is null or permission is null or permission not in ('file-upload','full-access') then raise exception 'Upload permission required' using errcode = '42501'; end if;
  checked := public.check_surveillance_workbook(p_workbook);
  validation := checked->'validation';
  if p_error is not null then
    if length(p_error) > 500 then raise exception 'Upload error message is too long'; end if;
    validation := jsonb_build_object('schemaVersion', 1, 'status', 'error', 'sheets', '[]'::jsonb, 'recordCount', 0, 'missingCount', 0, 'reasons', jsonb_build_array(p_error));
  end if;
  insert into public.surveillance_imports(id, uploader_id, assigned_unit, uploader, workbook, validation, upload_error)
  values (p_id, actor.id, actor.assigned_unit, jsonb_build_object('fullName', actor.full_name, 'email', actor.email, 'role', actor.role_label, 'assignedUnit', actor.assigned_unit), p_workbook - 'validation', validation, p_error);
  if validation->>'status' <> 'error' then
    for t in select value from jsonb_array_elements(checked->'tables') loop
      select value into s from jsonb_array_elements(p_workbook->'sheets') where value->>'name' = t->>'name';
      insert into public.surveillance_records(import_id, sheet_name, excel_row, record_data)
      select p_id, t->>'name', r.ordinality::integer,
        (select jsonb_object_agg(h.name, case when public.surveillance_cell_missing(r.value->(h.ordinality::integer - 1)) then 'null'::jsonb else r.value->(h.ordinality::integer - 1) end)
          from unnest(expected) with ordinality as h(name, ordinality))
      from jsonb_array_elements(s->'rows') with ordinality as r(value, ordinality)
      where r.ordinality > (t->>'headerIndex')::integer + 1 and r.ordinality <= (t->>'lastRow')::integer + 1;
    end loop;
  end if;
  return p_id;
end;
$$;

create or replace function public.list_surveillance_imports()
returns table(id uuid, date_imported timestamptz, uploader jsonb, workbook jsonb, validation jsonb, metadata_only boolean, upload_error text)
language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles; errors_only boolean;
begin
  select * into actor from public.profiles where profiles.id = auth.uid();
  if actor.id is null then raise exception 'Assigned profile required' using errcode = '42501'; end if;
  select r.grants->>'audit' = 'ingestion-errors' into errors_only from public.roles r where r.id = actor.role_id;
  return query select i.id, i.date_imported, i.uploader,
    case when errors_only then jsonb_build_object('filename', i.workbook->>'filename', 'sheets', '[]'::jsonb) else i.workbook end,
    i.validation, coalesce(errors_only, false), i.upload_error
    from public.surveillance_imports i
    where public.can_read_unit_imports(i.assigned_unit) or (errors_only and actor.assigned_unit = i.assigned_unit and i.status in ('error','incomplete'))
    order by i.date_imported desc, i.id desc;
end;
$$;

create or replace function public.delete_surveillance_import(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p join public.roles r on r.id = p.role_id where p.id = auth.uid() and r.grants->>'audit' = 'full-access') then
    raise exception 'Full system access required to delete imports' using errcode = '42501';
  end if;
  delete from public.surveillance_imports where id = p_id;
end;
$$;

create or replace function public.update_my_profile(p_full_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or length(btrim(p_full_name)) not between 1 and 200 then raise exception 'A valid name and authenticated account are required'; end if;
  update public.profiles set full_name = btrim(p_full_name) where id = auth.uid();
  if not found then raise exception 'Assigned profile required' using errcode = '42501'; end if;
end;
$$;

revoke all on function public.can_read_unit_imports(text), public.surveillance_cell_missing(jsonb), public.check_surveillance_workbook(jsonb),
  public.save_surveillance_workbook(uuid, jsonb, text), public.list_surveillance_imports(), public.delete_surveillance_import(uuid), public.update_my_profile(text) from public, anon, authenticated;
grant execute on function public.can_read_unit_imports(text), public.save_surveillance_workbook(uuid, jsonb, text),
  public.list_surveillance_imports(), public.delete_surveillance_import(uuid), public.update_my_profile(text) to authenticated;
commit;
