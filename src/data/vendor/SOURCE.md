# ISO 3166-1 country data — source and license

`iso-3166-all.json` in this directory is vendored from
[lukes/ISO-3166-Countries-with-Regional-Codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes),
pinned to commit
[`99cdae1`](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes/commit/99cdae15c839bb4f94a23db4e47b4a4c590dec61)
(2024-06-19), fetched 2026-08-20.

Previously `src/data/countries.json` was a derived snapshot copied from
this project's own `legacy-demo/`, which fetched this same upstream file
live from `master` at build time — unpinned, so a future upstream change
could silently alter or break the build. Fixed by vendoring a specific
commit here instead.

## License

This data is **CC BY-SA 4.0** (Creative Commons Attribution-ShareAlike
4.0 International) — see the source repo's
[LICENSE.md](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes/blob/master/LICENSE.md).

Two obligations this actually creates, worth stating plainly rather than
glossing over:

- **Attribution** — this file (satisfies it for this project).
- **ShareAlike** — an *adaptation* of this specific data must carry a
  CC BY-SA-compatible license. `src/data/countries.json` (generated from
  this file by `scripts/build-country-data.mjs`) is such an adaptation.
  This doesn't obligate the *code* in this repository (the picker
  component itself is original work, not a derivative of country data),
  but it does mean: **whatever license this project eventually picks
  (still an open decision — see DESIGN.md §12), the generated
  `countries.json` / `languages.json` data specifically needs a
  CC BY-SA-compatible note alongside it**, distinct from the project's
  overall code license. Flag before publishing, not after.

## Re-fetching / re-pinning

```bash
curl -sf -o src/data/vendor/iso-3166-all.json \
  "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/<commit-sha>/all/all.json"
```

Then update the commit SHA and date in this file, and run
`node scripts/build-country-data.mjs` to regenerate
`src/data/countries.json`.
