// Fontes abertas que respondem com CORS liberado: rodam no navegador e no Node.
const MAX_BYTES = 8 * 1024 * 1024;

export async function download(url, timeout = 20000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Resposta muito grande');
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error('Resposta muito grande');
  return text;
}

export const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } };

export function parseBrazil(text) {
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  let year = 0, month = -1; const events = [];
  for (const line of text.split(/\r?\n/)) {
    const yearMatch = line.match(/^## Eventos em (\d{4})/); if (yearMatch) { year = Number(yearMatch[1]); continue; }
    if (line.startsWith('## ')) { year = 0; continue; }
    const heading = line.match(/^### (.+)$/); if (heading) { month = months.indexOf(heading[1].trim().toLocaleLowerCase('pt-BR')); continue; }
    if (!year || month < 0) continue;
    const entry = line.match(/^- (\d{1,2})(?:[^:]*): \[(.+?)\]\((https?:\/\/[^ )]+)\)(.*)$/); if (!entry) continue;
    const day = Number(entry[1]);
    if (day < 1 || day > new Date(year, month + 1, 0).getDate()) continue;
    const start = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const url = safeUrl(entry[3]); if (!url) continue;
    const mode = /!\[online\]/i.test(entry[4]) ? 'Online' : /!\[híbrido\]/i.test(entry[4]) ? 'Híbrido' : 'Presencial';
    const place = entry[4].match(/_([^_]+)_/)?.[1].trim() || '';
    const uf = place.match(/\/\s*([A-Za-z]{2})\s*$/)?.[1].toUpperCase() || null;
    const city = (uf ? place.replace(/\/\s*[A-Za-z]{2}\s*$/, '') : place).trim() || null;
    events.push({ id: `Agenda Tech Brasil:${start}:${url.split('?')[0]}`, source: 'Agenda Tech Brasil', title: entry[2], start, end: endFromLabel(entry[0], year, month, day), url, mode, countryCode: 'BR', state: uf, city, online: mode === 'Online', topics: [], description: '' });
  }
  return events;
}

// Nome do país em inglês (como no Confs.tech) -> código ISO de 2 letras.
const COUNTRY_ALIASES = { 'u.s.a.': 'US', usa: 'US', 'united states of america': 'US', 'u.k.': 'GB', uk: 'GB', england: 'GB', scotland: 'GB', wales: 'GB', uae: 'AE', 'the netherlands': 'NL', 'czech republic': 'CZ', russia: 'RU', 'south korea': 'KR', korea: 'KR', vietnam: 'VN', turkey: 'TR', 'türkiye': 'TR', taiwan: 'TW', 'hong kong': 'HK', macedonia: 'MK', 'bosnia and herzegovina': 'BA', brasil: 'BR' };
let countryIndex;
export function countryCode(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key || /online|virtual|remote/.test(key)) return null;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (!countryIndex) {
    countryIndex = new Map(); const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const code = String.fromCharCode(a, b); try { const n = names.of(code); if (n) countryIndex.set(n.toLowerCase(), code); } catch {} }
  }
  return countryIndex.get(key) || null;
}

export function parseConferences(data, topic = null) {
  if (!Array.isArray(data)) return [];
  return data.flatMap(e => {
    const url = safeUrl(e.url);
    if (!url || typeof e.name !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.startDate || '')) return [];
    const online = e.online === true || /online|virtual/i.test(`${e.city || ''} ${e.country || ''}`);
    const rawCity = typeof e.city === 'string' && !/online|virtual/i.test(e.city) ? e.city.trim() : '';
    const cc = countryCode(e.country);
    const region = cc === 'US' || cc === 'CA' || cc === 'AU' ? rawCity.match(/,\s*([A-Z]{2,3})$/)?.[1] || null : null;
    const city = (region ? rawCity.replace(/,\s*[A-Z]{2,3}$/, '') : rawCity) || null;
    return [{ id: `Confs.tech:${e.startDate}:${url.split('?')[0]}`, source: 'Confs.tech', title: e.name, start: e.startDate, end: e.endDate || null, url, mode: online && city ? 'Híbrido' : online ? 'Online' : 'Presencial', countryCode: cc, state: region, city, online, topics: topic ? [topic] : [], description: '' }];
  });
}

// "11 e 12", "11 a 13", "30/11 a 02/12": tenta descobrir o último dia.
function endFromLabel(label, year, month, day) {
  const days = label.match(/^- ([^:]+):/)?.[1] || '';
  if (days.includes('/')) return null;
  const nums = days.match(/\d{1,2}/g)?.map(Number) || [];
  const last = nums[nums.length - 1];
  if (!last || last === day || last < 1 || last > 31) return null;
  const endMonth = last < day ? month + 1 : month;
  const d = new Date(year, endMonth, last);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function collectBrazil() {
  const source = 'Agenda Tech Brasil';
  try {
    const events = parseBrazil(await download('https://raw.githubusercontent.com/agenda-tech-brasil/agenda-tech-brasil/main/README.md'));
    return { events, status: { source, count: events.length, ok: events.length > 0, message: events.length ? 'Dados encontrados' : 'Nenhum evento identificado' } };
  } catch { return { events: [], status: { source, count: 0, ok: false, message: 'Não foi possível consultar esta fonte' } }; }
}

export async function collectConferences() {
  const source = 'Confs.tech';
  try {
    const year = new Date().getFullYear(); let partial = false; const all = [];
    for (const y of [year, year + 1]) {
      let files;
      try { files = JSON.parse(await download(`https://api.github.com/repos/tech-conferences/conference-data/contents/conferences/${y}`)); if (!Array.isArray(files)) throw Error(); }
      catch { partial = true; continue; }
      const urls = files.filter(f => f.type === 'file' && /^[a-z0-9-]+\.json$/.test(f.name)).map(f => `https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/${y}/${f.name}`);
      for (let i = 0; i < urls.length; i += 8) {
        const batch = await Promise.allSettled(urls.slice(i, i + 8).map(async url => parseConferences(JSON.parse(await download(url)), url.match(/\/([a-z0-9-]+)\.json$/)[1])));
        for (const result of batch) if (result.status === 'fulfilled') all.push(...result.value); else partial = true;
      }
    }
    const merged = new Map();
    for (const e of all) { const seen = merged.get(e.id); if (seen) seen.topics = [...new Set([...seen.topics, ...e.topics])]; else merged.set(e.id, { ...e }); }
    const events = [...merged.values()];
    return { events, status: { source, count: events.length, ok: events.length > 0, message: partial ? 'Coleta parcial; algumas fontes não responderam' : 'Dados encontrados' } };
  } catch { return { events: [], status: { source, count: 0, ok: false, message: 'Não foi possível consultar esta fonte' } }; }
}

// Even3: a página da categoria "Computação e TI" (id 4) publica este JSON com CORS aberto.
const EVEN3_URL = 'https://even3v2.blob.core.windows.net/json/lista_de_eventos-categoria-4.json';

export function parseEven3(data) {
  const raw = [...(data?.listaEventosPorCategoriaPaginados || []), ...(data?.listaModelTagCategoriaEvento || []).flatMap(t => (t.listaEventos || []).map(e => ({ ...e, tag: t.descricao })))];
  const out = new Map();
  for (const e of raw) {
    const url = safeUrl(e.url); const start = String(e.data || e.dataEvento || '').slice(0, 10);
    if (!url || typeof e.titulo !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start) || e.passou) continue;
    const id = `Even3:${e.id}`;
    if (out.has(id)) { const seen = out.get(id); if (e.tag && !seen.topics.includes(e.tag)) seen.topics.push(e.tag); continue; }
    const online = e.eventoOnline === true || /evento online|on-?line/i.test(e.localRealizacao || '');
    const foreign = e.pais && !/bra[sz]il/i.test(e.pais);
    const priceMax = Number(e.precoIngressoMaisCaro);
    out.set(id, {
      id, source: 'Even3', title: e.titulo.trim(), start, end: String(e.dataFim || e.dataFimEvento || '').slice(0, 10) || null, url,
      mode: online ? 'Online' : 'Presencial', online, countryCode: foreign ? countryCode(e.pais) : 'BR',
      state: /^[A-Z]{2}$/.test(e.siglaEstado || '') ? e.siglaEstado : null, city: e.cidade || null,
      // 0/0 não diferencia gratuito de preço não cadastrado: só marca pago quando há valor.
      price: priceMax > 0 ? 'paid' : undefined,
      topics: e.tag ? [e.tag] : [], description: e.resumoEvento || '',
    });
  }
  return [...out.values()];
}

export async function collectEven3() {
  const source = 'Even3';
  try {
    const events = parseEven3(JSON.parse((await download(EVEN3_URL)).replace(/^﻿/, '')));
    return { events, status: { source, count: events.length, ok: events.length > 0, message: events.length ? 'Dados encontrados' : 'Nenhum evento identificado' } };
  } catch { return { events: [], status: { source, count: 0, ok: false, message: 'Não foi possível consultar esta fonte' } }; }
}

export async function collectOpenSources() {
  const results = await Promise.all([collectBrazil(), collectConferences(), collectEven3()]);
  return { events: results.flatMap(r => r.events), status: results.map(r => r.status) };
}

// Converte o formato dos coletores para as colunas de public.events.
export function toRow(e) {
  const start = String(e.start || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !safeUrl(e.url)) return null;
  const endRaw = e.end ? String(e.end).slice(0, 10) : null;
  const end = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && endRaw >= start ? endRaw : null;
  const row = { external_id: e.id, title: String(e.title).trim().slice(0, 300) || 'Sem título', start_date: start, end_date: end, url: e.url, source: e.source, mode: e.mode || null, description: e.description || null, country_code: e.countryCode || null, state: e.state || null, city: e.city || null, is_online: Boolean(e.online), topics: e.topics || [] };
  // Preço só vai quando a fonte informa, para não apagar o que a casa marcou à mão.
  if (e.price === 'free' || e.price === 'paid') row.price = e.price;
  return row;
}
