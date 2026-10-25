import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { validateWorkbook, UPLOAD_HEADERS } from '../shared/standardizedWorkbook.js';
import { parseExcelFile } from './lib/browser-excel.mjs';

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`);
await db.exec(readFileSync(new URL('../supabase/migrations/202610250001_surveillance_imports.sql', import.meta.url), 'utf8'));
const migration = readFileSync(new URL('../supabase/migrations/202610250002_direct_supabase.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec(migration); // The follow-up migration can be rerun without losing data.
const liveMigration = readFileSync(new URL('../supabase/migrations/202610250003_analytics_editing_audit.sql', import.meta.url), 'utf8');
await db.exec(liveMigration);
await db.exec(liveMigration);
after(() => db.close());

const roles = ['admin-clerk', 'medtech', 'radtech', 'physical-therapist', 'nurse', 'medical-officer', 'hseu-analyst', 'it-personnel'];
const accountEmails = ['admin_clerk_test@email.com','medtech_test@email.com','radtech_test@email.com','physical_therapist_test@email.com','nurse_test@email.com','medical_officer_test@email.com','hseu_analyst_test@email.com','it_personnel_test@email.com'];
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const users = Object.fromEntries(roles.map((role, i) => [role, uid(i + 1)]));
for (const [i, role] of roles.entries()) {
  await db.query('insert into auth.users(id,email) values ($1,$2)', [uid(i + 1), accountEmails[i]]);
  await db.query(`insert into public.profiles(id,full_name,email,assigned_unit,role_label,role_id,can_upload)
    select $1,$2,$3,'Unit A',label,id,false from public.roles where id=$4`, [uid(i + 1), role, `${role}@example.test`, role]);
}
for (const n of [9, 10, 11]) await db.query('insert into auth.users(id) values ($1)', [uid(n)]);
await db.query(`insert into public.profiles(id,full_name,email,assigned_unit,role_label,role_id,can_upload)
  values ($1,'Other unit','other@example.test','Unit B','Medical Technologist','medtech',true),
         ($2,'Unassigned','unassigned@example.test','Unit A','No role',null,true)`, [uid(9), uid(10)]);

async function asUser(id, action) {
  return db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);
    await tx.exec('set local role authenticated');
    return action(tx);
  });
}
const row = ['26-001','2026-10-25','ER','SSG','PA','Example','Test','Q','M','30','Dengue','PROBABLE','2026-10-24','CEBU'];
const makeBook = (rows = [UPLOAD_HEADERS, row]) => ({ filename: 'test.xlsx', sheets: [{ name: 'Data', rowCount: rows.length, columnCount: rows[0]?.length ?? 0, rows: rows.map(cells => [...cells]) }] });
const save = (id, book, importId) => asUser(id, tx => tx.query('select public.save_surveillance_workbook($1,$2::jsonb,null)', [importId, JSON.stringify(book)]));
const history = id => asUser(id, async tx => (await tx.query('select * from public.list_surveillance_imports()')).rows);

test('database validation agrees with the browser on every finalized workbook', async () => {
  for (const filename of readdirSync(new URL('../sample-data/samples/', import.meta.url))) {
    if (!filename.endsWith('.xlsx')) continue;
    const book = await parseExcelFile(new File([readFileSync(new URL(`../sample-data/samples/${filename}`, import.meta.url))], filename));
    const js = validateWorkbook(book);
    const result = (await db.query('select public.check_surveillance_workbook($1::jsonb) as checked', [JSON.stringify(book)])).rows[0].checked.validation;
    for (const key of ['status', 'recordCount', 'missingCount']) assert.equal(result[key], js[key], `${filename}: ${key}`);
  }
});

test('database ignores forged status, rejects bad headers, and retains interior empty rows', async () => {
  const blank = Array(14).fill(null);
  for (const book of [makeBook(), makeBook([UPLOAD_HEADERS, row, blank, row, blank]), makeBook([UPLOAD_HEADERS]),
    makeBook([UPLOAD_HEADERS.map(h => ` ${h.toLowerCase()} `), row]),
    makeBook([UPLOAD_HEADERS.map((h,i) => i === 2 ? 'WRONG' : h), row]),
    makeBook([[...UPLOAD_HEADERS].reverse(), row]), makeBook([UPLOAD_HEADERS.map((h,i) => i === 2 ? 'CASE ID' : h), row])]) {
    const result = (await db.query('select public.check_surveillance_workbook($1::jsonb) as checked', [JSON.stringify({ ...book, validation: { status: 'complete' } })])).rows[0].checked.validation;
    const js = validateWorkbook(book);
    for (const key of ['status','recordCount','missingCount']) assert.equal(result[key], js[key]);
  }
  const malformed = makeBook(); malformed.sheets[0].rows[1][1] = { unexpected: true };
  await assert.rejects(db.query('select public.check_surveillance_workbook($1::jsonb)', [JSON.stringify(malformed)]), /Unsupported cell/);
});

test('all upload roles can save; database derives identity and unit from their profile', async () => {
  for (const role of ['medtech','radtech','physical-therapist','nurse','it-personnel']) await save(users[role], makeBook(), uid(100 + roles.indexOf(role)));
  const stored = (await db.query('select * from public.surveillance_imports where id=$1', [uid(104)])).rows[0];
  assert.equal(stored.assigned_unit, 'Unit A');
  assert.equal(stored.uploader.fullName, 'nurse');
  assert.equal(stored.status, 'complete');
  assert.equal((await db.query('select count(*)::int n from public.surveillance_records where import_id=$1', [uid(104)])).rows[0].n, 1);
});

test('upload is denied to clerks, doctors, analysts, unassigned profiles and anonymous callers', async () => {
  for (const id of [users['admin-clerk'], users['medical-officer'], users['hseu-analyst'], uid(10), uid(11), null]) {
    await assert.rejects(save(id, makeBook(), uid(200)), /Upload permission/);
  }
});

test('unit staff share unit imports; other units cannot read them; IT can read all units', async () => {
  await save(uid(9), makeBook(), uid(300));
  const unitA = await history(users.medtech);
  assert.equal(unitA.length, 5);
  assert.ok(unitA.some(entry => entry.uploader.fullName === 'nurse'));
  assert.equal((await history(uid(9))).length, 1);
  assert.equal((await history(users['it-personnel'])).length, 6);
  assert.equal((await history(users['admin-clerk'])).length, 0);
  const direct = await asUser(uid(9), tx => tx.query('select id from public.surveillance_imports where assigned_unit=$1', ['Unit A']));
  assert.equal(direct.rows.length, 0);
  const records = await asUser(uid(9), tx => tx.query('select * from public.surveillance_records'));
  assert.equal(records.rows.length, 1);
});

test('analysts receive unit error metadata without patient rows or direct table access', async () => {
  const missing = [...row]; missing[7] = null;
  await save(users.nurse, makeBook([UPLOAD_HEADERS, missing]), uid(400));
  await save(users.nurse, makeBook([['Wrong','Columns'], ['a','b']]), uid(401));
  const errors = await history(users['hseu-analyst']);
  assert.equal(errors.length, 2);
  assert.ok(errors.every(entry => entry.metadata_only && entry.workbook.sheets.length === 0));
  const direct = await asUser(users['hseu-analyst'], tx => tx.query('select * from public.surveillance_imports'));
  assert.equal(direct.rows.length, 0);
  const patientRows = await asUser(users['hseu-analyst'], tx => tx.query('select * from public.surveillance_records'));
  assert.equal(patientRows.rows.length, 0);
  const invalidRecords = (await db.query('select count(*)::int n from public.surveillance_records where import_id=$1', [uid(401)])).rows[0].n;
  assert.equal(invalidRecords, 0);
});

test('old trusted-client RPC and direct mutations are disabled; only IT can delete', async () => {
  await assert.rejects(asUser(users.nurse, tx => tx.query("select public.save_surveillance_import($1,'{}','{}','[]')", [uid(500)])), /permission denied/);
  await assert.rejects(asUser(users.nurse, tx => tx.query('delete from public.surveillance_imports where id=$1', [uid(104)])), /permission denied/);
  await assert.rejects(asUser(users.nurse, tx => tx.query('select public.delete_surveillance_import($1)', [uid(104)])), /Full system access/);
  await asUser(users['it-personnel'], tx => tx.query('select public.delete_surveillance_import($1)', [uid(104)]));
  assert.equal((await db.query('select count(*)::int n from public.surveillance_records where import_id=$1', [uid(104)])).rows[0].n, 0);
});

test('users can update their name, but cannot escalate roles, change unit or edit permissions', async () => {
  await asUser(users.nurse, tx => tx.query("select public.update_my_profile('Nurse Updated')"));
  assert.equal((await db.query('select full_name from public.profiles where id=$1', [users.nurse])).rows[0].full_name, 'Nurse Updated');
  await assert.rejects(asUser(users.nurse, tx => tx.query("update public.profiles set role_id='it-personnel' where id=$1", [users.nurse])), /permission denied/);
  await assert.rejects(asUser(users.nurse, tx => tx.query("update public.profiles set assigned_unit='Unit B' where id=$1", [users.nurse])), /permission denied/);
  await assert.rejects(asUser(users.nurse, tx => tx.query("update public.roles set grants='{}'")), /permission denied/);
});

test('profile provisioning script requires assigned units and provisions all eight known accounts', async () => {
  const script = readFileSync(new URL('../supabase/setup-test-profiles.sql', import.meta.url), 'utf8');
  const invalid = script.replace("unit_name text := 'Victoriano Luna Medical Center'", "unit_name text := 'REPLACE_WITH_ASSIGNED_UNIT'");
  await assert.rejects(db.exec(invalid), /assigned-unit placeholders/);
  const missingAccount = script.replace('admin_clerk_test@email.com', 'not-created@example.test');
  await assert.rejects(db.exec(missingAccount), /Missing Authentication accounts: not-created@example\.test/);
  await db.exec(script);
  await db.exec(script); // Re-running the self-contained block updates the same profiles.
  for (const [i, role] of roles.entries()) {
    const profile = (await db.query('select role_id,email,assigned_unit from public.profiles where id=$1', [uid(i + 1)])).rows[0];
    assert.equal(profile.role_id, role);
    assert.equal(profile.email, accountEmails[i]);
    assert.equal(profile.assigned_unit, 'Victoriano Luna Medical Center');
  }
});

const liveUsers = { nurse: uid(20), clerk: uid(21), doctor: uid(22), analyst: uid(23), medtech: uid(24) };
const liveImport = uid(600);
let liveRecordId;
const analytics = (id, from=null, to=null, disease=null, province=null, unit=null) => asUser(id, async tx =>
  (await tx.query('select public.get_surveillance_analytics($1,$2,$3,$4,$5) as data', [from,to,disease,province,unit])).rows[0].data);

test('analytics uses all scoped records, real report weeks, filters and missing-date counts', async () => {
  for (const [role,id] of Object.entries(liveUsers)) {
    const roleId = { clerk:'admin-clerk', doctor:'medical-officer', analyst:'hseu-analyst' }[role] ?? role;
    await db.query('insert into auth.users(id,email) values($1,$2)', [id,`${role}-live@example.test`]);
    await db.query(`insert into public.profiles(id,full_name,email,assigned_unit,role_label,role_id)
      select $1,$2,$3,'Live Unit',label,id from public.roles where id=$4`, [id,`${role} Live`,`${role}-live@example.test`,roleId]);
  }
  const first=[...row]; first[1]='2026-10-05'; first[11]='CONFIRMED';
  const second=[...row]; second[0]='26-002'; second[1]='2026-10-12';
  const third=[...row]; third[0]='26-003'; third[1]=null; third[7]=null; third[10]='Influenza'; third[11]='CONFIRMED'; third[13]='DAVAO';
  await save(liveUsers.nurse,makeBook([UPLOAD_HEADERS,first,second,third]),liveImport);
  const fourth=[...row]; fourth[0]='26-004'; fourth[1]='2026-10-13'; fourth[10]='Influenza'; fourth[11]='CONFIRMED';
  await save(liveUsers.nurse,makeBook([UPLOAD_HEADERS,fourth]),uid(601));
  await save(liveUsers.nurse,makeBook([['Wrong','Columns'],['a','b']]),uid(602));
  const result=await analytics(liveUsers.analyst);
  assert.equal(result.totalRecords,4); assert.equal(result.distinctDiseases,2); assert.equal(result.confirmedCases,3);
  assert.equal(result.undatedRecords,1); assert.equal(result.missingValueRecords,1);
  assert.equal(result.currentWeekCount,2); assert.equal(result.previousWeekCount,1); assert.equal(result.weeklyChange,100);
  assert.equal(result.latestReportDate,'2026-10-13'); assert.deepEqual(result.options.units,['Live Unit']);
  assert.equal((await analytics(liveUsers.clerk,'2026-10-12','2026-10-13')).totalRecords,2);
  assert.equal((await analytics(liveUsers.doctor,null,null,'DENGUE','CEBU')).totalRecords,2);
  assert.equal((await analytics(liveUsers.analyst,null,null,null,null,'Unit B')).totalRecords,0);
  await assert.rejects(analytics(liveUsers.medtech), /Surveillance viewing permission/);
  await assert.rejects(analytics(liveUsers.nurse,'2026-10-13','2026-10-01'), /Start date/);
});

test('record pagination and search honor field access; analysts cannot fetch patient rows', async () => {
  const page=await asUser(liveUsers.clerk,async tx => (await tx.query('select public.list_surveillance_records(0,2,null,null) as data')).rows[0].data);
  assert.equal(page.total,4); assert.equal(page.rows.length,2);
  assert.ok(!page.headers.includes('DISEASE')); assert.ok(!('DISEASE' in page.rows[0].data));
  assert.ok(page.editableHeaders.includes('SURNAME'));
  const search=await asUser(liveUsers.clerk,async tx => (await tx.query("select public.list_surveillance_records(0,50,'Dengue',null) as data")).rows[0].data);
  assert.equal(search.total,0,'Restricted clinical values must not influence clerk search results');
  const tech=await asUser(liveUsers.medtech,async tx => (await tx.query('select public.list_surveillance_records(0,50,null,null) as data')).rows[0].data);
  assert.ok(tech.headers.includes('SURNAME')); assert.ok(!tech.editableHeaders.includes('SURNAME')); assert.ok(tech.editableHeaders.includes('DISEASE'));
  await assert.rejects(asUser(liveUsers.analyst,tx => tx.query('select public.list_surveillance_records()')), /Patient record access/);
  await assert.rejects(asUser(liveUsers.nurse,tx => tx.query('select public.list_surveillance_records(0,null,null,null)')), /Invalid page/);
  liveRecordId=(await db.query('select id::text from public.surveillance_records where import_id=$1 order by excel_row limit 1',[liveImport])).rows[0].id;
});

test('edits enforce field permissions, unit scope, valid values and optimistic concurrency', async () => {
  const edit=(user,patch,version=1)=>asUser(user,tx=>tx.query('select public.update_surveillance_record($1,$2::jsonb,$3)',[liveRecordId,JSON.stringify(patch),version]));
  await assert.rejects(edit(liveUsers.medtech,{'SURNAME':'Unauthorized'}), /cannot edit field SURNAME/);
  await assert.rejects(edit(liveUsers.clerk,{'DISEASE':'Unauthorized'}), /cannot edit field DISEASE/);
  await assert.rejects(edit(uid(9),{'DISEASE':'Other unit'}), /unavailable for your assigned unit/);
  await assert.rejects(edit(liveUsers.nurse,{'UNKNOWN':'x'}), /cannot edit field/);
  await assert.rejects(edit(liveUsers.nurse,{'RP DATE':'2026-02-31'}), /valid YYYY-MM-DD/);
  await assert.rejects(edit(liveUsers.nurse,{'AGE':'200'}), /AGE must be/);
  await assert.rejects(edit(liveUsers.nurse,Object.fromEntries(UPLOAD_HEADERS.map(h=>[h,null]))), /retain at least one value/);
  await edit(liveUsers.medtech,{'DISEASE':'Changed Condition'});
  await assert.rejects(edit(liveUsers.nurse,{'SURNAME':'Stale edit'}), /This record changed/);
  const saved=(await db.query('select record_data,version from public.surveillance_records where id=$1',[liveRecordId])).rows[0];
  assert.equal(saved.record_data.DISEASE,'Changed Condition'); assert.equal(saved.version,2);
  const source=(await db.query('select workbook from public.surveillance_imports where id=$1',[liveImport])).rows[0].workbook;
  assert.equal(source.sheets[0].rows[1][10],'Changed Condition');
  assert.ok((await analytics(liveUsers.analyst)).byDisease.some(d=>d.name==='CHANGED CONDITION'&&d.count===1));
});

test('fixing missing values updates workbook validation and aggregate quality counts atomically', async () => {
  const id=(await db.query('select id::text from public.surveillance_records where import_id=$1 and excel_row=4',[liveImport])).rows[0].id;
  await asUser(liveUsers.nurse,tx=>tx.query('select public.update_surveillance_record($1,$2,1)',[id,JSON.stringify({'MIDDLE NAME':'Q','RP DATE':'2026-10-14'})]));
  const source=(await db.query('select status,validation,workbook from public.surveillance_imports where id=$1',[liveImport])).rows[0];
  assert.equal(source.status,'complete'); assert.equal(source.validation.missingCount,0);
  assert.equal(source.workbook.sheets[0].rows[3][7],'Q');
  assert.equal((await analytics(liveUsers.nurse)).missingValueRecords,0);
});

test('aggregate exports require full surveillance access and never return direct identifiers', async () => {
  await assert.rejects(asUser(liveUsers.doctor,tx=>tx.query('select public.export_surveillance_analytics()')), /Full surveillance access/);
  const exported=await asUser(liveUsers.analyst,async tx=>(await tx.query('select public.export_surveillance_analytics() as rows')).rows[0].rows);
  assert.equal(exported.reduce((sum,r)=>sum+r.Cases,0),4);
  for(const item of exported) for(const key of ['CASE ID','SURNAME','FIRST NAME','MIDDLE NAME','RANK','OS']) assert.ok(!(key in item));
  assert.ok(exported.every(r=>typeof r['Age Band']==='string'));
});

test('durable audit events record trusted actors and mutations without copied patient values', async () => {
  await asUser(liveUsers.nurse,tx=>tx.query("select public.record_access_event('Login')"));
  await assert.rejects(asUser(liveUsers.nurse,tx=>tx.query("select public.record_access_event('Forged')")), /Unsupported access action/);
  await assert.rejects(asUser(liveUsers.nurse,tx=>tx.query("select public.append_surveillance_event('Edit','record','1','{}','Other Unit','audit')")), /permission denied/);
  const own=await asUser(liveUsers.medtech,async tx=>(await tx.query('select public.list_audit_events(0,50,null,null,true) as data')).rows[0].data);
  const changed=own.rows.find(e=>e.action==='Edit Record');
  assert.equal(changed.email,'medtech-live@example.test'); assert.equal(changed.unit,'Live Unit');
  assert.deepEqual(changed.details.changedFields,['DISEASE']);
  assert.ok(!JSON.stringify(changed.details).includes('Changed Condition'));
  await assert.rejects(asUser(liveUsers.medtech,tx=>tx.query('select public.list_audit_events()')), /Audit viewing permission/);
  await assert.rejects(asUser(liveUsers.medtech,tx=>tx.query('select public.list_audit_events(0,50,null,null,null)')), /Audit viewing permission/);
  await assert.rejects(asUser(liveUsers.doctor,tx=>tx.query('select public.list_audit_events(0,null,null,null,false)')), /Invalid page/);
  const doctor=await asUser(liveUsers.doctor,async tx=>(await tx.query('select public.list_audit_events() as data')).rows[0].data);
  assert.ok(doctor.rows.length>0&&doctor.rows.every(e=>e.unit==='Live Unit'));
  const direct=await asUser(liveUsers.medtech,tx=>tx.query('select * from public.audit_events'));
  assert.equal(direct.rows.length,0);
  await assert.rejects(asUser(users['it-personnel'],tx=>tx.query('delete from public.audit_events')), /permission denied/);
  await assert.rejects(asUser(users['it-personnel'],tx=>tx.query("update public.audit_events set actor_name='fake'")), /permission denied/);
});
