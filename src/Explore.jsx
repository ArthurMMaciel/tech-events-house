import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Blend, Building2, Earth, Gift, Layers, MapPinned, MonitorPlay, Search, SlidersHorizontal, Tag, Ticket, X } from 'lucide-react';
import EventCard from './EventCard.jsx';
import { UF, countryName, isBrazil, topicLabel } from './geo.js';

const PAGE = 30;
const DEFAULTS = { scope: 'all', region: '', city: '', modes: [], price: 'all', period: 'all', topic: '', source: '', search: '' };

function useStoredState(key, initial) {
  const [value, setValue] = useState(() => { try { return { ...initial, ...JSON.parse(localStorage.getItem(key) || '{}'), search: '' }; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}

const plus = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toLocaleDateString('sv-SE'); };
const monthKey = e => e.start.slice(0, 7);
const monthTitle = key => new Date(`${key}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const count = (list, fn) => list.reduce((map, e) => { const k = fn(e); if (k) map.set(k, (map.get(k) || 0) + 1); return map; }, new Map());
const sorted = map => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));

function Segmented({ value, onChange, options, id }) {
  return <div className="segmented" role="radiogroup">
    {options.map(o => <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
      {value === o.value && <motion.span layoutId={`seg-${id}`} className="segmented-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
      <span className="segmented-label">{o.icon}{o.label}{o.count !== undefined && <em>{o.count}</em>}</span>
    </button>)}
  </div>;
}

export default function Explore({ events, card }) {
  const [f, setF] = useStoredState('dfl-filters', DEFAULTS);
  const [visible, setVisible] = useState(PAGE);
  const [showMore, setShowMore] = useState(false);
  const sentinel = useRef(null);
  const set = patch => { setF(cur => ({ ...cur, ...patch })); setVisible(PAGE); };

  const scoped = useMemo(() => events.filter(e => f.scope === 'all' || (f.scope === 'br' ? isBrazil(e) : !isBrazil(e))), [events, f.scope]);
  const regions = useMemo(() => sorted(count(scoped, e => f.scope === 'br' ? e.state : f.scope === 'intl' ? e.countryCode : null)), [scoped, f.scope]);
  const inRegion = useMemo(() => scoped.filter(e => !f.region || (f.scope === 'br' ? e.state : e.countryCode) === f.region), [scoped, f.region, f.scope]);
  const cities = useMemo(() => sorted(count(inRegion, e => e.city)), [inRegion]);
  const topics = useMemo(() => sorted(count(events.flatMap(e => e.topics.map(t => ({ t }))), x => x.t)), [events]);
  const sources = useMemo(() => sorted(count(events, e => e.source)), [events]);
  const months = useMemo(() => [...new Set(events.map(monthKey))].sort(), [events]);

  const filtered = useMemo(() => {
    const q = f.search.trim().toLocaleLowerCase('pt-BR');
    const limit = f.period === '7' ? plus(7) : f.period === '30' ? plus(30) : null;
    return inRegion.filter(e =>
      (!f.city || e.city === f.city) &&
      (!f.modes.length || f.modes.includes(e.mode)) &&
      (f.price === 'all' || (f.price === 'unknown' ? !e.price : e.price === f.price)) &&
      (f.period === 'all' || (limit ? e.start <= limit : monthKey(e) === f.period)) &&
      (!f.topic || e.topics.includes(f.topic)) &&
      (!f.source || e.source === f.source) &&
      (!q || `${e.title} ${e.city || ''} ${e.state || ''} ${countryName(e.countryCode)}`.toLocaleLowerCase('pt-BR').includes(q)));
  }, [inRegion, f]);

  const groups = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE'), map = new Map(), totals = new Map();
    const keyOf = e => e.start <= today ? 'now' : monthKey(e);
    for (const e of filtered) totals.set(keyOf(e), (totals.get(keyOf(e)) || 0) + 1);
    for (const e of filtered.slice(0, visible)) { const k = keyOf(e); if (!map.has(k)) map.set(k, []); map.get(k).push(e); }
    return [...map.entries()].map(([k, list]) => [k, list, totals.get(k)]);
  }, [filtered, visible]);

  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(v => v + PAGE); }, { rootMargin: '600px' });
    io.observe(el); return () => io.disconnect();
  }, [filtered.length, visible]);

  const active = ['region', 'city', 'topic', 'source', 'search'].filter(k => f[k]).length + (f.modes.length ? 1 : 0) + (f.price !== 'all') + (f.period !== 'all');
  const br = events.filter(isBrazil).length;
  const toggleMode = m => set({ modes: f.modes.includes(m) ? f.modes.filter(x => x !== m) : [...f.modes, m] });

  return <>
    <div className="filters card-surface">
      <div className="filters-top">
        <Segmented id="scope" value={f.scope} onChange={scope => set({ scope, region: '', city: '' })} options={[
          { value: 'all', label: 'Todos', count: events.length },
          { value: 'br', label: 'Brasil', icon: <span className="flag-br" aria-hidden="true" />, count: br },
          { value: 'intl', label: 'Fora do país', icon: <Earth size={15} />, count: events.length - br },
        ]} />
        <div className="search">
          <Search size={17} aria-hidden="true" />
          <label className="sr" htmlFor="search">Buscar eventos</label>
          <input id="search" placeholder="Buscar por evento, cidade ou país" value={f.search} onChange={e => set({ search: e.target.value })} />
          {f.search && <button className="icon-btn small" onClick={() => set({ search: '' })} aria-label="Limpar busca"><X size={14} /></button>}
        </div>
        <button className={`btn btn-ghost filters-toggle ${showMore ? 'on' : ''}`} onClick={() => setShowMore(!showMore)} aria-expanded={showMore}><SlidersHorizontal size={16} />Filtros{active > 0 && <em className="dot-count">{active}</em>}</button>
      </div>

      <AnimatePresence initial={false}>
        {f.scope !== 'all' && <motion.div key="region" className="region-row" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <MapPinned size={16} className="row-icon" aria-hidden="true" />
          <div className="chips" role="group" aria-label={f.scope === 'br' ? 'Estados' : 'Países'}>
            <button className={`chip ${!f.region ? 'active' : ''}`} onClick={() => set({ region: '', city: '' })}>{f.scope === 'br' ? 'Todos os estados' : 'Todos os países'}</button>
            {regions.map(([code, n]) => <button key={code} className={`chip ${f.region === code ? 'active' : ''}`} title={f.scope === 'br' ? UF[code] : undefined} onClick={() => set({ region: f.region === code ? '' : code, city: '' })}>{f.scope === 'br' ? code : countryName(code)}<em>{n}</em></button>)}
          </div>
          {cities.length > 0 && <select className="control compact" value={f.city} onChange={e => set({ city: e.target.value })} aria-label="Cidade">
            <option value="">Todas as cidades</option>
            {cities.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
          </select>}
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showMore && <motion.div key="more" className="more-filters" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <div className="filter-group"><span className="filter-label">Modalidade</span><div className="chips">
            {[['Presencial', Building2], ['Online', MonitorPlay], ['Híbrido', Blend]].map(([m, Icon]) => <button key={m} className={`chip ${f.modes.includes(m) ? 'active' : ''}`} aria-pressed={f.modes.includes(m)} onClick={() => toggleMode(m)}><Icon size={14} />{m}</button>)}
          </div></div>
          <div className="filter-group"><span className="filter-label">Preço</span><div className="chips">
            {[['all', 'Todos'], ['free', 'Gratuito', Gift], ['paid', 'Pago', Ticket], ['unknown', 'Não informado']].map(([v, l, Icon]) => <button key={v} className={`chip ${f.price === v ? 'active' : ''}`} onClick={() => set({ price: v })}>{Icon && <Icon size={14} />}{l}</button>)}
          </div></div>
          <div className="filter-group"><span className="filter-label">Quando</span>
            <select className="control compact" value={f.period} onChange={e => set({ period: e.target.value })}>
              <option value="all">Qualquer data</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option>
              {months.map(m => <option key={m} value={m}>{monthTitle(m)}</option>)}
            </select></div>
          <div className="filter-group"><span className="filter-label"><Tag size={13} />Tema</span>
            <select className="control compact" value={f.topic} onChange={e => set({ topic: e.target.value })}>
              <option value="">Todos os temas</option>{topics.map(([t, n]) => <option key={t} value={t}>{topicLabel(t)} ({n})</option>)}
            </select></div>
          <div className="filter-group"><span className="filter-label"><Layers size={13} />Fonte</span>
            <select className="control compact" value={f.source} onChange={e => set({ source: e.target.value })}>
              <option value="">Todas as fontes</option>{sources.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
            </select></div>
          {active > 0 && <button className="btn btn-ghost clear" onClick={() => { setF(DEFAULTS); setVisible(PAGE); }}><X size={15} />Limpar filtros</button>}
        </motion.div>}
      </AnimatePresence>
    </div>

    <div className="result"><strong>{filtered.length}</strong> {filtered.length === 1 ? 'evento' : 'eventos'} {f.scope === 'br' ? 'no Brasil' : f.scope === 'intl' ? 'fora do país' : 'pela frente'}{f.region && ` · ${f.scope === 'br' ? UF[f.region] || f.region : countryName(f.region)}`}{f.city && ` · ${f.city}`}</div>

    {filtered.length === 0
      ? <div className="empty card-surface"><Search size={28} /><strong>Nenhum evento com esses filtros</strong><span>Tente outra região, limpe os filtros ou atualize as fontes.</span>{active > 0 && <button className="btn btn-secondary" onClick={() => { setF(DEFAULTS); setVisible(PAGE); }}>Limpar filtros</button>}</div>
      : groups.map(([key, list, total]) => <section key={key} className="month-group" aria-label={key === 'now' ? 'Acontecendo agora' : monthTitle(key)}>
          <h2 className="month-title"><span>{key === 'now' ? 'Acontecendo agora' : monthTitle(key)}</span><em>{total}</em></h2>
          <div className="event-list">{list.map((e, i) => card(e, i))}</div>
        </section>)}
    {visible < filtered.length && <div ref={sentinel} className="load-more"><button className="btn btn-secondary" onClick={() => setVisible(v => v + PAGE)}>Mostrar mais ({filtered.length - visible} restantes)</button></div>}
  </>;
}
