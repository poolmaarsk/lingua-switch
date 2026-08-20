import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLanguageSet, toSearchEntry } from '../src/display-names.mjs';

const languages = JSON.parse(readFileSync(new URL('../src/generated/languages.json', import.meta.url), 'utf8'));
const nameTable = JSON.parse(readFileSync(new URL('../src/generated/language-names.json', import.meta.url), 'utf8'));
const regionTable = JSON.parse(readFileSync(new URL('../src/generated/region-names.json', import.meta.url), 'utf8'));

test('toSearchEntry produces endonym + exonyms + region names', () => {
  const sk = languages.find((l) => l.tag === 'sk');
  const entry = toSearchEntry(sk, nameTable, regionTable, ['en', 'de']);
  assert.equal(entry.endonym, 'slovenčina');
  assert.ok(entry.names.includes('Slovak'), `expected English exonym "Slovak" in ${JSON.stringify(entry.names)}`);
  assert.ok(entry.names.includes('Slowakisch'), `expected German exonym "Slowakisch" in ${JSON.stringify(entry.names)}`);
  assert.ok(entry.names.includes('Slovakia'), `expected English region name "Slovakia" in ${JSON.stringify(entry.names)}`);
  assert.ok(entry.names.includes('Slowakei'), `expected German region name "Slowakei" in ${JSON.stringify(entry.names)}`);
  assert.ok(entry.codes.includes('sk'));
  assert.ok(entry.codes.includes('SK'));
});

test('buildLanguageSet subsets to only the requested tags', () => {
  const set = buildLanguageSet(languages, nameTable, regionTable, ['sk', 'en', 'de']);
  assert.equal(set.length, 3);
  assert.deepEqual(set.map((e) => e.tag).sort(), ['de', 'en', 'sk']);
});

test('buildLanguageSet generates exonyms in every requested UI language', () => {
  const set = buildLanguageSet(languages, nameTable, regionTable, ['sk', 'en'], ['sk', 'en']);
  const en = set.find((e) => e.tag === 'en');
  assert.ok(en.names.includes('angličtina'), `expected Slovak exonym for English in ${JSON.stringify(en.names)}`);
  assert.ok(en.names.includes('English'));
});

test('every generated language has a resolvable, non-empty endonym', () => {
  for (const lang of languages) {
    const entry = toSearchEntry(lang, nameTable, regionTable, []);
    assert.notEqual(entry.endonym, '', `${lang.tag} produced empty endonym`);
  }
});

test('every referenced country has a resolvable, non-empty region name', () => {
  const allCountries = new Set(languages.flatMap((l) => l.countries));
  for (const code of allCountries) {
    assert.notEqual(regionTable[code]?.en, undefined, `${code} missing from region-names.json`);
    assert.notEqual(regionTable[code].en, '', `${code} produced empty English region name`);
  }
});

test('the precomputed table never silently substitutes a wrong-but-plausible language name', () => {
  // Regression test for the actual bug found: Node's own ambient locale
  // (sk-SK on the machine this was built on) leaking into languages Node
  // has no real display data for. If the build script's fallback-locale
  // guard ever regresses, this specific pair is what would catch it —
  // Latin's endonym silently becoming the Slovak word for Latin instead
  // of the deterministic English fallback "Latin".
  assert.notEqual(nameTable.la.la, 'latinčina', 'Latin endonym leaked the build machine\'s ambient locale (Slovak) instead of falling back to English');
  assert.equal(nameTable.la.la, 'Latin');
});

test('a genuinely native-language pair is not run through the English fallback', () => {
  // Belarusian viewing itself must be the real Cyrillic endonym, not the
  // English word "Belarusian" — this is the exact case that was broken
  // when names were resolved live in a browser lacking 'be' display data.
  assert.equal(nameTable.be.be, 'беларуская');
});

test('fil (not tl) is the Philippines\' language tag, and is canonical', () => {
  const ph = languages.find((l) => l.countries.includes('PH'));
  assert.equal(ph.tag, 'fil', 'Philippines should map to fil (canonical), not tl (deprecated ISO 639-1 code)');
  assert.deepEqual(Intl.getCanonicalLocales('fil'), ['fil']);
});
