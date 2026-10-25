// Load the actual browser parser for Node-based checks without a second parser implementation.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const typesUrl = moduleUrl(compile('../../src/data/excelTypes.ts'));
const excelSource = compile('../../src/data/excel.ts')
  .replace("from 'xlsx'", `from ${JSON.stringify(pathToFileURL(require.resolve('xlsx')).href)}`)
  .replace("from './excelTypes'", `from ${JSON.stringify(typesUrl)}`)
  .replace("from './workbook'", `from ${JSON.stringify(new URL('../../shared/standardizedWorkbook.js', import.meta.url).href)}`);

export const { parseExcelFile } = await import(moduleUrl(excelSource));
