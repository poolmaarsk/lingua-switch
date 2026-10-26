# lingua-switch

Embeddable `<language-picker>` web component — the project/package is
named **lingua-switch**; the HTML custom element it exports stays
`<language-picker>` (generic, descriptive tag name, distinct from the
project's brand name). Core component is built, tested, and manually
verified in a real browser. MIT licensed — see [LICENSE](LICENSE). See
[DESIGN.md](DESIGN.md) for the full design reasoning and open decisions.

- Repository: <https://github.com/poolmaarsk/lingua-switch>
- Live showcase: <https://linguaswitch.poolmaarsk.eu/>

If you use lingua-switch on your site, a link back to
<https://linguaswitch.poolmaarsk.eu/> is appreciated — but not required.
The MIT license only asks that you keep the copyright notice and license
text (the `/*!` banners at the top of each file survive minification, so
just don't strip them).

## Layout

See [LAYOUT.md](LAYOUT.md) for the full file-by-file breakdown.

## Develop

```bash
npm install            # dev tooling (svgo, esbuild) — the component itself ships zero dependencies
npm run build:data     # regenerate src/data/countries.json + src/generated/*.json
npm test               # node --test test/*.test.mjs
npm run dev            # serves the whole project at http://localhost:4174
                        #   - /demo/index.html for manual dev testing
                        #   - /showcase/index.html — the public-facing showcase page
npm run optimize:flags # re-run svgo over src/assets/flags/ (after re-vendoring)
npm run subset -- --langs sk,en,de --out ./dist/language-picker            # unminified drop-in bundle
npm run subset -- --langs sk,en,de --out ./dist/language-picker --minify  # same, with the 6 .mjs files minified
npm run build:public   # build public/ — self-contained, deployable showcase (Cloudflare Pages etc.)
```

`public/` is generated, gitignored, and safe to delete/regenerate any time — it's not
source. Edit `showcase/index.html`, then re-run `npm run build:public`; never edit
anything under `public/` directly, it gets wiped on every rebuild. Deploy the `public/`
folder as-is (e.g. Cloudflare Pages → direct upload of that folder) — it's fully
self-contained, no `/src/` reference anywhere in it, verified by serving it in complete
isolation from the rest of the repo.

`public/index.html` references its own scripts with a **relative** path
(`./language-picker/language-picker.mjs`), not root-relative — deliberately, since this
one file gets served two different ways (`public/` as the literal site root once
deployed, or as a `/public/` subpath during local preview via `npm run dev`), and a
root-relative path is only correct in one of those. Hit this for real: an earlier
root-relative version 404'd under `npm run dev` with no `Content-Type` on the 404
response, which browsers report as a bogus MIME-type/CORS error on the module fetch
instead of a plain, obvious 404. If `scripts/build-public.mjs` is ever touched, keep this
relative.

**Don't open `public/index.html` by double-clicking it.** Browsers block
`<script type="module">` under the `file://` protocol — every module fetch fails with a
CORS-shaped error (`Cross-Origin Request Blocked` / `Module source URI is not allowed`),
because each local file is treated as its own origin. This isn't a bug in this project
and isn't fixable by changing paths or folder names — ES modules require a real HTTP
server, always, everywhere, including for local testing. Two ways to preview `public/`
correctly before deploying:

```bash
npm run dev                          # then open http://localhost:4174/public/index.html
# or, from inside public/, any static server works, e.g.:
npx serve .                          # or: python -m http.server
```

Once actually deployed (Cloudflare Pages, any real host), this is a non-issue — they
always serve over `http(s)://`.

## Using it

### From npm

```bash
npm install @poolmaarsk/lingua-switch
```

```js
import '@poolmaarsk/lingua-switch'; // registers <language-picker>, side-effect import
```

```html
<language-picker langs="sk,en,de" current="en" mode="path-prefix"></language-picker>
```

Works with any bundler (Vite, webpack, esbuild, Rollup) — `package.json`'s `exports`
points straight at the unbundled ES module, and `sideEffects` is set so bundlers don't
tree-shake away the `customElements.define()` call just because nothing else imports
from the module. The published package ships the *full* 76-language dataset (no
subsetting on npm's side yet — see DESIGN.md's "Suggested build order"); if bundle size
matters, use the drop-in script-tag approach below with `npm run subset` instead.

### Drop-in `<script>` tag, no build step

```html
<script type="module" src="/path/to/src/language-picker.mjs"></script>
<language-picker langs="sk,en,de" current="en" mode="path-prefix"></language-picker>
```

For production, point the `<script>` at a subset built with
`npm run subset` instead of `src/` directly — see above.

### From a CDN, zero install

jsDelivr and unpkg both mirror npm automatically — nothing to publish or
configure beyond the npm release itself. Verified end-to-end (not just
the entry file: every relative import, the generated language/region
JSON data, and the flag SVGs all resolve correctly from both):

```html
<!-- jsDelivr, pinned to a version (recommended) -->
<script type="module" src="https://cdn.jsdelivr.net/npm/@poolmaarsk/lingua-switch@0.1.1/src/language-picker.mjs"></script>

<!-- jsDelivr, always latest — convenient, but a new release can change
     behavior under you with no warning -->
<script type="module" src="https://cdn.jsdelivr.net/npm/@poolmaarsk/lingua-switch/src/language-picker.mjs"></script>

<!-- unpkg, pinned -->
<script type="module" src="https://unpkg.com/@poolmaarsk/lingua-switch@0.1.1/src/language-picker.mjs"></script>

<language-picker langs="sk,en,de" current="en" mode="path-prefix"></language-picker>
```

This ships the full 76-language dataset, same as the npm install path —
there's no CDN-hosted subset build. If bundle size matters, use `npm run
subset` (or `npx lingua-switch-subset`) locally and host the resulting
files yourself instead.

- `langs` — comma-separated BCP-47 tags the host has translated.
- `current` — the current page's language tag.
- `mode`:
  - `path-prefix` (default) — `/sk/...`
  - `query-param` — `?lang=sk`
  - `none` — fires the event, never navigates; for full custom routing
- `fallback-lang` and `query-param="locale"` are also supported.
- Flags are **off by default** — pass `show-flags="true"` to enable
  them; they load from the vendored local SVGs, no third-party request.
- Row layout is always "translated name" on top, endonym below, shown in
  full even when they're identical (e.g. English viewed in English) —
  see DESIGN.md §7.

See the doc comment at the top of `language-picker.mjs` for the full
attribute list.

### Theming, light/dark mode

Every color is a CSS custom property (`--lp-bg`, `--lp-text`,
`--lp-accent`, `--lp-border`, `--lp-hover-bg`, `--lp-selected-bg`, …) and
custom properties cross the shadow-DOM boundary normally, so a host can
override any of them from outside with plain CSS — no build step, no
component API needed for that.

Dark mode specifically has two automatic paths built in, no host wiring
required for either:

1. **`prefers-color-scheme: dark`** — used as the default whenever
   nothing else says otherwise.
2. **`<html data-theme="dark">`** (or `"light"`) — if the host page
   already has this attribute (this is `plug-cost`'s existing
   convention — see `pages/CLAUDE.md`, this is the first concrete piece
   of shared theming between the two projects), `<language-picker>`
   mirrors it onto itself automatically and live, via a
   `MutationObserver` on `document.documentElement` set up in
   `connectedCallback`. An explicit attribute always wins over the OS
   preference, in both directions.

To opt a specific instance out of that auto-sync and control it
manually instead, just set `data-theme="light"` / `"dark"` **directly on
the `<language-picker>` element itself** before/when it connects — the
component detects that and never touches it again for that instance.

Verified in a real browser: OS-dark-by-default, explicit `<html
data-theme>` toggling live in both directions, and the manual per-
instance opt-out all work as described above.

Listen for `language-select` (bubbles, cancelable) to intercept selection
before/instead of the built-in navigation.

**The component never remembers a selection across a reload, in any
mode.** It only computes a URL and navigates to it (`path-prefix` /
`query-param`), or only fires the event (`none`) — restoring `current`
(and `<html lang>`) on the *next* page load is always the host's job:

- `path-prefix` — read the language segment back out of the pathname
- `query-param` — read it back out of `location.search`
- `none` — the event listener has to apply it synchronously, since
  there's no reload to read anything back from

Skipping this looks exactly like "picking a language does nothing": the
component did navigate, but the page never applied the new language on
the way back in, so it silently reverts to whatever `current` was
hardcoded to. This is a real bug that happened while testing this
project, not a hypothetical one. `demo/index.html` has both patterns —
its inline bootstrap script for `path-prefix`/`query-param`, its
`language-select` listener for `none`.

## Status

Done and manually verified in a real browser: the whole core component
(trigger label + fallback chain, panel open/close, search/filter, full
keyboard nav, locale-aware sort, focus return, outside-click close,
`language-select` event, href computation, locally-vendored + optimized
flag rendering, card-styled options, `forced-colors` support, and the
full 76-language set loading and displaying correctly with no
silently-wrong names anywhere — language names or region names).

Also done: the build-time subsetting CLI (now with an optional `--minify`
pass, esbuild-powered — see "Develop" above; devDependency only, so a
plain `npm install @poolmaarsk/lingua-switch` or an unflagged `npx
lingua-switch-subset` stay exactly as dependency-free as before), MIT
licensing (+ the CC BY-SA note for vendored country data),
pinned/vendored ISO source data, `fil` instead of deprecated `tl`, an
XSS audit (no `innerHTML` + interpolation anywhere in the shipped
component), and light/dark theming — CSS custom properties cross the
shadow boundary, plus automatic `prefers-color-scheme` + live
`<html data-theme>` sync (see "Theming, light/dark mode" above).

**Published to npm** as `@poolmaarsk/lingua-switch` — the earlier `403
Forbidden` (2FA required on the publishing account) is resolved; `npm
install @poolmaarsk/lingua-switch` works today. The CLI's `bin` entry
also means a consumer can run `npx lingua-switch-subset --langs ... --out
<dir>` with no local checkout of this repo at all.

**Also available directly from jsDelivr and unpkg** — both mirror npm
automatically, no separate publish step. Verified live: the entry file,
every relative import, the generated language/region JSON, and the flag
SVGs all resolve correctly from both CDNs — see "From a CDN, zero
install" above for the exact `<script>` tags.

**plug-cost is now a real consumer** — its settings popout embeds
`<language-picker>` in place of its old hand-rolled link list, vendoring
a subset built via `npx lingua-switch-subset` (unminified; that project
minifies at its own build step instead — see its CLAUDE.md). This was
the "first real consumer" test this project's design was waiting on;
nothing about the API changed as a result.

Known, deliberately deferred: at full 76-language scale with all 76 also
used as the UI-language set, searching a short 2-letter code like `sk`
returns dozens of loosely-related matches (still correctly ranked with
the exact match first) because the search index for each language
includes region names in every UI language — a real host doing the
subsetting above (a handful of languages, not 76) won't hit this. See
DESIGN.md §6.

See DESIGN.md's "Suggested build order" for what's left.
