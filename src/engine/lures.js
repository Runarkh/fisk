// lures.js
// Katalog over agntyper med egenskaper som anbefalingsmotoren bruker.
//
// Egenskaper:
//  - depth:        hvilke vannlag agnet primært jobber i ('top','mid','deep','any')
//  - bestLight:    lysforhold der typen skinner ('bright','low','any')
//  - bestClarity:  vannklarhet ('clear','stained','murky','any')
//  - action:       hvor mye liv/vibrasjon ('subtle','moderate','high')
//  - coldOk:       hvor godt typen fungerer i kaldt vann (0-1, brukes til scoring)
//  - speed:        anbefalt innspinningsfart ('slow','medium','fast','varied')
//
// Fargevalg avgjøres dynamisk i recommend.js ut fra lys + klarhet.

export const LURE_TYPES = {
  spinner: {
    id: 'spinner',
    name: 'Spinner',
    depth: 'mid',
    bestLight: 'any',
    bestClarity: 'stained',
    action: 'high',
    coldOk: 0.5,
    speed: 'medium',
    blurb: 'Roterende blad gir blink og vibrasjon – tiltrekker på sansene selv i grumsete vann.',
  },
  spoon: {
    id: 'spoon',
    name: 'Skjesluk',
    depth: 'mid',
    bestLight: 'bright',
    bestClarity: 'clear',
    action: 'moderate',
    coldOk: 0.6,
    speed: 'varied',
    blurb: 'Klassisk vippende blink. Allround-sluk som kaster langt og søker av store områder.',
  },
  wobbler: {
    id: 'wobbler',
    name: 'Wobbler / sluk med dykkfinne',
    depth: 'mid',
    bestLight: 'any',
    bestClarity: 'any',
    action: 'high',
    coldOk: 0.55,
    speed: 'medium',
    blurb: 'Svømmer med eget vrikk på fast dybde. Lett å fiske kontrollert langs kanter.',
  },
  jerkbait: {
    id: 'jerkbait',
    name: 'Jerkbait',
    depth: 'mid',
    bestLight: 'low',
    bestClarity: 'clear',
    action: 'high',
    coldOk: 0.35,
    speed: 'varied',
    blurb: 'Rykkes i uberegnelige utfall – trigger reaksjonshugg fra rovfisk i bevegelse.',
  },
  softbait: {
    id: 'softbait',
    name: 'Jigg / softbait',
    depth: 'deep',
    bestLight: 'any',
    bestClarity: 'any',
    action: 'moderate',
    coldOk: 0.9,
    speed: 'slow',
    blurb: 'Mykt gummiagn på jigghode. Fiskes sakte langs bunn – uslåelig i kaldt og passivt fiske.',
  },
  crankbait: {
    id: 'crankbait',
    name: 'Crankbait (dyptgående)',
    depth: 'deep',
    bestLight: 'bright',
    bestClarity: 'stained',
    action: 'high',
    coldOk: 0.4,
    speed: 'medium',
    blurb: 'Graver seg ned mot bunn og banker mot strukturer. Dekker dypere standplasser.',
  },
  topwater: {
    id: 'topwater',
    name: 'Overflateagn (popper/walker)',
    depth: 'top',
    bestLight: 'low',
    bestClarity: 'clear',
    action: 'high',
    coldOk: 0.1,
    speed: 'varied',
    blurb: 'Plasker i overflaten. Spektakulært i varmt vann ved demring/skumring og stille forhold.',
  },
  fly: {
    id: 'fly',
    name: 'Flue / nymfe',
    depth: 'top',
    bestLight: 'low',
    bestClarity: 'clear',
    action: 'subtle',
    coldOk: 0.5,
    speed: 'slow',
    blurb: 'Imiterer insekter/yngel. Suverent ved klekkinger og forsiktig fisk i klart vann.',
  },
  pirk: {
    id: 'pirk',
    name: 'Pilk',
    depth: 'deep',
    bestLight: 'any',
    bestClarity: 'any',
    action: 'high',
    coldOk: 0.8,
    speed: 'varied',
    blurb: 'Tung blink som pilkes vertikalt over dypet – standardvåpen for saltvann fra båt.',
  },
  shrimp: {
    id: 'shrimp',
    name: 'Reke-/makkimitasjon',
    depth: 'deep',
    bestLight: 'any',
    bestClarity: 'any',
    action: 'subtle',
    coldOk: 0.85,
    speed: 'slow',
    blurb: 'Naturtro reke på krok/jigg. Tålmodig bunnfiske etter mistenksom fisk.',
  },
};

// Farge-paletter velges ut fra lys og vannklarhet.
export const COLOR_RULES = {
  // klart vann + mye lys → naturlige/sølv toner
  clearBright: ['sølv', 'naturlig abbor', 'klar/transparent', 'blå-sølv'],
  // klart vann + lavt lys → litt mer kontrast
  clearLow: ['sølv-blå', 'sort-sølv', 'rød-hvit', 'naturlig'],
  // grumsete/farget vann + lys → kontrast og blink
  stainedBright: ['gull', 'kobber', 'oransje-tiger', 'chartreuse'],
  // grumsete + lavt lys → sterke/mørke signalfarger
  stainedLow: ['chartreuse', 'fluorescerende gul', 'sort', 'rød-svart'],
  // veldig grumsete / mørkt → silhuett + UV/glow
  murkyDark: ['sort (silhuett)', 'fluo gul/grønn', 'glow/UV', 'sterk oransje'],
};
