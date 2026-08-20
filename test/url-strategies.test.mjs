import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathPrefixHref, queryParamHref } from '../src/url-strategies.mjs';

test('pathPrefixHref replaces an existing recognized language prefix', () => {
  assert.equal(pathPrefixHref('/en/pricing', '', 'sk', ['en', 'sk', 'de']), '/sk/pricing/');
});

test('pathPrefixHref adds a prefix when none exists', () => {
  assert.equal(pathPrefixHref('/pricing', '', 'sk', ['en', 'sk', 'de']), '/sk/pricing/');
});

test('pathPrefixHref handles root path', () => {
  assert.equal(pathPrefixHref('/', '', 'sk', ['en', 'sk']), '/sk/');
});

test('pathPrefixHref does not strip a first segment that is not a known language', () => {
  // "blog" is not in supportedTags, so it must not be swallowed as a false-positive prefix
  assert.equal(pathPrefixHref('/blog/my-post', '', 'sk', ['en', 'sk']), '/sk/blog/my-post/');
});

test('pathPrefixHref preserves the query string', () => {
  assert.equal(pathPrefixHref('/en/pricing', '?ref=x', 'sk', ['en', 'sk']), '/sk/pricing/?ref=x');
});

test('pathPrefixHref result is always root-relative', () => {
  const href = pathPrefixHref('/en/x', '', 'sk', ['en', 'sk']);
  assert.ok(href.startsWith('/'), `expected root-relative href, got ${href}`);
  assert.ok(!href.startsWith('//'), `expected no protocol-relative href, got ${href}`);
});

test('queryParamHref adds lang param', () => {
  assert.equal(queryParamHref('/pricing', '', 'sk'), '/pricing?lang=sk');
});

test('queryParamHref replaces an existing lang param and keeps others', () => {
  assert.equal(queryParamHref('/pricing', '?ref=x&lang=en', 'sk'), '/pricing?ref=x&lang=sk');
});

test('queryParamHref supports a custom param name', () => {
  assert.equal(queryParamHref('/pricing', '', 'sk', 'locale'), '/pricing?locale=sk');
});
