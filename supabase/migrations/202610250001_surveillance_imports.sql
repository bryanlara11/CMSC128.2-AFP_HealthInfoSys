-- Preparation only: apply to your Supabase project when Supabase Auth is ready.
-- Provision profiles through a trusted administrator, never from editable user metadata.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  assigned_unit text not null,
  role_label text not null,
  can_upload boolean not null default false
);

create table public.surveillance_imports (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id),
  assigned_unit text not null,
  uploader jsonb not null,
  date_imported timestamptz not null default now(),
  workbook jsonb not null,
  validation jsonb not null,
  status text generated always as (validation->>'status') stored not null,
  constraint valid_status check (status in ('complete', 'incomplete', 'error'))
);

create table public.surveillance_records (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.surveillance_imports(id) on delete cascade,
  sheet_name text not null,
  excel_row integer not null check (excel_row > 0),
  record_data jsonb not null,
  unique (import_id, sheet_name, excel_row),
  constraint standardized_columns check (jsonb_typeof(record_data) = 'object' and record_data ?& array[
    'CASE ID', 'RP DATE', 'RP UNIT', 'RANK', 'OS', 'SURNAME', 'FIRST NAME',
    'MIDDLE NAME', 'SEX', 'AGE', 'DISEASE', 'CASE CL', 'DS DATE', 'PROVINCE'
  ])
);

create index surveillance_imports_uploader_date on public.surveillance_imports(uploader_id, date_imported desc);
create index surveillance_imports_unit on public.surveillance_imports(assigned_unit);
create index surveillance_records_import on public.surveillance_records(import_id);

alter table public.profiles enable row level security;
alter table public.surveillance_imports enable row level security;
alter table public.surveillance_records enable row level security;

create policy read_own_profile on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy read_own_imports on public.surveillance_imports for select to authenticated using (uploader_id = (select auth.uid()));
create policy delete_own_imports on public.surveillance_imports for delete to authenticated using (
  uploader_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and can_upload)
);
create policy read_own_records on public.surveillance_records for select to authenticated using (
  exists (select 1 from public.surveillance_imports i where i.id = import_id and i.uploader_id = (select auth.uid()))
);

-- Single transaction saves the import and its records. Failed schemas retain history only.
-- Identity and assigned unit always come from the provisioned profile.
create function public.save_surveillance_import(p_id uuid, p_workbook jsonb, p_validation jsonb, p_records jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or not actor.can_upload then
    raise exception 'Upload permission required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_records) <> 'array' or p_records is null then
    raise exception 'Records must be an array';
  end if;
  if p_validation->>'status' = 'error' and jsonb_array_length(p_records) > 0 then
    raise exception 'Files with column errors cannot create surveillance records';
  end if;
  insert into public.surveillance_imports(id, uploader_id, assigned_unit, uploader, workbook, validation)
  values (p_id, actor.id, actor.assigned_unit, jsonb_build_object(
    'fullName', actor.full_name, 'email', actor.email, 'role', actor.role_label, 'assignedUnit', actor.assigned_unit
  ), p_workbook, p_validation);
  insert into public.surveillance_records(import_id, sheet_name, excel_row, record_data)
    select p_id, item->>'sheet_name', (item->>'excel_row')::integer, item->'values'
    from jsonb_array_elements(p_records) as item;
  return p_id;
end;
$$;

-- Keep writes to the RPC; authenticated clients cannot directly alter profile grants.
revoke all on public.profiles, public.surveillance_imports, public.surveillance_records from anon, authenticated;
grant select on public.profiles, public.surveillance_imports, public.surveillance_records to authenticated;
grant delete on public.surveillance_imports to authenticated;
revoke all on function public.save_surveillance_import(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_surveillance_import(uuid, jsonb, jsonb, jsonb) to authenticated;

commit;
