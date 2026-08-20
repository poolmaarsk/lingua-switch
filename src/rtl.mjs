/*! lingua-switch — Copyright (c) 2026 lingua-switch project.
    MIT License. See /LICENSE. */

// ISO 639-1 primary language subtags that are written right-to-left.
// Used to set dir="rtl" on individual rows (DESIGN.md §7) — punctuation
// and layout break for these without it, even inside an otherwise-LTR
// page.
const RTL_TAGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'ku', 'dv']);

export function isRtl(tag) {
  const primary = tag.split('-')[0].toLowerCase();
  return RTL_TAGS.has(primary);
}
