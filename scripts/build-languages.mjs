#!/usr/bin/env node
// Generates src/generated/languages.json: the language-first table the
// rest of the project consumes. Country-first source data in in
// src/data/ is never read directly by app code — see DESIGN.md §1.
//
// Fail-loud on purpose (matches plug-cost/build.mjs's convention): a
// multi-country language with no curated flag order stops the build
// instead of silently picking an arbitrary order.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EXCLUDED_TERRITORIES } from '../src/data/excluded-territories.mjs';
import { CURATED_FLAG_ORDER } from '../src/data/curated-flag-order.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const countryToLang = JSON.parse(readFileSync(path.join(root, 'src/data/country-to-lang.json'), 'utf8'));
const countries = JSON.parse(readFileSync(path.join(root, 'src/data/countries.json'), 'utf8'));
const countryByAlpha2 = new Map(countries.map((country) => [country.alpha2, country]));

const byLang = new Map();
for (const [alpha2, lang] of Object.entries(countryToLang)) {
  if (EXCLUDED_TERRITORIES.includes(alpha2)) continue;
  if (!byLang.has(lang)) byLang.set(lang, []);
  byLang.get(lang).push(alpha2);
}

const languages = [];
for (const [tag, countryCodes] of byLang) {
  countryCodes.sort();

  let flags;
  if (countryCodes.length === 1) {
    flags = countryCodes;
  } else {
    const curated = CURATED_FLAG_ORDER[tag];
    if (!curated) {
      throw new Error(
        `Language "${tag}" is spoken in ${countryCodes.length} countries ` +
        `(${countryCodes.join(', ')}) but has no entry in curated-flag-order.mjs. ` +
        `Add one deliberately — see DESIGN.md §3.`
      );
    }
    const known = new Set(countryCodes);
    for (const countryCode of curated.flags) {
      if (!known.has(countryCode)) {
        throw new Error(
          `curated-flag-order.mjs has "${countryCode}" for language "${tag}", but ` +
          `country-to-lang.json does not map ${countryCode} -> ${tag}. Data drifted — fix one or the other.`
        );
      }
    }
    flags = curated.flags.slice(0, 3);
  }

  const countryNames = countryCodes
    .map((countryCode) => countryByAlpha2.get(countryCode)?.name)
    .filter(Boolean);

  languages.push({ tag, flags, countries: countryCodes, countryNames });
}

languages.sort((a, b) => a.tag.localeCompare(b.tag));

const outDir = path.join(root, 'src/generated');
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'languages.json');
writeFileSync(outPath, JSON.stringify(languages, null, 2) + '\n');

console.log(`Wrote ${languages.length} languages to ${path.relative(root, outPath)}`);
console.log(`  ${languages.filter((language) => language.flags.length > 1).length} multi-flag, ${languages.filter((language) => language.flags.length === 1).length} single-flag`);
