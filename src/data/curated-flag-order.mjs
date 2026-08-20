// Editorial ordering for languages spoken (officially) in more than one
// country — see DESIGN.md §3. Rule applied: total speakers, among
// countries where the language is official, capped at 3.
//
// This is a judgment call, not a lookup — several entries are genuinely
// contentious (zh, ko, sr, ar in particular). A host embedding this
// component can override any entry; these are only the shipped defaults.
//
// build-languages.mjs throws if a language has >1 country and no entry
// here, so a newly-appearing multi-country language can't silently pick
// an arbitrary/alphabetical order — it forces a deliberate decision.
export const CURATED_FLAG_ORDER = {
  en: { flags: ['US', 'GB', 'NG'], note: 'US: largest speaker base. GB: historic anchor/origin. NG: largest population among remaining English-official countries in this dataset (India is not in the list — its primary mapped language here is hi, not en).' },
  fr: { flags: ['FR', 'CD', 'CI'], note: 'FR: origin/anchor. CD: largest francophone population by count (DR Congo). CI: next-largest population (Canada is not in the list — its primary mapped language here is en, not fr).' },
  ar: { flags: ['EG', 'SA', 'DZ'], note: 'EG: largest Arabic-speaking population. SA: religious/economic center. DZ: next-largest population. Contentious — 21 countries share this code.' },
  es: { flags: ['MX', 'ES', 'AR'], note: 'MX: largest Spanish-speaking population. ES: origin/anchor. AR: next-largest population.' },
  pt: { flags: ['BR', 'PT', 'AO'], note: 'BR: dwarfs all others in speaker count. PT: origin/anchor. AO: next-largest population.' },
  nl: { flags: ['NL', 'BE', 'SR'], note: 'NL: anchor. BE: large speaker base (Flanders). SR: Suriname.' },
  de: { flags: ['DE', 'AT', 'CH'], note: 'DE: largest population. AT, CH: next by population.' },
  zh: { flags: ['CN', 'TW', 'HK'], note: 'CN: largest population. TW, HK kept distinct (traditional script, politically salient) rather than folded into CN — deliberately contentious, revisit if hosts object.' },
  ms: { flags: ['MY', 'BN'], note: 'MY: larger population. BN: Brunei.' },
  el: { flags: ['GR', 'CY'], note: 'GR: anchor. CY: Cyprus.' },
  it: { flags: ['IT', 'SM'], note: 'IT: anchor. SM: San Marino, the only other sovereign state with Italian as sole official language.' },
  sw: { flags: ['TZ', 'KE'], note: "TZ: Swahili's historic/cultural home (Zanzibar). KE: Kenya, widely recognized." },
  ko: { flags: ['KR', 'KP'], note: 'KR: far larger population/economy. KP: North Korea. Contentious given the political relationship.' },
  ro: { flags: ['RO', 'MD'], note: 'RO: anchor, larger population. MD: Moldova.' },
  sr: { flags: ['RS', 'ME'], note: 'RS: anchor, larger population. ME: Montenegro. Contentious — language/ethnicity politics in the region run deep.' },
  sv: { flags: ['SE', 'AX'], note: "SE: anchor, overwhelming majority of speakers. AX: Åland, Finland's Swedish-speaking autonomous region." },
};
