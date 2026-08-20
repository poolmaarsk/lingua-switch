import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, buildIndex, search } from '../src/match.mjs';

test('normalize strips diacritics and case', () => {
  assert.equal(normalize('Slovenčina'), 'slovencina');
  assert.equal(normalize('DEUTSCH'), 'deutsch');
  assert.equal(normalize('  Español  '), 'espanol');
});

const entries = [
  { tag: 'sk', endonym: 'slovenčina', names: ['slovenčina', 'Slovak', 'Slowakisch', 'Slovakia'], codes: ['sk', 'slk', 'svk'] },
  { tag: 'en', endonym: 'English', names: ['English', 'English'], codes: ['en', 'eng'] },
  { tag: 'de', endonym: 'Deutsch', names: ['Deutsch', 'German'], codes: ['de', 'deu', 'ger'] },
  { tag: 'da', endonym: 'dansk', names: ['dansk', 'Danish'], codes: ['da', 'dan'] },
  { tag: 'fr', endonym: 'français', names: ['français', 'French'], codes: ['fr', 'fra'] },
];

test('empty query returns everything in original order', () => {
  const idx = buildIndex(entries);
  assert.deepEqual(search(idx, ''), ['sk', 'en', 'de', 'da', 'fr']);
});

test('exact code match wins over substring name match', () => {
  // "en" is French's exact code AND a substring of nothing else relevant here,
  // but must not be beaten by any partial name match.
  const idx = buildIndex(entries);
  const result = search(idx, 'en');
  assert.equal(result[0], 'en', `exact code "en" should rank first, got ${result}`);
});

test('typing a country/exonym finds the language by endonym mismatch', () => {
  const idx = buildIndex(entries);
  const result = search(idx, 'slovakia');
  assert.ok(result.includes('sk'));
  assert.equal(result[0], 'sk');
});

test('diacritic-free query still finds the diacritic endonym', () => {
  const idx = buildIndex(entries);
  const result = search(idx, 'slovencina');
  assert.equal(result[0], 'sk');
});

test('alpha-3 code search input finds the language', () => {
  const idx = buildIndex(entries);
  const result = search(idx, 'svk');
  assert.equal(result[0], 'sk');
});

test('prefix match ranks above substring-only match', () => {
  const idx = buildIndex([
    { tag: 'a', endonym: 'Danish', names: ['Danish'], codes: ['a1'] },
    { tag: 'b', endonym: 'Sudanese', names: ['Sudanese'], codes: ['b1'] },
  ]);
  const result = search(idx, 'dan');
  assert.deepEqual(result, ['a', 'b']);
});

test('no match omits the entry entirely', () => {
  const idx = buildIndex(entries);
  const result = search(idx, 'xyzzy_no_such_language');
  assert.deepEqual(result, []);
});

test('case-insensitive code match', () => {
  const idx = buildIndex(entries);
  const result = search(idx, 'SK');
  assert.equal(result[0], 'sk');
});
