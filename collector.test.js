import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBrazil, parseConferences, countryCode, toRow } from './collector.js';

test('coleta datas, cidade e estado da lista brasileira', () => {
  const events = parseBrazil('## Eventos em 2026\n### Novembro\n- 11 e 12: [Evento](https://example.com/evento) - _Recife/PE_ ![presencial]\n- 20: [Live](https://example.com/live) ![online]\n## TBA\n- 12: [Ignorar](https://example.com)');
  assert.equal(events.length, 2);
  assert.equal(events[0].start, '2026-11-11'); assert.equal(events[0].end, '2026-11-12');
  assert.equal(events[0].mode, 'Presencial'); assert.equal(events[0].city, 'Recife'); assert.equal(events[0].state, 'PE'); assert.equal(events[0].countryCode, 'BR');
  assert.equal(events[1].online, true); assert.equal(events[1].city, null);
});

test('valida e normaliza eventos internacionais', () => {
  const events = parseConferences([
    { name: 'Test', url: 'https://example.com', startDate: '2026-11-20', city: 'Online' },
    { name: 'NYC', url: 'https://nyc.example.com', startDate: '2026-11-20', city: 'Brooklyn, NY', country: 'U.S.A.' },
    { name: 'Unsafe', url: 'javascript:alert(1)', startDate: '2026-11-20' },
  ], 'javascript');
  assert.equal(events.length, 2);
  assert.equal(events[0].mode, 'Online'); assert.equal(events[0].countryCode, null);
  assert.deepEqual([events[1].countryCode, events[1].state, events[1].city, events[1].topics[0]], ['US', 'NY', 'Brooklyn', 'javascript']);
});

test('converte nomes de país', () => {
  assert.equal(countryCode('Germany'), 'DE'); assert.equal(countryCode('U.K.'), 'GB'); assert.equal(countryCode('Brazil'), 'BR'); assert.equal(countryCode('Online'), null);
});

test('não envia preço quando a fonte não informa', () => {
  const base = { id: 'x', title: 'T', start: '2026-12-01', url: 'https://a.com', source: 'S' };
  assert.equal('price' in toRow(base), false);
  assert.equal(toRow({ ...base, price: 'free' }).price, 'free');
});
