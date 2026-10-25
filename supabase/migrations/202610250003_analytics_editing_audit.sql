-- Run after migrations 001 and 002. Adds live analytics, guarded editing and durable audit events.
begin;

alter table public.surveillance_records add column if not exists version integer not null default 1;
alter table public.surveillance_records add column if not exists updated_at timestamptz not null default now();

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  happened_at timestamptz not null default clock_timestamp(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  actor_email text not null,
  role_id text not null,
  role_label text not null,
  assigned_unit text not null,
  affected_unit text not null,
  category text not null check (category in ('audit','access')),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'
);
create index if not exists audit_events_time on public.audit_events(happened_at desc, id desc);
create index if not exists audit_events_unit on public.audit_events(affected_unit, happened_at desc);
create index if not exists audit_events_actor on public.audit_events(actor_id, happened_at desc);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;
drop policy if exists read_authorized_audit on public.audit_events;
create policy read_authorized_audit on public.audit_events for select to authenticated using (
  exists (select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=auth.uid()
    and (r.grants->>'audit'='full-access' or (r.grants->>'audit'='view' and p.assigned_unit=affected_unit)))
);

-- Internal only. Actor identity, time and unit are never supplied by the browser.
create or replace function public.append_surveillance_event(p_action text, p_entity text, p_id text,
  p_details jsonb, p_unit text, p_category text default 'audit')
returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles; r public.roles;
begin
  select * into p from public.profiles where id=auth.uid();
  select * into r from public.roles where id=p.role_id;
  insert into public.audit_events(actor_id,actor_name,actor_email,role_id,role_label,assigned_unit,
    affected_unit,category,action,entity_type,entity_id,details)
  values (p.id,coalesce(p.full_name,'Database administrator'),coalesce(p.email,''),coalesce(r.id,'database-admin'),
    coalesce(r.label,'Database administrator'),coalesce(p.assigned_unit,p_unit),p_unit,p_category,p_action,p_entity,p_id,p_details);
end;
$$;

create or replace function public.audit_surveillance_import()
returns trigger language plpgsql security definer set search_path='' as $$
declare i public.surveillance_imports;
begin
  if tg_op='DELETE' then i:=old; else i:=new; end if;
  perform public.append_surveillance_event(case when tg_op='DELETE' then 'Delete Import' else 'Import' end,
    'import',i.id::text,jsonb_build_object('filename',i.workbook->>'filename','status',i.status,
    'recordCount',i.validation->'recordCount'),i.assigned_unit);
  return i;
end;
$$;
drop trigger if exists audit_import on public.surveillance_imports;
create trigger audit_import after insert or delete on public.surveillance_imports
  for each row execute function public.audit_surveillance_import();

create or replace function public.audit_surveillance_record_edit()
returns trigger language plpgsql security definer set search_path='' as $$
declare changed jsonb; source_unit text;
begin
  if new.record_data is not distinct from old.record_data then return new; end if;
  select jsonb_agg(k order by k) into changed from jsonb_object_keys(new.record_data) k
    where new.record_data->k is distinct from old.record_data->k;
  select assigned_unit into source_unit from public.surveillance_imports where id=new.import_id;
  perform public.append_surveillance_event('Edit Record','record',new.id::text,
    jsonb_build_object('importId',new.import_id,'sheet',new.sheet_name,'excelRow',new.excel_row,
      'changedFields',changed,'version',new.version),source_unit);
  return new;
end;
$$;
drop trigger if exists audit_record_edit on public.surveillance_records;
create trigger audit_record_edit after update of record_data on public.surveillance_records
  for each row execute function public.audit_surveillance_record_edit();

create or replace function public.audit_surveillance_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.full_name is distinct from new.full_name or old.role_id is distinct from new.role_id
    or old.assigned_unit is distinct from new.assigned_unit then
    perform public.append_surveillance_event('Update Profile','profile',new.id::text,
      jsonb_build_object('nameChanged',old.full_name is distinct from new.full_name,
        'roleChanged',old.role_id is distinct from new.role_id,'unitChanged',old.assigned_unit is distinct from new.assigned_unit),new.assigned_unit);
  end if;
  return new;
end;
$$;
drop trigger if exists audit_profile_update on public.profiles;
create trigger audit_profile_update after update on public.profiles for each row execute function public.audit_surveillance_profile();

create or replace function public.record_access_event(p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare unit_name text;
begin
  select assigned_unit into unit_name from public.profiles where id=auth.uid() and role_id is not null;
  if unit_name is null then raise exception 'Assigned profile required' using errcode='42501'; end if;
  if p_action not in ('Login','Logout','Session Expired') or p_action is null then raise exception 'Unsupported access action'; end if;
  perform public.append_surveillance_event(p_action,'session',null,'{}',unit_name,'access');
end;
$$;

create or replace function public.list_audit_events(p_offset integer default 0,p_limit integer default 50,
  p_category text default null,p_search text default null,p_own boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor public.profiles; permission text; result jsonb;
begin
  p_own:=coalesce(p_own,false);
  select * into actor from public.profiles where id=auth.uid();
  select grants->>'audit' into permission from public.roles where id=actor.role_id;
  if actor.id is null or permission is null or (not p_own and permission not in ('view','full-access')) then
    raise exception 'Audit viewing permission required' using errcode='42501'; end if;
  if p_offset is null or p_limit is null or p_offset<0 or p_limit not between 1 and 100 then raise exception 'Invalid page'; end if;
  with permitted as (
    select e.* from public.audit_events e where
      (case when p_own then e.actor_id=actor.id else permission='full-access' or e.affected_unit=actor.assigned_unit end)
      and (p_category is null or e.category=p_category)
      and (coalesce(p_search,'')='' or strpos(lower(e.actor_name||' '||e.actor_email||' '||e.action||' '||e.affected_unit||' '||e.details::text),lower(p_search))>0)
  ), page as (select * from permitted order by happened_at desc,id desc offset p_offset limit p_limit)
  select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((select jsonb_agg(
    jsonb_build_object('id',id::text,'timestamp',happened_at,'actorName',actor_name,'email',actor_email,
      'role',role_label,'unit',affected_unit,'category',category,'action',action,'entityType',entity_type,'entityId',entity_id,'details',details)
    order by happened_at desc,id desc) from page),'[]'::jsonb)) into result;
  return result;
end;
$$;

create or replace function public.surveillance_date(p_value text)
returns date language plpgsql immutable set search_path='' as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p_value::date;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end;
$$;

create or replace function public.record_field_permissions(p_edit boolean default false)
returns text[] language plpgsql stable security definer set search_path='' as $$
declare permissions jsonb; result text[]:=array[]::text[];
begin
  select r.grants into permissions from public.profiles p join public.roles r on r.id=p.role_id where p.id=auth.uid();
  if permissions is null then return result; end if;
  if (case when p_edit then permissions->>'demographics' in ('create-edit-view','edit-view','full-access')
    else permissions->>'demographics' in ('create-edit-view','edit-view','view','full-access') end) then
    result:=result||array['CASE ID','RANK','OS','SURNAME','FIRST NAME','MIDDLE NAME','SEX','AGE','PROVINCE'];
  end if;
  if (case when p_edit then permissions->>'clinicalLab' in ('create-edit-view','edit-view','full-access')
    else permissions->>'clinicalLab' in ('create-edit-view','edit-view','view','full-access') end) then
    result:=result||array['RP DATE','RP UNIT','DISEASE','CASE CL','DS DATE'];
  end if;
  return result;
end;
$$;

create or replace function public.list_surveillance_records(p_offset integer default 0,p_limit integer default 50,
  p_search text default null,p_import_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.profiles; readable text[]; editable text[]; result jsonb;
begin
  select * into actor from public.profiles where id=auth.uid();
  if actor.id is null or actor.role_id is null or actor.role_id='hseu-analyst' then
    raise exception 'Patient record access required' using errcode='42501'; end if;
  if p_offset is null or p_limit is null or p_offset<0 or p_limit not between 1 and 100 then raise exception 'Invalid page'; end if;
  readable:=public.record_field_permissions(false); editable:=public.record_field_permissions(true);
  if cardinality(readable)=0 then raise exception 'Patient record access required' using errcode='42501'; end if;
  with permitted as (
    select r.id,r.import_id,r.sheet_name,r.excel_row,r.version,r.updated_at,i.assigned_unit,i.workbook->>'filename' filename,
      (select jsonb_object_agg(k,v) from jsonb_each(r.record_data) as c(k,v) where k=any(readable)) as data
    from public.surveillance_records r join public.surveillance_imports i on i.id=r.import_id
    where (actor.role_id='it-personnel' or i.assigned_unit=actor.assigned_unit) and (p_import_id is null or i.id=p_import_id)
  ), filtered as (select * from permitted where coalesce(p_search,'')='' or strpos(lower(data::text),lower(p_search))>0),
  page as (select * from filtered order by id desc offset p_offset limit p_limit)
  select jsonb_build_object('total',(select count(*) from filtered),'headers',to_jsonb(readable),'editableHeaders',to_jsonb(editable),
    'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'importId',import_id,'sheet',sheet_name,'excelRow',excel_row,
      'version',version,'updatedAt',updated_at,'assignedUnit',assigned_unit,'filename',filename,'data',data) order by id desc) from page),'[]'::jsonb)) into result;
  perform public.append_surveillance_event('View Records','records',null,
    jsonb_build_object('returned',jsonb_array_length(result->'rows'),'offset',p_offset),actor.assigned_unit);
  return result;
end;
$$;

create or replace function public.update_surveillance_record(p_id bigint,p_patch jsonb,p_expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare actor public.profiles; rec public.surveillance_records; source public.surveillance_imports;
  editable text[]; k text; v jsonb; revised jsonb; checked jsonb; sheet_index integer; column_index integer;
  expected text[]:=array['CASE ID','RP DATE','RP UNIT','RANK','OS','SURNAME','FIRST NAME','MIDDLE NAME','SEX','AGE','DISEASE','CASE CL','DS DATE','PROVINCE'];
begin
  select * into actor from public.profiles where id=auth.uid();
  if actor.id is null or actor.role_id is null or actor.role_id='hseu-analyst' then raise exception 'Record edit permission required' using errcode='42501'; end if;
  -- Always lock the parent first, serializing edits and deletion for the same workbook.
  select i.* into source from public.surveillance_imports i join public.surveillance_records r on r.import_id=i.id where r.id=p_id for update of i;
  if source.id is null or (actor.role_id<>'it-personnel' and source.assigned_unit<>actor.assigned_unit) then
    raise exception 'Record is unavailable for your assigned unit' using errcode='42501'; end if;
  select * into rec from public.surveillance_records where id=p_id for update;
  if p_expected_version is null or rec.version<>p_expected_version then raise exception 'This record changed. Refresh the records and reopen it before saving.' using errcode='40001'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Changes must be an object'; end if;
  editable:=public.record_field_permissions(true); revised:=source.workbook;
  select ordinality::integer-1 into sheet_index from jsonb_array_elements(revised->'sheets') with ordinality where value->>'name'=rec.sheet_name;
  if sheet_index is null then raise exception 'Source worksheet was not found'; end if;
  for k,v in select * from jsonb_each(p_patch) loop
    if not k=any(editable) then raise exception 'You cannot edit field %',k using errcode='42501'; end if;
    if jsonb_typeof(v) not in ('string','number','boolean','null') or length(v::text)>2000 then raise exception 'Invalid value for %',k; end if;
    if public.surveillance_cell_missing(v) then v:='null'; end if;
    if k in ('RP DATE','DS DATE') and v<>'null' and public.surveillance_date(v#>>'{}') is null then raise exception '% must be a valid YYYY-MM-DD date',k; end if;
    if k='AGE' and v<>'null' then
      if (v#>>'{}') !~ '^\d{1,3}$' then raise exception 'AGE must be an integer from 0 to 130'; end if;
      if (v#>>'{}')::integer>130 then raise exception 'AGE must be an integer from 0 to 130'; end if;
    end if;
    column_index:=array_position(expected,k)-1;
    revised:=jsonb_set(revised,array['sheets',sheet_index::text,'rows',(rec.excel_row-1)::text,column_index::text],v,false);
    rec.record_data:=jsonb_set(rec.record_data,array[k],v,false);
  end loop;
  if not exists(select 1 from jsonb_each(rec.record_data) c where not public.surveillance_cell_missing(c.value)) then
    raise exception 'A record must retain at least one value. Clearing an entire record is not an edit.';
  end if;
  if rec.record_data=(select record_data from public.surveillance_records where id=p_id) then return; end if;
  checked:=public.check_surveillance_workbook(revised);
  if checked->'validation'->>'status'='error' then raise exception 'The edit would invalidate the workbook structure'; end if;
  update public.surveillance_records set record_data=rec.record_data,version=version+1,updated_at=clock_timestamp() where id=p_id;
  update public.surveillance_imports set workbook=revised,validation=checked->'validation' where id=source.id;
end;
$$;

-- Public callers can only read through policies/RPCs; all mutations are guarded above.
revoke insert,update,delete on public.surveillance_records from public,anon,authenticated;

create or replace function public.build_surveillance_analytics(p_from date,p_to date,p_disease text,p_province text,p_unit text,p_export boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor public.profiles; permission text; result jsonb;
begin
  select * into actor from public.profiles where id=auth.uid();
  select grants->>'surveillance' into permission from public.roles where id=actor.role_id;
  if actor.id is null or permission is null or permission not in ('view','full-access') then
    raise exception 'Surveillance viewing permission required' using errcode='42501'; end if;
  if p_from>p_to then raise exception 'Start date must be on or before end date'; end if;
  with scoped as (
    select r.record_data d,i.assigned_unit,
      public.surveillance_date(r.record_data->>'RP DATE') report_date,
      coalesce(nullif(upper(btrim(r.record_data->>'DISEASE')),''),'(missing)') disease,
      coalesce(nullif(upper(btrim(r.record_data->>'PROVINCE')),''),'(missing)') province,
      coalesce(nullif(upper(btrim(r.record_data->>'CASE CL')),''),'(missing)') classification
    from public.surveillance_records r join public.surveillance_imports i on i.id=r.import_id
    where actor.role_id='it-personnel' or i.assigned_unit=actor.assigned_unit
  ), filtered as (
    select * from scoped where (p_from is null or report_date>=p_from) and (p_to is null or report_date<=p_to)
      and (p_disease is null or disease=p_disease) and (p_province is null or province=p_province)
      and (p_unit is null or assigned_unit=p_unit)
  ), stats as (
    select count(*) total,count(distinct disease) filter(where disease<>'(missing)') diseases,
      count(*) filter(where classification='CONFIRMED') confirmed,
      count(*) filter(where report_date is null) undated,max(report_date) latest,
      count(*) filter(where exists(select 1 from jsonb_each(d) c where public.surveillance_cell_missing(c.value))) missing
    from filtered
  ), weeks as (
    select count(*) filter(where f.report_date>=date_trunc('week',s.latest)::date) current_count,
      count(*) filter(where f.report_date>=date_trunc('week',s.latest)::date-7 and f.report_date<date_trunc('week',s.latest)::date) previous_count
    from filtered f cross join stats s
  ), diseases as (select disease name,count(*) count from filtered group by disease),
  provinces as (select province name,count(*) count from filtered group by province),
  units as (select assigned_unit name,count(*) count from filtered group by assigned_unit),
  trend as (select date_trunc('week',report_date)::date week,disease,count(*) count from filtered where report_date is not null group by 1,2),
  export_data as (
    select coalesce(date_trunc('week',report_date)::date::text,'Unknown') as "Reporting Week", disease as "Disease",province as "Province",
      assigned_unit as "Assigned Unit",coalesce(nullif(upper(btrim(d->>'RP UNIT')),''),'(missing)') as "Reporting Unit",
      classification as "Classification",coalesce(nullif(upper(btrim(d->>'SEX')),''),'(missing)') as "Sex",
      case when d->>'AGE' ~ '^\d{1,3}$' then case when (d->>'AGE')::integer<=130 then
        ((d->>'AGE')::integer/5*5)::text||'-'||((d->>'AGE')::integer/5*5+4)::text else 'Unknown' end else 'Unknown' end as "Age Band",
      count(*) as "Cases" from filtered where p_export group by 1,2,3,4,5,6,7,8
  )
  select jsonb_build_object('totalRecords',s.total,'distinctDiseases',s.diseases,'confirmedCases',s.confirmed,
    'missingValueRecords',s.missing,'undatedRecords',s.undated,'latestReportDate',s.latest,
    'currentWeekCount',w.current_count,'previousWeekCount',w.previous_count,
    'weeklyChange',round((w.current_count-w.previous_count)*100.0/nullif(w.previous_count,0),1),
    'byDisease',coalesce((select jsonb_agg(to_jsonb(d) order by count desc,name) from diseases d),'[]'),
    'byProvince',coalesce((select jsonb_agg(to_jsonb(p) order by count desc,name) from provinces p),'[]'),
    'byUnit',coalesce((select jsonb_agg(to_jsonb(u) order by count desc,name) from units u),'[]'),
    'trend',coalesce((select jsonb_agg(to_jsonb(t) order by week,disease) from trend t),'[]'),
    'options',jsonb_build_object('diseases',coalesce((select jsonb_agg(disease order by disease) from (select distinct disease from scoped) o),'[]'),
      'provinces',coalesce((select jsonb_agg(province order by province) from (select distinct province from scoped) o),'[]'),
      'units',coalesce((select jsonb_agg(assigned_unit order by assigned_unit) from (select distinct assigned_unit from scoped) o),'[]')),
    'exportRows',case when p_export then coalesce((select jsonb_agg(to_jsonb(e) order by "Reporting Week","Disease","Province","Assigned Unit","Reporting Unit","Classification","Sex","Age Band") from export_data e),'[]') else '[]'::jsonb end)
    into result from stats s cross join weeks w;
  return result;
end;
$$;

create or replace function public.get_surveillance_analytics(p_from date default null,p_to date default null,
  p_disease text default null,p_province text default null,p_unit text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; source_unit text;
begin
  result:=public.build_surveillance_analytics(p_from,p_to,p_disease,p_province,p_unit,false);
  select assigned_unit into source_unit from public.profiles where id=auth.uid();
  perform public.append_surveillance_event('View Analytics','analytics',null,jsonb_build_object('records',result->'totalRecords'),source_unit);
  return result;
end;
$$;

create or replace function public.export_surveillance_analytics(p_from date default null,p_to date default null,
  p_disease text default null,p_province text default null,p_unit text default null,p_format text default 'csv')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; source_unit text;
begin
  if not exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=auth.uid() and r.grants->>'surveillance'='full-access') then
    raise exception 'Full surveillance access required to export' using errcode='42501'; end if;
  if p_format not in ('csv','xlsx') or p_format is null then raise exception 'Unsupported export format'; end if;
  result:=public.build_surveillance_analytics(p_from,p_to,p_disease,p_province,p_unit,true);
  select assigned_unit into source_unit from public.profiles where id=auth.uid();
  perform public.append_surveillance_event('Export','analytics',null,jsonb_build_object('format',p_format,'records',result->'totalRecords',
    'groups',jsonb_array_length(result->'exportRows'),'from',p_from,'to',p_to,'disease',p_disease,'province',p_province,'unit',p_unit),source_unit);
  return result->'exportRows';
end;
$$;

create index if not exists surveillance_records_disease on public.surveillance_records((upper(btrim(record_data->>'DISEASE'))));

revoke all on function public.append_surveillance_event(text,text,text,jsonb,text,text),public.audit_surveillance_import(),
  public.audit_surveillance_record_edit(),public.audit_surveillance_profile(),public.record_access_event(text),
  public.list_audit_events(integer,integer,text,text,boolean),public.surveillance_date(text),public.record_field_permissions(boolean),
  public.list_surveillance_records(integer,integer,text,uuid),public.update_surveillance_record(bigint,jsonb,integer),
  public.build_surveillance_analytics(date,date,text,text,text,boolean),public.get_surveillance_analytics(date,date,text,text,text),
  public.export_surveillance_analytics(date,date,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_access_event(text),public.list_audit_events(integer,integer,text,text,boolean),
  public.list_surveillance_records(integer,integer,text,uuid),public.update_surveillance_record(bigint,jsonb,integer),
  public.get_surveillance_analytics(date,date,text,text,text),public.export_surveillance_analytics(date,date,text,text,text,text) to authenticated;
commit;
