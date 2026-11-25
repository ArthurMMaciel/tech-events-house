import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import { UF, countryName } from './geo.js';

const empty = { title: '', start_date: '', end_date: '', mode: 'Presencial', country_code: 'BR', state: '', city: '', price: '', url: '', description: '' };

function allCountries() {
  const list = [];
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    try { const n = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }).of(code); if (n && !/unknown/i.test(n)) list.push([code, countryName(code)]); } catch {}
  }
  return list.sort((x, y) => x[1].localeCompare(y[1], 'pt-BR'));
}

export default function EventFormDialog({ saving, onClose, onCreate }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const countries = useMemo(allCountries, []);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  const set = field => e => setForm(current => ({ ...current, [field]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    const data = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    if (!data.title) return setError('Informe o nome do evento.');
    if (!data.start_date) return setError('Informe a data de início.');
    if (data.end_date && data.end_date < data.start_date) return setError('A data de término deve ser igual ou posterior ao início.');
    if (data.url && !/^https?:\/\//i.test(data.url)) return setError('O link deve começar com https://');
    if (data.country_code !== 'BR') data.state = null;
    setError('');
    const result = await onCreate({ ...data, is_online: data.mode === 'Online' });
    if (result) setError(result);
  }
  return <dialog ref={dialog} className="dialog" aria-labelledby="event-form-title" onCancel={e => { e.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={submit} noValidate>
      <div className="dialog-heading"><div className="dialog-icon"><CalendarPlus size={20} /></div><div><div className="eyebrow">Agenda da casa</div><h2 id="event-form-title">Novo evento</h2></div><button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={18} /></button></div>
      <p className="dialog-description">O evento entra direto na agenda e ganha um link público para quem quiser se inscrever.</p>
      <div className="form-grid">
        <label className="field span-2">Nome do evento<input className="control" value={form.title} onChange={set('title')} maxLength={300} autoFocus /></label>
        <label className="field">Início<input className="control" type="date" value={form.start_date} onChange={set('start_date')} /></label>
        <label className="field">Término (opcional)<input className="control" type="date" value={form.end_date} min={form.start_date || undefined} onChange={set('end_date')} /></label>
        <label className="field">Modalidade<select className="control" value={form.mode} onChange={set('mode')}><option>Presencial</option><option>Online</option><option>Híbrido</option></select></label>
        <label className="field">Preço<select className="control" value={form.price} onChange={set('price')}><option value="">Não informado</option><option value="free">Gratuito</option><option value="paid">Pago</option></select></label>
        <label className="field">País<select className="control" value={form.country_code} onChange={set('country_code')}>{countries.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
        {form.country_code === 'BR'
          ? <label className="field">Estado<select className="control" value={form.state} onChange={set('state')}><option value="">—</option>{Object.entries(UF).map(([uf, n]) => <option key={uf} value={uf}>{uf} · {n}</option>)}</select></label>
          : <span className="field-spacer" />}
        <label className="field span-2">Cidade (opcional)<input className="control" value={form.city} onChange={set('city')} maxLength={120} /></label>
        <label className="field span-2">Site do evento (opcional)<input className="control" type="url" value={form.url} onChange={set('url')} placeholder="https://" /></label>
        <label className="field span-2">Descrição (opcional)<textarea className="control" rows={3} value={form.description} onChange={set('description')} maxLength={2000} /></label>
      </div>
      <div className="dialog-error" role="alert">{error}</div>
      <div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Criando…' : 'Criar evento'}</button></div>
    </form>
  </dialog>;
}
