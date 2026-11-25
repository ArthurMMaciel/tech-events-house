import { useEffect, useState } from 'react';
import { getPublicEvent, registerForEvent } from './data.js';

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
  return <div className="public-page"><main className="public-card">
    <div className="brand"><span className="logo">✳</span> DFL events</div>
    {state.loading ? <p role="status">Carregando evento…</p>
      : state.error ? <p role="alert">{state.error}</p>
      : !event ? <><h1>Evento não encontrado</h1><p className="sub">Este link não existe ou o evento saiu da agenda.</p></>
      : <>
        <div className="tagline">Você foi convidado(a)</div>
        <h1>{event.title}</h1>
        <div className="meta public-meta">
          <span>◷ {formatDate(event.start_date)}{event.end_date && event.end_date !== event.start_date ? ` até ${formatDate(event.end_date)}` : ''}</span>
          <span>◎ {[event.mode, event.location].filter(Boolean).join(' · ') || 'Não informado'}</span>
        </div>
        {event.description && <p className="sub public-description">{event.description}</p>}
        {event.url && <p><a href={event.url} target="_blank" rel="noopener noreferrer">Site oficial do evento ↗</a></p>}
        {done ? <div className="notice" role="status">{done === 'confirmed' ? 'Presença confirmada! Até lá.' : 'Resposta registrada. Obrigado por avisar.'}{done === 'confirmed' && event.url && <> Não esqueça de fazer a inscrição oficial no site do evento.</>}</div>
          : <form onSubmit={e => { e.preventDefault(); respond('confirmed'); }} noValidate>
            <label className="field">Seu nome<input className="control" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={150} /></label>
            <label className="field">Seu e-mail<input className="control" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} /></label>
            <div className="error" role="alert">{error}</div>
            <div className="public-actions"><button className="primary" disabled={busy}>{busy ? 'Enviando…' : 'Confirmar presença'}</button><button type="button" className="secondary" disabled={busy} onClick={() => respond('declined')}>Não poderei ir</button></div>
          </form>}
      </>}
  </main></div>;
}
