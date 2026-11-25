import { useEffect, useRef, useState } from 'react';

const empty = { title: '', start_date: '', end_date: '', mode: 'Presencial', location: '', url: '', description: '' };

export default function EventFormDialog({ saving, onClose, onCreate }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  const set = field => e => setForm(current => ({ ...current, [field]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    const data = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    if (!data.title) return setError('Informe o nome do evento.');
    if (!data.start_date) return setError('Informe a data de início.');
    if (data.end_date && data.end_date < data.start_date) return setError('A data de término deve ser igual ou posterior ao início.');
    if (data.url && !/^https?:\/\//i.test(data.url)) return setError('O link deve começar com https://');
    setError('');
    const result = await onCreate(data);
    if (result) setError(result);
  }
  return <dialog ref={dialog} className="attendees-dialog" aria-labelledby="event-form-title" onCancel={e => { e.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={submit} noValidate>
      <div className="dialog-heading"><div><div className="tagline">Agenda da casa</div><h2 id="event-form-title">Novo evento</h2></div><button type="button" className="dialog-close" aria-label="Fechar" onClick={onClose} disabled={saving}>×</button></div>
      <p className="dialog-description">O evento entra direto na agenda e ganha um link público para quem quiser se inscrever.</p>
      <div className="attendee-list">
        <label className="field">Nome do evento<input className="control" value={form.title} onChange={set('title')} maxLength={300} autoFocus /></label>
        <div className="form-row">
          <label className="field">Início<input className="control" type="date" value={form.start_date} onChange={set('start_date')} /></label>
          <label className="field">Término (opcional)<input className="control" type="date" value={form.end_date} min={form.start_date || undefined} onChange={set('end_date')} /></label>
        </div>
        <div className="form-row">
          <label className="field">Modalidade<select className="control" value={form.mode} onChange={set('mode')}><option>Presencial</option><option>Online</option><option>Híbrido</option></select></label>
          <label className="field">Local (opcional)<input className="control" value={form.location} onChange={set('location')} maxLength={200} placeholder="Cidade, endereço…" /></label>
        </div>
        <label className="field">Site do evento (opcional)<input className="control" type="url" value={form.url} onChange={set('url')} placeholder="https://" /></label>
        <label className="field">Descrição (opcional)<textarea className="control" rows={3} value={form.description} onChange={set('description')} maxLength={2000} /></label>
      </div>
      <div className="dialog-error" role="alert">{error}</div>
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Criando…' : 'Criar evento'}</button></div>
    </form>
  </dialog>;
}
