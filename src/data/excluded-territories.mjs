// ISO 3166-1 entries with no or near-zero permanent population.
// Excluded so they never inflate a language's country count or leak
// into a flag ranking — see DESIGN.md §1 ("Data trap").
export const EXCLUDED_TERRITORIES = [
  'AQ', // Antarctica
  'BV', // Bouvet Island
  'HM', // Heard Island and McDonald Islands
  'TF', // French Southern Territories
  'UM', // United States Minor Outlying Islands
  'GS', // South Georgia and the South Sandwich Islands
  'CC', // Cocos (Keeling) Islands
  'PN', // Pitcairn
  'NF', // Norfolk Island
  'SJ', // Svalbard and Jan Mayen
  'IO', // British Indian Ocean Territory
  'CX', // Christmas Island
];
