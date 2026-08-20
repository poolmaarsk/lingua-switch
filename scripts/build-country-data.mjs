#!/usr/bin/env node
// Derives src/data/countries.json (our simplified schema) from the
// pinned, vendored raw ISO 3166-1 source in src/data/vendor/ — see
// src/data/vendor/SOURCE.md for provenance, the pinned commit, and the
// CC BY-SA 4.0 attribution/ShareAlike obligations that data carries.
//
// Replaces the old approach of copying an already-derived snapshot out
// of legacy-demo/, which was itself an unpinned live fetch from a third
// party's `master` branch at build time.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const raw = JSON.parse(readFileSync(path.join(root, 'src/data/vendor/iso-3166-all.json'), 'utf8'));

function getContinent(rawCountry) {
  const region = rawCountry.region || '';
  if (region === 'Americas') {
    return (rawCountry['intermediate-region'] || '') === 'South America' ? 'South America' : 'North America';
  }
  return region;
}

const countries = raw.map((rawCountry) => ({
  name: rawCountry.name,
  alpha2: rawCountry['alpha-2'],
  alpha3: rawCountry['alpha-3'],
  continent: getContinent(rawCountry),
}));

const outPath = path.join(root, 'src/data/countries.json');
writeFileSync(outPath, JSON.stringify(countries, null, 2) + '\n');

console.log(`Wrote ${countries.length} countries to ${path.relative(root, outPath)} (from pinned vendor data, CC BY-SA 4.0 — see src/data/vendor/SOURCE.md)`);
