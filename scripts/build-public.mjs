#!/usr/bin/env node
/*! lingua-switch — Copyright (c) 2026 lingua-switch project.
    MIT License. See /LICENSE. */

// Builds public/ — a self-contained, deployable copy of the showcase
// page, ready to publish as-is (e.g. Cloudflare Pages direct upload,
// no build step on their end). showcase/index.html stays the source of
// truth for editing (its script tags point at /src/ directly, for fast
// iteration against npm run dev); this script never hand-copies it —
// re-run after any change to showcase/index.html or the component.
//
// The showcase uses all 76 built-in languages (its "full scale"
// section), so this copies the full dataset rather than running it
// through scripts/subset.mjs — there's nothing to subset down to here.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const publicDir = path.join(root, 'public');

rmSync(publicDir, { recursive: true, force: true });
mkdirSync(path.join(publicDir, 'language-picker/generated'), { recursive: true });
mkdirSync(path.join(publicDir, 'language-picker/assets/flags'), { recursive: true });

const modules = [
  'language-picker.mjs',
  'match.mjs',
  'display-names.mjs',
  'url-strategies.mjs',
  'rtl.mjs',
  'trigger-label.mjs',
];
for (const file of modules) {
  copyFileSync(path.join(srcDir, file), path.join(publicDir, 'language-picker', file));
}

for (const file of readdirSync(path.join(srcDir, 'generated'))) {
  copyFileSync(path.join(srcDir, 'generated', file), path.join(publicDir, 'language-picker/generated', file));
}

let flagCount = 0;
for (const file of readdirSync(path.join(srcDir, 'assets/flags'))) {
  if (!file.endsWith('.svg')) continue; // skip SOURCE.md
  copyFileSync(path.join(srcDir, 'assets/flags', file), path.join(publicDir, 'language-picker/assets/flags', file));
  flagCount++;
}

// showcase/index.html references the component as /src/language-picker.mjs
// — root-relative, correct under npm run dev, which serves the whole
// repo from one root. public/index.html must NOT use a root-relative
// path here: this file gets served two different ways (public/ as the
// literal site root once deployed, or as a /public/ subpath during local
// preview via npm run dev), and a root-relative path is only correct in
// one of those. A *relative* path (./language-picker/...) resolves
// against wherever this HTML file itself sits, so it's correct in both —
// real bug hit locally: root-relative here 404'd under npm run dev with
// no Content-Type on the 404, which browsers report as a bogus "MIME
// type" error on the module fetch instead of a plain 404.
let html = readFileSync(path.join(root, 'showcase/index.html'), 'utf8');
html = html.replaceAll('/src/language-picker.mjs', './language-picker/language-picker.mjs');
html = html.replaceAll('/src/url-strategies.mjs', './language-picker/url-strategies.mjs');
writeFileSync(path.join(publicDir, 'index.html'), html);

// robots.txt / sitemap.xml — plain copies, root-relative by nature (a
// crawler always requests /robots.txt at the actual site root, so no
// path rewriting question here the way there was for the HTML above).
copyFileSync(path.join(root, 'showcase/robots.txt'), path.join(publicDir, 'robots.txt'));
copyFileSync(path.join(root, 'showcase/sitemap.xml'), path.join(publicDir, 'sitemap.xml'));

console.log(`Wrote public/index.html + public/language-picker/ (${modules.length} modules, 3 generated data files, ${flagCount} flags)`);
console.log('Ready to deploy public/ as-is — e.g. Cloudflare Pages direct upload, no build step needed on their end.');
