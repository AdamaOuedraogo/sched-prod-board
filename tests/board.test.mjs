import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIncidents, sortedIds, formatLocal, severityClass } from '../app/board.js';

const inc = (id, openedAt, extra = {}) => ({ id, service: 's', region: 'r', summary: 'x', severity: 'sev2', openedAt, ...extra });

test('a delta page adds to the board and never removes (risk A)', () => {
  const m = new Map();
  mergeIncidents(m, [inc('A', '2026-11-12T01:00:00Z'), inc('B', '2026-11-12T02:00:00Z')]);
  const added = mergeIncidents(m, [inc('C', '2026-11-12T03:00:00Z')]);
  assert.deepEqual(added, ['C']);
  assert.deepEqual(sortedIds(m), ['C', 'B', 'A']);
  assert.deepEqual(mergeIncidents(m, []), []);
  assert.equal(m.size, 3);
});

test('a known id is updated in place, not added twice', () => {
  const m = new Map();
  mergeIncidents(m, [inc('A', '2026-11-12T01:00:00Z')]);
  const added = mergeIncidents(m, [inc('A', '2026-11-12T01:00:00Z', { severity: 'sev1' })]);
  assert.deepEqual(added, []);
  assert.equal(m.get('A').severity, 'sev1');
});

test('newest first (R1)', () => {
  const m = new Map();
  mergeIncidents(m, [inc('old', '2026-11-12T01:00:00Z'), inc('new', '2026-11-12T04:00:00Z'), inc('mid', '2026-11-12T02:30:00Z')]);
  assert.deepEqual(sortedIds(m), ['new', 'mid', 'old']);
});

test('Berlin, de-DE: local zone, day before month (R5)', () => {
  assert.equal(formatLocal('2026-11-12T03:03:00.000Z', 'de-DE', 'Europe/Berlin'), '12.11.2026, 04:03');
});

test('Auckland, en-NZ: local zone, day before month (R5)', () => {
  const s = formatLocal('2026-11-12T03:03:00.000Z', 'en-NZ', 'Pacific/Auckland');
  assert.match(s, /^12\/11\/2026, 0?4:03\s?pm$/i);
});

test('US locale keeps month first (order follows the locale)', () => {
  assert.match(formatLocal('2026-11-12T03:03:00.000Z', 'en-US', 'America/New_York'), /^11\/11\/2026, 10:03\s?PM$/);
});

test('bad time falls back to the raw value', () => {
  assert.equal(formatLocal('nope', 'de-DE', 'Europe/Berlin'), 'nope');
});

test('severity class only sev0..sev9', () => {
  assert.equal(severityClass('sev1'), 'sev1');
  assert.equal(severityClass('sev1 evil" onclick'), '');
});
