# lingua-switch — file layout

See [README.md](README.md) for usage and [DESIGN.md](DESIGN.md) for the
design reasoning behind these choices.

- `src/data/vendor/` — pinned, vendored raw ISO 3166-1 country data
  (CC BY-SA 4.0 — attribution + ShareAlike obligations noted in its
  `SOURCE.md`; `LICENSE` cross-references it — the code is MIT, this one
  data file carries its own separate note).
- `src/data/` — hand-maintained source data:
  - `country-to-lang.json` — ISO 3166 country → primary BCP-47 language
    (`PH` → `fil`, the canonical tag — not `tl`, ISO 639-1's deprecated one)
  - `countries.json` — country metadata (name, alpha-2/3, continent),
    generated from `src/data/vendor/` by `scripts/build-country-data.mjs`
  - `excluded-territories.mjs` — uninhabited ISO entries to drop
  - `curated-flag-order.mjs` — hand-picked, documented flag ordering for
    the 16 languages spoken in more than one country
- `scripts/build-country-data.mjs` — derives `src/data/countries.json`
  from the pinned vendor data
- `scripts/build-languages.mjs` — turns the country-first source data
  above into the language-first table, fails loudly on missing/incorrect
  curation
- `scripts/build-language-names.mjs` / `build-region-names.mjs` —
  precompute every "name of language/country X as written by a viewer of
  language V" pair (76×76 languages, 237×76 countries) using Node's
  `Intl.DisplayNames`, with an explicit guard against silently baking in
  the build machine's ambient locale for the handful Node itself lacks
  data for. See DESIGN.md §4 for why this runs at build time rather than
  live in the browser — a real, serious bug, not a hypothetical one.
- `scripts/optimize-flags.mjs` — runs `svgo --precision=1` over the
  vendored flags in place (~40% smaller; a handful carry full coat-of-
  arms detail for icons rendered at ~20×15px)
- `scripts/subset.mjs` — **the build-time subsetting CLI.** Takes
  `--langs sk,en,de --out ./dist/language-picker` and writes a minimal,
  self-contained output directory: only those languages' data, only the
  N×N slice of the name/region matrices (not the full 76-wide rows —
  this is the real saving, since the component always uses
  `uiLangs = langs`), only the flags actually referenced, plus the
  handful of small JS modules copied as-is (no bundler). Mirrors `src/`'s
  relative layout exactly, so `language-picker.mjs`'s existing
  `./generated/...` and `./assets/flags/...` fetches work unmodified.
  Measured: sk+en+de → ~38KB, vs. ~1.3MB for the full unsubset dataset.
- `src/generated/*.json` — build output (languages, language-names,
  region-names). Regenerate all three with `npm run build:data` after
  touching anything in `src/data/`.
- `src/assets/flags/` — 100 flag SVGs, vendored locally and `svgo`-
  optimized (see its `SOURCE.md` — flagcdn.com, public domain, no live
  third-party requests at render time). Only the country codes actually
  referenced by `languages.json`'s `flags` field.
- `src/match.mjs` — pure search/normalize/rank functions, no DOM
- `src/display-names.mjs` — bridges the generated tables to the shape
  match.mjs consumes (endonyms/exonyms/region-names, all from the
  precomputed matrices — no runtime `Intl.DisplayNames` calls left
  anywhere in the shipped component)
- `src/url-strategies.mjs` — pure href computation for `path-prefix` /
  `query-param` output modes, always root-relative
- `src/rtl.mjs` — which BCP-47 tags need `dir="rtl"`
- `src/trigger-label.mjs` — the DESIGN.md §8 fallback chain for what
  language the trigger button shows, as a pure function
- `src/language-picker.mjs` — the `<language-picker>` custom element
  itself. Wires all of the above into a real ARIA combobox: keyboard
  nav, live-region result counts, focus management, locale-aware
  alphabetical sort of the option list (`Intl.Collator` on the current
  UI language — e.g. Slovak's "č" sorts right after "c", not lumped
  elsewhere), root-relative `<a>`-equivalent navigation, cancelable
  `language-select` event, card-styled option list, locally-vendored
  flags, `forced-colors` (Windows High Contrast) support. Every DOM
  insertion of dynamic data goes through `textContent`/`setAttribute`/
  `createElement` — audited, no `innerHTML` + string-interpolation
  anywhere, so no XSS surface from host-supplied attributes or fetched
  data.
- `test/*.test.mjs` — `node --test` coverage for every pure module in
  `src/` (kept in its own directory, separate from the shipped surface —
  `scripts/subset.mjs` already whitelists exactly which files ship, but
  keeping `src/` itself test-free removes any doubt), including
  regression tests for the real bugs found along the way (a
  self-referential CSS token cycle that made the panel transparent, and
  a silent-locale-substitution bug in language/region-name resolution)
- `demo/index.html` + `scripts/dev-server.mjs` — manual test page (page
  starts with `lang="zh"` on purpose, to exercise the trigger label's
  hardest case; applies picked languages itself via `mode="none"`, the
  way a real client-side-routed host would) and a zero-dependency static
  server (`Cache-Control: no-store` — a stale dev-server cache burned an
  hour once, don't remove this) to view it
- `showcase/index.html` — **the source of truth for the showcase page.**
  Edit this one. Its script tags reference `/src/...` directly (root-
  relative), so it only renders correctly under `npm run dev`, which
  serves the whole repo — not standalone. Three sections: a realistic
  3-language example with a simulated address bar, the full 76-language
  set with flags on, and the three output modes side by side with their
  actual computed results shown live. Every picker runs `mode="none"`
  and every "navigation" is simulated with the same pure
  `pathPrefixHref`/`queryParamHref` functions the component itself
  uses — the page never actually navigates away, so all three demos stay
  usable together. Includes a light/dark toggle that every picker on the
  page follows automatically via the `<html data-theme>` sync (§11) — no
  extra wiring, direct proof that feature works. Responsive down to
  375px, no horizontal overflow at any width, verified in a real browser.
- `scripts/build-public.mjs` → `public/` — **the deployable output,
  generated, gitignored, never hand-edited.** Copies `showcase/index.html`
  with its `/src/...` script paths rewritten to `/language-picker/...`,
  plus the 6 runtime modules, the full generated dataset, and all 100
  flags into `public/language-picker/`, so the result is completely
  self-contained — no reference to `src/` anywhere. Verified by serving
  `public/` in total isolation (a throwaway server rooted only at that
  folder, nothing else from the repo reachable) and confirming every
  picker still upgrades and works. This is the folder to point Cloudflare
  Pages (or any static host) at. Re-run `npm run build:public` after
  editing `showcase/index.html` or anything in `src/` — never edit `public/`
  itself, it's wiped on every rebuild.
