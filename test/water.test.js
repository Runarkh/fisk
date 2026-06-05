// Tester for vann-klassifisering (classifyArea) og salinitets-håndtering.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyArea, buildOverpassQuery } from '../src/engine/water.js';
import { speciesForWater } from '../src/engine/species.js';
import { recommend, estimateWaterTemp } from '../src/engine/recommend.js';

const area = (tags) => ({ type: 'area', tags });
const way = (tags) => ({ type: 'way', tags });
const rel = (tags) => ({ type: 'relation', tags });

test('buildOverpassQuery inneholder is_in og koordinater', () => {
  const q = buildOverpassQuery(60.7, 11.0);
  assert.match(q, /is_in\(60\.7,11\)/);
  assert.match(q, /natural"="coastline/);
});

test('innsjø klassifiseres som ferskvann', () => {
  const r = classifyArea([area({ natural: 'water', water: 'lake', name: 'Mjøsa' })]);
  assert.equal(r.salinity, 'fresh');
  assert.equal(r.type, 'lake');
  assert.equal(r.name, 'Mjøsa');
  assert.equal(r.confidence, 'high');
});

test('elv i nærheten klassifiseres som ferskvann/elv', () => {
  const r = classifyArea([way({ waterway: 'river', name: 'Glomma' })]);
  assert.equal(r.salinity, 'fresh');
  assert.equal(r.type, 'river');
  assert.equal(r.name, 'Glomma');
});

test('åpent hav (place=sea) klassifiseres som saltvann', () => {
  const r = classifyArea([area({ place: 'sea', name: 'Skagerrak' })]);
  assert.equal(r.salinity, 'salt');
  assert.equal(r.type, 'sea');
});

test('kystlinje i nærheten gir saltvann', () => {
  const r = classifyArea([way({ natural: 'coastline' })]);
  assert.equal(r.salinity, 'salt');
});

test('generisk water med fjord-navn + kystlinje blir saltvann/fjord', () => {
  const r = classifyArea([
    area({ natural: 'water', name: 'Oslofjorden' }),
    way({ natural: 'coastline' }),
  ]);
  assert.equal(r.salinity, 'salt');
  assert.equal(r.type, 'fjord');
});

test('elv som møter sjø = brakkvann', () => {
  const r = classifyArea([
    area({ place: 'sea', name: 'Bunnefjorden' }),
    way({ waterway: 'river', name: 'Alna' }),
  ]);
  assert.equal(r.salinity, 'brackish');
  assert.equal(r.type, 'brackish');
  assert.ok(r.note.length > 0);
});

test('tomt resultat gir unknown', () => {
  const r = classifyArea([]);
  assert.equal(r.salinity, 'unknown');
  assert.equal(r.type, 'unknown');
});

test('speciesForWater: ferskvann gir gjedde, ikke makrell', () => {
  const fresh = speciesForWater('fresh');
  assert.ok(fresh.includes('gjedde'));
  assert.ok(!fresh.includes('makrell'));
});

test('speciesForWater: brakkvann inkluderer både gjedde og sjøørret', () => {
  const brak = speciesForWater('brackish');
  assert.ok(brak.includes('gjedde'));
  assert.ok(brak.includes('sjoorret'));
});

test('estimateWaterTemp: brakkvann ligger mellom fersk og salt', () => {
  const fresh = estimateWaterTemp(15, 6, 'fresh');
  const salt = estimateWaterTemp(15, 6, 'salt');
  const brak = estimateWaterTemp(15, 6, 'brackish');
  assert.ok(brak > Math.min(fresh, salt) && brak < Math.max(fresh, salt));
});

test('habitat-mismatch (gjedde i saltvann) gir kraftig lavere indeks + advarsel', () => {
  const common = {
    month: 6,
    light: { phase: 'twilight', label: 'Skumring', nearGoldenHour: true },
    airTemp: 16, cloudCover: 50, windSpeed: 4, pressure: 1008,
    pressureTrend: 'falling', precip: 0, waterClarity: 'stained',
  };
  const ok = recommend('gjedde', { ...common, salinity: 'fresh' });
  const bad = recommend('gjedde', { ...common, salinity: 'salt' });
  assert.equal(bad.habitatMatch, false);
  assert.ok(bad.activityIndex < ok.activityIndex);
});

test('alle agn-scorer er innenfor 0-100', () => {
  const out = recommend('torsk', {
    month: 2, salinity: 'salt',
    light: { phase: 'day', label: 'Dag', nearGoldenHour: false },
    airTemp: 1, cloudCover: 70, windSpeed: 5, pressure: 1010,
    pressureTrend: 'steady', precip: 0, waterTemp: 4, waterClarity: 'stained',
  });
  for (const l of out.lures) {
    assert.ok(l.score >= 0 && l.score <= 100, `score ${l.score} utenfor 0-100`);
  }
});
