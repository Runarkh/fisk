// species.js
// Profiler for vanlige norske fiskearter. Verdiene er destillert praktisk +
// teoretisk fiskekunnskap, og brukes av anbefalingsmotoren til scoring.
//
//  - salinity:    hvilke vanntyper arten finnes i: 'fresh' | 'brackish' | 'salt'
//  - waters:      typer vannforekomst arten typisk står i
//                 ('lake','river','coast','fjord','sea')
//  - tempOpt:     [min,max] vanntemp (°C) der arten er mest aktiv/eter best
//  - tempActive:  [min,max] ytre grenser der arten i praksis hugger
//  - lightPref:   foretrukket lys ('low' = demring/skumring/overskyet, 'bright', 'any')
//  - depthBias:   typisk standplass ('shallow','mid','deep') – flyttes av temp i motoren
//  - lures:       agntyper som passer, med vekt (0-1) for hvor godt de passer arten
//  - sizeRange:   anbefalt agnvekt i gram [min,max]
//  - season:      måneder (1-12) der fisket typisk er best
//  - notes:       kort praktisk tips
//  - proTips:     egne tips & triks for arten
export const SPECIES = {
  gjedde: {
    id: 'gjedde',
    name: 'Gjedde',
    nameEn: 'Northern pike',
    salinity: ['fresh', 'brackish'],
    waters: ['lake', 'river'],
    tempOpt: [12, 18],
    tempActive: [4, 24],
    lightPref: 'low',
    depthBias: 'shallow',
    lures: { jerkbait: 1.0, wobbler: 0.9, spinner: 0.85, spoon: 0.8, softbait: 0.85, topwater: 0.6 },
    sizeRange: [15, 80],
    season: [4, 5, 6, 9, 10, 11],
    notes: 'Standplass-jeger ved vegetasjon og kanter. Stort agn = stor gjedde. Sakte tak når vannet er kaldt.',
    proTips: [
      'Fisk «åttetallet» ved båten/land – gjedda følger ofte agnet helt inn før den hugger.',
      'Stålfortom er et must; gjeddetenner kapper vanlig sene på et blunk.',
      'Let etter vegetasjonskanter, nedfall og brå dybdeendringer – der ligger jegeren i bakhold.',
    ],
  },
  abbor: {
    id: 'abbor',
    name: 'Abbor',
    nameEn: 'Perch',
    salinity: ['fresh', 'brackish'],
    waters: ['lake', 'river'],
    tempOpt: [12, 20],
    tempActive: [4, 24],
    lightPref: 'bright',
    depthBias: 'mid',
    lures: { softbait: 1.0, spinner: 0.85, wobbler: 0.7, spoon: 0.6, jerkbait: 0.4 },
    sizeRange: [3, 15],
    season: [5, 6, 7, 8, 9, 10],
    notes: 'Stimfisk – finn én, finn flere. Liker små agn og jigging nær bunn. Aktiv i dagslys.',
    proTips: [
      'Finner du én stor abbor, står det ofte en hel stim – kast rett tilbake på samme sted.',
      'Dropshot eller liten jigg pirket sakte langs bunn når abboren er passiv.',
      'Rød/oransje detaljer imiterer skadet byttefisk og trigger hugg.',
    ],
  },
  orret: {
    id: 'orret',
    name: 'Ørret (innsjø/elv)',
    nameEn: 'Brown trout',
    salinity: ['fresh'],
    waters: ['lake', 'river'],
    tempOpt: [9, 16],
    tempActive: [2, 19],
    lightPref: 'low',
    depthBias: 'mid',
    lures: { spinner: 0.95, spoon: 0.9, fly: 0.9, wobbler: 0.7, softbait: 0.5 },
    sizeRange: [3, 18],
    season: [5, 6, 7, 8, 9],
    notes: 'Sky i klart vann – fisk fint og naturlig. Insektsklekkinger i demring gir hektisk overflatefiske.',
    proTips: [
      'I elv: kast oppstrøms og la slukket svinge naturlig inn mot standplassene bak steiner.',
      'Klart fjellvann krever lange kast, tynn sene og naturlige farger.',
      'Ser du vak ved insektsklekking? Bytt til flue eller bombarda med flue bak.',
    ],
  },
  roye: {
    id: 'roye',
    name: 'Røye',
    nameEn: 'Arctic char',
    salinity: ['fresh'],
    waters: ['lake', 'river'],
    tempOpt: [4, 12],
    tempActive: [1, 16],
    lightPref: 'low',
    depthBias: 'deep',
    lures: { spoon: 0.95, spinner: 0.85, fly: 0.8, softbait: 0.6 },
    sizeRange: [3, 20],
    season: [6, 7, 8, 9],
    notes: 'Kaldtvannsfisk som ofte står dypt. Små, blanke skjesluk og rød/rosa innslag er en klassiker.',
    proTips: [
      'Røya står ofte i termoklinen – tell agnet ned og kartlegg dybden den eter på.',
      'Rosa/oransje innslag på blanke skjer utløser hugg.',
      'Isfiske: små pilkagn agnet med maggot/mark, og let opp riktig dyp.',
    ],
  },
  harr: {
    id: 'harr',
    name: 'Harr',
    nameEn: 'Grayling',
    salinity: ['fresh'],
    waters: ['river', 'lake'],
    tempOpt: [8, 16],
    tempActive: [3, 18],
    lightPref: 'low',
    depthBias: 'mid',
    lures: { fly: 1.0, spinner: 0.7, softbait: 0.4 },
    sizeRange: [2, 8],
    season: [6, 7, 8, 9],
    notes: 'Insektseter i strømmende vann. Tørrflue/nymfe over standplassene er førstevalget.',
    proTips: [
      'Harren vaker – legg en tørrflue presist over ringene ved solnedgang.',
      'Stå lavt og kast oppstrøms; harren er sky og rygger for skygger.',
      'Vaker den ikke, driv små nymfer langs bunn gjennom standplassen.',
    ],
  },
  laks: {
    id: 'laks',
    name: 'Laks',
    nameEn: 'Atlantic salmon',
    salinity: ['fresh', 'brackish'],
    waters: ['river'],
    tempOpt: [8, 14],
    tempActive: [4, 18],
    lightPref: 'low',
    depthBias: 'mid',
    lures: { fly: 0.95, spoon: 0.9, wobbler: 0.8, spinner: 0.8 },
    sizeRange: [10, 35],
    season: [6, 7, 8],
    notes: 'Hugger reaksjon, ikke sult, i elva. Tidlig morgen og kveld med litt vannføring er beste vindu.',
    proTips: [
      'Fisk fluen/slukket på «swing» i jevn fart tvers over hølen.',
      'Litt farge og stigende/fallende vannføring etter regn vekker fisken.',
      'Veksle størrelse og farge systematisk til du finner dagens trigger.',
    ],
  },
  sjoorret: {
    id: 'sjoorret',
    name: 'Sjøørret',
    nameEn: 'Sea trout',
    salinity: ['salt', 'brackish', 'fresh'],
    waters: ['coast', 'fjord', 'river'],
    tempOpt: [6, 14],
    tempActive: [2, 17],
    lightPref: 'low',
    depthBias: 'shallow',
    lures: { spoon: 0.95, fly: 0.9, wobbler: 0.85, spinner: 0.75 },
    sizeRange: [10, 28],
    season: [3, 4, 5, 6, 9, 10, 11],
    notes: 'Kystjeger på grunna. Demring, skumring og litt sjø gir best sjanse. Vinterstøinger tar sakte agn.',
    proTips: [
      'Vandre og dekk mye vann – sjøørret er en jeger på farten, ikke en standplassfisk.',
      'Fisk grunningene rundt fjære/flo og i lysskiftet morgen og kveld.',
      'Vinterstøinger står dypt og treigt – senk farten dramatisk og fisk sakte.',
    ],
  },
  torsk: {
    id: 'torsk',
    name: 'Torsk',
    nameEn: 'Atlantic cod',
    salinity: ['salt', 'brackish'],
    waters: ['fjord', 'sea', 'coast'],
    tempOpt: [4, 9],
    tempActive: [1, 14],
    lightPref: 'any',
    depthBias: 'deep',
    lures: { pirk: 1.0, softbait: 0.9, shrimp: 0.7, spoon: 0.5 },
    sizeRange: [60, 300],
    season: [1, 2, 3, 4, 11, 12],
    notes: 'Bunnfisk over rev og kanter. Pilk vertikalt og la agnet banke bunn. Kommer grunnere i kaldt vann.',
    proTips: [
      'La pilken banke bunn – hugget kommer som regel når agnet synker.',
      'Driv over rev, egg og bratte kanter, ikke over flat, død bunn.',
      'Kaldt vann om vinteren: torsken trekker grunt, prøv 5–15 m fra land.',
    ],
  },
  sei: {
    id: 'sei',
    name: 'Sei',
    nameEn: 'Saithe',
    salinity: ['salt'],
    waters: ['fjord', 'sea', 'coast'],
    tempOpt: [6, 12],
    tempActive: [3, 16],
    lightPref: 'any',
    depthBias: 'mid',
    lures: { pirk: 0.95, softbait: 0.85, spoon: 0.7, shrimp: 0.5 },
    sizeRange: [40, 200],
    season: [5, 6, 7, 8, 9, 10],
    notes: 'Pelagisk og rasende kampsterk. Står ofte i frie vannmasser – tell agnet ned til riktig sjikt.',
    proTips: [
      'Finn riktig dybde: seien står i «sjikt» – tell agnet ned og finn etesonen.',
      'Rask, jevn innspinning – seien elsker fart og jakter aktivt.',
      'Følg måkene og overflateaktivitet for å lokalisere stimene.',
    ],
  },
  makrell: {
    id: 'makrell',
    name: 'Makrell',
    nameEn: 'Mackerel',
    salinity: ['salt'],
    waters: ['fjord', 'sea', 'coast'],
    tempOpt: [12, 18],
    tempActive: [9, 22],
    lightPref: 'bright',
    depthBias: 'shallow',
    lures: { spoon: 0.9, pirk: 0.85, spinner: 0.7, softbait: 0.6 },
    sizeRange: [10, 60],
    season: [6, 7, 8, 9],
    notes: 'Sommergjest i stim nær overflaten. Rask innspinning av blanke agn – let etter måkene og overflateaktivitet.',
    proTips: [
      'Stimene følger varmt overflatevann – let i sol og stille, gjerne midt på dagen.',
      'Makkstang/forfang med flere fluer gir flere fisk per kast når stimen står tett.',
      'Sveiv raskt og høyt i vannet – makrellen jakter oppe.',
    ],
  },
  lyr: {
    id: 'lyr',
    name: 'Lyr',
    nameEn: 'Pollack',
    salinity: ['salt'],
    waters: ['fjord', 'coast', 'sea'],
    tempOpt: [8, 14],
    tempActive: [4, 18],
    lightPref: 'low',
    depthBias: 'mid',
    lures: { softbait: 0.95, pirk: 0.8, wobbler: 0.7, spoon: 0.6 },
    sizeRange: [30, 150],
    season: [5, 6, 7, 8, 9, 10],
    notes: 'Står ved tareskog og rev. Mykt agn fisket langs strukturen i demring er dødelig.',
    proTips: [
      'Fisk tett inntil tareskog og rev, særlig i skumringen.',
      'Mykt agn «pumpet» sakte opp fra bunn trigger eksplosive hugg.',
      'Lyren tar ofte idet agnet stopper og synker – vær klar på synken.',
    ],
  },
  hvitting: {
    id: 'hvitting',
    name: 'Hvitting',
    nameEn: 'Whiting',
    salinity: ['salt'],
    waters: ['fjord', 'sea', 'coast'],
    tempOpt: [6, 12],
    tempActive: [2, 15],
    lightPref: 'low',
    depthBias: 'deep',
    lures: { shrimp: 0.9, softbait: 0.8, pirk: 0.6 },
    sizeRange: [20, 80],
    season: [9, 10, 11, 12, 1],
    notes: 'Bunnnær åtseleter, mest aktiv i mørke timer. Små naturlige agn nær bunn.',
    proTips: [
      'Bunnfiske i mørket – hvittingen eter mest når lyset er borte.',
      'Reke eller mark på paternoster like over bunn er drepende.',
      'Best på høst/vinter når den samler seg på dypet.',
    ],
  },
};

export function listSpecies() {
  return Object.values(SPECIES).map((s) => ({
    id: s.id,
    name: s.name,
    nameEn: s.nameEn,
    salinity: s.salinity,
    waters: s.waters,
    season: s.season,
    notes: s.notes,
  }));
}

/**
 * Arter som realistisk kan fiskes i en gitt salinitet (og evt. vanntype).
 * @param {'fresh'|'salt'|'brackish'} salinity
 * @param {string} [waterType] f.eks. 'lake','river','fjord','sea','coast'
 */
export function speciesForWater(salinity, waterType) {
  return Object.values(SPECIES).filter((s) => {
    if (salinity && !s.salinity.includes(salinity)) return false;
    if (waterType && s.waters && !s.waters.includes(waterType)) {
      // tillat hav/fjord/kyst om hverandre – de overlapper i praksis
      const seaGroup = ['sea', 'fjord', 'coast'];
      if (seaGroup.includes(waterType) && s.waters.some((w) => seaGroup.includes(w))) return true;
      return false;
    }
    return true;
  }).map((s) => s.id);
}
