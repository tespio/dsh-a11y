import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api } from './load.mjs';

function readLocale(name) {
  const path = fileURLToPath(new URL(`../locale/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

const enJson = readLocale('en');
const zhJson = readLocale('zh');
const enRuntime = api.LOCALES.en;
const zhRuntime = api.LOCALES.zh;

// Metadata lives under a nested `meta` object in the package locale files and
// under flat `meta.*` keys in the runtime dictionaries.
assert.equal(enJson.meta.title, enRuntime['meta.title']);
assert.equal(enJson.meta.description, enRuntime['meta.description']);
assert.equal(zhJson.meta.title, zhRuntime['meta.title']);
assert.equal(zhJson.meta.description, zhRuntime['meta.description']);

const enKeys = Object.keys(enJson).filter((key) => key !== 'meta').sort();
const zhKeys = Object.keys(zhJson).filter((key) => key !== 'meta').sort();
const runtimeEnKeys = Object.keys(enRuntime).filter((key) => !key.startsWith('meta.')).sort();
const runtimeZhKeys = Object.keys(zhRuntime).filter((key) => !key.startsWith('meta.')).sort();

assert.deepEqual(enKeys, runtimeEnKeys, 'locale/en.json and the runtime English dictionary disagree');
assert.deepEqual(zhKeys, runtimeZhKeys, 'locale/zh.json and the runtime Chinese dictionary disagree');
assert.deepEqual(enKeys, zhKeys, 'English and Chinese locale files must carry the same keys');

for (const key of enKeys) {
  assert.equal(typeof enJson[key], 'string', `${key} must be a string`);
  assert.equal(typeof zhJson[key], 'string', `${key} must be a string`);
  const placeholders = [...enJson[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  for (const placeholder of placeholders) {
    assert.match(
      zhJson[key],
      new RegExp('\\{' + placeholder + '\\}'),
      `${key} must keep the {${placeholder}} placeholder in Chinese`,
    );
  }
}

console.log('locale.test.mjs ok');
