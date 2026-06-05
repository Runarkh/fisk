// water.js
// Gjenkjenner hva slags vann brukeren har trykket på, ut fra OpenStreetMap-data
// (Overpass). Skiller mellom:
//   - innsjø (lake)        → ferskvann
//   - elv/bekk (river)     → ferskvann
//   - fjord/kystsjø        → saltvann
//   - åpent hav (sea)      → saltvann
//   - brakkvann            → elvemunning/poll der ferskvann møter sjø
//
// Klassifiseringen er ren og testbar: `classifyArea` tar en liste OSM-elementer
// og returnerer en vurdering. Nettverkskallet ligger i server.js.

const LAKE_WATERS = ['lake', 'pond', 'reservoir', 'oxbow', 'basin', 'reflecting_pool'];
const RIVER_WATERS = ['river', 'stream', 'canal', 'stream_pool'];
const SALT_NAME_RE = /fjord|fjorden|sund|sundet|pollen|våg|vågen|vika|havet|sjøen|bukt|kilen|str?aumen|leia/i;
// Bevisst med ordgrenser så «Oslofjorden» o.l. ikke matcher på «os».
const ESTUARY_RE = /munning|elveos|estuar|\bdelta\b|\bos(en)?\b/i;

/**
 * Bygger én Overpass-spørring som henter både omsluttende vannpolygon (is_in)
 * og nærliggende lineære forekomster (kystlinje, elver, bukter, hav).
 */
export function buildOverpassQuery(lat, lon) {
  return `[out:json][timeout:25];
is_in(${lat},${lon})->.a;
(
  area.a["natural"="water"];
  area.a["place"~"sea|ocean|strait|bay"];
  area.a["natural"~"bay|strait"];
);
out tags;
(
  way(around:1500,${lat},${lon})["natural"="coastline"];
  way(around:700,${lat},${lon})["waterway"~"^(river|tidal_channel|canal)$"];
  way(around:400,${lat},${lon})["waterway"="stream"];
  way(around:900,${lat},${lon})["natural"="water"]["name"];
  rel(around:1500,${lat},${lon})["natural"~"bay|strait"]["name"];
  rel(around:4000,${lat},${lon})["place"~"sea|ocean"]["name"];
);
out tags 60;`;
}

const has = (el, key, re) => el.tags && el.tags[key] && re.test(el.tags[key]);

/**
 * Klassifiserer ut fra OSM-elementer (blanding av 'area' fra is_in og
 * 'way'/'relation' fra around-spørringen).
 * @returns {{
 *   salinity:'fresh'|'salt'|'brackish'|'unknown',
 *   type:string, typeLabel:string, salinityLabel:string,
 *   name:string|null, nearby:string[], confidence:'high'|'medium'|'low',
 *   note:string
 * }}
 */
export function classifyArea(elements = []) {
  const areas = elements.filter((e) => e.type === 'area');
  const nearby = elements.filter((e) => e.type === 'way' || e.type === 'relation');

  // Omsluttende forekomster (is_in)
  const enclosingWater = areas.find((a) => has(a, 'natural', /^water$/));
  const enclosingSea = areas.find(
    (a) => has(a, 'place', /sea|ocean|strait|bay/) || has(a, 'natural', /bay|strait/)
  );

  // Nærliggende trekk
  const hasCoastline = nearby.some((e) => has(e, 'natural', /coastline/));
  const nearbyRiver = nearby.find((e) => has(e, 'waterway', /river|tidal_channel|canal/));
  const nearbyStream = nearby.find((e) => has(e, 'waterway', /stream/));
  const nearbyBay = nearby.find((e) => has(e, 'natural', /bay|strait/));
  const nearbySea = nearby.find((e) => has(e, 'place', /sea|ocean/));
  const nearbyNamedWater = nearby.find((e) => has(e, 'natural', /^water$/) && e.tags.name);

  // Samle navn på det som finnes i området
  const nearbyNames = [];
  for (const e of [...areas, ...nearby]) {
    const n = e.tags && e.tags.name;
    if (n && !nearbyNames.includes(n)) nearbyNames.push(n);
  }

  let type = 'unknown';
  let salinity = 'unknown';
  let confidence = 'low';
  let name = null;
  let note = '';

  if (enclosingWater) {
    name = enclosingWater.tags.name || null;
    const w = (enclosingWater.tags.water || '').toLowerCase();
    const saltTag = enclosingWater.tags.salt; // 'yes' | 'no' | undefined
    confidence = 'high';

    if (saltTag === 'yes' || w === 'lagoon') {
      type = w === 'lagoon' ? 'lagoon' : 'fjord';
      salinity = 'salt';
    } else if (RIVER_WATERS.includes(w)) {
      type = w === 'stream' ? 'stream' : 'river';
      salinity = 'fresh';
    } else if (LAKE_WATERS.includes(w)) {
      type = 'lake';
      salinity = 'fresh';
    } else {
      // Generisk natural=water uten undertype – avgjør med kontekst.
      const looksSalt =
        saltTag !== 'no' &&
        (hasCoastline || nearbySea || nearbyBay || (name && SALT_NAME_RE.test(name)));
      if (looksSalt) {
        type = 'fjord';
        salinity = 'salt';
      } else {
        type = 'lake';
        salinity = 'fresh';
      }
    }
  } else if (enclosingSea) {
    name = enclosingSea.tags.name || null;
    type = has(enclosingSea, 'place', /sea|ocean/) ? 'sea' : 'fjord';
    salinity = 'salt';
    confidence = 'high';
  } else if (hasCoastline || nearbySea || nearbyBay) {
    // Ingen omsluttende polygon, men kyst/hav i nærheten → saltvann.
    name = (nearbySea && nearbySea.tags.name) || (nearbyBay && nearbyBay.tags.name) ||
      (nearbyNamedWater && nearbyNamedWater.tags.name) || null;
    type = nearbySea ? 'sea' : hasCoastline ? 'coast' : 'fjord';
    salinity = 'salt';
    confidence = 'medium';
  } else if (nearbyRiver) {
    name = nearbyRiver.tags.name || null;
    type = 'river';
    salinity = 'fresh';
    confidence = 'medium';
  } else if (nearbyStream) {
    name = nearbyStream.tags.name || null;
    type = 'stream';
    salinity = 'fresh';
    confidence = 'medium';
  } else if (nearbyNamedWater) {
    name = nearbyNamedWater.tags.name || null;
    type = 'lake';
    salinity = 'fresh';
    confidence = 'low';
  }

  // --- Brakkvanns-deteksjon (elvemunning/estuar) ---
  // Saltvann med en betydelig elv rett ved → brakk elvemunning.
  if (salinity === 'salt' && (nearbyRiver || (name && ESTUARY_RE.test(name)))) {
    salinity = 'brackish';
    type = 'brackish';
    note = 'Elv møter sjø her – brakkvann, der både fersk- og saltvannsarter kan opptre.';
  } else if (salinity === 'fresh' && (type === 'river' || type === 'stream') &&
             (hasCoastline || nearbySea)) {
    // Nedre elveløp helt ute ved sjøen → tidevannspåvirket/brakt.
    salinity = 'brackish';
    type = 'brackish';
    note = 'Nedre elveløp ut mot sjøen – ofte tidevannspåvirket og brakt.';
  }

  return {
    salinity,
    type,
    typeLabel: TYPE_LABELS[type] || 'Ukjent vannforekomst',
    salinityLabel: SALINITY_LABELS[salinity] || 'Ukjent',
    name,
    nearby: nearbyNames.slice(0, 6),
    confidence,
    note,
  };
}

const TYPE_LABELS = {
  lake: 'Innsjø / vann',
  river: 'Elv',
  stream: 'Bekk',
  fjord: 'Fjord / kystsjø',
  coast: 'Kystsjø',
  sea: 'Åpent hav',
  lagoon: 'Lagune / poll',
  brackish: 'Brakkvann (elvemunning)',
  unknown: 'Ukjent vannforekomst',
};

const SALINITY_LABELS = {
  fresh: 'Ferskvann',
  salt: 'Saltvann',
  brackish: 'Brakkvann',
  unknown: 'Ukjent',
};

export { TYPE_LABELS, SALINITY_LABELS };
