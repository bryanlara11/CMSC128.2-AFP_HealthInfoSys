-- Run this entire block in the Supabase SQL Editor AFTER migrations 001 and 002.
-- The eight login accounts must already exist under Authentication > Users.
-- This one statement is atomic, can be rerun, and does not use temporary tables.
-- It provisions profiles only and never stores or changes passwords.
do $profiles$
declare
  unit_name text := 'Victoriano Luna Medical Center';
  assignments jsonb := '[
    {"email":"admin_clerk_test@email.com","role_id":"admin-clerk","full_name":"Admin Clerk Test"},
    {"email":"medtech_test@email.com","role_id":"medtech","full_name":"Medical Technologist Test"},
    {"email":"radtech_test@email.com","role_id":"radtech","full_name":"Radiologic Technologist Test"},
    {"email":"physical_therapist_test@email.com","role_id":"physical-therapist","full_name":"Physical Therapist Test"},
    {"email":"nurse_test@email.com","role_id":"nurse","full_name":"Nurse Test"},
    {"email":"medical_officer_test@email.com","role_id":"medical-officer","full_name":"Medical Officer Test"},
    {"email":"hseu_analyst_test@email.com","role_id":"hseu-analyst","full_name":"HSEU Analyst Test"},
    {"email":"it_personnel_test@email.com","role_id":"it-personnel","full_name":"I.T. Personnel Test"}
  ]';
  missing_emails text;
  missing_roles text;
  assigned_count integer;
begin
  if unit_name is null or unit_name = 'REPLACE_WITH_ASSIGNED_UNIT' or btrim(unit_name) = '' then
    raise exception 'Replace the assigned-unit placeholders before running this script.';
  end if;

  select string_agg(a.email, ', ' order by a.email) into missing_emails
  from jsonb_to_recordset(assignments) as a(email text, role_id text, full_name text)
  left join auth.users u on lower(u.email) = a.email
  where u.id is null;
  if missing_emails is not null then
    raise exception 'Missing Authentication accounts: %', missing_emails
      using hint = 'Create these emails under Authentication > Users, then rerun this entire block.';
  end if;

  select string_agg(a.role_id, ', ' order by a.role_id) into missing_roles
  from jsonb_to_recordset(assignments) as a(email text, role_id text, full_name text)
  left join public.roles r on r.id = a.role_id
  where r.id is null;
  if missing_roles is not null then
    raise exception 'Missing role definitions: %', missing_roles
      using hint = 'Run migration 202610250002_direct_supabase.sql before provisioning profiles.';
  end if;

  insert into public.profiles(id, full_name, email, assigned_unit, role_label, role_id, can_upload)
  select u.id, a.full_name, a.email, unit_name, r.label, r.id,
    r.grants->>'audit' in ('file-upload', 'full-access')
  from jsonb_to_recordset(assignments) as a(email text, role_id text, full_name text)
  join auth.users u on lower(u.email) = a.email
  join public.roles r on r.id = a.role_id
  on conflict(id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    assigned_unit = excluded.assigned_unit,
    role_label = excluded.role_label,
    role_id = excluded.role_id,
    can_upload = excluded.can_upload;

  get diagnostics assigned_count = row_count;
  raise notice 'Created or updated % profiles for %.', assigned_count, unit_name;
end;
$profiles$;
