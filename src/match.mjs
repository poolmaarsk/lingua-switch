/*! lingua-switch — Copyright (c) 2026 Poolmaarsk.
    MIT License. See /LICENSE. */

// Pure search/matching logic — no DOM. See DESIGN.md §6.
//
// A "language entry" here is:
//   { tag, endonym, names: string[], codes: string[] }
// where `names` holds every display name worth matching (endonym +
// exonyms in every shipped UI language + associated country names) and
// `codes` holds every code worth matching (BCP-47 tag, ISO 639-1/2/3,
// alpha-2/alpha-3 of its flag countries). Building that shape from the
// generated language table + Intl.DisplayNames is display-names.mjs's
// job, not this file's — kept separate so this stays framework/runtime
// agnostic and trivially testable.

/** Lowercase, decompose, strip combining marks. "Slovenčina" -> "slovencina". */
export function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .trim();
}

/**
 * Build a search index from language entries.
 * @param {Array<{tag:string, endonym:string, names:string[], codes:string[]}>} entries
 */
export function buildIndex(entries) {
  return entries.map((entry) => ({
    tag: entry.tag,
    endonym: entry.endonym,
    normalizedNames: entry.names.map(normalize),
    normalizedCodes: entry.codes.map((code) => code.toLowerCase()),
  }));
}

const RANK = {
  EXACT_CODE: 0,
  PREFIX_NAME: 1,
  SUBSTRING_NAME: 2,
  CODE_SUBSTRING_OR_COUNTRY: 3,
};

/**
 * Search a built index. Returns entries in ranked order (best match
 * first); entries with no match at all are omitted. Empty query returns
 * every entry in the index's original order.
 * @param {ReturnType<typeof buildIndex>} index
 * @param {string} query
 */
export function search(index, query) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery === '') return index.map((entry) => entry.tag);

  const scoredMatches = [];
  for (const entry of index) {
    let bestRank = null;

    if (entry.normalizedCodes.includes(normalizedQuery)) {
      bestRank = RANK.EXACT_CODE;
    } else {
      for (const name of entry.normalizedNames) {
        if (name === normalizedQuery || name.startsWith(normalizedQuery)) {
          bestRank = RANK.PREFIX_NAME;
          break;
        }
      }
      if (bestRank === null) {
        for (const name of entry.normalizedNames) {
          if (name.includes(normalizedQuery)) {
            bestRank = RANK.SUBSTRING_NAME;
            break;
          }
        }
      }
      if (bestRank === null) {
        const codeContainsQuery = entry.normalizedCodes.some((code) => code.includes(normalizedQuery));
        if (codeContainsQuery) bestRank = RANK.CODE_SUBSTRING_OR_COUNTRY;
      }
    }

    if (bestRank !== null) scoredMatches.push({ tag: entry.tag, rank: bestRank });
  }

  scoredMatches.sort((a, b) => a.rank - b.rank);
  return scoredMatches.map((match) => match.tag);
}
