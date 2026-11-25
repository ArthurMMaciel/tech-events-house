import { supabase } from './supabase.js';
import { toRow } from './sources.js';

const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function fail(error, fallback = 'Não foi possível concluir a operação. Tente novamente.') {
  // Só repassa as mensagens escritas no SQL (register_for_event); o resto vira texto amigável.
  const err = new Error(['22023', 'P0002'].includes(error?.code) ? error.message : fallback);
  err.status = error?.status || (error?.code === 'PGRST301' ? 401 : undefined);
  throw err;
}

export async function currentMember(userId) {
  const { data, error } = await supabase.from('members').select('name').eq('user_id', userId).maybeSingle();
  if (error) fail(error);
  return data;
}

const FIELDS = 'id,title,start_date,end_date,url,source,mode,location,description,country_code,state,city,is_online,price,topics';

function shape(e) {
  const item = Array.isArray(e.agenda_items) ? e.agenda_items[0] : e.agenda_items;
  return { id: e.id, title: e.title, start: e.start_date, end: e.end_date, url: e.url, source: e.source, mode: e.mode, location: e.location, description: e.description, countryCode: e.country_code, state: e.state, city: e.city, online: e.is_online, price: e.price, topics: e.topics || [], saved: Boolean(item), publicToken: item?.public_token || null, attendees: (item?.participants || []).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) };
}

async function fetchAll(build) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await build().range(offset, offset + 999);
    if (error) fail(error, 'Não foi possível carregar os eventos.');
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows.map(shape);
}

// Catálogo: só o que ainda não terminou (término ou início a partir de hoje).
export function loadUpcoming() {
  const today = isoDate(new Date());
  return fetchAll(() => supabase.from('events')
    .select(`${FIELDS},agenda_items(public_token,participants(id,name,email,status,origin))`)
    .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
    .order('start_date').order('title'));
}

// Agenda da casa no mês (inclui dias passados do mês, para o calendário).
export function loadAgendaMonth(month) {
  const from = isoDate(month), to = isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  return fetchAll(() => supabase.from('events')
    .select(`${FIELDS},agenda_items!inner(public_token,participants(id,name,email,status,origin))`)
    .gte('start_date', from).lt('start_date', to)
    .order('start_date').order('title'));
}

export async function saveCollected(events) {
  const rows = [...new Map(events.map(toRow).filter(Boolean).map(r => [r.external_id, r])).values()];
  // Lotes com o mesmo conjunto de colunas: linhas sem preço não sobrescrevem o preço salvo.
  const groups = new Map();
  for (const r of rows) { const k = Object.keys(r).sort().join(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  for (const group of groups.values()) for (let i = 0; i < group.length; i += 500) {
    const { error } = await supabase.from('events').upsert(group.slice(i, i + 500), { onConflict: 'external_id' });
    if (error) fail(error, 'Não foi possível salvar os eventos coletados.');
  }
  return rows.length;
}

export async function setEventPrice(id, price) {
  const { error } = await supabase.from('events').update({ price: price || null }).eq('id', id);
  if (error) fail(error, 'Não foi possível atualizar o preço.');
}

export async function createEvent(input) {
  const { data, error } = await supabase.from('events').insert({ ...input, source: 'Manual' }).select('id').single();
  if (error) fail(error, 'Não foi possível criar o evento.');
  await addToAgenda(data.id);
  return data.id;
}

export async function addToAgenda(eventId) {
  const { error } = await supabase.from('agenda_items').upsert({ event_id: eventId }, { onConflict: 'event_id', ignoreDuplicates: true });
  if (error) fail(error, 'Não foi possível adicionar à agenda.');
}

export async function removeFromAgenda(eventId) {
  const { error } = await supabase.from('agenda_items').delete().eq('event_id', eventId);
  if (error) fail(error, 'Não foi possível remover da agenda.');
}

// Sincroniza a lista de pessoas do evento com o que foi editado no diálogo.
export async function saveParticipants(eventId, people, previous) {
  const keep = new Set(people.filter(p => p.id).map(p => p.id));
  const removed = previous.filter(p => !keep.has(p.id)).map(p => p.id);
  if (removed.length) { const { error } = await supabase.from('participants').delete().in('id', removed); if (error) fail(error); }
  for (const p of people.filter(p => p.id)) {
    const old = previous.find(x => x.id === p.id);
    if (old && (old.name !== p.name || old.email !== p.email)) { const { error } = await supabase.from('participants').update({ name: p.name, email: p.email.toLowerCase() }).eq('id', p.id); if (error) fail(error, 'Não foi possível atualizar a pessoa. Verifique se o e-mail não está repetido.'); }
  }
  const fresh = people.filter(p => !p.id).map(p => ({ event_id: eventId, name: p.name, email: p.email.toLowerCase() }));
  if (fresh.length) { const { error } = await supabase.from('participants').insert(fresh); if (error) fail(error, 'Não foi possível salvar. Verifique se algum e-mail já está na lista.'); }
}

export async function setParticipantStatus(id, status) {
  const { error } = await supabase.from('participants').update({ status }).eq('id', id);
  if (error) fail(error, 'Não foi possível atualizar a resposta.');
}

export async function getPublicEvent(token) {
  const { data, error } = await supabase.rpc('get_public_event', { p_token: token });
  if (error) fail(error, 'Não foi possível carregar o evento.');
  return data?.[0] || null;
}

export async function registerForEvent(token, name, email, response) {
  const { error } = await supabase.rpc('register_for_event', { p_token: token, p_name: name, p_email: email, p_response: response });
  if (error) fail(error, 'Não foi possível registrar sua resposta.');
}

export const publicLink = token => `${window.location.origin}/e/${token}`;

export function inviteMailto(event, emails) {
  const date = new Date(`${event.start}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = `Olá!\n\nBora no ${event.title}, em ${date}?\n\nConfirme sua presença aqui: ${publicLink(event.publicToken)}\n${event.url ? `\nSite do evento (inscrição oficial): ${event.url}\n` : ''}\nDFL Events`;
  const params = new URLSearchParams({ subject: `Convite: ${event.title}`, body });
  const [to, ...bcc] = emails;
  if (bcc.length) params.set('bcc', bcc.join(','));
  return `mailto:${encodeURIComponent(to)}?${params.toString().replace(/\+/g, '%20')}`;
}
