import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, CircleCheck, ExternalLink, MapPin, MonitorPlay, RefreshCw } from 'lucide-react';
import Brand, { Backdrop } from './Brand.jsx';
import { getPublicEvent, registerForEvent } from './data.js';
import { UF, countryName } from './geo.js';

const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function PublicEvent({ token }) {
  const [state, setState] = useState({ loading: true, event: null, error: '' });
  const [name, setName] = useState(''), [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  useEffect(() => {
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    if (!valid) { setState({ loading: false, event: null, error: '' }); return; }
    getPublicEvent(token).then(event => setState({ loading: false, event, error: '' })).catch(err => setState({ loading: false, event: null, error: err.message }));
  }, [token]);
  async function respond(response) {
    setError('');
    if (!name.trim()) return setError('Informe seu nome.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Informe um e-mail válido.');
    setBusy(true);
    try { await registerForEvent(token, name.trim(), email.trim(), response); setDone(response); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const { event } = state;
  const where = event && ([event.city, event.state && (UF[event.state] || event.state), event.country_code && event.country_code !== 'BR' ? countryName(event.country_code) : null, event.location].filter(Boolean).join(', ') || event.mode || 'Local não informado');
  return <div className="public-page"><Backdrop />
    <motion.main className="public-card card-surface" initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .5 }}>
      <Brand />
      {state.loading ? <p role="status" className="sub"><RefreshCw size={16} className="spin" /> Carregando evento…</p>
        : state.error ? <p role="alert" className="error">{state.error}</p>
        : !event ? <><h1>Evento não encontrado</h1><p className="sub">Este link não existe ou o evento saiu da agenda.</p></>
        : <>
          <div className="eyebrow">Você foi convidado(a)</div>
          <h1>{event.title}</h1>
          <ul className="public-meta">
            <li><CalendarDays size={17} />{formatDate(event.start_date)}{event.end_date && event.end_date !== event.start_date ? ` até ${formatDate(event.end_date)}` : ''}</li>
            <li>{event.mode === 'Online' ? <MonitorPlay size={17} /> : <MapPin size={17} />}{where}</li>
          </ul>
          {event.description && <p className="sub public-description">{event.description}</p>}
          {event.url && <a className="chip-link" href={event.url} target="_blank" rel="noopener noreferrer">Site oficial do evento <ExternalLink size={14} /></a>}
          {done ? <motion.div className="notice notice-ok" role="status" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}><CircleCheck size={20} /><span>{done === 'confirmed' ? 'Presença confirmada! Até lá.' : 'Resposta registrada. Obrigado por avisar.'}{done === 'confirmed' && event.url && ' Não esqueça de fazer a inscrição oficial no site do evento.'}</span></motion.div>
            : <form onSubmit={e => { e.preventDefault(); respond('confirmed'); }} noValidate>
              <label className="field">Seu nome<input className="control" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={150} /></label>
              <label className="field">Seu e-mail<input className="control" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} /></label>
              <div className="error" role="alert">{error}</div>
              <div className="public-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Enviando…' : 'Confirmar presença'}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => respond('declined')}>Não poderei ir</button></div>
            </form>}
        </>}
    </motion.main>
  </div>;
}
