#!/usr/bin/env node
/*! lingua-switch — Copyright (c) 2026 Poolmaarsk.
    MIT License. See /LICENSE. */

// Precomputes "name of country C as written by a viewer of language V"
// for every country referenced anywhere in languages.json's `countries`
// field (237 of them) × all 76 languages, same reasoning and same
// silent-locale-substitution guard as build-language-names.mjs — see
// that file's header comment for the full explanation.
//
// Lower stakes than the language-name matrix (this only affects search
// recall — typing "Slovakia" to find Slovak — not text rendered as if
// it were a verified fact), but the same class of bug, so worth closing
// the same way rather than leaving it as the one remaining runtime
// Intl.DisplayNames call.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const languages = JSON.parse(readFileSync(path.join(root, 'src/generated/languages.json'), 'utf8'));
const viewerTags = [...new Set([...languages.map((language) => language.tag), 'en'])];
const countryCodes = [...new Set(languages.flatMap((language) => language.countries))].sort();

function primarySubtag(tag) {
  return tag.split('-')[0].toLowerCase();
}

function hasNativeViewerData(viewerTag) {
  let canonicalPrimary;
  try {
    canonicalPrimary = primarySubtag(Intl.getCanonicalLocales(viewerTag)[0]);
  } catch {
    return false;
  }
  const displayNames = new Intl.DisplayNames([viewerTag], { type: 'region' });
  return primarySubtag(displayNames.resolvedOptions().locale) === canonicalPrimary;
}

const viewerSupport = new Map(viewerTags.map((viewer) => [viewer, hasNativeViewerData(viewer)]));
const unsupportedViewers = viewerTags.filter((viewer) => !viewerSupport.get(viewer));
console.log(`${unsupportedViewers.length} of ${viewerTags.length} viewer languages have no native region-name data on this machine: ${unsupportedViewers.join(', ') || '(none)'}`);

const englishNamer = new Intl.DisplayNames(['en'], { type: 'region' });
const namerCache = new Map();
function namerFor(viewerTag) {
  const effectiveViewerTag = viewerSupport.get(viewerTag) ? viewerTag : 'en';
  if (!namerCache.has(effectiveViewerTag)) {
    namerCache.set(effectiveViewerTag, effectiveViewerTag === 'en' ? englishNamer : new Intl.DisplayNames([effectiveViewerTag], { type: 'region' }));
  }
  return namerCache.get(effectiveViewerTag);
}

const table = {};
let fallbackPairCount = 0;
for (const country of countryCodes) {
  table[country] = {};
  for (const viewerTag of viewerTags) {
    const namer = namerFor(viewerTag);
    let name;
    try {
      name = namer.of(country) ?? country;
    } catch {
      name = country;
    }
    if (!viewerSupport.get(viewerTag)) fallbackPairCount++;
    table[country][viewerTag] = name;
  }
}

const outPath = path.join(root, 'src/generated/region-names.json');
writeFileSync(outPath, JSON.stringify(table) + '\n');
console.log(`Wrote ${countryCodes.length}×${viewerTags.length} region-name pairs to ${path.relative(root, outPath)}`);
console.log(`${fallbackPairCount} pairs used the English fallback viewer.`);
