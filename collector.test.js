import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBrazil, parseConferences } from './collector.js';
test('coleta datas e links da lista brasileira', () => {
  const events = parseBrazil('## Eventos em 2026\n### Novembro\n- 11 e 12: [Evento](https://example.com/evento) - _Recife_ ![presencial]\n## TBA\n- 12: [Ignorar](https://example.com)');
  assert.equal(events.length, 1); assert.equal(events[0].start, '2026-11-11'); assert.equal(events[0].mode, 'Presencial');
});
test('valida e normaliza eventos internacionais', () => {
  const events = parseConferences([{name:'Test',url:'https://example.com',startDate:'2026-11-20',city:'Online'}, {name:'Unsafe',url:'javascript:alert(1)',startDate:'2026-11-20'}]);
  assert.equal(events.length, 1); assert.equal(events[0].mode, 'Online');
});
