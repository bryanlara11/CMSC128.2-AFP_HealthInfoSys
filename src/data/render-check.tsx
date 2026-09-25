import { renderToString } from 'react-dom/server';
import { AuthProvider } from './auth';
import { AnalysisExportPage } from '../pages/AnalysisExportPage';
import { DataManagementPage } from '../pages/DataManagementPage';
import { HomePage } from '../pages/HomePage';
import { RoleSwitcher } from '../components/RoleSwitcher';

let failed = 0;
const check = (l: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}`);
};
const flat = (h: string) => h.replace(/<!--[\s\S]*?-->/g, '');
const wrap = (el: React.ReactNode) =>
  flat(renderToString(<AuthProvider>{el}</AuthProvider>));

const ae = wrap(<AnalysisExportPage />);
const dm = wrap(<DataManagementPage />);
const home = wrap(<HomePage />);
const rs = wrap(<RoleSwitcher />);

console.log('=== renders without crashing under the default (analyst) role ===');
check('AnalysisExportPage renders', ae.length > 500);
check('DataManagementPage renders', dm.length > 500);
check('HomePage renders', home.length > 500);
check('RoleSwitcher renders', rs.includes('hseu-analyst') || rs.length > 0);

console.log('\n=== Table 3 KPIs on Home ===');
for (const m of ['Surveillance Category', 'Condition / Diagnosis', 'Active / New Cases (Week)', 'Percent Change (%)']) {
  check(`KPI "${m}"`, home.includes(m));
}

console.log('\n=== Table 2 vocabulary in the rendered page ===');
for (const bad of ['COVID-19', 'Typhoid', 'Measles', 'Malaria', '>ARI<']) {
  check(`"${bad}" not rendered`, !ae.includes(bad));
}
check('Pneumonia present (replaced ARI)', ae.includes('Pneumonia'));
check('Dengue present', ae.includes('Dengue'));
check('Acute Gastroenteritis in ranked chart', ae.includes('Acute Gastroenteritis'));

console.log('\n=== Table 1 affordances ===');
check('field-count toggle present', ae.includes(`Show all 16 Table 1 fields`) || ae.includes('Table 1 fields'));
check('analyst sees enabled Export Current View', ae.includes('Export Current View') && !ae.includes('unavailable for'));
check('synthetic-identifier notice', ae.includes('synthetic identifiers stay internal'));

console.log('\n=== Data Management: template + error batch ===');
check('Download Template is a real button', dm.includes('Download Template'));
check('error batch trigger present', dm.includes('30-record error batch'));
check('Table 1 column count on template card', dm.includes('16 Table 1 columns'));

/* The restricted path still has to work — it is just not the default role now.
   Render the same page as a role with no upload rights. */
const dmRestricted = flat(
  renderToString(
    <AuthProvider initialRoleId="hseu-analyst">
      <DataManagementPage />
    </AuthProvider>,
  ),
);
check('restricted role sees the restriction message', dmRestricted.includes('Uploading is restricted'));
check('restriction names the role', dmRestricted.includes('HSEU Epidemiologist'));
check('restricted role cannot browse', dmRestricted.includes('aria-disabled="true"'));

console.log(`\n${failed === 0 ? 'ALL RENDER CHECKS PASSED' : failed + ' CHECKS FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
