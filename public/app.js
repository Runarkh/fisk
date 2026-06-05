// app.js – frontend-logikk for Fiskeguru

const state = {
  lat: null,
  lon: null,
  conditions: null,
  species: [],
};

// --- kart ---
const map = L.map('map').setView([63.43, 10.39], 5); // sentrert på Norge
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap',
}).addTo(map);

let marker = null;
function setLocation(lat, lon, zoom) {
  state.lat = lat;
  state.lon = lon;
  if (marker) marker.setLatLng([lat, lon]);
  else marker = L.marker([lat, lon]).addTo(map);
  if (zoom) map.setView([lat, lon], zoom);
  document.getElementById('coords').textContent =
    `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  loadConditions();
  refreshCalcButton();
}

map.on('click', (e) => setLocation(e.latlng.lat, e.latlng.lng));

document.getElementById('geo-btn').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolokasjon støttes ikke av nettleseren.');
  navigator.geolocation.getCurrentPosition(
    (pos) => setLocation(pos.coords.latitude, pos.coords.longitude, 11),
    () => alert('Klarte ikke hente posisjon. Klikk i kartet i stedet.')
  );
});

// --- forhold ---
async function loadConditions() {
  const card = document.getElementById('conditions-card');
  card.innerHTML = '<p class="placeholder spin">Henter vær og lysforhold…</p>';
  try {
    const r = await fetch(`/api/conditions?lat=${state.lat}&lon=${state.lon}`);
    const data = await r.json();
    state.conditions = data;
    renderConditions(data);
  } catch (e) {
    card.innerHTML = `<p class="placeholder">Klarte ikke hente forhold (${e.message}). Du kan fortsatt beregne med manuelle verdier.</p>`;
  }
}

function fmtTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
}

function renderConditions(d) {
  const card = document.getElementById('conditions-card');
  const w = d.weather;
  const l = d.light;
  const cells = [];
  cells.push(cell('Lys', l.label, l.nearGoldenHour ? '✨ gylden time' : `sol ${l.sunAltitude}°`));
  if (l.polar) cells.push(cell('Spesielt', l.polar === 'midnattssol' ? 'Midnattssol' : 'Mørketid', ''));
  cells.push(cell('Soloppg.', fmtTime(l.sunrise), ''));
  cells.push(cell('Solnedg.', fmtTime(l.sunset), ''));
  if (w) {
    cells.push(cell('Lufttemp', `${w.airTemp}°C`, ''));
    cells.push(cell('Skydekke', `${Math.round(w.cloudCover)}%`, w.symbol || ''));
    cells.push(cell('Vind', `${w.windSpeed} m/s`, ''));
    cells.push(cell('Lufttrykk', `${Math.round(w.pressure)} hPa`, trendLabel(w.pressureTrend)));
    cells.push(cell('Nedbør', `${w.precip} mm`, ''));
  }
  let banner = '';
  if (d.weatherError) {
    banner = `<div class="warn-banner">⚠️ Fikk ikke live værdata (${d.weatherError}). Bruk manuelle verdier under for best resultat.</div>`;
  }
  card.innerHTML = banner + `<div class="cond-grid">${cells.join('')}</div>`;
}

function cell(k, v, sub) {
  return `<div class="cond"><div class="k">${k}</div><div class="v">${v}</div>${
    sub ? `<div class="k">${sub}</div>` : ''
  }</div>`;
}
function trendLabel(t) {
  return { falling: '↓ fallende', rising: '↑ stigende', steady: '→ stabilt' }[t] || '';
}

// --- arter ---
async function loadSpecies() {
  const r = await fetch('/api/species');
  state.species = await r.json();
  const sel = document.getElementById('species-select');
  // grupper fersk/salt
  const groups = { fresh: 'Ferskvann', salt: 'Saltvann' };
  for (const key of ['fresh', 'salt']) {
    const og = document.createElement('optgroup');
    og.label = groups[key];
    state.species.filter((s) => s.water === key).forEach((s) => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name;
      og.appendChild(o);
    });
    sel.appendChild(og);
  }
}

document.getElementById('species-select').addEventListener('change', (e) => {
  const s = state.species.find((x) => x.id === e.target.value);
  document.getElementById('species-note').textContent = s ? s.notes : '';
  refreshCalcButton();
});

function refreshCalcButton() {
  const hasSpecies = !!document.getElementById('species-select').value;
  document.getElementById('calc-btn').disabled = !(state.lat != null && hasSpecies);
}

// --- beregning ---
document.getElementById('calc-btn').addEventListener('click', async () => {
  const species = document.getElementById('species-select').value;
  const btn = document.getElementById('calc-btn');
  btn.disabled = true;
  btn.textContent = 'Beregner…';

  const override = {};
  const air = parseFloat(document.getElementById('ov-air').value);
  const wind = parseFloat(document.getElementById('ov-wind').value);
  if (!Number.isNaN(air)) override.airTemp = air;
  if (!Number.isNaN(wind)) override.windSpeed = wind;
  const water = parseFloat(document.getElementById('ov-water').value);
  const clarity = document.getElementById('ov-clarity').value;

  const body = {
    species,
    lat: state.lat,
    lon: state.lon,
    waterClarity: clarity,
    override,
  };
  if (!Number.isNaN(water)) body.waterTemp = water;

  try {
    const r = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    renderResult(data);
  } catch (e) {
    alert('Beregning feilet: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Beregn beste sluk →';
  }
});

function renderResult(data) {
  const res = data.result;
  const el = document.getElementById('result');
  const panel = document.getElementById('step-result');
  panel.hidden = false;

  const gauge = `
    <div class="gauge">
      <div class="gauge-ring" style="--val:${res.activityIndex}">${res.activityIndex}</div>
      <div class="gauge-text">
        <div class="lbl">${res.activityLabel}</div>
        <div class="sub">Aktivitetsindeks for ${res.species.name.toLowerCase()} ·
          vanntemp ${res.waterTemp ?? '?'}°C${res.waterTempEstimated ? ' (estimert)' : ''} ·
          ${clarityLabel(res.waterClarity)}</div>
      </div>
    </div>`;

  const lures = res.lures.map((l) => `
    <div class="lure ${l.rank === 1 ? 'top' : ''}">
      <div class="lure-head">
        <span><span class="rank">#${l.rank}</span> <span class="lure-name">${l.name}</span></span>
        <span class="lure-score">${l.score}</span>
      </div>
      <p class="lure-blurb">${l.blurb}</p>
      <div class="lure-specs">
        <span><b>Størrelse:</b> ${l.suggestedSize}</span>
        <span><b>Dybde:</b> ${l.suggestedDepth}</span>
        <span><b>Fart:</b> ${l.suggestedRetrieve}</span>
      </div>
      <div class="chips">
        ${l.suggestedColors.map((c) => `<span class="chip">🎨 ${c}</span>`).join('')}
        ${l.reasons.map((r) => `<span class="chip">✓ ${r}</span>`).join('')}
      </div>
    </div>`).join('');

  const tips = `
    <div class="tips">
      <h3>💡 Tips for forholdene</h3>
      <ul>${res.tips.map((t) => `<li>${t}</li>`).join('')}</ul>
    </div>`;

  const factorRows = Object.entries(res.factors).map(([name, f]) => `
    <div class="factor-row">
      <span class="fname">${cap(name)}</span>
      <span class="bar"><span style="width:${Math.round(f.score * 100)}%"></span></span>
      <span>${Math.round(f.score * 100)}</span>
    </div>
    ${f.reason ? `<p class="factor-reason">${f.reason}</p>` : ''}`).join('');

  const factors = `
    <details class="factors">
      <summary>Hvorfor? Se forholdene som påvirker</summary>
      ${factorRows}
    </details>`;

  el.innerHTML = gauge + lures + tips + factors;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clarityLabel(c) {
  return { clear: 'klart vann', stained: 'litt farget vann', murky: 'grumsete vann' }[c] || c;
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// init
loadSpecies();
