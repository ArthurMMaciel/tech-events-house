import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowRight, CalendarHeart, ChevronLeft, ChevronRight, CircleCheck, Compass, Earth, Eye, EyeOff, Lock, LogOut, Mail, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import './style.css';
import AttendeesDialog from './AttendeesDialog.jsx';
import EventFormDialog from './EventFormDialog.jsx';
import PublicEvent from './PublicEvent.jsx';
import Calendar from './Calendar.jsx';
import EventCard, { eventDate } from './EventCard.jsx';
import Explore from './Explore.jsx';
import Brand, { Backdrop } from './Brand.jsx';
import { supabase, configured } from './supabase.js';
import { addToAgenda, createEvent, currentMember, loadAgendaMonth, loadUpcoming, publicLink, removeFromAgenda, saveCollected, saveParticipants, setEventPrice, setParticipantStatus } from './data.js';
import { collectOpenSources } from './sources.js';
import { isBrazil } from './geo.js';


function Login({ initialError = '' }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(initialError), [busy, setBusy] = useState(false), [showPassword, setShowPassword] = useState(false);
  useEffect(() => setError(initialError), [initialError]);
  async function submit(e) {
    e.preventDefault(); setError('');
    if (!email.trim() || !password) { setError('Informe seu e-mail e sua senha.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.status === 400 ? 'E-mail ou senha incorretos.' : error.status === 429 ? 'Muitas tentativas. Tente novamente mais tarde.' : 'Não foi possível entrar. Tente novamente.'); setPassword(''); }
  }
  return <div className="login"><Backdrop />
    <motion.aside className="login-art" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .6 }}>
      <Brand />
      <div><div className="eyebrow">Agenda compartilhada</div><h1>Boas ideias começam em <span className="gradient-text">bons encontros.</span></h1><p>Eventos de tecnologia do Brasil e do mundo, numa agenda só da casa.</p>
        <ul className="login-points"><li><Compass size={16} />Descubra eventos por país, estado e cidade</li><li><CalendarHeart size={16} />Monte a agenda junto com o sócio</li><li><Mail size={16} />Convide pessoas com um link de inscrição</li></ul></div>
      <div className="eyebrow muted">DFL events · {new Date().getFullYear()}</div>
    </motion.aside>
    <main className="login-main"><motion.div className="login-box card-surface" initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .5, delay: .1 }}>
      <div className="eyebrow">Bem-vindo de volta</div><h2>Entre na sua conta</h2><p className="sub">Seus eventos estão esperando por você.</p>
      <form onSubmit={submit} noValidate>
        <label className="field">E-mail<span className="input-icon"><Mail size={17} /><input className="control" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></span></label>
        <label className="field">Senha<span className="input-icon"><Lock size={17} /><input className="control" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /><button type="button" className="icon-btn small" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
        <div className="error" role="alert">{error}</div>
        <button className="btn btn-primary wide" disabled={busy}>{busy ? <RefreshCw size={17} className="spin" /> : null}{busy ? 'Entrando…' : <>Entrar <ArrowRight size={17} /></>}</button>
      </form>
    </motion.div></main>
  </div>;
}

function useCountUp(value) {
  const [shown, setShown] = useState(value), from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value; let raf;
    const tick = now => { const t = Math.min(1, (now - start) / 700), k = 1 - Math.pow(1 - t, 3); setShown(Math.round(a + (b - a) * k)); if (t < 1) raf = requestAnimationFrame(tick); else from.current = b; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

function Stat({ icon, label, value, tone, delay }) {
  const n = useCountUp(value);
  return <motion.div className={`stat tone-${tone}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: .4 }}>
    <span className="stat-icon">{icon}</span><div><strong>{n}</strong><span>{label}</span></div>
  </motion.div>;
}

function Skeleton() { return <div className="event-list">{[0, 1, 2, 3].map(i => <div key={i} className="event skeleton"><div className="sk sk-tile" /><div className="sk-lines"><div className="sk sk-line w40" /><div className="sk sk-line w70" /><div className="sk sk-line w55" /></div></div>)}</div>; }

function Agenda({ member, onLogout, onSessionExpired }) {
  const [page, setPage] = useState(() => { try { return localStorage.getItem('dfl-page') || 'events'; } catch { return 'events'; } });
  const [upcoming, setUpcoming] = useState([]), [agendaMonth, setAgendaMonth] = useState([]);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [notice, setNotice] = useState(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [saving, setSaving] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null), [creating, setCreating] = useState(false), [toast, setToast] = useState('');
  useEffect(() => { try { localStorage.setItem('dfl-page', page); } catch {} }, [page]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  const expired = err => { if (err.status === 401) { onSessionExpired(); return true; } return false; };

  async function load() {
    try { setLoadError(''); const [u, m] = await Promise.all([loadUpcoming(), loadAgendaMonth(month)]); setUpcoming(u); setAgendaMonth(m); }
    catch (err) { if (!expired(err)) setLoadError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [month]);

  async function refresh() {
    setBusy(true); setNotice({ tone: 'info', text: 'Consultando as fontes. Isso leva alguns segundos…' });
    try { const { events: found, status } = await collectOpenSources(); await saveCollected(found); await load(); setNotice({ tone: 'ok', items: status }); }
    catch (err) { if (!expired(err)) setNotice({ tone: 'error', text: err.message }); } finally { setBusy(false); }
  }
  async function run(id, action, message) {
    setSaving(id);
    try { await action(); await load(); if (message) setToast(message); return ''; }
    catch (err) { if (expired(err)) return ''; setNotice({ tone: 'error', text: err.message }); return err.message; }
    finally { setSaving(null); }
  }
  const addEvent = event => run(event.id, () => addToAgenda(event.id), 'Evento na agenda! O link de inscrição já está disponível.');
  const remove = event => { if (window.confirm(`Remover "${event.title}" da agenda? A lista de participantes deste evento será apagada.`)) run(event.id, () => removeFromAgenda(event.id), 'Evento removido da agenda.'); };
  const updateStatus = (person, status) => run(person.id, () => setParticipantStatus(person.id, status), 'Resposta atualizada.');
  const updatePrice = (event, price) => run(event.id, () => setEventPrice(event.id, price), 'Preço atualizado.');
  async function savePeople(event, people) { const error = await run(event.id, () => saveParticipants(event.id, people, event.attendees), 'Pessoas atualizadas.'); if (!error) setSelectedEvent(null); return error; }
  async function create(data) {
    setSaving('new');
    try { await createEvent(data); const start = eventDate(data.start_date); setCreating(false); setPage('calendar'); setMonth(new Date(start.getFullYear(), start.getMonth(), 1)); await load(); setToast('Evento criado! Copie o link de inscrição no cartão.'); return ''; }
    catch (err) { if (expired(err)) return ''; return err.message; } finally { setSaving(null); }
  }
  async function copy(event) { try { await navigator.clipboard.writeText(publicLink(event.publicToken)); setToast('Link copiado.'); } catch { setNotice({ tone: 'info', text: `Copie o link: ${publicLink(event.publicToken)}` }); } }
  async function logout() { await supabase.auth.signOut(); onLogout(); }

  const card = (event, index) => <EventCard key={event.id} index={index} event={event} onSave={addEvent} onPeople={setSelectedEvent} onRemove={remove} onStatus={updateStatus} onCopy={copy} onPrice={updatePrice} saving={saving === event.id || event.attendees.some(p => p.id === saving)} />;
  const houseNext = useMemo(() => upcoming.filter(e => e.saved), [upcoming]);
  const stats = useMemo(() => ({ total: upcoming.length, br: upcoming.filter(isBrazil).length, intl: upcoming.filter(e => !isBrazil(e)).length, house: houseNext.length }), [upcoming, houseNext]);
  const initials = member.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const nav = [['events', 'Explorar', Compass, stats.total], ['calendar', 'Agenda da casa', CalendarHeart, stats.house]];
  return <div className="shell"><Backdrop />
    <aside className="sidebar">
      <Brand />
      <nav className="nav" aria-label="Navegação principal">
        <div className="nav-label">Menu</div>
        {nav.map(([key, label, Icon, n]) => <button key={key} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined} onClick={() => { setPage(key); setNotice(null); }}>
          {page === key && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <Icon size={19} /><span>{label}</span><em>{n}</em>
        </button>)}
      </nav>
      <div className="user-card"><span className="avatar lg">{initials}</span><div><small>Conectado como</small><strong>{member.name}</strong></div><button className="icon-btn" onClick={logout} aria-label="Sair" title="Sair"><LogOut size={17} /></button></div>
    </aside>

    <main className="main">
      <header className="header">
        <motion.div key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow">{page === 'events' ? 'Explore e descubra' : 'Nossos compromissos'}</div>
          <h1>{page === 'events' ? <>Eventos <span className="gradient-text">para vocês</span></> : <>Agenda <span className="gradient-text">da casa</span></>}</h1>
          <p>{page === 'events' ? 'Só o que ainda vai acontecer, do Brasil e do mundo.' : 'Os eventos que a casa vai, com quem confirmou presença.'}</p>
        </motion.div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setCreating(true)}><Plus size={17} />Novo evento</button>
          {page === 'events' && <button className="btn btn-primary" onClick={refresh} disabled={busy}><RefreshCw size={17} className={busy ? 'spin' : ''} />{busy ? 'Atualizando…' : 'Atualizar eventos'}</button>}
        </div>
      </header>

      {page === 'events' && <div className="stats">
        <Stat icon={<Sparkles size={18} />} label="próximos eventos" value={stats.total} tone="amber" delay={0} />
        <Stat icon={<span className="flag-br" />} label="no Brasil" value={stats.br} tone="green" delay={.05} />
        <Stat icon={<Earth size={18} />} label="fora do país" value={stats.intl} tone="blue" delay={.1} />
        <Stat icon={<CalendarHeart size={18} />} label="na agenda da casa" value={stats.house} tone="rose" delay={.15} />
      </div>}

      <AnimatePresence>{notice && <motion.div className={`notice notice-${notice.tone}`} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        {notice.items ? <><CircleCheck size={18} /><span className="notice-items">{notice.items.map(s => <span key={s.source} className={s.ok ? '' : 'off'}><b>{s.count}</b> {s.source}{s.message !== 'Dados encontrados' && <small> · {s.message}</small>}</span>)}</span></> : <span>{notice.text}</span>}
        <button className="icon-btn small" onClick={() => setNotice(null)} aria-label="Fechar aviso"><X size={14} /></button>
      </motion.div>}</AnimatePresence>

      {loading ? <Skeleton />
        : loadError ? <div className="empty card-surface" role="alert"><strong>Não foi possível carregar os eventos.</strong><span>{loadError}</span><button className="btn btn-secondary" onClick={() => { setLoading(true); load(); }}>Tentar novamente</button></div>
        : page === 'events' ? <Explore events={upcoming} card={card} />
        : <>
          <div className="toolbar card-surface"><div className="monthnav">
            <button className="icon-btn" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
            <strong>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
            <button className="icon-btn" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
          </div><button className="btn btn-ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Hoje</button></div>
          <Calendar month={month} events={agendaMonth} eventDate={eventDate} renderEvent={card} />
          <section className="month-group"><h2 className="month-title"><span>Próximos da casa</span><em>{houseNext.length}</em></h2>
            {houseNext.length ? <div className="event-list">{houseNext.map(card)}</div> : <div className="empty card-surface"><CalendarHeart size={28} /><strong>Nenhum evento na agenda ainda</strong><span>Em Explorar, clique em <b>Vamos nesse</b> ou crie um evento.</span></div>}
          </section>
        </>}
    </main>
    {selectedEvent && <AttendeesDialog event={selectedEvent} saving={saving === selectedEvent.id} onClose={() => setSelectedEvent(null)} onConfirm={savePeople} />}
    {creating && <EventFormDialog saving={saving === 'new'} onClose={() => setCreating(false)} onCreate={create} />}
    <AnimatePresence>{toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 24, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .96 }}>
      <CircleCheck size={19} /><span>{toast}</span><button type="button" className="icon-btn small" aria-label="Fechar aviso" onClick={() => setToast('')}><X size={14} /></button>
    </motion.div>}</AnimatePresence>
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
  if (state.loading) return <main className="loading"><span className="logo pulse-logo"><Sparkles size={22} /></span>Carregando a agenda…</main>;
  if (!state.member) return <Login initialError={state.error} />;
  return <Agenda member={state.member} onLogout={() => setState({ loading: false, member: null, error: '' })} onSessionExpired={() => { supabase.auth.signOut(); setState({ loading: false, member: null, error: 'Sua sessão terminou. Entre novamente.' }); }} />;
}

function Root() {
  if (!configured) return <main className="loading">Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY e gere o build novamente.</main>;
  const match = window.location.pathname.match(/^\/e\/([^/]+)\/?$/);
  if (match) return <PublicEvent token={decodeURIComponent(match[1])} />;
  return <App />;
}

createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><Root /></MotionConfig>);
