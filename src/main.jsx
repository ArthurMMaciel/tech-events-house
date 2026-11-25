import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import AttendeesDialog from './AttendeesDialog.jsx';
import EventFormDialog from './EventFormDialog.jsx';
import PublicEvent from './PublicEvent.jsx';
import Calendar from './Calendar.jsx';
import { supabase, configured } from './supabase.js';
import { addToAgenda, createEvent, currentMember, inviteMailto, loadMonth, publicLink, removeFromAgenda, saveCollected, saveParticipants, setParticipantStatus } from './data.js';
import { collectOpenSources } from './sources.js';

function eventDate(value) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function Login({ initialError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => setError(initialError), [initialError]);
  async function submit(e) {
    e.preventDefault(); setError('');
    if (!email.trim() || !password) { setError('Informe seu e-mail e sua senha.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.status === 400 ? 'E-mail ou senha incorretos.' : error.status === 429 ? 'Muitas tentativas. Tente novamente mais tarde.' : 'Não foi possível entrar. Tente novamente.'); setPassword(''); }
  }
  return <div className="login"><aside className="login-art"><Brand /><div><div className="eyebrow">Sua próxima descoberta</div><h1>Boas ideias começam em bons encontros.</h1><p>Encontre eventos de tecnologia e organize a agenda da casa.</p></div><div className="eyebrow">Agenda compartilhada</div></aside><main className="login-main"><div className="login-box"><div className="tagline">Bem-vindo de volta</div><h2>Entre na sua conta</h2><p className="sub">Seus eventos favoritos estão esperando por você.</p><form onSubmit={submit} noValidate><label className="field">E-mail<input className="control" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label><label className="field">Senha<input className="control" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</button><div className="error" role="alert">{error}</div><button className="primary wide" disabled={busy}>{busy ? 'Entrando…' : 'Entrar →'}</button></form></div></main></div>;
}

function Brand() { return <div className="brand"><span className="logo">✳</span> DFL events</div>; }

const statusLabel = { invited: 'Convidado', confirmed: 'Confirmou', declined: 'Não vai' };

function EventCard({ event, onSave, onPeople, onRemove, onStatus, onCopy, saving }) {
  const date = eventDate(event.start);
  const emails = event.attendees.filter(p => p.status === 'invited').map(p => p.email);
  const confirmed = event.attendees.filter(p => p.status === 'confirmed').length;
  return <article className="event"><div className="date"><strong>{date ? date.toLocaleDateString('pt-BR', { day: '2-digit' }) : '—'}</strong>{date ? date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '—'}</div><div>
    <h3>{event.title}</h3>
    <div className="meta"><span>◷ {date ? date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Data não informada'}</span><span>◎ {[event.mode, event.location].filter(Boolean).join(' · ') || 'Não informado'}</span><span>↗ {event.source}</span>{event.saved && <span>✓ {confirmed} {confirmed === 1 ? 'confirmado' : 'confirmados'}</span>}</div>
    {event.saved && <div className="event-share"><span className="share-label">Link de inscrição</span><code>{publicLink(event.publicToken)}</code><button className="ghost" onClick={() => onCopy(event)}>Copiar</button>{emails.length > 0 && <a className="ghost-link" href={inviteMailto(event, emails)}>Convidar por e-mail ({emails.length})</a>}</div>}
    {event.saved && event.attendees.length > 0 && <div className="event-attendees"><strong>Participantes</strong>{event.attendees.map(person => <div className="person-row" key={person.id}><span>{person.name} <span className="person-email">{person.email}</span><small>{person.origin === 'public' ? 'Inscreveu-se pelo link' : 'Adicionado pela casa'}</small></span><label><span className="sr">Resposta de {person.name}</span><select className="control status-select" value={person.status} disabled={saving} onChange={e => onStatus(person, e.target.value)}>{Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>{person.status === 'invited' && <a className="ghost-link send-invite" href={inviteMailto(event, [person.email])}>Enviar convite</a>}</div>)}</div>}
  </div><div className="event-actions">{event.url && <a href={event.url} target="_blank" rel="noopener noreferrer">Ver evento ↗</a>}{event.saved ? <><button className="secondary saved" disabled={saving} onClick={() => onPeople(event)}>✓ Pessoas</button><button className="ghost remove-event" disabled={saving} onClick={() => onRemove(event)}>Remover</button></> : <button className="secondary" disabled={saving} onClick={() => onSave(event)}>+ Vamos nesse</button>}</div></article>;
}

function Agenda({ member, onLogout, onSessionExpired }) {
  const [events, setEvents] = useState([]), [page, setPage] = useState('events');
  const [month, setMonth] = useState(() => { const date = new Date(); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [saving, setSaving] = useState(null);
  const [search, setSearch] = useState(''), [source, setSource] = useState('all'), [mode, setMode] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null), [creating, setCreating] = useState(false), [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);
  const handle = err => { if (err.status === 401) onSessionExpired(); else setNotice(err.message); };
  async function load() { try { setLoadError(''); setEvents(await loadMonth(month)); } catch (err) { if (err.status === 401) onSessionExpired(); else setLoadError(err.message); } finally { setLoading(false); } }
  useEffect(() => { setLoading(true); load(); }, [month]);
  async function refresh() {
    setBusy(true); setNotice('Consultando as fontes. Isso pode levar alguns segundos.');
    try { const { events: found, status } = await collectOpenSources(); await saveCollected(found); await load(); setNotice(status.map(s => `${s.source}: ${s.count} eventos${s.message !== 'Dados encontrados' ? ` (${s.message})` : ''}`).join(' · ')); }
    catch (err) { handle(err); } finally { setBusy(false); }
  }
  async function run(id, action, message) { setSaving(id); try { await action(); await load(); if (message) setToast(message); return ''; } catch (err) { if (err.status === 401) { onSessionExpired(); return ''; } setNotice(err.message); return err.message; } finally { setSaving(null); } }
  const addEvent = event => run(event.id, () => addToAgenda(event.id), 'Evento adicionado à agenda! O link de inscrição já está disponível.');
  const remove = event => { if (window.confirm(`Remover "${event.title}" da agenda? A lista de participantes deste evento será apagada.`)) run(event.id, () => removeFromAgenda(event.id), 'Evento removido da agenda.'); };
  const updateStatus = (person, status) => run(person.id, () => setParticipantStatus(person.id, status), 'Resposta atualizada.');
  async function savePeople(event, people) { const error = await run(event.id, () => saveParticipants(event.id, people, event.attendees), 'Pessoas atualizadas.'); if (!error) setSelectedEvent(null); return error; }
  async function create(data) {
    setSaving('new');
    try { await createEvent(data); const start = eventDate(data.start_date); setCreating(false); setPage('calendar'); setMonth(new Date(start.getFullYear(), start.getMonth(), 1)); await load(); setToast('Evento criado na agenda! Copie o link de inscrição no cartão.'); return ''; }
    catch (err) { if (err.status === 401) { onSessionExpired(); return ''; } return err.message; } finally { setSaving(null); }
  }
  async function copy(event) { try { await navigator.clipboard.writeText(publicLink(event.publicToken)); setToast('Link copiado.'); } catch { setNotice(`Copie o link: ${publicLink(event.publicToken)}`); } }
  async function logout() { await supabase.auth.signOut(); onLogout(); }
  const filtered = events.filter(event => (page === 'events' || event.saved) && (page !== 'events' || ((source === 'all' || event.source === source) && (mode === 'all' || (mode === 'online' ? event.mode === 'Online' : event.mode !== 'Online')) && event.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))));
  const card = event => <EventCard key={event.id} event={event} onSave={addEvent} onPeople={setSelectedEvent} onRemove={remove} onStatus={updateStatus} onCopy={copy} saving={saving === event.id || event.attendees.some(p => p.id === saving)} />;
  return <div className="shell"><aside className="sidebar"><Brand /><div><div className="nav-label">MENU PRINCIPAL</div><nav className="nav" aria-label="Navegação principal"><button className={page === 'events' ? 'active' : ''} onClick={() => { setPage('events'); setNotice(''); }}><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16v12H4zM4 10h16M8 4v5M16 4v5M8 14h3m-3 3h5"/></svg></span> Eventos</button><button className={page === 'calendar' ? 'active' : ''} onClick={() => { setPage('calendar'); setNotice(''); }}><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3v5M16.5 3v5M3.5 10h17M8 14h2m4 0h2m-8 3h2m4 0h2"/></svg></span> Agenda da casa</button></nav></div><div className="side-bottom">Conectado como<br />{member.name}<button className="logout" onClick={logout}>Sair →</button></div></aside>
    <main className="main"><header className="header"><div><div className="tagline">{page === 'events' ? 'Explore e descubra' : 'Nossos compromissos'}</div><h1>{page === 'events' ? 'Eventos para vocês' : 'Agenda da casa'}</h1><p>{page === 'events' ? 'Encontre o próximo evento de tecnologia.' : 'Os eventos que a casa vai, com quem confirmou presença.'}</p></div><div className="header-actions"><button className="secondary" onClick={() => setCreating(true)}>+ Novo evento</button>{page === 'events' && <button className="primary" onClick={refresh} disabled={busy}>{busy ? 'Atualizando…' : '↻ Atualizar eventos'}</button>}</div></header>
      <div className="toolbar">{page === 'events' && <><label className="sr" htmlFor="search">Buscar eventos</label><input id="search" className="control" placeholder="⌕  Buscar por assunto ou evento" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="secondary" onClick={() => setSearch('')} aria-label="Limpar busca">×</button>}<label className="sr" htmlFor="source">Plataforma</label><select id="source" className="control" value={source} onChange={e => setSource(e.target.value)}><option value="all">Todas as plataformas</option>{[...new Set(events.map(event => event.source))].sort().map(s => <option key={s}>{s}</option>)}</select><label className="sr" htmlFor="mode">Modalidade</label><select id="mode" className="control" value={mode} onChange={e => setMode(e.target.value)}><option value="all">Todas as modalidades</option><option value="online">Online</option><option value="other">Outras / não informado</option></select></>}<div className="monthnav"><button className="secondary" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong><button className="secondary" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div></div>
      {notice && <div className="notice" role="status">{notice}</div>}
      {loading ? <div className="empty" role="status">Carregando eventos…</div> : loadError ? <div className="empty" role="alert"><strong>Não foi possível carregar os eventos.</strong>{loadError}<br /><button className="secondary" onClick={() => { setLoading(true); load(); }}>Tentar novamente</button></div> : page === 'calendar' ? <Calendar month={month} events={filtered} eventDate={eventDate} renderEvent={card} /> : <><div className="result">{filtered.length} {filtered.length === 1 ? 'evento encontrado' : 'eventos encontrados'}</div><section className="event-list" aria-label="Lista de eventos">{filtered.length ? filtered.map(card) : <div className="empty"><strong>Nenhum evento encontrado</strong>Atualize as fontes, crie um evento ou experimente outro mês ou filtro.</div>}</section></>}
    </main>
    {selectedEvent && <AttendeesDialog event={selectedEvent} saving={saving === selectedEvent.id} onClose={() => setSelectedEvent(null)} onConfirm={savePeople} />}
    {creating && <EventFormDialog saving={saving === 'new'} onClose={() => setCreating(false)} onCreate={create} />}
    {toast && <div className="toast-success" role="status"><span aria-hidden="true">✓</span><span>{toast}</span><button type="button" aria-label="Fechar aviso" onClick={() => setToast('')}>×</button></div>}
  </div>;
}

function App() {
  const [state, setState] = useState({ loading: true, member: null, error: '' });
  useEffect(() => {
    async function check(session, error = '') {
      if (!session) return setState({ loading: false, member: null, error });
      try {
        const member = await currentMember(session.user.id);
        if (member) return setState({ loading: false, member, error: '' });
        await supabase.auth.signOut();
        setState({ loading: false, member: null, error: 'Esta conta ainda não tem acesso à agenda.' });
      } catch { setState({ loading: false, member: null, error: 'Não foi possível conectar ao Supabase.' }); }
    }
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') setTimeout(() => check(session), 0);
      if (event === 'SIGNED_OUT') setState(current => ({ ...current, loading: false, member: null }));
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (state.loading) return <main className="loading">Carregando a agenda…</main>;
  if (!state.member) return <Login initialError={state.error} />;
  return <Agenda member={state.member} onLogout={() => setState({ loading: false, member: null, error: '' })} onSessionExpired={() => { supabase.auth.signOut(); setState({ loading: false, member: null, error: 'Sua sessão terminou. Entre novamente.' }); }} />;
}

function Root() {
  if (!configured) return <main className="loading">Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY e gere o build novamente.</main>;
  const match = window.location.pathname.match(/^\/e\/([^/]+)\/?$/);
  if (match) return <PublicEvent token={decodeURIComponent(match[1])} />;
  return <App />;
}

createRoot(document.getElementById('root')).render(<Root />);
