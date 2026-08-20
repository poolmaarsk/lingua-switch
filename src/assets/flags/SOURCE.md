# Flag SVGs — source and license

The 100 flag SVGs in this directory were downloaded from
[flagcdn.com](https://flagcdn.com) on 2026-08-20, one file per country
code actually referenced by `src/generated/languages.json`'s `flags`
field (regenerate the list with the snippet at the bottom of this file
if the language/curation data changes).

## License

flagcdn.com is run by [flagpedia.net](https://flagpedia.net), whose
[license page](https://flagpedia.net/about) states flag images are
**public domain** — free for commercial and non-commercial use, no
attribution required. The underlying vector files originate from
Wikimedia Commons.

No attribution is legally required. This file exists anyway, per
project convention: cite the source of anything downloaded and vendored,
license terms or not.

flagcdn.com's own site asks for a courtesy backlink to
https://flagpedia.net when used — not a license condition, but honored
here.

## Re-fetching

```bash
node -e "
const langs = require('../../generated/languages.json');
const codes = new Set();
for (const l of langs) for (const f of l.flags) codes.add(f.toLowerCase());
console.log([...codes].sort().join(','));
"
```

Then `curl -sf -o {code}.svg https://flagcdn.com/{code}.svg` for each.

## Known follow-up, not done here

Several of these (`af`, `es`, `mx`, `me`, `va`, `sm`, `hr`, `ad`, …)
carry full-detail coat-of-arms artwork and run 50–220KB each. The full
set of 100 totals **~1.3MB** (verified by summing actual file bytes —
an earlier note here said ~13MB, which was a `du -sh` block-size
artifact on the machine this was measured on, not real content size;
correcting it rather than leaving it uncorrected). Still worth running
the outliers through an SVG optimizer (e.g. `svgo`) before a production
bundle, since a handful of files dominate a small language subset's
size disproportionately — done, see `scripts/optimize-flags.mjs`.
