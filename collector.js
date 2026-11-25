// Coleta completa (Node): fontes abertas + páginas que bloqueiam o navegador (CORS).
import * as cheerio from 'cheerio';
import { collectOpenSources, download } from './src/sources.js';

export { parseBrazil, parseConferences } from './src/sources.js';

const pages = {
  Eventbrite: 'https://www.eventbrite.com.br/d/online/free--science-and-tech--events/',
  Sympla: 'https://www.sympla.com.br/eventos/tecnologia?category=collection',
};
const allowedHosts = ['www.eventbrite.com', 'www.eventbrite.com.br', 'www.sympla.com.br'];

function scrape(source, html) {
  const $ = cheerio.load(html); const events = [];
  if (source === 'Eventbrite') $('script[type="application/ld+json"]').each((_, el) => {
    try { for (const x of JSON.parse($(el).html()).itemListElement || []) { const e = x.item; if (e?.startDate && e.url) events.push({ title: e.name, start: e.startDate, end: e.endDate, url: e.url, mode: 'Online', description: e.description || '' }); } } catch {}
  });
  if (source === 'Sympla') $('script').each((_, el) => {
    const match = ($(el).html() || '').match(/^self\.__next_f\.push\((\[.*\])\)$/s); if (!match) return;
    try {
      const part = JSON.parse(match[1])[1]; const data = JSON.parse(part.slice(part.indexOf(':') + 1));
      const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.name === 'string' && typeof o.start_date === 'string' && typeof o.url === 'string' && o.url.includes('sympla.com.br/evento/')) events.push({ title: o.name, start: o.start_date, end: o.end_date, url: o.url, mode: o.location?.city || 'Não informado', description: '' }); for (const v of Object.values(o)) walk(v); };
      walk(data);
    } catch {}
  });
  return events.filter(e => { try { return allowedHosts.includes(new URL(e.url).hostname); } catch { return false; } }).map(e => ({ ...e, source, id: `${source}:${e.url.split('?')[0]}` }));
}

export async function collect() {
  const all = [], status = [];
  for (const [source, url] of Object.entries(pages)) {
    try { const events = scrape(source, await download(url, 25000)); all.push(...events); status.push({ source, count: events.length, ok: events.length > 0, message: events.length ? 'Dados encontrados' : 'Nenhum evento identificado na página' }); }
    catch { status.push({ source, count: 0, ok: false, message: 'Não foi possível consultar esta fonte' }); }
  }
  const open = await collectOpenSources();
  return { events: [...all, ...open.events], status: [...status, ...open.status] };
}
