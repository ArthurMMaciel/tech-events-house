import { motion } from 'motion/react';
import { Blend, Building2, CalendarCheck, CalendarPlus, Copy, ExternalLink, Gift, Globe, Mail, MapPin, MonitorPlay, Ticket, Trash2, Users } from 'lucide-react';
import { inviteMailto, publicLink } from './data.js';
import { placeLabel, topicLabel } from './geo.js';

const modeIcon = { Online: MonitorPlay, Híbrido: Blend, Presencial: Building2 };
const statusLabel = { invited: 'Convidado', confirmed: 'Confirmou', declined: 'Não vai' };
const priceLabel = { free: 'Gratuito', paid: 'Pago', '': 'Preço ?' };

export function eventDate(value) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function dateRange(event) {
  const start = eventDate(event.start), end = event.end && event.end !== event.start ? eventDate(event.end) : null;
  if (!start) return 'Data não informada';
  const opts = { day: 'numeric', month: 'short' };
  return end ? `${start.toLocaleDateString('pt-BR', opts)} – ${end.toLocaleDateString('pt-BR', { ...opts, year: 'numeric' })}` : start.toLocaleDateString('pt-BR', { weekday: 'short', ...opts, year: 'numeric' });
}

export default function EventCard({ event, index = 0, onSave, onPeople, onRemove, onStatus, onCopy, onPrice, saving }) {
  const date = eventDate(event.start);
  const ModeIcon = modeIcon[event.mode] || MapPin;
  const invited = event.attendees.filter(p => p.status === 'invited').map(p => p.email);
  const confirmed = event.attendees.filter(p => p.status === 'confirmed').length;
  const today = new Date().toLocaleDateString('sv-SE');
  const live = event.start <= today && (event.end || event.start) >= today;
  return <motion.article
    className={`event ${event.saved ? 'is-saved' : ''}`}
    initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: .35, delay: Math.min(index, 10) * .035, ease: [.2, .7, .2, 1] }}
    whileHover={{ y: -3 }}>
    <div className="date-tile" aria-hidden="true">
      <span className="date-month">{date ? date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '—'}</span>
      <strong>{date ? date.toLocaleDateString('pt-BR', { day: '2-digit' }) : '—'}</strong>
      <span className="date-weekday">{date ? date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : ''}</span>
    </div>
    <div className="event-body">
      <div className="event-badges">
        {live && <span className="badge badge-live"><span className="pulse" />Acontecendo</span>}
        {event.saved && <span className="badge badge-saved"><CalendarCheck size={13} />Na agenda</span>}
        <span className="badge"><ModeIcon size={13} />{event.mode || 'Modalidade ?'}</span>
        <label className={`badge badge-price price-${event.price || 'unknown'}`} title="Marcar preço">
          {event.price === 'free' ? <Gift size={13} /> : <Ticket size={13} />}
          <span className="sr">Preço de {event.title}</span>
          <select value={event.price || ''} disabled={saving} onChange={e => onPrice(event, e.target.value)}>
            {Object.entries(priceLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <h3>{event.title}</h3>
      <div className="meta">
        <span><CalendarPlus size={14} />{dateRange(event)}</span>
        <span>{event.countryCode && event.countryCode !== 'BR' ? <Globe size={14} /> : <MapPin size={14} />}{placeLabel(event)}</span>
        <span className="meta-source">{event.source}</span>
      </div>
      {event.topics.length > 0 && <div className="topics">{event.topics.slice(0, 4).map(t => <span key={t}>#{topicLabel(t)}</span>)}</div>}

      {event.saved && <div className="event-share">
        <div className="share-head"><span>Link de inscrição</span><span className="share-count"><Users size={13} />{confirmed} {confirmed === 1 ? 'confirmado' : 'confirmados'}</span></div>
        <div className="share-row">
          <code>{publicLink(event.publicToken)}</code>
          <button className="icon-btn" onClick={() => onCopy(event)} aria-label="Copiar link de inscrição" title="Copiar link"><Copy size={15} /></button>
          {invited.length > 0 && <a className="chip-link" href={inviteMailto(event, invited)}><Mail size={14} />Convidar ({invited.length})</a>}
        </div>
      </div>}

      {event.saved && event.attendees.length > 0 && <ul className="people">
        {event.attendees.map(person => <li key={person.id}>
          <span className="avatar" aria-hidden="true">{person.name.trim()[0]?.toUpperCase()}</span>
          <span className="person-info"><strong>{person.name}</strong><small>{person.email} · {person.origin === 'public' ? 'pelo link' : 'pela casa'}</small></span>
          <select className={`status status-${person.status}`} value={person.status} disabled={saving} onChange={e => onStatus(person, e.target.value)} aria-label={`Resposta de ${person.name}`}>
            {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {person.status === 'invited' && <a className="icon-btn" href={inviteMailto(event, [person.email])} aria-label={`Enviar convite para ${person.name}`} title="Enviar convite"><Mail size={15} /></a>}
        </li>)}
      </ul>}
    </div>
    <div className="event-actions">
      {event.url && <a className="btn btn-ghost" href={event.url} target="_blank" rel="noopener noreferrer">Ver evento <ExternalLink size={15} /></a>}
      {event.saved
        ? <><button className="btn btn-secondary" disabled={saving} onClick={() => onPeople(event)}><Users size={16} />Pessoas</button><button className="icon-btn danger" disabled={saving} onClick={() => onRemove(event)} aria-label="Remover da agenda" title="Remover da agenda"><Trash2 size={16} /></button></>
        : <button className="btn btn-primary" disabled={saving} onClick={() => onSave(event)}><CalendarPlus size={16} />Vamos nesse</button>}
    </div>
  </motion.article>;
}
