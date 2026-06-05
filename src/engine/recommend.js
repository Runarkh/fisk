// recommend.js
// Anbefalingsmotoren. Tar en fiskeart + rådende forhold og produserer:
//  - en aktivitetsindeks (0-100) for hvor gode forholdene er akkurat nå
//  - en rangert liste over agn med størrelse, farge, dybde, fart og begrunnelse
//  - praktiske tips
//
// All logikk er regelbasert og forklarbar – ingen "magi". Hver delscore
// kommer med en menneskelig lesbar begrunnelse.

import { SPECIES } from './species.js';
import { LURE_TYPES, COLOR_RULES } from './lures.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Grovt estimat av vanntemperatur hvis den ikke er målt.
 * Vann henger etter lufttemperatur og demper svingninger – om våren er
 * vannet kaldere enn lufta, om høsten varmere. Saltvann er mer stabilt.
 */
export function estimateWaterTemp(airTemp, month, water = 'fresh') {
  if (airTemp == null) return null;
  // sesongforskyvning: vår (3-5) trekker ned, høst (9-11) trekker opp
  let lag = 0;
  if ([3, 4, 5].includes(month)) lag = -3;
  else if ([6, 7].includes(month)) lag = -1.5;
  else if ([8].includes(month)) lag = 0;
  else if ([9, 10, 11].includes(month)) lag = 2;
  else lag = -1; // vinter

  let est = airTemp * 0.7 + 8 * 0.3 + lag; // demping mot ~8°C "treghet"
  if (water === 'salt') {
    // kysten er tregere og sjelden under ~2 eller over ~18 i Norge
    est = airTemp * 0.45 + 9 * 0.55 + lag * 0.5;
    est = clamp(est, 2, 19);
  } else {
    est = clamp(est, 0.5, 26);
  }
  return Math.round(est * 10) / 10;
}

// --- delfaktorer for aktivitetsindeks ---

function tempFactor(species, waterTemp) {
  if (waterTemp == null) return { score: 0.6, reason: 'Vanntemp ukjent – antar middels aktivitet.' };
  const [lo, hi] = species.tempOpt;
  const [amin, amax] = species.tempActive;
  let score;
  let reason;
  if (waterTemp >= lo && waterTemp <= hi) {
    score = 1;
    reason = `Vanntemp ${waterTemp}°C er midt i ${species.name.toLowerCase()}ens beste vindu (${lo}-${hi}°C).`;
  } else if (waterTemp < amin || waterTemp > amax) {
    score = 0.15;
    reason = `Vanntemp ${waterTemp}°C er utenfor aktivt område (${amin}-${amax}°C) – regn med treg fisk.`;
  } else {
    // mellom ytre grense og optimum: lineær avtrapping
    const dist = waterTemp < lo ? lo - waterTemp : waterTemp - hi;
    const span = waterTemp < lo ? lo - amin : amax - hi;
    score = clamp(1 - (dist / Math.max(span, 0.1)) * 0.7, 0.3, 0.95);
    reason = `Vanntemp ${waterTemp}°C er litt ${waterTemp < lo ? 'kjølig' : 'varm'} – aktivitet litt under topp.`;
  }
  return { score, reason };
}

function lightFactor(species, light) {
  const pref = species.lightPref;
  let score = 0.6;
  let reason;
  if (light.nearGoldenHour) {
    score = 1;
    reason = 'Gylden time (gryning/skumring) – rovfiskens beste matvindu.';
  } else if (pref === 'low') {
    if (light.phase === 'twilight' || light.phase === 'lowsun') {
      score = 0.95;
      reason = `${light.label} passer ${species.name.toLowerCase()} som liker dempet lys.`;
    } else if (light.phase === 'night') {
      score = 0.7;
      reason = 'Mørkt – noen arter eter i mørket, men sikten reduseres.';
    } else {
      score = 0.5;
      reason = `${light.label}: skarpt lys gjør ${species.name.toLowerCase()} mer forsiktig.`;
    }
  } else if (pref === 'bright') {
    if (light.phase === 'day' || light.phase === 'lowsun') {
      score = 0.95;
      reason = `${light.label} passer ${species.name.toLowerCase()} som jakter på syn i dagslys.`;
    } else if (light.phase === 'night') {
      score = 0.35;
      reason = 'Mørkt – synsjegeren ser dårlig, aktiviteten faller.';
    } else {
      score = 0.7;
      reason = `${light.label}: brukbart, men dagsfisken liker mer lys.`;
    }
  } else {
    score = 0.8;
    reason = `${light.label}: arten er fleksibel på lys.`;
  }
  return { score, reason };
}

function cloudFactor(species, cloudCover) {
  if (cloudCover == null) return { score: 0.7, reason: '' };
  // Lett til moderat skydekke jevner ut lyset og roer mistenksom fisk –
  // ofte bedre enn skyfri sol, særlig for lyssky arter.
  let score;
  let reason;
  if (cloudCover >= 30 && cloudCover <= 85) {
    score = 0.95;
    reason = `Overskyet (${Math.round(cloudCover)}%) demper lyset – fisken tør lengre ut og opp.`;
  } else if (cloudCover < 30) {
    score = species.lightPref === 'bright' ? 0.85 : 0.6;
    reason = `Klart vær (${Math.round(cloudCover)}% skyer) gir skarpt lys – fisk dypt eller i kantene.`;
  } else {
    score = 0.8;
    reason = `Tett skydekke (${Math.round(cloudCover)}%).`;
  }
  return { score, reason };
}

function pressureFactor(pressure, trend) {
  // Fallende trykk før et lavtrykk trigger ofte eting; høyt stabilt trykk
  // etter en front gir gjerne tregere fisk.
  let score = 0.7;
  let reason = '';
  if (trend === 'falling') {
    score = 0.95;
    reason = 'Fallende lufttrykk – klassisk hugge-vær før været slår om.';
  } else if (trend === 'rising') {
    score = 0.55;
    reason = 'Stigende trykk etter front – fisken er ofte treg et døgn.';
  } else if (trend === 'steady') {
    score = 0.8;
    reason = 'Stabilt lufttrykk – forutsigbare forhold.';
  }
  if (pressure != null && pressure < 1000) {
    reason += ` Lavt trykk (${Math.round(pressure)} hPa).`;
  }
  return { score, reason };
}

function windFactor(windSpeed) {
  if (windSpeed == null) return { score: 0.7, reason: '' };
  // Litt krusning skjuler fiskeren og setter byttedyr i bevegelse; for mye
  // vind gjør presentasjon og sikt vanskelig.
  let score;
  let reason;
  if (windSpeed >= 2 && windSpeed <= 7) {
    score = 0.95;
    reason = `Lett bris (${windSpeed} m/s) krusker overflaten – skjuler deg og aktiverer byttefisk.`;
  } else if (windSpeed < 2) {
    score = 0.65;
    reason = `Nesten vindstille (${windSpeed} m/s) – speilblankt vann gjør fisken sky.`;
  } else if (windSpeed <= 11) {
    score = 0.6;
    reason = `Frisk vind (${windSpeed} m/s) – fisk le-sider og bruk tyngre agn.`;
  } else {
    score = 0.35;
    reason = `Mye vind (${windSpeed} m/s) – krevende forhold, søk ly.`;
  }
  return { score, reason };
}

function precipFactor(precip) {
  if (precip == null) return { score: 0.75, reason: '' };
  if (precip > 0 && precip < 3) {
    return { score: 0.9, reason: `Lett nedbør (${precip} mm) – ofte godt bett, demper lys og overflate.` };
  }
  if (precip >= 3) {
    return { score: 0.6, reason: `Kraftig nedbør (${precip} mm) – kan grumse vannet og senke sikten.` };
  }
  return { score: 0.8, reason: '' };
}

function seasonFactor(species, month) {
  if (!month) return { score: 0.8, reason: '' };
  if (species.season.includes(month)) {
    return { score: 1, reason: 'Inne i artens beste sesong.' };
  }
  // nabo-måned regnes som skuldersesong
  const near = species.season.some((m) => Math.abs(m - month) <= 1 || Math.abs(m - month) === 11);
  if (near) return { score: 0.75, reason: 'Skuldersesong – fiske mulig, men ikke toppen.' };
  return { score: 0.45, reason: 'Utenom hovedsesong for arten.' };
}

// --- dybde og fart ut fra temperatur ---

function depthAdvice(species, waterTemp) {
  let bias = species.depthBias;
  let note = '';
  if (waterTemp != null) {
    if (waterTemp < species.tempActive[0] + 2) {
      // kaldt → fisken står dypere/roligere (sjøørret/torsk kan motsatt søke grunt)
      if (species.water === 'salt' && species.id === 'torsk') {
        note = 'Kaldt vann: torsken kan trekke uvanlig grunt.';
      } else {
        bias = bias === 'shallow' ? 'mid' : 'deep';
        note = 'Kaldt vann presser fisken dypere og roligere.';
      }
    } else if (waterTemp > species.tempOpt[1]) {
      bias = species.water === 'salt' ? 'deep' : (bias === 'deep' ? 'mid' : bias);
      note = 'Varmt vann: søk dypere/kjøligere lag og kjøligere tider på døgnet.';
    }
  }
  const label = { shallow: 'grunt (0-2 m)', mid: 'mellomdypt (2-5 m)', deep: 'dypt (5 m+)' }[bias];
  return { bias, label, note };
}

function retrieveAdvice(waterTemp, lure) {
  // Kaldt vann → sakte; varmt → kjappere reaksjonsfiske.
  let base = lure.speed;
  if (waterTemp != null) {
    if (waterTemp < 8) base = 'slow';
    else if (waterTemp > 17) base = lure.speed === 'slow' ? 'medium' : 'fast';
  }
  return { slow: 'sakte', medium: 'moderat', fast: 'rask', varied: 'variert' }[base] || base;
}

// --- farge ut fra lys + klarhet ---

function pickColors(light, clarity) {
  const bright = light.phase === 'day' || light.phase === 'lowsun';
  if (clarity === 'clear') {
    return bright ? COLOR_RULES.clearBright : COLOR_RULES.clearLow;
  }
  if (clarity === 'murky') {
    return bright ? COLOR_RULES.stainedLow : COLOR_RULES.murkyDark;
  }
  // stained (default)
  return bright ? COLOR_RULES.stainedBright : COLOR_RULES.stainedLow;
}

// --- agn-scoring ---

function lureScore(lure, species, ctx) {
  const { light, clarity, waterTemp } = ctx;
  const fit = species.lures[lure.id] || 0; // hvor godt agnet passer arten
  if (fit === 0) return null;

  let score = fit * 100;
  const reasons = [];

  // lys-match
  if (lure.bestLight !== 'any') {
    const lowNow = light.phase === 'twilight' || light.phase === 'night' || light.nearGoldenHour;
    const match = (lure.bestLight === 'low' && lowNow) || (lure.bestLight === 'bright' && !lowNow);
    score += match ? 8 : -8;
    if (match) reasons.push(`passer ${lure.bestLight === 'low' ? 'dempet lys' : 'godt lys'} nå`);
  }

  // klarhet-match
  if (lure.bestClarity !== 'any') {
    const match = lure.bestClarity === clarity;
    score += match ? 8 : -5;
    if (match) reasons.push(`treffer vannklarheten (${clarity === 'clear' ? 'klart' : clarity === 'murky' ? 'grumsete' : 'farget'})`);
  }
  // grumsete vann favoriserer kraftig action/vibrasjon
  if (clarity === 'murky') {
    if (lure.action === 'high') { score += 10; reasons.push('kraftig vibrasjon merkes i dårlig sikt'); }
    if (lure.action === 'subtle') score -= 8;
  }

  // temperatur → action/agn-type
  if (waterTemp != null) {
    if (waterTemp < 8) {
      score += (lure.coldOk - 0.5) * 30; // belønn kaldtvanns-agn
      if (lure.coldOk >= 0.8) reasons.push('effektivt i kaldt vann fisket sakte');
    } else if (waterTemp > 16 && lure.depth === 'top') {
      score += 10;
      reasons.push('varmt vann gir sjanse for overflatehugg');
    }
  }

  return {
    id: lure.id,
    name: lure.name,
    blurb: lure.blurb,
    score: Math.round(clamp(score, 0, 130)),
    reasons,
  };
}

/**
 * Hovedfunksjon.
 * @param {string} speciesId
 * @param {object} conditions – { airTemp, waterTemp, cloudCover, windSpeed,
 *        pressure, pressureTrend, precip, month, light:{phase,label,nearGoldenHour,...} }
 */
export function recommend(speciesId, conditions) {
  const species = SPECIES[speciesId];
  if (!species) throw new Error(`Ukjent art: ${speciesId}`);

  const month = conditions.month;
  const waterTemp =
    conditions.waterTemp != null
      ? conditions.waterTemp
      : estimateWaterTemp(conditions.airTemp, month, species.water);
  const clarity = conditions.waterClarity || 'stained';
  const light = conditions.light || { phase: 'day', label: 'Dag', nearGoldenHour: false };

  // --- aktivitetsindeks (vektet snitt av faktorer) ---
  const factors = {
    temperatur: { ...tempFactor(species, waterTemp), weight: 2.5 },
    lys: { ...lightFactor(species, light), weight: 2.0 },
    skydekke: { ...cloudFactor(species, conditions.cloudCover), weight: 1.0 },
    lufttrykk: { ...pressureFactor(conditions.pressure, conditions.pressureTrend), weight: 1.2 },
    vind: { ...windFactor(conditions.windSpeed), weight: 1.0 },
    nedbør: { ...precipFactor(conditions.precip), weight: 0.6 },
    sesong: { ...seasonFactor(species, month), weight: 1.5 },
  };
  let wsum = 0;
  let total = 0;
  for (const f of Object.values(factors)) {
    total += f.score * f.weight;
    wsum += f.weight;
  }
  const activityIndex = Math.round((total / wsum) * 100);

  let activityLabel;
  if (activityIndex >= 78) activityLabel = 'Utmerket – grip stanga!';
  else if (activityIndex >= 62) activityLabel = 'Gode forhold';
  else if (activityIndex >= 45) activityLabel = 'Middels – jobb for fisken';
  else activityLabel = 'Krevende – tålmodighet kreves';

  // --- rangér agn ---
  const ctx = { light, clarity, waterTemp };
  const ranked = Object.values(LURE_TYPES)
    .map((l) => lureScore(l, species, ctx))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const depth = depthAdvice(species, waterTemp);
  const colors = pickColors(light, clarity);
  const [smin, smax] = species.sizeRange;

  const lures = ranked.slice(0, 4).map((l, i) => ({
    rank: i + 1,
    ...l,
    suggestedSize: `${smin}-${smax} g`,
    suggestedColors: colors.slice(0, 3),
    suggestedDepth: depth.label,
    suggestedRetrieve: retrieveAdvice(waterTemp, LURE_TYPES[l.id]),
  }));

  // --- tips ---
  const tips = [];
  tips.push(species.notes);
  if (depth.note) tips.push(depth.note);
  if (light.nearGoldenHour) tips.push('Du er i den gylne timen – maksimal innsats nå de neste ~60 min.');
  if (waterTemp != null && waterTemp < 6) tips.push('Kaldt vann: senk farten dramatisk og gi lange pauser.');
  if (conditions.windSpeed != null && conditions.windSpeed > 8) tips.push('Mye vind – fisk lo-siden og bruk tyngre agn for kontroll.');
  if (clarity === 'murky') tips.push('Dårlig sikt: velg agn med vibrasjon/lyd og sterke signalfarger.');

  return {
    species: { id: species.id, name: species.name, nameEn: species.nameEn, water: species.water },
    activityIndex,
    activityLabel,
    waterTemp,
    waterTempEstimated: conditions.waterTemp == null,
    waterClarity: clarity,
    factors,
    lures,
    palette: colors,
    depth,
    tips,
  };
}
