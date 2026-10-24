'use strict';
// TEST REPOSITORY ONLY: fail CI if any staged source points at production Firebase.
// Scan the entire tracked test tree, including every nested stage folder.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTION = 'tscms' + '-admin';
const TEST_PROJECT = PRODUCTION + '-login-test';
const TEXT_SOURCE = /\.(?:js|cjs|mjs|ts|tsx|jsx|json|html|yml|yaml|py|rules)$/i;
const FIELD = /["']?(projectId|project_id|authDomain|storageBucket|apiKey|messagingSenderId|appId)["']?\s*[:=]\s*["']([^"'\r\n]+)["']/g;
const CHECKED = new Set(['projectId','project_id','authDomain','storageBucket']);

function fields(text) {
  return new Map([...text.matchAll(FIELD)].map(m=>[m[1],m[2]]));
}

const reference = fs.readFileSync(
  path.join(ROOT, 'listening-room-stage/firebase-admin-config.js'), 'utf8');
const referenceFields = fields(reference);
const required = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
for (const name of required) assert.ok(referenceFields.get(name), 'Missing reference Firebase field '+name);
assert.equal(referenceFields.get('projectId'), TEST_PROJECT, 'Known-good reference must use TEST Firebase');

function inspectSource(source, file) {
  const problems = [];
  const kv = fields(source);
  const configFile = /(?:^|\/)firebase-admin-config\.js$/.test(file);
  for (const m of source.matchAll(FIELD)) {
    const key=m[1], value=m[2];
    if (CHECKED.has(key) && (
      value===PRODUCTION ||
      value===PRODUCTION+'.firebaseapp.com' ||
      value===PRODUCTION+'.firebasestorage.app'
    )) problems.push(file+': production Firebase '+key+' value');
    if (configFile && referenceFields.has(key) && value!==referenceFields.get(key)) {
      problems.push(file+': Firebase '+key+' differs from TEST reference');
    }
  }
  if (configFile) {
    for (const key of required) {
      if (!kv.has(key)) problems.push(file+': missing Firebase '+key);
    }
  }
  return problems;
}

// Negative regression tests: a production project anywhere in a nested
// test source file must be rejected. No production SDK calls are made.
assert.ok(inspectSource('const config={projectId:"'+PRODUCTION+'"};',
  'radio-stage/nested/config.js').length > 0);
assert.ok(inspectSource('const config={authDomain:"'+PRODUCTION+'.firebaseapp.com"};',
  'listening-room-stage/nested/config.js').length > 0);
assert.deepEqual(inspectSource(reference,'listening-room-stage/firebase-admin-config.js'),[]);

const tracked = execFileSync('git',['ls-files','-z'],{cwd:ROOT,encoding:'utf8'})
  .split('\0').filter(Boolean);
const violations = [];
let checked = 0, configs = 0;
for (const file of tracked) {
  if (!TEXT_SOURCE.test(file)) continue;
  const full = path.join(ROOT,file);
  if (!fs.existsSync(full)) continue;
  const source = fs.readFileSync(full,'utf8');
  violations.push(...inspectSource(source,file));
  checked++;
  if (/(?:^|\/)firebase-admin-config\.js$/.test(file)) configs++;
}
assert.ok(configs >= 3, 'Expected root, Listening Room, and radio-stage Firebase configs');
if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('TEST Firebase isolation PASS: '+checked+
  ' tracked source files, '+configs+' Firebase configs; production IDs rejected.');
