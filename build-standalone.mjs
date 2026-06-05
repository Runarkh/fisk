// build-standalone.mjs
// Fletter den testede motoren + frontend til ÉN selvstendig fiskeguru.html
// som kjører helt i nettleseren (met.no og Overpass kalles direkte via CORS).
// Ingen server nødvendig – bare åpne fila.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(__dirname, p), 'utf8');

// Fjern ES-module import/export så filene kan kjøre i ett felles skop.
function stripModule(src) {
  return src
    .replace(/^\s*import[^\n]*\n/gm, '')
    .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s+/gm, '');
}

// Rekkefølge: recommend bruker SPECIES/LURE_TYPES, så de må komme først.
const engine = [
  'src/engine/solar.js',
  'src/engine/lures.js',
  'src/engine/species.js',
  'src/engine/water.js',
  'src/engine/recommend.js',
].map((f) => `// ===== ${f} =====\n${stripModule(read(f))}`).join('\n\n');

const css = read('public/styles.css');

// Datalag som erstatter serveren: kaller met.no + Overpass direkte fra nettleseren.
const dataLayer = `
// ===== datalag (browser, erstatter serveren) =====
const _areaCache = new Map();

async function fetchWeatherBrowser(lat, lon) {
  const url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + lat + '&lon=' + lon;
  const res = await fetch(url);
  if (!res.ok) throw new Error('met.no ' + res.status);
  const json = await res.json();
  const series = json.properties.timeseries;
  const now = series[0].data.instant.details;
  const later = series.find((s) => new Date(s.time) - new Date(series[0].time) >= 6 * 3600 * 1000);
  let pressureTrend = 'steady';
  if (later) {
    const diff = later.data.instant.details.air_pressure_at_sea_level - now.air_pressure_at_sea_level;
    if (diff <= -1.5) pressureTrend = 'falling';
    else if (diff >= 1.5) pressureTrend = 'rising';
  }
  const precip = (series[0].data.next_1_hours && series[0].data.next_1_hours.details && series[0].data.next_1_hours.details.precipitation_amount)
    ?? (series[0].data.next_6_hours && series[0].data.next_6_hours.details && series[0].data.next_6_hours.details.precipitation_amount) ?? 0;
  return {
    source: 'met.no',
    updatedAt: json.properties.meta.updated_at,
    airTemp: now.air_temperature,
    cloudCover: now.cloud_area_fraction,
    windSpeed: now.wind_speed,
    pressure: now.air_pressure_at_sea_level,
    pressureTrend,
    precip,
    symbol: (series[0].data.next_1_hours && series[0].data.next_1_hours.summary && series[0].data.next_1_hours.summary.symbol_code)
      ?? (series[0].data.next_6_hours && series[0].data.next_6_hours.summary && series[0].data.next_6_hours.summary.symbol_code) ?? null,
  };
}

async function getConditionsBrowser(lat, lon) {
  const date = new Date();
  const light = lightConditions(date, lat, lon);
  let weather = null, weatherError = null;
  try { weather = await fetchWeatherBrowser(lat, lon); }
  catch (e) { weatherError = e.message; }
  return { lat, lon, time: date.toISOString(), month: date.getMonth() + 1, light, weather, weatherError };
}

async function getAreaBrowser(lat, lon) {
  const key = lat.toFixed(4) + ',' + lon.toFixed(4);
  if (_areaCache.has(key)) return _areaCache.get(key);
  const q = buildOverpassQuery(lat, lon);
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let lastErr;
  for (const url of endpoints) {
    try {
      const res = await fetch(url + '?data=' + encodeURIComponent(q));
      if (!res.ok) throw new Error('Overpass ' + res.status);
      const json = await res.json();
      const water = classifyArea(json.elements || []);
      const matchingSpecies = (water.salinity && water.salinity !== 'unknown')
        ? speciesForWater(water.salinity, water.type) : [];
      const out = { water, matchingSpecies };
      _areaCache.set(key, out);
      return out;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Overpass utilgjengelig');
}
`;

// UI – tilpasset til å kalle de lokale funksjonene i stedet for /api/*.
const ui = read('public/app.standalone.js');

const html = `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>🎣 Fiskeguru – beste slukvalg akkurat nå</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <style>
${css}
  </style>
</head>
<body>
  <header>
    <h1>🎣 Fiskeguru</h1>
    <p class="tagline">Beste slukvalg ut fra sanntids vær- og lysforhold</p>
  </header>

  <main>
    <section class="panel" id="step-location">
      <h2>1. Velg lokasjon</h2>
      <p class="hint">Klikk i kartet der du skal fiske, eller bruk din posisjon.</p>
      <div id="map"></div>
      <div class="loc-row">
        <button id="geo-btn" class="ghost">📍 Bruk min posisjon</button>
        <span id="coords" class="coords">Ingen posisjon valgt</span>
      </div>
      <div id="area-card" class="area-card" hidden></div>
    </section>

    <section class="panel" id="step-conditions">
      <h2>2. Forhold akkurat nå</h2>
      <div id="conditions-card" class="conditions">
        <p class="placeholder">Velg en lokasjon for å hente vær og lysforhold…</p>
      </div>
      <details class="adv">
        <summary>Juster forhold manuelt (valgfritt)</summary>
        <div class="adv-grid">
          <label>Vanntemperatur (°C)<input type="number" id="ov-water" step="0.5" placeholder="auto-estimat" /></label>
          <label>Vannklarhet
            <select id="ov-clarity">
              <option value="clear">Klart</option>
              <option value="stained" selected>Litt farget</option>
              <option value="murky">Grumsete</option>
            </select>
          </label>
          <label>Vanntype (overstyr)
            <select id="ov-salinity">
              <option value="">Auto (fra kart)</option>
              <option value="fresh">Ferskvann</option>
              <option value="brackish">Brakkvann</option>
              <option value="salt">Saltvann</option>
            </select>
          </label>
          <label>Lufttemp (°C)<input type="number" id="ov-air" step="0.5" placeholder="auto" /></label>
          <label>Vind (m/s)<input type="number" id="ov-wind" step="0.5" placeholder="auto" /></label>
        </div>
      </details>
    </section>

    <section class="panel" id="step-species">
      <h2>3. Ønsket fisk</h2>
      <div class="species-row">
        <select id="species-select"><option value="">Velg art…</option></select>
        <button id="calc-btn" class="primary" disabled>Beregn beste sluk →</button>
      </div>
      <p id="species-note" class="species-note"></p>
    </section>

    <section class="panel result-panel" id="step-result" hidden>
      <h2>Anbefaling</h2>
      <div id="result"></div>
    </section>
  </main>

  <footer>
    <p>Værdata fra <a href="https://met.no" target="_blank" rel="noopener">MET Norway</a> ·
       Vanntype fra OpenStreetMap · Sol/lys beregnet lokalt ·
       Anbefalinger er veiledende – lokalkunnskap slår alltid en kalkulator 🐟</p>
    <p class="muted" style="font-size:0.75rem">Selvstendig fil – fungerer offline for selve beregningen. Live vær/vanntype krever internett.</p>
  </footer>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
//<![CDATA[
${engine}

${dataLayer}

${ui}
//]]>
  </script>
</body>
</html>
`;

writeFileSync(path.join(__dirname, 'fiskeguru.html'), html);
console.log('✓ Skrev fiskeguru.html (' + (html.length / 1024).toFixed(0) + ' kB)');
