/*! lingua-switch — Copyright (c) 2026 lingua-switch project.
    MIT License. See /LICENSE. */

// Pure href computation for the built-in output strategies (DESIGN.md §10).
// No DOM — takes plain strings, returns plain strings, so it's testable
// without a browser and reusable from the custom element either way.
//
// Every href is root-relative on purpose: an absolute
// "https://example.com/sk/" href would bounce a visitor on a preview
// deployment or subdomain back to the canonical host when they switch
// language. Already-hit bug in this workspace (plug-cost/CLAUDE.md) —
// baked in as the default here instead of re-learning it.

/**
 * "/en/pricing" + "sk" + ["en","sk","de"] -> "/sk/pricing"
 * "/pricing" (no recognized prefix) + "sk" + [...] -> "/sk/pricing"
 */
export function pathPrefixHref(pathname, search, newTag, supportedTags) {
  const segments = pathname.split('/').filter(Boolean);
  const hasKnownPrefix = segments.length > 0 && supportedTags.includes(segments[0]);
  const rest = hasKnownPrefix ? segments.slice(1) : segments;
  const newPath = '/' + [newTag, ...rest].join('/') + '/';
  return newPath + (search || '');
}

/**
 * "/pricing?ref=x" + "sk" -> "/pricing?ref=x&lang=sk" (or replaces existing lang param)
 */
export function queryParamHref(pathname, search, newTag, paramName = 'lang') {
  const params = new URLSearchParams(search);
  params.set(paramName, newTag);
  const queryString = params.toString();
  return pathname + (queryString ? `?${queryString}` : '');
}
