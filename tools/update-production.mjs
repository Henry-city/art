import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const core = require('../production-core.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = path.join(root, 'assets/production/data.js');
const match = fs.readFileSync(dataFile, 'utf8').match(/^window\.PRODUCTION_DATA\s*=\s*([\s\S]+);\s*$/);
if (!match) throw new Error('Cannot read assets/production/data.js');
const data = core.validate(JSON.parse(match[1]));
const args = process.argv.slice(2);
if (!['--record','--import'].includes(args[0]) || !args[1]) {
  console.log('node tools/update-production.mjs --record daily.json [--replace]\nnode tools/update-production.mjs --import production-backup.json');
  process.exit(1);
}
const input = JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8'));
let next;
if (args[0] === '--import') next = core.merge(data, input);
else {
  const existing = data.records.find(r => r.date === input.date);
  if (existing && !args.includes('--replace')) throw new Error('Date already exists. Use --replace to update that day.');
  const record = {
    date: input.date,
    highStandardAdded: input.highStandardAdded,
    codeAdded: input.codeAdded,
    gptUsdUnits: core.decimalUnits(input.gptUsd, 4),
    claudeCnyFen: core.decimalUnits(input.claudeCny, 2),
    accountCount: input.accountCount,
    note: input.note || '',
    thumbnails: input.thumbnails ?? existing?.thumbnails ?? [],
    sheets: input.sheets ?? existing?.sheets ?? []
  };
  next = core.upsert(data, record);
}
// Validate the complete ledger before touching the source. Keep the previous
// version in a local, ignored backup folder for accidental-entry recovery.
const backupDir = path.join(root, '.production-backups');
fs.mkdirSync(backupDir, {recursive:true});
fs.copyFileSync(dataFile, path.join(backupDir, 'data-' + new Date().toISOString().replaceAll(':','-') + '.js'));
const temporary = dataFile + '.tmp';
fs.writeFileSync(temporary, 'window.PRODUCTION_DATA = ' + JSON.stringify(next, null, 2) + ';\n');
fs.renameSync(temporary, dataFile);
const closing = core.totals(next, next.records.at(-1)?.date || next.baseline.date);
console.log(JSON.stringify({records:next.records.length,asOf:closing.asOf,highStandard:closing.highStandard,code:closing.code,gptUsd:core.money(closing.gptUsdUnits,4),claudeCny:core.money(closing.claudeCnyFen,2)},null,2));
