import { renderToString } from 'react-dom/server';
import { AuthProvider, DEFAULT_ROLE_ID } from './auth';
import { HomePage } from '../pages/HomePage';
import { DataManagementPage } from '../pages/DataManagementPage';
import { ActionPanel } from '../components/ActionPanel';
import { RoleSwitcher } from '../components/RoleSwitcher';
import { ROLES } from './dictionary';
import { buildWeeklyReport, ALERT_RULES, DATA_SOURCES, WEEKLY_REPORT_META } from './sample';
import type { QuickActionId } from '../components/ActionPanel';

let failed = 0;
const check = (l: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}`);
};
const flat = (h: string) => h.replace(/<!--[\s\S]*?-->/g, '');
const wrap = (el: React.ReactNode) => flat(renderToString(<AuthProvider>{el}</AuthProvider>));

/* ---- sample data sanity ---- */
console.log('=== sample data is populated and Table 2 clean ===');
check('weekly report has rows', buildWeeklyReport().length > 0);
check('weekly report totals > 0', WEEKLY_REPORT_META.totalCases > 0);
check('5 alert rules', ALERT_RULES.length === 5);
check('some rules armed', ALERT_RULES.some((r) => r.enabled));
check('5 data sources', DATA_SOURCES.length === 5);
check('sources have rows/status', DATA_SOURCES.every((s) => !!s.status && !!s.kind));
const sampleJson = JSON.stringify([buildWeeklyReport(), ALERT_RULES, DATA_SOURCES]);
for (const bad of ['COVID', 'Typhoid', 'Measles', 'Malaria', 'ARI']) {
  check(`sample data free of "${bad}"`, !sampleJson.includes(bad));
}

/* ---- default role can upload ---- */
console.log('\n=== default role grants upload + export (demo path) ===');
const def = ROLES.find((r) => r.id === DEFAULT_ROLE_ID)!;
check('default role is I.T. Personnel', def.label === 'I.T. Personnel');
check('default role can upload', def.grants.audit === 'full-access' || def.grants.audit === 'file-upload');
check('default role can export', def.grants.surveillance === 'full-access');
const dm = wrap(<DataManagementPage />);
check('upload NOT restricted for default role', !dm.includes('Uploading is restricted'));
check('Browse Files enabled', dm.includes('Browse Files') && !dm.includes('aria-disabled="true"'));
check('error batch trigger visible', dm.includes('30-record error batch'));

/* ---- every quick action panel renders ---- */
console.log('\n=== all 6 quick action panels render ===');
const ids: QuickActionId[] = ['upload', 'weekly-report', 'trends', 'sources', 'alerts', 'anonymized-export'];
for (const id of ids) {
  const h = wrap(<ActionPanel id={id} onClose={() => undefined} />);
  check(`panel "${id}" renders content`, h.length > 200);
}
const upload = wrap(<ActionPanel id="upload" onClose={() => undefined} />);
check('upload panel names the role', upload.includes('I.T. Personnel'));
check('upload panel links to Import Center', upload.includes('Open Import Center'));
const rep = wrap(<ActionPanel id="weekly-report" onClose={() => undefined} />);
check('report panel shows Epi-Week', rep.includes('Epi-Week'));
check('report panel shows conditions', rep.includes('Dengue') && rep.includes('Leptospirosis'));
check('report panel has % change column', rep.includes('% Change'));
const src = wrap(<ActionPanel id="sources" onClose={() => undefined} />);
check('sources panel lists local server', src.includes('Local server'));
check('sources panel marks aggregate DOH', src.includes('aggregate only'));
check('sources panel shows Offline for APE', src.includes('Offline'));
const al = wrap(<ActionPanel id="alerts" onClose={() => undefined} />);
check('alerts panel states no-AI rule', al.includes('no AI'));
check('alerts panel lists dengue threshold', al.includes('Dengue weekly threshold'));
const ax = wrap(<ActionPanel id="anonymized-export" onClose={() => undefined} />);
check('export panel explains column removal', ax.includes('dropped from the file entirely'));

/* ---- home page ---- */
console.log('\n=== Home page ===');
const home = wrap(<HomePage />);
check('home renders', home.length > 800);
check('all 6 action labels present', [
  'Upload Surveillance Data', 'Generate Weekly Report', 'View Disease Trends',
  'Manage Data Sources', 'Configure Alerts', 'Export Anonymized Data',
].every((l) => home.includes(l)));
check('no href="#" dead links', !home.includes('href="#"'));
check('COVID-19 gone from home', !home.includes('COVID-19'));
check('chart placeholder removed', !home.includes('Chart placeholder'));
check('recharts svg rendered on home', home.includes('<svg'));
check('role context line shown', home.includes('Acting as'));
check('role switcher renders default role', wrap(<RoleSwitcher />).includes('I.T. Personnel'));

console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECKS FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
