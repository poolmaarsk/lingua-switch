#!/usr/bin/env node
/*! lingua-switch — Copyright (c) 2026 lingua-switch project.
    MIT License. See /LICENSE. */

// Build-time subsetting CLI — DESIGN.md §5. Today the component always
// fetches the full 76-language dataset (~89KB for language-names.json
// alone) regardless of how many languages a host actually declares in
// `langs`. This produces a minimal, self-contained output directory
// containing only what a specific host needs, mirroring src/'s relative
// layout exactly — so language-picker.mjs's existing `./generated/...`
// and `./assets/flags/...` fetches work completely unmodified. No
// bundler, no build step on the host's side: drop the output directory
// on a static server and point a <script type="module"> at it.
//
// Usage:
//   node scripts/subset.mjs --langs sk,en,de --out ./dist/language-picker
//   node scripts/subset.mjs --langs sk,en,de --out ./dist/language-picker --minify
//
// The name-matrix subsetting is the real win, not just the language
// list: the shipped component always uses uiLangs = langs (see
// language-picker.mjs's `_load()`), so a host only ever needs an N×N
// slice of the full 76×76 language-names.json, not full 76-wide rows.
// For 3 languages that's 9 pairs instead of 5776.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');

function parseArgs(argv) {
  const args = { langs: null, out: null, minify: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--langs') args.langs = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--minify') args.minify = true;
  }
  return args;
}

const { langs: langsArg, out: outArg, minify } = parseArgs(process.argv.slice(2));

if (!langsArg || !outArg) {
  console.error('Usage: node scripts/subset.mjs --langs sk,en,de --out ./dist/language-picker [--minify]');
  process.exit(1);
}

const wantedTags = langsArg.split(',').map((tag) => tag.trim()).filter(Boolean);
if (wantedTags.length === 0) {
  console.error('subset: --langs must list at least one BCP-47 tag');
  process.exit(1);
}

const allLanguages = JSON.parse(readFileSync(path.join(srcDir, 'generated/languages.json'), 'utf8'));
const allNames = JSON.parse(readFileSync(path.join(srcDir, 'generated/language-names.json'), 'utf8'));
const allRegions = JSON.parse(readFileSync(path.join(srcDir, 'generated/region-names.json'), 'utf8'));

const wantedSet = new Set(wantedTags);
const subsetLanguages = allLanguages.filter((language) => wantedSet.has(language.tag));

const missingTags = wantedTags.filter((tag) => !subsetLanguages.some((language) => language.tag === tag));
if (missingTags.length > 0) {
  console.error(`subset: unknown language tag(s): ${missingTags.join(', ')}`);
  console.error(`  known tags: ${allLanguages.map((language) => language.tag).join(', ')}`);
  process.exit(1);
}

// N×N slice: only pairs where BOTH the target and the viewer are in the
// requested set — exactly what buildLanguageSet(..., langs, langs) uses.
const subsetNames = {};
for (const targetTag of wantedTags) {
  subsetNames[targetTag] = {};
  for (const viewerTag of wantedTags) {
    subsetNames[targetTag][viewerTag] = allNames[targetTag]?.[viewerTag] ?? allNames[targetTag]?.en ?? targetTag;
  }
}

// Region names: only countries that actually appear in the subset's
// languages, viewed only in the subset's own languages — same N×N idea,
// but keyed by country rather than language.
const subsetCountries = [...new Set(subsetLanguages.flatMap((language) => language.countries))];
const subsetRegions = {};
for (const country of subsetCountries) {
  subsetRegions[country] = {};
  for (const viewerTag of wantedTags) {
    subsetRegions[country][viewerTag] = allRegions[country]?.[viewerTag] ?? allRegions[country]?.en ?? country;
  }
}

const flagCodes = new Set();
for (const language of subsetLanguages) for (const flagCode of language.flags) flagCodes.add(flagCode.toLowerCase());

const outDir = path.resolve(outArg);
mkdirSync(path.join(outDir, 'generated'), { recursive: true });
mkdirSync(path.join(outDir, 'assets/flags'), { recursive: true });

writeFileSync(path.join(outDir, 'generated/languages.json'), JSON.stringify(subsetLanguages) + '\n');
writeFileSync(path.join(outDir, 'generated/language-names.json'), JSON.stringify(subsetNames) + '\n');
writeFileSync(path.join(outDir, 'generated/region-names.json'), JSON.stringify(subsetRegions) + '\n');

for (const code of flagCodes) {
  const flagSrc = path.join(srcDir, 'assets/flags', `${code}.svg`);
  copyFileSync(flagSrc, path.join(outDir, 'assets/flags', `${code}.svg`));
}

// The small pure-JS modules language-picker.mjs imports — copied as-is by
// default, not bundled. They're a few KB each unminified; a bundler is a
// later step (see README), not required for a working drop-in. --minify
// (below) shrinks each file in place without bundling them together — they
// keep importing each other by relative path exactly as they do in src/,
// so this stays a "drop several files on a static server" output either
// way, just a smaller one.
const modules = [
  'language-picker.mjs',
  'match.mjs',
  'display-names.mjs',
  'url-strategies.mjs',
  'rtl.mjs',
  'trigger-label.mjs',
];
for (const file of modules) {
  copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}

if (minify) {
  // esbuild is a devDependency here, not a runtime one — importing it lazily
  // (only when --minify is actually passed) keeps `npm install
  // @poolmaarsk/lingua-switch` and a plain `npx lingua-switch-subset` (no
  // flag) exactly as dependency-free as before. A bare `npx
  // lingua-switch-subset --minify` from OUTSIDE a checkout of this repo
  // still won't find it, though: npx only installs a package's own
  // (runtime) `dependencies`, never its devDependencies, so there is no
  // node_modules/esbuild in that ephemeral install for this dynamic import
  // to resolve. The error below says so and gives the one-line workaround
  // (`npx -p esbuild -p @poolmaarsk/lingua-switch ...`, which puts both
  // packages in the same temporary node_modules, where this DOES resolve).
  let transform;
  try {
    ({ transform } = await import('esbuild'));
  } catch {
    console.error('subset --minify: esbuild is not installed.');
    console.error('  In a checkout of this repo: npm install, then re-run.');
    console.error('  Via npx from elsewhere: npx -p esbuild -p @poolmaarsk/lingua-switch lingua-switch-subset --minify ...');
    process.exit(1);
  }
  for (const file of modules) {
    const p = path.join(outDir, file);
    // format:'esm', no bundle:true: minify each file's own whitespace and
    // local identifiers only. Bundling would inline these files into one,
    // which is exactly the "unbundled subset directory" contract this CLI
    // exists to produce — a consumer's <script type="module"> and this
    // file's own sibling imports both depend on these staying separate
    // files at these same relative paths.
    const { code } = await transform(readFileSync(p, 'utf8'), { loader: 'js', format: 'esm', minify: true });
    writeFileSync(p, code);
  }
}

function dirSize(dir) {
  let total = 0;
  for (const entryName of readdirSync(dir)) {
    const entryPath = path.join(dir, entryName);
    const stat = statSync(entryPath);
    total += stat.isDirectory() ? dirSize(entryPath) : stat.size;
  }
  return total;
}

// Apples-to-apples baseline: the same *category* of files the subset
// contains (generated data + flags + modules), not all of src/ — src/
// also holds tests, vendor sources, and curation data a shipped bundle
// never included in the first place.
const fullSize = modules.reduce((sum, file) => sum + statSync(path.join(srcDir, file)).size, 0)
  + statSync(path.join(srcDir, 'generated/languages.json')).size
  + statSync(path.join(srcDir, 'generated/language-names.json')).size
  + statSync(path.join(srcDir, 'generated/region-names.json')).size
  + dirSize(path.join(srcDir, 'assets/flags'));
const subsetSize = dirSize(outDir);
const formatKB = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

console.log(`Subset for [${wantedTags.join(', ')}] written to ${path.relative(root, outDir)}`);
console.log(`  ${subsetLanguages.length} languages, ${flagCodes.size} flags`);
console.log(`  full src/: ${formatKB(fullSize)}  →  subset: ${formatKB(subsetSize)}${minify ? ' (minified)' : ''}`);
if (!minify) console.log(`  (pass --minify to shrink the ${modules.length} .mjs modules further)`);
console.log(`\nHost usage:`);
console.log(`  <script type="module" src="/path/to/${path.basename(outDir)}/language-picker.mjs"></script>`);
console.log(`  <language-picker langs="${wantedTags.join(',')}" current="${wantedTags[0]}" mode="path-prefix"></language-picker>`);
