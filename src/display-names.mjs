/*! lingua-switch — Copyright (c) 2026 Poolmaarsk.
    MIT License. See /LICENSE. */

// Bridges the generated language-first table (tags + flags + raw country
// codes) to the shape match.mjs consumes (names + codes to search over).
//
// Both language names (endonym + exonyms) and region names (country
// names, for search matching — e.g. typing "Slovakia" to find Slovak)
// come from precomputed matrices — src/generated/language-names.json
// and src/generated/region-names.json — not from calling
// Intl.DisplayNames live in the browser. See scripts/build-language-names.mjs
// for why: browsers silently substitute a different language's name
// when they lack data for the one requested, no error, no visible sign
// anything went wrong. In one real test, 28 of 76 languages — including
// Icelandic, Armenian, Georgian, Khmer, Albanian, Somali, not just
// obscure ones — showed English text rendered as if it were their own
// endonym. Region names started out as a runtime call because a miss
// there only degrades search recall rather than displaying wrong text
// as fact — genuinely lower stakes — but it's the same bug class, so
// it's precomputed the same way now rather than left as the one
// remaining exception.

/**
 * @param {Record<string, Record<string, string>>} table - a language-names.json or region-names.json shaped table
 * @param {string} key - the language/country code whose name we want
 * @param {string} viewerTag - the language to view it in
 */
function nameOf(table, key, viewerTag) {
  return table[key]?.[viewerTag] ?? table[key]?.en ?? key;
}

/**
 * @param {{tag:string, flags:string[], countries:string[], countryNames:string[]}} language
 * @param {Record<string, Record<string, string>>} nameTable - src/generated/language-names.json
 * @param {Record<string, Record<string, string>>} regionTable - src/generated/region-names.json
 * @param {string[]} uiLangs - every UI language this host ships (e.g. ['en','sk','de'])
 * @returns {{tag:string, endonym:string, names:string[], codes:string[]}}
 */
export function toSearchEntry(language, nameTable, regionTable, uiLangs) {
  const names = new Set();
  const codes = new Set([language.tag]);

  const endonym = nameOf(nameTable, language.tag, language.tag);
  names.add(endonym);

  for (const uiLang of uiLangs) {
    names.add(nameOf(nameTable, language.tag, uiLang));
  }

  for (const country of language.countries) {
    codes.add(country);
    for (const uiLang of uiLangs) {
      names.add(nameOf(regionTable, country, uiLang));
    }
  }
  for (const name of language.countryNames ?? []) names.add(name);

  return { tag: language.tag, endonym, names: [...names], codes: [...codes] };
}

/**
 * Subset + prepare the full generated table for one host's language set.
 * @param {Array} allLanguages - the full src/generated/languages.json content
 * @param {Record<string, Record<string, string>>} nameTable - src/generated/language-names.json
 * @param {Record<string, Record<string, string>>} regionTable - src/generated/region-names.json
 * @param {string[]} supportedTags - the host's translated languages, e.g. ['sk','en','de']
 * @param {string[]} [uiLangs] - languages to generate exonyms in; defaults to supportedTags
 */
export function buildLanguageSet(allLanguages, nameTable, regionTable, supportedTags, uiLangs = supportedTags) {
  const wantedTags = new Set(supportedTags);
  return allLanguages
    .filter((language) => wantedTags.has(language.tag))
    .map((language) => toSearchEntry(language, nameTable, regionTable, uiLangs));
}
