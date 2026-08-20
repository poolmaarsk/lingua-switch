#!/usr/bin/env node
// Precomputes every "name of language T as written/understood by a
// viewer of language V" pair, for all 76×76 combinations, using Node's
// Intl.DisplayNames — and ships the result as static data.
//
// Why this exists: resolving these names at *runtime* in the browser
// (the original approach) turned out to be unreliable. Intl.DisplayNames
// doesn't throw when it lacks data for a requested display locale — it
// silently negotiates down to *some* supported locale and returns that
// locale's name instead, with no indication anything went wrong. In one
// real browser test, 28 of 76 languages (including non-obscure ones —
// Icelandic, Armenian, Georgian, Khmer, Albanian, Somali) silently
// substituted English names while being rendered as if they were native
// endonyms with lang="xx" attached.
//
// Node's own ICU data is far more complete (only ~5 gaps vs. 28), but
// naively trusting Node isn't safe either: Node's silent fallback locale
// is the *ambient environment locale* — on the machine this was
// generated on, that's sk-SK, so the ~5 truly-uncovered languages
// resolved to *Slovak* names, silently mislabeled as their own
// endonyms. Building this on a different machine would have produced
// different wrong answers. So every pair here is explicitly verified:
// if Intl.DisplayNames doesn't actually have native data for the
// requested viewer locale, we deliberately fall back to English (a
// fixed, machine-independent choice) instead of accepting whatever the
// runtime silently substituted.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const languages = JSON.parse(readFileSync(path.join(root, 'src/generated/languages.json'), 'utf8'));
const tags = languages.map((language) => language.tag);
const viewers = [...new Set([...tags, 'en'])]; // always include 'en' as the universal fallback viewer

function primarySubtag(tag) {
  return tag.split('-')[0].toLowerCase();
}

// Does Intl.DisplayNames actually have native data to display names IN
// this viewer language? (Not "is the tag valid" — .of() can return a
// plausible-looking string even when this is false, via silent fallback.)
function hasNativeViewerData(viewerTag) {
  let canonicalPrimary;
  try {
    canonicalPrimary = primarySubtag(Intl.getCanonicalLocales(viewerTag)[0]);
  } catch {
    return false;
  }
  const displayNames = new Intl.DisplayNames([viewerTag], { type: 'language' });
  const resolvedPrimary = primarySubtag(displayNames.resolvedOptions().locale);
  return resolvedPrimary === canonicalPrimary;
}

const viewerSupport = new Map(viewers.map((viewer) => [viewer, hasNativeViewerData(viewer)]));
const unsupportedViewers = viewers.filter((viewer) => !viewerSupport.get(viewer));

console.log(`${unsupportedViewers.length} of ${viewers.length} viewer languages have no native Intl.DisplayNames data on this machine:`);
console.log(`  ${unsupportedViewers.join(', ') || '(none)'}`);
console.log('  These fall back to English names instead of the ambient environment locale.');

const englishNamer = new Intl.DisplayNames(['en'], { type: 'language' });
const namerCache = new Map();
function namerFor(viewerTag) {
  const effectiveViewerTag = viewerSupport.get(viewerTag) ? viewerTag : 'en';
  if (!namerCache.has(effectiveViewerTag)) {
    namerCache.set(effectiveViewerTag, effectiveViewerTag === 'en' ? englishNamer : new Intl.DisplayNames([effectiveViewerTag], { type: 'language' }));
  }
  return namerCache.get(effectiveViewerTag);
}

const table = {};
let fallbackPairCount = 0;

for (const targetTag of tags) {
  table[targetTag] = {};
  for (const viewerTag of viewers) {
    const namer = namerFor(viewerTag);
    let name;
    try {
      name = namer.of(targetTag) ?? targetTag;
    } catch {
      name = targetTag;
    }
    if (!viewerSupport.get(viewerTag)) fallbackPairCount++;
    table[targetTag][viewerTag] = name;
  }
}

const outPath = path.join(root, 'src/generated/language-names.json');
writeFileSync(outPath, JSON.stringify(table) + '\n');

console.log(`\nWrote ${tags.length}×${viewers.length} name pairs to ${path.relative(root, outPath)}`);
console.log(`${fallbackPairCount} pairs used the English fallback viewer.`);
