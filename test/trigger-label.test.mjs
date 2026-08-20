import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTriggerLanguage } from '../src/trigger-label.mjs';

test('picks exact browser language match', () => {
  assert.equal(pickTriggerLanguage(['sk-SK', 'en'], ['en', 'sk', 'de'], null), 'sk');
});

test('falls back to primary-subtag match when exact fails', () => {
  // browser wants de-AT, host only ships plain "de"
  assert.equal(pickTriggerLanguage(['de-AT'], ['en', 'de'], null), 'de');
});

test('walks down the preference list until a supported language is found', () => {
  assert.equal(pickTriggerLanguage(['fr-FR', 'ja', 'sk'], ['en', 'sk'], null), 'sk');
});

test('uses host fallback when no browser language matches', () => {
  assert.equal(pickTriggerLanguage(['ja', 'ko'], ['en', 'sk'], 'en'), 'en');
});

test('returns null (icon-only) when nothing matches and no fallback given', () => {
  assert.equal(pickTriggerLanguage(['ja', 'ko'], ['en', 'sk'], null), null);
});

test('ignores a fallback tag the host does not actually support', () => {
  assert.equal(pickTriggerLanguage(['ja'], ['en', 'sk'], 'de'), null);
});

test('the Chinese-page test case from DESIGN.md §8', () => {
  // visitor reads Slovak, page is in Chinese, host supports both
  assert.equal(pickTriggerLanguage(['sk-SK', 'sk'], ['zh', 'sk', 'en'], null), 'sk');
});
