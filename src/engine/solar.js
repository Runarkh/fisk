// solar.js
// Beregner solas posisjon (høyde over horisonten) og soloppgang/solnedgang
// for en gitt posisjon og tidspunkt. Basert på de velkjente astronomiske
// formlene (samme matematikk som biblioteket SunCalc, public domain).
//
// Vi bruker dette til å bestemme lysforhold uten å være avhengig av et
// eksternt API – kun lat/lon og tidspunkt trengs.

const RAD = Math.PI / 180;
const DAY_MS = 1000 * 60 * 60 * 24;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397; // jordas aksehelling

function toJulian(date) {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}
function fromJulian(j) {
  return new Date((j + 0.5 - J1970) * DAY_MS);
}
function toDays(date) {
  return toJulian(date) - J2000;
}

function solarMeanAnomaly(d) {
  return RAD * (357.5291 + 0.98560028 * d);
}
function eclipticLongitude(M) {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372; // perihelion
  return M + C + P + Math.PI;
}
function declination(L) {
  return Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
}
function rightAscension(L) {
  return Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
}
function siderealTime(d, lw) {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

/**
 * Solas høyde (altitude) og azimut for gitt tidspunkt og posisjon.
 * @returns {{ altitude:number, azimuth:number }} grader.
 */
export function sunPosition(date, lat, lon) {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const d = toDays(date);

  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const ra = rightAscension(L);
  const H = siderealTime(d, lw) - ra;

  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  );
  const azimuth = Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
  );
  return {
    altitude: altitude / RAD,
    azimuth: (azimuth / RAD + 180) % 360,
  };
}

// --- soloppgang / solnedgang ---
const J0 = 0.0009;
function julianCycle(d, lw) {
  return Math.round(d - J0 - lw / (2 * Math.PI));
}
function approxTransit(Ht, lw, n) {
  return J0 + (Ht + lw) / (2 * Math.PI) + n;
}
function solarTransitJ(ds, M, L) {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}
function hourAngle(h, phi, dec) {
  return Math.acos(
    (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  );
}

/**
 * Soloppgang, solnedgang og soltime (transit) for kalenderdagen.
 * Returnerer null for tider som ikke inntreffer (midnattssol / mørketid).
 */
export function sunTimes(date, lat, lon) {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);

  const h0 = -0.833 * RAD; // standard refraksjon for sol-skive
  const cosH = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));

  let sunrise = null;
  let sunset = null;
  let polar = null;
  if (cosH <= -1) polar = 'midnattssol'; // sola går aldri ned
  else if (cosH >= 1) polar = 'mørketid'; // sola står aldri opp
  else {
    const Hangle = Math.acos(cosH);
    const Jset = solarTransitJ(approxTransit(Hangle, lw, n), M, L);
    const Jrise = Jnoon - (Jset - Jnoon);
    sunrise = fromJulian(Jrise);
    sunset = fromJulian(Jset);
  }

  return {
    solarNoon: fromJulian(Jnoon),
    sunrise,
    sunset,
    polar,
  };
}

/**
 * Klassifiserer lysforhold ut fra solhøyde.
 * Soloppgang/-nedgang og skumring er gull for mange rovfisk.
 */
export function lightConditions(date, lat, lon) {
  const { altitude } = sunPosition(date, lat, lon);
  const times = sunTimes(date, lat, lon);

  let phase;
  let label;
  if (altitude > 12) {
    phase = 'day';
    label = 'Full dag';
  } else if (altitude > 0) {
    phase = 'lowsun';
    label = 'Lavtstående sol';
  } else if (altitude > -6) {
    phase = 'twilight';
    label = 'Skumring / demring';
  } else {
    phase = 'night';
    label = 'Mørkt';
  }

  // Hvor nær er vi gryning/skumring (de mest aktive periodene)?
  let nearGoldenHour = false;
  for (const t of [times.sunrise, times.sunset]) {
    if (t && Math.abs(t - date) < 75 * 60 * 1000) nearGoldenHour = true;
  }

  return {
    sunAltitude: Math.round(altitude * 10) / 10,
    phase,
    label,
    nearGoldenHour,
    sunrise: times.sunrise,
    sunset: times.sunset,
    solarNoon: times.solarNoon,
    polar: times.polar,
  };
}
