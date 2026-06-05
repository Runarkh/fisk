// server.js
// Express-server som:
//  1) serverer frontend (public/)
//  2) henter sanntids vær fra met.no (med påkrevd User-Agent) via proxy
//  3) beregner lysforhold lokalt
//  4) kjører anbefalingsmotoren
//
// Designet for å være robust: hvis met.no ikke er tilgjengelig faller vi
// tilbake på manuelt oppgitte forhold, slik at appen alltid kan brukes.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lightConditions } from './src/engine/solar.js';
import { recommend } from './src/engine/recommend.js';
import { listSpecies, speciesForWater } from './src/engine/species.js';
import { buildOverpassQuery, classifyArea } from './src/engine/water.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
// met.no krever en identifiserende User-Agent (se deres TOS).
const MET_UA = process.env.MET_USER_AGENT || 'Fiskeguru/1.0 github.com/runarkh/fisk';

// Enkel in-memory cache for å være snill mot met.no (de ber om caching).
const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

// Egen, lengre cache for vann-/områdeoppslag (OSM endrer seg sjelden).
const areaCache = new Map();
const AREA_CACHE_MS = 24 * 60 * 60 * 1000;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Klassifiserer vannet på en posisjon via Overpass (OpenStreetMap).
async function fetchArea(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = areaCache.get(key);
  if (hit && Date.now() - hit.t < AREA_CACHE_MS) return hit.data;

  const query = buildOverpassQuery(lat, lon);
  let lastErr;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': MET_UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(28000),
      });
      if (!res.ok) throw new Error(`Overpass svarte ${res.status}`);
      const json = await res.json();
      const data = classifyArea(json.elements || []);
      areaCache.set(key, { t: Date.now(), data });
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Overpass utilgjengelig');
}

async function fetchWeather(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.data;

  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { 'User-Agent': MET_UA } });
  if (!res.ok) throw new Error(`met.no svarte ${res.status}`);
  const json = await res.json();

  const series = json.properties.timeseries;
  const now = series[0].data.instant.details;
  // estimer trykktrend ved å sammenligne nå med ~6 timer fram
  const later = series.find((s) => new Date(s.time) - new Date(series[0].time) >= 6 * 3600 * 1000);
  let pressureTrend = 'steady';
  if (later) {
    const diff = later.data.instant.details.air_pressure_at_sea_level - now.air_pressure_at_sea_level;
    if (diff <= -1.5) pressureTrend = 'falling';
    else if (diff >= 1.5) pressureTrend = 'rising';
  }
  const precip = series[0].data.next_1_hours?.details?.precipitation_amount
    ?? series[0].data.next_6_hours?.details?.precipitation_amount
    ?? 0;

  const data = {
    source: 'met.no',
    updatedAt: json.properties.meta.updated_at,
    airTemp: now.air_temperature,
    cloudCover: now.cloud_area_fraction,
    windSpeed: now.wind_speed,
    windFromDirection: now.wind_from_direction,
    pressure: now.air_pressure_at_sea_level,
    pressureTrend,
    precip,
    humidity: now.relative_humidity,
    symbol: series[0].data.next_1_hours?.summary?.symbol_code
      ?? series[0].data.next_6_hours?.summary?.symbol_code
      ?? null,
  };
  cache.set(key, { t: Date.now(), data });
  return data;
}

function buildConditions(lat, lon, when) {
  const date = when ? new Date(when) : new Date();
  const light = lightConditions(date, lat, lon);
  return { date, light, month: date.getMonth() + 1 };
}

// --- API ---

app.get('/api/species', (_req, res) => {
  res.json(listSpecies());
});

// Hva slags vann er det her? (innsjø/elv/fjord/hav/brakkvann) + hva finnes i området.
app.get('/api/area', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'Mangler gyldig lat/lon' });
  }
  try {
    const water = await fetchArea(lat, lon);
    const matchingSpecies = water.salinity && water.salinity !== 'unknown'
      ? speciesForWater(water.salinity, water.type)
      : [];
    res.json({ lat, lon, water, matchingSpecies });
  } catch (e) {
    res.json({ lat, lon, water: null, areaError: e.message, matchingSpecies: [] });
  }
});

// Henter rådende forhold (vær + lys) for en posisjon.
app.get('/api/conditions', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'Mangler gyldig lat/lon' });
  }
  const base = buildConditions(lat, lon, req.query.when);
  let weather = null;
  let weatherError = null;
  try {
    weather = await fetchWeather(lat, lon);
  } catch (e) {
    weatherError = e.message;
  }
  res.json({
    lat,
    lon,
    time: base.date.toISOString(),
    month: base.month,
    light: base.light,
    weather,
    weatherError,
  });
});

// Kjører anbefalingen. Bruker oppgitte forhold hvis de finnes, ellers
// henter den live fra met.no.
app.post('/api/recommend', async (req, res) => {
  try {
    const { species, lat, lon, when, waterTemp, waterClarity, salinity, waterType, override } = req.body || {};
    if (!species) return res.status(400).json({ error: 'Mangler art (species)' });
    if (lat == null || lon == null) return res.status(400).json({ error: 'Mangler lat/lon' });

    const base = buildConditions(lat, lon, when);
    let weather = null;
    let weatherError = null;
    try {
      weather = await fetchWeather(lat, lon);
    } catch (e) {
      weatherError = e.message;
    }

    const ov = override || {};
    const conditions = {
      month: base.month,
      light: base.light,
      airTemp: ov.airTemp ?? weather?.airTemp ?? null,
      cloudCover: ov.cloudCover ?? weather?.cloudCover ?? null,
      windSpeed: ov.windSpeed ?? weather?.windSpeed ?? null,
      pressure: ov.pressure ?? weather?.pressure ?? null,
      pressureTrend: ov.pressureTrend ?? weather?.pressureTrend ?? 'steady',
      precip: ov.precip ?? weather?.precip ?? null,
      waterTemp: waterTemp ?? null,
      waterClarity: waterClarity || 'stained',
      salinity: salinity || null,
      waterType: waterType || null,
    };

    const result = recommend(species, conditions);
    res.json({
      input: { lat, lon, time: base.date.toISOString() },
      weather,
      weatherError,
      conditionsUsed: {
        airTemp: conditions.airTemp,
        cloudCover: conditions.cloudCover,
        windSpeed: conditions.windSpeed,
        pressure: conditions.pressure,
        pressureTrend: conditions.pressureTrend,
        precip: conditions.precip,
      },
      result,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Ikke start server når filen importeres i tester.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🎣 Fiskeguru kjører på http://localhost:${PORT}`);
  });
}

export { app, fetchWeather };
