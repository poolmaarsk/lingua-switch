/*! lingua-switch — Copyright (c) 2026 lingua-switch project.
    MIT License. See /LICENSE. */

// Trigger label selection — DESIGN.md §8's fallback chain, extracted as
// a pure function so the "which language does the button show" decision
// is testable without a browser/navigator.
//
// The label is always some language's endonym, written in that
// language's own script — deliberately NOT the current page's language,
// because a visitor who can't read the current page can't read that
// label either. See DESIGN.md §8 for the full reasoning (the Chinese-
// page test case).

/**
 * @param {string[]} browserLanguages - navigator.languages, most-preferred first
 * @param {string[]} supportedTags - the host's translated languages
 * @param {string|null} [fallbackTag] - host-declared fallback if no browser match
 * @returns {string|null} a tag from supportedTags, or null (icon-only trigger)
 */
export function pickTriggerLanguage(browserLanguages, supportedTags, fallbackTag = null) {
  const supportedTagSet = new Set(supportedTags);

  for (const browserLanguage of browserLanguages) {
    const browserPrimarySubtag = browserLanguage.split('-')[0].toLowerCase();
    // exact tag match first (e.g. host ships "pt-BR" and browser wants "pt-BR")
    const exactMatch = supportedTags.find((tag) => tag.toLowerCase() === browserLanguage.toLowerCase());
    if (exactMatch) return exactMatch;
    // then primary-subtag match (browser wants "de-AT", host ships "de")
    const primarySubtagMatch = supportedTags.find((tag) => tag.toLowerCase().split('-')[0] === browserPrimarySubtag);
    if (primarySubtagMatch) return primarySubtagMatch;
  }

  if (fallbackTag && supportedTagSet.has(fallbackTag)) return fallbackTag;

  return null;
}
