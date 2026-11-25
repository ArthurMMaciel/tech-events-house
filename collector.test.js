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

test('lê eventos da Even3 com cidade, estado e preço', async () => {
  const { parseEven3 } = await import('./src/sources.js');
  const events = parseEven3({
    listaEventosPorCategoriaPaginados: [
      { id: 1, data: '2026-12-12T00:00:00', dataFim: '2026-12-13T00:00:00', titulo: 'DevOpsDays Recife', url: 'https://even3.com.br/devopsdays-1', cidade: 'Recife', siglaEstado: 'PE', pais: 'Brasil', precoIngressoMaisCaro: 0, passou: false },
      { id: 2, data: '2026-12-14T00:00:00', titulo: 'Agentes de IA', url: 'https://even3.com.br/agentes-2', localRealizacao: 'Este é um evento online', pais: 'Brasil', precoIngressoMaisCaro: 178.9 },
      { id: 3, data: '2020-01-01T00:00:00', titulo: 'Antigo', url: 'https://even3.com.br/x-3', passou: true },
    ],
    listaModelTagCategoriaEvento: [{ descricao: 'inteligência artificial', listaEventos: [{ id: 2, data: '2026-12-14T00:00:00', titulo: 'Agentes de IA', url: 'https://even3.com.br/agentes-2' }] }],
  });
  assert.equal(events.length, 2);
  assert.deepEqual([events[0].city, events[0].state, events[0].countryCode, events[0].end, events[0].price], ['Recife', 'PE', 'BR', '2026-12-13', undefined]);
  assert.deepEqual([events[1].mode, events[1].price, events[1].topics], ['Online', 'paid', ['inteligência artificial']]);
});
