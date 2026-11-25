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
    events.push({ id: `Agenda Tech Brasil:${start}:${url.split('?')[0]}`, source: 'Agenda Tech Brasil', title: entry[2], start, end: null, url, mode: /!\[online\]/i.test(entry[4]) ? 'Online' : /!\[híbrido\]/i.test(entry[4]) ? 'Híbrido' : 'Presencial', description: '' });
  }
  return events;
}

export function parseConferences(data) {
  if (!Array.isArray(data)) return [];
  return data.flatMap(e => {
    const url = safeUrl(e.url);
    if (!url || typeof e.name !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.startDate || '')) return [];
    return [{ id: `Confs.tech:${e.startDate}:${url.split('?')[0]}`, source: 'Confs.tech', title: e.name, start: e.startDate, end: e.endDate || null, url, mode: /online|virtual/i.test(`${e.city || ''} ${e.country || ''}`) ? 'Online' : [e.city, e.country].filter(Boolean).join(', ') || 'Não informado', description: '' }];
  });
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
        const batch = await Promise.allSettled(urls.slice(i, i + 8).map(async url => parseConferences(JSON.parse(await download(url)))));
        for (const result of batch) if (result.status === 'fulfilled') all.push(...result.value); else partial = true;
      }
    }
    const events = [...new Map(all.map(e => [e.id, e])).values()];
    return { events, status: { source, count: events.length, ok: events.length > 0, message: partial ? 'Coleta parcial; algumas fontes não responderam' : 'Dados encontrados' } };
  } catch { return { events: [], status: { source, count: 0, ok: false, message: 'Não foi possível consultar esta fonte' } }; }
}

export async function collectOpenSources() {
  const results = await Promise.all([collectBrazil(), collectConferences()]);
  return { events: results.flatMap(r => r.events), status: results.map(r => r.status) };
}

// Converte o formato dos coletores para as colunas de public.events.
export function toRow(e) {
  const start = String(e.start || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !safeUrl(e.url)) return null;
  const endRaw = e.end ? String(e.end).slice(0, 10) : null;
  const end = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && endRaw >= start ? endRaw : null;
  return { external_id: e.id, title: String(e.title).trim().slice(0, 300) || 'Sem título', start_date: start, end_date: end, url: e.url, source: e.source, mode: e.mode || null, description: e.description || null };
}
