// Tester for anbefalingsmotoren og solberegningen.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recommend, estimateWaterTemp } from '../src/engine/recommend.js';
import { lightConditions, sunTimes } from '../src/engine/solar.js';
import { listSpecies, SPECIES } from '../src/engine/species.js';

test('listSpecies returnerer alle artene med påkrevde felter', () => {
  const list = listSpecies();
  assert.ok(list.length >= 10);
  for (const s of list) {
    assert.ok(s.id && s.name && Array.isArray(s.salinity));
    assert.ok(s.salinity.every((x) => ['fresh', 'salt', 'brackish'].includes(x)));
  }
});

test('estimateWaterTemp gir lavere vann enn luft om våren', () => {
  const spring = estimateWaterTemp(15, 4, 'fresh');
  assert.ok(spring < 15, `forventet < 15, fikk ${spring}`);
  assert.ok(spring > 0);
});

test('estimateWaterTemp for saltvann holder seg i rimelig norsk område', () => {
  assert.ok(estimateWaterTemp(30, 7, 'salt') <= 19);
  assert.ok(estimateWaterTemp(-10, 1, 'salt') >= 2);
});

test('solberegning: soloppgang er før solnedgang i Oslo om sommeren', () => {
  const d = new Date('2026-06-21T12:00:00Z');
  const t = sunTimes(d, 59.91, 10.75);
  assert.ok(t.sunrise < t.sunset);
});

test('lightConditions klassifiserer midt på dagen som dag i Oslo (sommer, lokal middag)', () => {
  // 11:00 UTC ~ 13:00 lokal sommertid → sola står høyt
  const d = new Date('2026-06-21T11:00:00Z');
  const lc = lightConditions(d, 59.91, 10.75);
  assert.equal(lc.phase, 'day');
  assert.ok(lc.sunAltitude > 12);
});

test('lightConditions klassifiserer natt midt på natten', () => {
  const d = new Date('2026-01-15T01:00:00Z');
  const lc = lightConditions(d, 59.91, 10.75);
  assert.ok(['night', 'twilight'].includes(lc.phase));
});

test('recommend gir gyldig struktur og rangerte agn', () => {
  const out = recommend('gjedde', {
    month: 6,
    light: { phase: 'twilight', label: 'Skumring', nearGoldenHour: true },
    airTemp: 16,
    cloudCover: 50,
    windSpeed: 4,
    pressure: 1008,
    pressureTrend: 'falling',
    precip: 0,
    waterClarity: 'stained',
  });
  assert.ok(out.activityIndex >= 0 && out.activityIndex <= 100);
  assert.ok(out.lures.length > 0 && out.lures.length <= 4);
  // sortert synkende
  for (let i = 1; i < out.lures.length; i++) {
    assert.ok(out.lures[i - 1].score >= out.lures[i].score);
  }
  // alle anbefalte agn skal være kompatible med gjedde
  for (const l of out.lures) {
    assert.ok(SPECIES.gjedde.lures[l.id] != null);
    assert.ok(l.suggestedColors.length > 0);
    assert.ok(l.suggestedSize);
  }
});

test('gunstige forhold gir høyere indeks enn ugunstige for gjedde', () => {
  const good = recommend('gjedde', {
    month: 6,
    light: { phase: 'twilight', label: 'Skumring', nearGoldenHour: true },
    airTemp: 18, cloudCover: 55, windSpeed: 4, pressure: 1006,
    pressureTrend: 'falling', precip: 0.5, waterTemp: 15, waterClarity: 'stained',
  });
  const bad = recommend('gjedde', {
    month: 1,
    light: { phase: 'day', label: 'Full dag', nearGoldenHour: false },
    airTemp: -2, cloudCover: 5, windSpeed: 14, pressure: 1030,
    pressureTrend: 'rising', precip: 0, waterTemp: 2, waterClarity: 'clear',
  });
  assert.ok(good.activityIndex > bad.activityIndex,
    `forventet good(${good.activityIndex}) > bad(${bad.activityIndex})`);
});

test('kaldt vann favoriserer jigg/softbait for torsk', () => {
  const out = recommend('torsk', {
    month: 2,
    light: { phase: 'day', label: 'Dag', nearGoldenHour: false },
    airTemp: 1, cloudCover: 70, windSpeed: 5, pressure: 1010,
    pressureTrend: 'steady', precip: 0, waterTemp: 4, waterClarity: 'stained',
  });
  const ids = out.lures.map((l) => l.id);
  assert.ok(ids.includes('pirk') || ids.includes('softbait'));
});

test('ukjent art kaster feil', () => {
  assert.throws(() => recommend('drage', { month: 6, light: { phase: 'day' } }));
});
