/*! lingua-switch — Copyright (c) 2026 lingua-switch project.
    MIT License. See /LICENSE. */

// <language-picker> — embeddable language switcher web component.
// See DESIGN.md for the full design reasoning. This file wires together
// the pure modules (match.mjs, display-names.mjs, url-strategies.mjs,
// rtl.mjs, trigger-label.mjs) into an actual ARIA combobox UI.
//
// Usage:
//   <script type="module" src="/language-picker.mjs"></script>
//   <language-picker langs="sk,en,de" current="en" mode="path-prefix"></language-picker>
//
// Attributes:
//   langs           required. Comma-separated BCP-47 tags this host has translations for.
//   current         required. BCP-47 tag of the current page's language.
//   mode            "path-prefix" (default) | "query-param" | "none"
//   fallback-lang   optional. Used for the trigger label when navigator.languages
//                   has no match in `langs` — see trigger-label.mjs.
//   show-flags      "true" to enable flags. Off by default — flags render from
//                   vendored local SVGs (src/assets/flags/, see SOURCE.md there)
//                   and text alone must stay sufficient regardless (DESIGN.md §3's
//                   "text identifies, flags decorate" rule).
//   query-param     param name for mode="query-param" (default "lang").
//   data-theme      "light" | "dark". Set this directly to opt out of the
//                   auto-sync below and take full manual control.
//
// Theming: CSS custom properties (--lp-bg, --lp-text, --lp-accent, ...
// see the STYLE constant below for the full list) cross the shadow
// boundary normally, so a host can theme this from outside without any
// of the above. Dark mode specifically has two automatic paths on top
// of that: prefers-color-scheme by default, and — if the host page uses
// <html data-theme="dark"> (matching plug-cost's existing convention,
// see pages/CLAUDE.md) — this element mirrors that attribute onto
// itself live via a MutationObserver, no host wiring required. Setting
// data-theme directly on THIS element disables the auto-sync for that
// instance (explicit host intent always wins).
//
// Fires a cancelable, bubbling, composed `language-select` CustomEvent
// with `detail: {tag, endonym, name, flags}` before navigating. Call
// event.preventDefault() to take over navigation yourself (mode="none"
// never navigates on its own — it only fires the event).
//
// The component never remembers a selection across a reload, in any
// mode — it only computes a URL (path-prefix/query-param) and navigates
// to it, or only fires the event (none). Restoring `current` (and
// <html lang>) from that new URL on the *next* page load is always the
// host's job:
//   - path-prefix: read the language segment back out of the pathname
//   - query-param: read it back out of location.search
//   - none: the event listener already has to do this synchronously,
//     since there's no reload to read anything back from
// Forgetting this is a real, easy-to-hit bug, not a hypothetical one —
// it looks exactly like "picking a language does nothing": the
// component actually did navigate, but the page never applied the new
// language on the way back in, so the UI silently reverts to whatever
// `current` was hardcoded to. See demo/index.html's bootstrap script
// for the path-prefix/query-param pattern, and its `language-select`
// listener for the mode="none" pattern.

import { buildIndex, search } from './match.mjs';
import { buildLanguageSet } from './display-names.mjs';
import { pathPrefixHref, queryParamHref } from './url-strategies.mjs';
import { isRtl } from './rtl.mjs';
import { pickTriggerLanguage } from './trigger-label.mjs';

function fetchJson(relativePath, label) {
  return fetch(new URL(relativePath, import.meta.url)).then((response) => {
    if (!response.ok) throw new Error(`language-picker: failed to load ${label} (${response.status})`);
    return response.json();
  });
}

let languagesDataPromise = null;
function loadLanguagesData() {
  languagesDataPromise ??= fetchJson('./generated/languages.json', 'languages.json');
  return languagesDataPromise;
}

let nameTablePromise = null;
function loadNameTable() {
  nameTablePromise ??= fetchJson('./generated/language-names.json', 'language-names.json');
  return nameTablePromise;
}

let regionTablePromise = null;
function loadRegionTable() {
  regionTablePromise ??= fetchJson('./generated/region-names.json', 'region-names.json');
  return regionTablePromise;
}

// Vendored locally under src/assets/flags/ — see SOURCE.md there for
// origin (flagcdn.com, public domain) and license. No third-party
// request at render time; override with the `flagUrl` property if a
// host wants its own delivery (a CDN, inline data: URIs, whatever).
function defaultFlagUrl(code) {
  return new URL(`./assets/flags/${code.toLowerCase()}.svg`, import.meta.url).href;
}

// Token defaults are set directly here, once — never as
// "--lp-x: var(--lp-x, fallback)". That self-referential pattern looks
// like "use the host's override, else this default" but a custom
// property can't fall back to itself: the browser treats it as a cyclic
// definition and the whole thing resolves to nothing, silently, with no
// console warning. Every property consuming it then gets its own
// default (transparent, for background) instead of the value written
// here — which is exactly what made the panel see-through. A host that
// wants to override a token still can, from outside, by setting
// --lp-bg etc. on the <language-picker> element itself; the normal CSS
// cascade handles that without needing var()-with-self-fallback at all.
const STYLE = `
/* Token defaults live in a :where(:host) rule — zero specificity — so
   ANY host-side override wins the cascade, down to a bare tag selector
   like "language-picker { --lp-bg: ... }". Without :where(), a plain
   :host { --lp-bg: ...} rule already carries (0,1,0) specificity, and
   the per-theme variants below carry even more ([data-theme="..."]
   adds an attribute selector) — a host reaching for anything less
   specific than an ID selector would silently lose to these internal
   defaults. See CLAUDE.md/DESIGN.md for the plug-cost integration that
   surfaced this (dark mode silently ignored a class-based host
   override; only an ID-anchored one won). Structural layout (font,
   position, display) stays in a normal :host rule below — those aren't
   meant to be swapped by theme and don't need the same treatment. */
:where(:host) {
  --lp-bg: #ffffff;
  --lp-surface: #f4f4f2;
  --lp-card-bg: #ffffff;
  --lp-text: #1a1a1a;
  --lp-text-secondary: #55554f;
  --lp-border: #d6d6d0;
  --lp-border-strong: #9a9a90;
  --lp-accent: #185fa5;
  --lp-focus-ring: #185fa5;
  --lp-hover-bg: #eef3f8;
  --lp-selected-bg: #e6f1fb;
  --lp-radius: 8px;
}
:host {
  font-family: var(--lp-font, system-ui, sans-serif);
  position: relative;
  display: inline-block;
}
/* Dark palette, two ways to reach it — matching the [data-theme]
   convention plug-cost already uses (pages/CLAUDE.md flags this as the
   first real candidate for code shared between the two projects):
   1. OS-level preference, automatic, no host wiring needed.
   2. Explicit :host([data-theme="..."]) attribute — wrapped in :where()
      like the base rule above, so precedence between these three is
      decided by source order (below: base, then OS-preference, then
      explicit attribute, so an explicit attribute always wins over the
      OS default) rather than by selector specificity, keeping a host
      override able to beat all three regardless of which one would
      otherwise apply. See _syncHostTheme() for how the attribute gets
      set automatically when the host already uses <html data-theme>. */
@media (prefers-color-scheme: dark) {
  :where(:host) {
    --lp-bg: #1e293b;
    --lp-surface: #17233a;
    --lp-card-bg: #263449;
    --lp-text: #e2e8f0;
    --lp-text-secondary: #94a3b8;
    --lp-border: #334155;
    --lp-border-strong: #4b5b73;
    --lp-accent: #60a5fa;
    --lp-focus-ring: #60a5fa;
    --lp-hover-bg: #2d3f57;
    --lp-selected-bg: #1f3a5f;
  }
}
:where(:host([data-theme="dark"])) {
  --lp-bg: #1e293b;
  --lp-surface: #17233a;
  --lp-card-bg: #263449;
  --lp-text: #e2e8f0;
  --lp-text-secondary: #94a3b8;
  --lp-border: #334155;
  --lp-border-strong: #4b5b73;
  --lp-accent: #60a5fa;
  --lp-focus-ring: #60a5fa;
  --lp-hover-bg: #2d3f57;
  --lp-selected-bg: #1f3a5f;
}
:where(:host([data-theme="light"])) {
  --lp-bg: #ffffff;
  --lp-surface: #f4f4f2;
  --lp-card-bg: #ffffff;
  --lp-text: #1a1a1a;
  --lp-text-secondary: #55554f;
  --lp-border: #d6d6d0;
  --lp-border-strong: #9a9a90;
  --lp-accent: #185fa5;
  --lp-focus-ring: #185fa5;
  --lp-hover-bg: #eef3f8;
  --lp-selected-bg: #e6f1fb;
}
button.lp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.5em 0.85em;
  min-height: 44px;
  background: var(--lp-bg);
  color: var(--lp-text);
  border: 1px solid var(--lp-border-strong);
  border-radius: var(--lp-radius);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
}
button.lp-trigger:hover { background: var(--lp-hover-bg); }
button.lp-trigger:focus-visible {
  outline: 2px solid var(--lp-focus-ring);
  outline-offset: 2px;
}
.lp-trigger-icon { font-size: 1em; line-height: 1; letter-spacing: -0.05em; }
.lp-trigger-arrow { font-size: 0.7em; margin-inline-start: 0.2em; }
.lp-panel {
  position: absolute;
  top: calc(100% + 4px);
  inset-inline-start: 0;
  width: max(300px, 100%);
  max-width: min(380px, 90vw);
  max-height: min(460px, 70vh);
  background: var(--lp-bg);
  border: 1px solid var(--lp-border-strong);
  border-radius: var(--lp-radius);
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  display: none;
  flex-direction: column;
  overflow: hidden;
  z-index: 1000;
}
.lp-panel.open { display: flex; }
input.lp-search {
  border: none;
  border-bottom: 1px solid var(--lp-border);
  padding: 0.75em 0.9em;
  font-size: 0.95rem;
  font-family: inherit;
  color: var(--lp-text);
  background: var(--lp-bg);
  width: 100%;
  box-sizing: border-box;
}
input.lp-search:focus-visible {
  outline: 2px solid var(--lp-focus-ring);
  outline-offset: -2px;
}
.lp-list {
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0.5em;
  background: var(--lp-surface);
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}
.lp-option {
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding: 0.6em 0.75em;
  min-height: 44px;
  text-decoration: none;
  color: var(--lp-text);
  cursor: pointer;
  box-sizing: border-box;
  background: var(--lp-card-bg);
  border: 1px solid var(--lp-border);
  border-radius: calc(var(--lp-radius) - 2px);
}
.lp-option:hover { border-color: var(--lp-border-strong); background: var(--lp-hover-bg); }
.lp-option.active { border-color: var(--lp-accent); box-shadow: 0 0 0 1px var(--lp-accent); }
.lp-option[aria-selected="true"] { background: var(--lp-selected-bg); border-color: var(--lp-accent); }
.lp-option[aria-selected="true"] .lp-exonym { font-weight: 600; }
.lp-flags { display: inline-flex; flex-shrink: 0; gap: 3px; align-items: center; overflow: hidden; }
.lp-flags img { width: 1.8em; height: 1.35em; object-fit: cover; border: 1px solid rgba(0,0,0,0.15); border-radius: 2px; display: block; }
.lp-names { display: flex; flex-direction: column; min-width: 0; }
.lp-exonym { font-size: 0.95rem; }
.lp-endonym { font-size: 0.8rem; color: var(--lp-text-secondary); }
.lp-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
.lp-empty { padding: 0.9em; font-size: 0.9rem; color: var(--lp-text-secondary); background: var(--lp-surface); }
@media (prefers-reduced-motion: no-preference) {
  .lp-panel { transition: opacity 0.12s ease; }
}
@media (forced-colors: active) {
  /* Windows High Contrast etc. strip custom backgrounds/box-shadows —
     the active/selected rings below are box-shadow-only today (see
     .lp-option.active above), which disappears entirely under
     forced-colors. outline survives it, so re-assert state with outline
     instead of relying on the box-shadow/border-color trick working. */
  button.lp-trigger, .lp-panel, .lp-option { border: 1px solid CanvasText; }
  .lp-option.active, .lp-option[aria-selected="true"] { outline: 2px solid Highlight; outline-offset: -2px; }
  .lp-flags img { forced-color-adjust: none; }
}
`;

export class LanguagePicker extends HTMLElement {
  static get observedAttributes() {
    return ['langs', 'current', 'mode', 'fallback-lang', 'show-flags', 'query-param'];
  }

  constructor() {
    super();
    this._open = false;
    this._entries = [];
    this._index = null;
    this._activeIndex = -1;
    this._filteredTags = [];

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <button type="button" class="lp-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="lp-trigger-icon" aria-hidden="true">🌐 文A</span>
        <span class="lp-trigger-label"></span>
        <span class="lp-trigger-arrow" aria-hidden="true">▾</span>
      </button>
      <div class="lp-panel" role="presentation">
        <input type="text" class="lp-search" role="combobox" aria-expanded="false"
               aria-controls="lp-listbox" aria-autocomplete="list" />
        <ul class="lp-list" id="lp-listbox" role="listbox"></ul>
        <div class="lp-empty" hidden></div>
        <div class="lp-status" role="status" aria-live="polite"></div>
      </div>
    `;

    this._trigger = this.shadowRoot.querySelector('.lp-trigger');
    this._triggerLabel = this.shadowRoot.querySelector('.lp-trigger-label');
    this._panel = this.shadowRoot.querySelector('.lp-panel');
    this._search = this.shadowRoot.querySelector('.lp-search');
    this._list = this.shadowRoot.querySelector('.lp-list');
    this._empty = this.shadowRoot.querySelector('.lp-empty');
    this._status = this.shadowRoot.querySelector('.lp-status');

    this._onTriggerClick = this._onTriggerClick.bind(this);
    this._onSearchInput = this._onSearchInput.bind(this);
    this._onSearchKeydown = this._onSearchKeydown.bind(this);
    this._onDocumentClick = this._onDocumentClick.bind(this);
    this._onListClick = this._onListClick.bind(this);
  }

  async connectedCallback() {
    this._trigger.addEventListener('click', this._onTriggerClick);
    this._search.addEventListener('input', this._onSearchInput);
    this._search.addEventListener('keydown', this._onSearchKeydown);
    this._list.addEventListener('click', this._onListClick);
    document.addEventListener('click', this._onDocumentClick);

    // Auto-follow the host page's own <html data-theme="..."> toggle
    // (plug-cost's convention), unless the host set data-theme directly
    // on <language-picker> itself — that's treated as an explicit
    // opt-out of auto-sync, full manual control from then on.
    if (!this.hasAttribute('data-theme')) {
      this._syncHostTheme();
      this._themeObserver = new MutationObserver(() => this._syncHostTheme());
      this._themeObserver.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    }

    await this._load();
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocumentClick);
    this._themeObserver?.disconnect();
  }

  _syncHostTheme() {
    const hostTheme = document.documentElement.getAttribute('data-theme');
    if (hostTheme) this.setAttribute('data-theme', hostTheme);
    else this.removeAttribute('data-theme');
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (this.isConnected) this._load();
  }

  get langs() {
    return (this.getAttribute('langs') || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  get currentLang() {
    return this.getAttribute('current') || '';
  }

  get mode() {
    return this.getAttribute('mode') || 'path-prefix';
  }

  // Off by default (DESIGN.md §3's "text identifies, flags decorate" rule
  // — a working picker must not depend on them). Opt in with show-flags="true".
  get showFlags() {
    return this.getAttribute('show-flags') === 'true';
  }

  async _load() {
    const langs = this.langs;
    if (langs.length === 0) return;

    const [allLanguages, nameTable, regionTable] = await Promise.all([loadLanguagesData(), loadNameTable(), loadRegionTable()]);
    this._nameTable = nameTable;
    this._generatedByTag = new Map(allLanguages.map((language) => [language.tag, language]));
    this._entries = buildLanguageSet(allLanguages, nameTable, regionTable, langs, langs);

    // Sort by the *displayed* name (the translated-name primary line, §7)
    // using a collator for the current UI language, not a fixed locale.
    // This matters beyond just "alphabetical": each language's own
    // collation rules decide where its accented letters sit — Slovak
    // collation places "č" immediately after all "c" words, not at the
    // end of the alphabet or interleaved arbitrarily. Sorting with the
    // *viewer's* language keeps that correct regardless of which UI
    // language is active.
    const collator = new Intl.Collator(this.currentLang || 'en');
    this._entries.sort((a, b) => collator.compare(this._exonymFor(a.tag) ?? a.endonym, this._exonymFor(b.tag) ?? b.endonym));

    this._index = buildIndex(this._entries);
    this._byTag = new Map(this._entries.map((entry) => [entry.tag, entry]));

    this._renderTriggerLabel();
    this._filter('');
  }

  _renderTriggerLabel() {
    const browserLanguages = (typeof navigator !== 'undefined' && navigator.languages) || [];
    const fallbackTag = this.getAttribute('fallback-lang');
    const pickedTag = pickTriggerLanguage(browserLanguages, this.langs, fallbackTag);

    if (pickedTag && this._byTag?.has(pickedTag)) {
      this._triggerLabel.textContent = this._byTag.get(pickedTag).endonym;
      this._triggerLabel.hidden = false;
    } else {
      this._triggerLabel.textContent = '';
      this._triggerLabel.hidden = true;
    }

    const currentName = this._englishNameOf(this.currentLang);
    this._trigger.setAttribute('aria-label', `Change language — page is currently in ${currentName}`);
  }

  _englishNameOf(tag) {
    return this._nameTable?.[tag]?.en ?? tag;
  }

  _onTriggerClick() {
    this._open ? this._close() : this._openPanel();
  }

  _openPanel() {
    this._open = true;
    this._panel.classList.add('open');
    this._trigger.setAttribute('aria-expanded', 'true');
    this._search.setAttribute('aria-expanded', 'true');
    this._search.value = '';
    this._filter('');
    this._search.focus();
  }

  _close() {
    this._open = false;
    this._panel.classList.remove('open');
    this._trigger.setAttribute('aria-expanded', 'false');
    this._search.setAttribute('aria-expanded', 'false');
    this._search.removeAttribute('aria-activedescendant');
    this._activeIndex = -1;
  }

  _closeAndRefocusTrigger() {
    this._close();
    this._trigger.focus();
  }

  _onDocumentClick(e) {
    if (!this._open) return;
    const path = e.composedPath();
    if (!path.includes(this)) this._close();
  }

  _onSearchInput() {
    this._filter(this._search.value);
  }

  _filter(query) {
    if (!this._index) return;
    this._filteredTags = search(this._index, query);
    this._renderList();

    const count = this._filteredTags.length;
    this._status.textContent = count === 0
      ? 'No languages found'
      : `${count} language${count === 1 ? '' : 's'}`;
  }

  _renderList() {
    this._list.innerHTML = '';
    this._activeIndex = this._filteredTags.length > 0 ? 0 : -1;
    this._empty.hidden = this._filteredTags.length !== 0;

    for (const [index, tag] of this._filteredTags.entries()) {
      const entry = this._byTag.get(tag);
      const li = this._renderOption(entry, index);
      this._list.appendChild(li);
    }
    this._syncActiveDescendant();
  }

  _renderOption(entry, index) {
    const li = document.createElement('li');
    li.className = 'lp-option';
    li.id = `lp-opt-${index}`;
    li.setAttribute('role', 'option');
    li.dataset.tag = entry.tag;
    li.setAttribute('aria-selected', String(entry.tag === this.currentLang));
    if (isRtl(entry.tag)) li.setAttribute('dir', 'rtl');

    // Primary line: this language's name *translated into the current UI
    // language* ("Nemecky" while browsing in Slovak). Secondary line:
    // the endonym, the name in its own script ("Deutsch"). Always both,
    // even when they happen to be identical (English viewed in English
    // is legitimately "English" / "English") — the pair is the point.
    const names = document.createElement('span');
    names.className = 'lp-names';

    const exonym = this._exonymFor(entry.tag);
    const primaryEl = document.createElement('span');
    primaryEl.className = 'lp-exonym';
    if (this.currentLang) primaryEl.setAttribute('lang', this.currentLang);
    primaryEl.textContent = exonym || entry.endonym;
    names.appendChild(primaryEl);

    const secondaryEl = document.createElement('span');
    secondaryEl.className = 'lp-endonym';
    secondaryEl.setAttribute('lang', entry.tag);
    secondaryEl.textContent = entry.endonym;
    names.appendChild(secondaryEl);

    li.appendChild(names);

    if (this.showFlags) {
      const flagsSpan = document.createElement('span');
      flagsSpan.className = 'lp-flags';
      flagsSpan.setAttribute('aria-hidden', 'true');
      const flagCodes = this._flagsFor(entry.tag);
      for (const code of flagCodes) {
        const img = document.createElement('img');
        img.src = this.flagUrl ? this.flagUrl(code) : defaultFlagUrl(code);
        img.alt = '';
        img.loading = 'lazy';
        img.width = 27;
        img.height = 20;
        flagsSpan.appendChild(img);
      }
      li.appendChild(flagsSpan);
    }

    return li;
  }

  _flagsFor(tag) {
    const generatedLanguage = this._generatedByTag?.get(tag);
    if (generatedLanguage) return generatedLanguage.flags;
    return [];
  }

  _exonymFor(tag) {
    const viewerTag = this.currentLang || 'en';
    return this._nameTable?.[tag]?.[viewerTag] ?? this._nameTable?.[tag]?.en ?? null;
  }

  _onSearchKeydown(e) {
    const optionCount = this._filteredTags.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (optionCount > 0) this._setActive((this._activeIndex + 1 + optionCount) % optionCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (optionCount > 0) this._setActive((this._activeIndex - 1 + optionCount) % optionCount);
        break;
      case 'Home':
        if (optionCount > 0) { e.preventDefault(); this._setActive(0); }
        break;
      case 'End':
        if (optionCount > 0) { e.preventDefault(); this._setActive(optionCount - 1); }
        break;
      case 'Enter':
        e.preventDefault();
        if (this._activeIndex >= 0) this._select(this._filteredTags[this._activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        this._closeAndRefocusTrigger();
        break;
      case 'Tab':
        this._close();
        break;
    }
  }

  _setActive(index) {
    this._activeIndex = index;
    this._syncActiveDescendant();
  }

  _syncActiveDescendant() {
    for (const option of this._list.children) option.classList.remove('active');
    if (this._activeIndex >= 0) {
      const activeOption = this._list.children[this._activeIndex];
      if (activeOption) {
        activeOption.classList.add('active');
        this._search.setAttribute('aria-activedescendant', activeOption.id);
        activeOption.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
    this._search.removeAttribute('aria-activedescendant');
  }

  _onListClick(e) {
    const option = e.target.closest('.lp-option');
    if (!option) return;
    e.preventDefault();
    this._select(option.dataset.tag);
  }

  _select(tag) {
    const entry = this._byTag.get(tag);
    if (!entry) return;

    const detail = { tag: entry.tag, endonym: entry.endonym, flags: this._flagsFor(tag) };
    const selectEvent = new CustomEvent('language-select', { detail, bubbles: true, composed: true, cancelable: true });
    const notCancelled = this.dispatchEvent(selectEvent);

    this._closeAndRefocusTrigger();

    if (!notCancelled || this.mode === 'none') return;

    const href = this._hrefFor(tag);
    window.location.href = href;
  }

  _hrefFor(tag) {
    const { pathname, search } = window.location;
    if (this.mode === 'query-param') {
      return queryParamHref(pathname, search, tag, this.getAttribute('query-param') || 'lang');
    }
    return pathPrefixHref(pathname, search, tag, this.langs);
  }
}

if (!customElements.get('language-picker')) {
  customElements.define('language-picker', LanguagePicker);
}
