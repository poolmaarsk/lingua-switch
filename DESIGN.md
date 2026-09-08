# lingua-switch — design notes

Project name: **lingua-switch**. The HTML custom element it exports
stays `<language-picker>` — a generic, descriptive tag name, kept
separate from the project's brand name on purpose.

Status: **core component built and manually verified in a real
browser, including the build-time subsetting CLI.** The original
throwaway demo this grew out of has been removed. See
[README.md](README.md) for usage and [LAYOUT.md](LAYOUT.md) for the file
layout. Flags render from
locally-vendored, `svgo`-optimized SVGs (no third-party request);
country data comes from a pinned vendored source; both language *and*
region names are precomputed at build time (no runtime
`Intl.DisplayNames` calls left in the shipped component at all — see
§4); `scripts/subset.mjs` produces a minimal per-host bundle (sk+en+de
measured at ~38KB vs. ~1.3MB unsubset); light/dark theming follows the
OS preference and, live, a host's existing `<html data-theme>` toggle
(§11) with zero integration code for a plug-cost-style host. **MIT
licensed** (§12; the `/*!`
copyright banner in every shipped `src/*.mjs` file survives future
minification, same convention as `plug-cost`). An XSS audit found no
`innerHTML` + interpolation anywhere in the component — everything
dynamic goes through `textContent`/`setAttribute`/`createElement`.
Remaining: plug-cost integration (deliberately deferred), npm
publishing.

Goal: an embeddable language switcher for static sites. A host site says
"I have translations for sk, en, de", builds, drops the component in, and
gets back the language the visitor picked.

**Decided so far:** return BCP-47 tags (§2) · language-first data model
(§1) · up to 3 flags per language, off by default until flag delivery is
settled (§3) · `🌐 文A` icon + the visitor's detected-language endonym on
the trigger (§8) · row layout is translated-name-primary /
endonym-secondary, always both (§7) · accessibility is a hard
requirement, not a later pass (§9).

---

## 1. The data model has to be inverted

The demo is **country-first**: 249 countries, each carrying a language.
The product is **language-first**: a list of languages, each carrying
representative flags.

Measured from the current `COUNTRY_TO_LANG` table:

| | count |
|---|---|
| countries | 249 |
| distinct languages | **77** |
| languages spoken in exactly 1 country | 60 |
| languages spoken in >1 country | **17** |
| countries mapped to `en` | 72 |

The picker list is ~77 rows, not 249 — and it cannot be derived by
reversing `COUNTRY_TO_LANG`, because reversing is many-to-one and picks
arbitrarily. Reversed, English's flag becomes American Samoa (`AS`, first
alphabetically).

### Data trap: uninhabited territories

`countries.json` is the full ISO 3166-1 list, which includes 12
territories with no or near-zero permanent population, and the demo maps
languages to them anyway:

```
AQ Antarctica → en        BV Bouvet Island → no
HM Heard & McDonald → en  TF French Southern Terr. → fr
GS South Georgia → en     UM US Minor Outlying Is. → en
IO, CX, CC, NF, PN, SJ …
```

Norwegian's "2 countries" is **Norway + Bouvet Island**. These inflate
every country count and would pollute a flag ranking. Filter them out
before ranking anything.

---

## 2. BCP-47 is the return value — DECIDED

Both alpha-2 and alpha-3 are ISO **3166 country** codes. A language
switcher must return a **language** tag. `sk`/`SK` lining up is a
coincidence; most don't (`cs`/`CZ`, `da`/`DK`, `el`/`GR`, `ja`/`JP`,
`sv`/`SE`).

**Return BCP-47** (`sk`, `en`, `pt-BR`, `zh-Hant`):

- Exactly what `<html lang>`, `<link hreflang>`, `Accept-Language`, and
  every `Intl.*` constructor already consume. No translation layer.
- The only scheme that expresses `pt-BR` vs `pt-PT`, `zh-Hans` vs
  `zh-Hant`, `en-GB` vs `en-US` — distinctions real sites actually ship.
- ISO 639-1 covers only ~180 languages; 639-3 covers ~7900 but nothing on
  the web speaks it. BCP-47 subsumes both.

Accept alpha-2 / alpha-3 / 639-3 as **search input** (typing `SVK` finds
Slovak) — never as the **output**.

---

## 3. Flags: up to 3 per language — DECIDED

Showing the top 3 countries where a language is spoken is a better answer
than picking one, and it defuses the main objection to flags: there is no
"why did you choose Spain over Mexico" argument when you show both.

### It's a 17-row curation job

60 of 77 languages have exactly one country — nothing to decide. Only
these 17 need a curated, ordered list:

```
en 72   fr 34   ar 21   es 21   pt 8   nl 7   de 4   zh 4
no  2   ms  2   el  2   it  2   sw 2   ko 2   ro 2   sr 2   sv 2
```

(and `no` collapses to 1 once Bouvet Island is filtered — see §1)

So: hand-curate ~16 rows, generate the rest. No population dataset
needed, no extra dependency.

### "Most spoken" is an editorial decision, not a lookup

Native speakers and total speakers give different answers, and the
difference is politically visible:

- **Spanish** — Mexico has far more speakers than Spain. Ranking by
  speakers puts 🇲🇽 first; most pickers put 🇪🇸 first out of habit.
- **French** — DR Congo is the largest francophone country by population,
  ahead of Canada.
- **English** — India has more English speakers than the UK, but few are
  native. US/UK/AU is the conventional answer.
- **Portuguese** — Brazil dwarfs Portugal.

Pick one rule (I'd suggest *total speakers, filtered to countries where
it is official*), write it down in the data file, and accept that the
result will occasionally surprise people. Contentious entries to decide
deliberately: `zh` (Taiwan), `ko` (North Korea), `sr` (Kosovo/Montenegro),
`ar` (which of 21).

**Let hosts override per language.** A site whose audience is Latin
American should be able to force 🇲🇽 first without forking.

### Rendering 3 flags without wrecking the row

- **Fixed-width flag slot** regardless of 1 or 3 flags, so rows stay
  aligned and text starts at the same x-offset. A 1-flag row just has
  empty space.
- Consider overlapping/fanned flags (avatar-stack style) to save width —
  or cap at 2 on narrow viewports.
- Flags render at ~20–24px where many are indistinguishable. This is not
  a styling nitpick: 🇮🇩 Indonesia and 🇲🇨 Monaco are *identical* except
  aspect ratio; 🇹🇩 Chad and 🇷🇴 Romania differ by one shade of blue;
  🇮🇪 Ireland and 🇨🇮 Ivory Coast are mirror images. Add a subtle border
  so white-edged flags (🇯🇵, 🇫🇮) don't dissolve into the background.
- **All flags must be `aria-hidden="true"`.** See §9 — a screen reader
  announcing "flag of United Kingdom, flag of United States, flag of
  Australia, English, English" for one row is unusable.

### The rule that keeps flags safe

**Text identifies, flags decorate.** Every row must be findable and
distinguishable with flags switched off — which is also literally true
for colorblind users (§9) and anyone on a slow connection. Ship
`showFlags: false` as a supported mode — **implemented as the default**,
opt-in via `show-flags="true"`.

### Delivery — DECIDED and IMPLEMENTED: vendored locally

`src/assets/flags/` holds the 100 SVGs actually referenced by the
curated flag order, downloaded once from flagcdn.com (public domain,
sourced from Wikimedia Commons — see that directory's `SOURCE.md`) and
served locally, no third-party request at render time. A host can still
override via the `flagUrl` property for its own delivery (CDN, inline
`data:` URIs, whatever).

**Known follow-up, not done**: several of the 100 (`af`, `es`, `mx`,
`me`, `va`, `sm`, `hr`, `ad`, …) carry full coat-of-arms detail and run
50–220KB each — ~13MB total, for icons rendered at ~20×15px. Running
these through `svgo` before they ship in any production bundle is the
obvious next step; not done yet.

---

## 4. Language names come free from `Intl.DisplayNames`

Verified in your Node 22 (full ICU, which Node ships by default):

```js
new Intl.DisplayNames(['en'], {type:'language'}).of('sk')      // "Slovak"
new Intl.DisplayNames(['sk'], {type:'language'}).of('sk')      // "slovenčina"
new Intl.DisplayNames(['de'], {type:'language'}).of('sk')      // "Slowakisch"
new Intl.DisplayNames(['pt-BR'],{type:'language'}).of('pt-BR') // "português (Brasil)"
new Intl.DisplayNames(['en'], {type:'region'}).of('SK')        // "Slovakia"
```

This replaces the hand-written 46-language × 6-string `TRANSLATIONS`
table for *language and country names*, in every direction, generated.

**Generate at build time, DECIDED and IMPLEMENTED** — not runtime. This
reverses an earlier version of this doc, which argued Intl.DisplayNames'
Baseline browser *API* support made a runtime approach safe. That
conflated API availability with data coverage. In a real browser test,
28 of 76 languages (not just obscure ones — Icelandic, Armenian,
Georgian, Khmer, Albanian, Somali) silently substituted the wrong
language's name with no error and no visible sign anything was wrong,
because Intl.DisplayNames negotiates down to *some* supported locale
instead of throwing when it lacks data. Precomputing once at build time
with Node (which has much fuller ICU data — only ~4-5 real gaps) and
shipping the resolved strings as static JSON
(`scripts/build-language-names.mjs` → `src/generated/language-names.json`)
sidesteps the whole bug class. One more trap the build script closes:
Node's *own* fallback for the handful of languages it also lacks data
for is the *build machine's ambient locale* (Slovak, on the machine this
was built on) — silently baking in wrong-but-plausible-looking text
that would be even harder to catch once "static." The build script
detects this via `resolvedOptions().locale` and forces a deterministic
English fallback instead.

Still needs hand translation: the picker's own chrome — search
placeholder, trigger label, aria-labels, the "N languages found" live
message (§9). That's ~5 strings per language, not 6×46.

---

## 5. Build-time subsetting

The feature that makes everything else cheap. `--langs sk,en,de` emits
only those rows, only those flags, only those UI strings.

```bash
npx language-picker build --langs sk,en,de --out ./dist/language-picker
```

At 5 languages the whole thing (data + inlined flags + logic) should be a
few KB, and inlining flag SVGs becomes viable — no third-party requests
at all. At 77 languages it's a different product needing a CDN or sprite.

**Addendum, post-implementation:** the actual CLI is `node scripts/subset.mjs`
(published as the `lingua-switch-subset` bin), not the `npx language-picker
build` shape sketched above — see README.md for the real invocation. It also
gained an optional `--minify` flag (esbuild, per-file — the six `.mjs`
modules stay separate files importing each other by relative path, matching
this section's "no bundler needed" premise; only bundling them together
would have broken it). Added on request after a PageSpeed Insights pass on
plug-cost flagged the vendored, unminified copy of this bundle specifically.
esbuild is a devDependency, imported lazily only when `--minify` is passed,
so `npm install @poolmaarsk/lingua-switch` and a bare `npx
lingua-switch-subset` stay dependency-free exactly as before.

---

## 6. Search and matching

Requirement: typing `slovak`, `slovensky`, `slovenčina`, `sk`, `slk`,
`svk`, or `slovakia` all find Slovak.

Per language, build a normalized index of:

- endonym (`slovenčina`)
- exonym in the current UI language (`Slovak`)
- exonyms in **all shipped UI languages** — cheap once subsetted, and it
  means a German-UI visitor typing "slovak" still succeeds
- ISO 639-1 (`sk`), 639-2/3 (`slk`, `slo`)
- associated country names + alpha-2 + alpha-3 (`Slovakia`, `SK`, `SVK`)

**Normalization**: lowercase + NFD + strip combining marks, so
`slovencina` matches `slovenčina`. Apply to index and query alike.

**Ranking matters more than matching.** Naive substring search means
typing `en` surfaces Slovenian, Danish and French above English. Order:

1. exact code match (`sk` → Slovak, `en` → English)
2. prefix match on endonym or exonym
3. substring match on endonym or exonym
4. country name / code match

Non-Latin scripts work via the exonym path (type "russian" → Русский).
Transliteration ("ruskij") is a stretch goal — skip it.

**Extract match/normalize/rank as pure functions and unit test them**
(`node --test`), like `plug-cost/src/calc.mjs`. Same shape of problem:
fiddly pure logic that regresses silently.

---

## 7. Row layout — DECIDED, implemented

```
Slovak          <- exonym: this language's name, translated into the
slovenčina      <-          current UI language (primary, top)
                <- endonym: the name in its own script (secondary, below)
```

Primary line is the **translated name**, not the endonym — a Slovak-UI
visitor sees "Nemecky" over "Deutsch", not the reverse. The translated
name is what's actually readable to them; the endonym is the reference/
confirmation underneath. (Flags are off by default — see §3's status —
so right now this text pair is the entire row.)

**Always show both lines, even when they're identical.** English viewed
in an English UI is legitimately "English" / "English" — that's not a
bug to collapse away, it's what an honest translated-name/endonym pair
looks like when they happen to coincide. Collapsing it removes
information (you can no longer tell whether the picker is showing a
translated name or a native name) for no real benefit.

- `lang` attribute on **both** spans, not just the endonym: the primary
  line is text in the current UI language, the secondary line is text in
  the target language — each needs its own `lang` so a screen reader
  picks the right voice/pronunciation for both (WCAG 3.1.2 Language of
  Parts).
- RTL languages (`ar`, `he`, `fa`, `ur`, …) need `dir="rtl"` on their row
  or punctuation lands on the wrong side.

---

## 8. The trigger: it has to say "I change the language" — even to someone who can't read the page at all

**Icon: `🌐 文A` — globe followed by the two-script glyph, combined.**
Globe alone means "international", "shipping", "region/currency", or
just "website" as readily as it means language (§8's test case below is
what surfaces that). `文A` alone fixes the ambiguity but is a less
globally-recognized glyph on its own. Together: the globe gets a click
to register as "this control does something site-wide", `文A` narrows it
specifically to language. Implemented as one `aria-hidden` span; the
accessible name (below) carries the real meaning regardless.

### The test case that decides this section

Picture landing on a page in a script you don't read at all — Chinese,
say, with no Latin characters anywhere. What tells you "click here to
change language"?

That's not a hypothetical edge case, it's the **primary user** of this
component: whoever most needs a language switcher is, by definition,
someone who can't read the current page. Design the trigger for them
first, everyone else is easier.

Tested against that case:

| trigger | reads to someone who can't read 中文? |
|---|---|
| `🌐 中文 ▾` (globe + current endonym) | **no.** Globe is ambiguous, label is in the unreadable script. My first draft — fails its own test. |
| `文A 中文 ▾` (icon + current endonym) | icon works, label still doesn't. The A only signals "there's a Latin option somewhere." |
| `文A 中文 · ZH ▾` | legible but jargon — a code means little to a non-technical visitor |
| `文A ▾` icon-only | works, but forces a click before any information is exchanged |
| `文A Slovenčina ▾` *(detected)* | **works.** Own language, own script, no reading of the page required |

### The icon: 文A, not a globe

`文A` — a CJK glyph next to a Latin one — is what Google Translate and
recent Wikipedia use. It's unambiguous because it shows two *writing
systems* rather than a metaphor; it can't be mistaken for shipping or
currency. This is now the only icon in the design, not an option.

### The default label: the visitor's own detected language, not the current page's

Read `navigator.languages`, find the best match in the language set the
host supports, and put **that language's endonym** on the trigger —
`文A Slovenčina ▾` on a Chinese page for a browser set to Slovak. This is
the one label that survives the test above: it doesn't require reading
the page's script, because it's written in the visitor's own.

This supersedes putting the *current page's* language on the trigger —
that only works for a visitor who already reads the current script, which
is close to the group that doesn't need the switcher.

**Fallback chain**, in order:

1. `navigator.languages` match found in the host's language set →
   detected language's endonym (`文A Slovenčina ▾`)
2. no match, but the host declares a fallback language → that language's
   endonym, so the label is never blank
3. neither available → icon-only `文A ▾`

Icon-only still requires `aria-label` naming the *current page* language
("Change language — currently Chinese") plus a `title` tooltip, and is a
real `<button>` either way, with `aria-expanded` and `aria-haspopup`.

**One honesty caveat**: the label suggests but must not imply the page is
already in that language — it's an offer, not a state claim. Row (2) in
the dropdown for the language actually shown should stay marked current
(`aria-selected`) so this stays unambiguous once the dropdown opens.

### Also

- Same detection can additionally power a one-time subtle highlight if
  `navigator.languages` excludes the current page language entirely —
  the trigger label already does most of that job on its own now.
  **Never auto-redirect** (§12).
- The trigger is a `<button>`, not a div. It needs `aria-expanded`,
  `aria-haspopup="listbox"`, and `aria-controls`.

---

## 9. Accessibility — a hard requirement, designed in

Not a later pass. Retrofitting the combobox pattern onto the demo's
structure is a rewrite, so build it correctly the first time.

The demo has real, measured failures to not carry forward:

| issue | measured | required |
|---|---|---|
| `outline: none` on search input, replaced only by a 1px border-colour change | — | visible focus indicator (2.4.7) |
| border `#374151` on `#0d1117` | **1.84:1** | 3:1 for UI components (1.4.11) |
| placeholder `#6b7280` on `#161b22` | **3.58:1** | 4.5:1 (1.4.3) |
| `role="option"` with no `role="listbox"` parent | — | valid ARIA structure (4.1.2) |
| no keyboard navigation at all | — | 2.1.1 |
| fixed 320px absolutely-positioned dropdown | — | reflow at 400% zoom (1.4.10) |

### Blind / screen-reader users

- Full **ARIA combobox** pattern (APG): `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, `role="listbox"` +
  `role="option"`, `aria-selected` on the current language.
- Keyboard: ↑/↓ move, Home/End jump, Enter selects, Esc closes **and
  returns focus to the trigger**, Tab closes without selecting.
- **Live region announcing result counts** while filtering — "12
  languages" / "no matches" (WCAG 4.1.3 Status Messages). Without it a
  screen-reader user types and hears nothing.
- Flags `aria-hidden="true"`, always. Three flags per row otherwise means
  three junk announcements before the language name.
- `lang` attribute on each endonym (§7) so it's pronounced correctly
  rather than read as mangled English phonetics.
- Accessible name on the trigger must state the *current page's*
  language explicitly, even when the visible label (§8) shows a detected
  language instead: "Change language — page is currently in Chinese".
  A screen reader can announce this regardless of script, where the
  visual label can't carry both pieces of information at once.

### Low vision / magnification — the group most often missed

- **Text contrast ≥ 4.5:1, UI borders and focus rings ≥ 3:1.** Both fail
  in the demo today. Pick the palette against these thresholds rather
  than fixing it afterwards.
- **Reflow at 400% zoom** (1.4.10): a 320px fixed-width absolute dropdown
  becomes unusable. Below a breakpoint, go full-screen sheet or native
  `<select>`.
- **Target size ≥ 24×24 CSS px** (WCAG 2.2 SC 2.5.8); the demo's
  `0.6rem 1rem` rows are borderline. 44px is the comfortable target.
- **Focus indicator**: ≥2px, 3:1 contrast against both the focused
  element and its background. Never `outline: none` without a stronger
  replacement.
- **Focus must not be obscured** (2.4.11) — a dropdown overlapping the
  focused trigger fails this.
- Screen-magnifier users see a small viewport slice: keep the dropdown
  visually adjacent to the trigger, not flung to a screen corner.
- Respect **200% text-only zoom** and user text-spacing overrides
  (1.4.12) — no fixed `height` on rows, no `overflow: hidden` clipping.

### Colour vision deficiency

Directly relevant here because flags *are* colour: 🇮🇪/🇨🇮, 🇹🇩/🇷🇴,
🇮🇩/🇲🇨 are indistinguishable or near-indistinguishable to many users
(and to everyone at 20px). This isn't an edge case — it's the reason
**text must identify and flags must only decorate** (§3). Never use
colour alone to mark the currently-selected language; use a checkmark or
text too.

### Windows High Contrast / `forced-colors`

Backgrounds and box-shadows are stripped, and SVG flags may vanish or
invert. Add a `@media (forced-colors: active)` block, keep borders that
survive, and test — you're on Windows, so this is one keystroke to check.

### Motion & other

- `@media (prefers-reduced-motion: reduce)` — the demo animates the
  dropdown and rotates the arrow.
- `prefers-contrast: more` as a bonus.
- Works with JavaScript disabled if the rows are real `<a href>` (§10) —
  a plain link list is a perfectly good degraded switcher.

### Testing plan

- **NVDA** (free, Windows) — actually listen to one filter-and-select run.
- Keyboard-only pass with the mouse unplugged.
- 400% browser zoom, and 320px viewport width.
- axe DevTools / Lighthouse for the mechanical checks (they catch maybe
  30% — the contrast and ARIA-structure ones above, not the live region
  or the focus-return).

Bake the contrast thresholds into the theme tokens (§11) so a host
picking custom colours can't silently fall below them. Consider shipping
a contrast check in the build that fails loud — `plug-cost/build.mjs`
already uses fail-loud validation for locale keys; same idea, same
workspace habit.

---

## 10. The output contract

A single `onSelect(code)` callback is the right escape hatch but the
wrong *default*, because ~90% of sites do one of five known things:

| host pattern | example |
|---|---|
| path prefix | `/sk/page` |
| subdomain | `sk.example.com` |
| query param | `?lang=sk` |
| cookie + reload | server-side routing |
| client-side swap | no navigation |

Ship these as named strategies so the common case is zero-code, and keep
`onSelect` for everything else. Pass the **whole object**, not a string:

```js
{ tag: 'sk', endonym: 'slovenčina', name: 'Slovak', flags: ['SK'] }
```

### Emit real `<a href>`, not divs with click handlers

The demo uses `<div class="lang-option">` + a click listener. For a
shipped component that must be an anchor: crawlable, middle-clickable,
ctrl-clickable, keyboard-accessible by default, works without JS, and it
makes the language set visible to search engines.

**And the hrefs must be root-relative (`/sk/`), not absolute.** Absolute
`https://example.com/sk/` hrefs bounce a visitor on a preview deployment
or a subdomain back to the canonical host, so the language switch looks
like it "loses" the deployment. This is a bug that has already been hit
once in this workspace — bake the fix in as the default rather than
re-learning it.

Related: the component knows the full language set, so it could also emit
the `<link rel="alternate" hreflang>` block from the same source of
truth, instead of hosts duplicating that list by hand and letting it
drift.

---

## 11. Packaging and embedding

**Custom element + Shadow DOM**, zero dependencies.

```html
<script type="module" src="/picker.js"></script>
<language-picker langs="sk,en,de" current="en" mode="path-prefix"></language-picker>
```

- Shadow DOM gives style isolation, which is the point of embedding into
  someone else's page — no CSS collisions in either direction.
- Trade-off: hosts can't restyle with their own selectors. Expose **CSS
  custom properties** as the theming surface (`--lp-bg`, `--lp-text`,
  `--lp-accent`, `--lp-focus-ring`, …), with the §9 contrast floors
  enforced.
- Must work with no build step on the host side: plain `<script>` plus a
  generated data file.

### Light/dark theming — DECIDED and IMPLEMENTED

Custom properties cross the shadow boundary normally, so the CSS surface
above already lets a host theme this from outside with plain CSS — no
component API needed for the general case. Dark mode gets two automatic
paths built in on top of that, verified working in a real browser:

1. **`prefers-color-scheme: dark`** as the default.
2. **`<html data-theme="dark">`** — `plug-cost` already uses exactly
   this convention (`pages/CLAUDE.md` flagged theme tokens as the first
   real candidate for code shared between the two sibling projects, back
   when only plug-cost existed to compare against). `connectedCallback`
   sets up a `MutationObserver` on `document.documentElement` and
   mirrors its `data-theme` attribute onto `<language-picker>` itself
   live, so a plug-cost-style host needs **zero** integration code — the
   picker just follows the page's existing toggle. An explicit
   `data-theme` always wins over the OS preference in both directions.

Escape hatch: a host that wants manual per-instance control sets
`data-theme` directly on the `<language-picker>` element itself (rather
than relying on the auto-sync) — detected at `connectedCallback` time,
and once set that way the element never touches its own `data-theme`
attribute again. Chose "presence of the attribute at connect time" as
the opt-out signal rather than a separate boolean flag — one less
attribute to document, and it matches how a host would naturally reach
for this (they already know how to set an attribute, they don't need to
learn a second one just to say "and don't auto-manage it").

---

## 12. Other open decisions

**Auto-detection.** Read `navigator.languages`, show a "suggested" row at
the top (§8). **Never auto-redirect** — it breaks the back button,
confuses crawlers, and traps anyone whose browser locale ≠ what they want
to read.

**Who owns persistence?** Component or host. Recommend host by default,
with an opt-in localStorage helper; a cookie is needed instead if the
*server* routes. Namespace any key the component writes.

**Mobile.** The fixed-width absolute dropdown clips on small screens.
Bottom sheet or native `<select>` below a breakpoint — same decision as
the 400%-zoom case in §9, so solve them together.

**DONE — country data is now pinned and vendored.** The original demo's
`build.js` fetched `raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json`
live at build time, unpinned — a network dependency on someone else's
`master` branch that could silently break the build. Fixed:
`src/data/vendor/iso-3166-all.json` is now pinned to a specific commit,
with provenance in its `SOURCE.md`. That data is **CC BY-SA 4.0**
(attribution + ShareAlike) — checked, and it matters: an *adaptation* of
this specific data (which `src/data/countries.json` and
`src/generated/languages.json` are) needs a CC BY-SA-compatible note
alongside it, independent of whatever license the project's own code
ends up under. Doesn't block picking MIT for the code — but the data
files need their own line about it.

**Licensing — DECIDED and IMPLEMENTED: MIT.** `LICENSE` at the project
root, `"license": "MIT"` in `package.json`, and a `/*!` copyright banner
(`Copyright (c) 2026 lingua-switch project`) at the top of every shipped
`src/*.mjs` file — deliberately using esbuild/terser's "legal comment"
convention (leading `/*!`) so it survives minification once the
subsetting CLI exists, not just today's unminified source. The specific
requirement that drove this: whoever embeds the component must keep that
notice in their copy of the code — standard MIT term, reinforced by the
banner actually being *in* the shipped file rather than only sitting in
a separate `LICENSE` file a consumer might never open.

The CC BY-SA 4.0 note for the vendored country data (§ above) is
separate and still applies — `LICENSE` cross-references it rather than
conflating the two. flagcdn's terms are no longer relevant (flags are
vendored locally, public domain — see §3), but worth a check if a live
CDN mode is ever added back as an option.

**Scope: the country table — RESOLVED.** The old demo's sortable
249-row country table (a different product — a country data browser,
not a language picker) was never carried into the real component. Moot:
the demo it lived in has been removed entirely.

**XSS — AUDITED, no `innerHTML`+interpolation anywhere.** The concern
here was inherited from the *old* demo, which built HTML via template
literals with a manual `esc()` helper — exactly the risky pattern where
one missed interpolation is a real vulnerability. The rewritten
component never adopted that pattern: `_renderOption` and everything
else in `language-picker.mjs` use `document.createElement` +
`.textContent` / `.setAttribute` throughout, including for host-supplied
values (`current`, `langs`, flag codes). Those DOM APIs don't parse
their input as HTML, so there's no injection surface regardless of what
a host passes in `current` or what a custom `flagUrl` function returns.
The one `innerHTML` write in the file (building the shadow DOM skeleton
in the constructor) interpolates only the `STYLE` constant — authored in
this file, never derived from host or fetched data.

**plug-cost as first real consumer — DONE.** Replaced its hand-rolled
`langSwitcher` link list; exercised subsetting, `path-prefix` mode and
root-relative hrefs all at once, as intended. See plug-cost's own
CLAUDE.md ("Language picker" section) for the integration details and
the one theming gotcha that surfaced there (an internal
`:host([data-theme="dark"])` rule outranking a plain host selector,
fixed by wrapping the internal rule in `:where()`).

---

## Suggested build order — all done

1. ✅ `LANGUAGES` data model — filter uninhabited territories, curate the
   ~16 multi-country flag lists, generate names (precomputed at build
   time, not live `Intl.DisplayNames` — see §4)
2. ✅ Pure search: normalize / match / rank, with `node --test` coverage
3. ✅ Rendering + full ARIA combobox behaviour + `forced-colors` support
4. ✅ Trigger (`🌐 文A` + detected-language endonym) and output strategies
   (`path-prefix` / `query-param` / `none`)
5. ✅ Custom-element packaging and the subsetting CLI (`scripts/subset.mjs`)

6. ✅ npm publish (`@poolmaarsk/lingua-switch`) and plug-cost as the first
   real consumer — both done, see README.md's Status section.
7. ✅ Optional `--minify` pass on `scripts/subset.mjs`'s output
   (esbuild, devDependency-only so the zero-runtime-dependency claim
   holds for anyone not using that flag) — a PageSpeed Insights pass on
   plug-cost flagged its unminified vendored copy of this bundle.

Nothing outstanding right now; see README.md's Status section for
anything that surfaces later.
