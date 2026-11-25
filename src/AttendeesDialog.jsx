import { useEffect, useRef, useState } from 'react';
import { UserPlus, Users, X } from 'lucide-react';

export default function AttendeesDialog({ event, saving, onClose, onConfirm }) {
  const dialog = useRef(null);
  const [people, setPeople] = useState(() => event.attendees?.length ? event.attendees.map(person => ({ ...person })) : [{ name: '', email: '' }]);
  const [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  function change(index, field, value) { setPeople(current => current.map((person, i) => i === index ? { ...person, [field]: value } : person)); }
  async function submit(e) {
    e.preventDefault();
    const normalized = people.map(person => ({ ...person, name: person.name.trim(), email: person.email.trim().toLowerCase() })).filter(p => p.name || p.email || p.id);
    const invalid = normalized.findIndex(person => !person.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(person.email));
    if (invalid !== -1) { setError(`Informe nome e e-mail válidos para a pessoa ${invalid + 1}.`); dialog.current.querySelector(`[data-person="${invalid}"]`)?.focus(); return; }
    if (new Set(normalized.map(p => p.email)).size !== normalized.length) { setError('Há e-mails repetidos na lista.'); return; }
    setError('');
    const result = await onConfirm(event, normalized);
    if (result) setError(result);
  }
  return <dialog ref={dialog} className="dialog" aria-labelledby="attendees-title" aria-describedby="attendees-description" onCancel={e => { e.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={submit} noValidate>
      <div className="dialog-heading"><div className="dialog-icon"><Users size={20} /></div><div><div className="eyebrow">Agenda da casa</div><h2 id="attendees-title">Quem vai participar?</h2></div><button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={18} /></button></div>
      <p id="attendees-description" className="dialog-description">Pessoas para <strong>{event.title}</strong>. Depois de salvar, use <strong>Convidar</strong> no cartão: o seu e-mail abre com o link de confirmação. Quem se inscrever pelo link aparece aqui também.</p>
      <div className="attendee-list">{people.map((person, index) => <fieldset className="attendee" key={person.id || `new-${index}`}>
        <legend>Pessoa {index + 1}</legend>
        <label className="field">Nome<input data-person={index} className="control" value={person.name} onChange={e => change(index, 'name', e.target.value)} autoComplete="off" maxLength={150} /></label>
        <label className="field">E-mail<input className="control" type="email" value={person.email} onChange={e => change(index, 'email', e.target.value)} autoComplete="off" maxLength={254} /></label>
        <button type="button" className="icon-btn danger" aria-label={`Remover pessoa ${index + 1}`} onClick={() => setPeople(current => current.filter((_, i) => i !== index))}><X size={16} /></button>
      </fieldset>)}</div>
      <button type="button" className="btn btn-ghost add-person" onClick={() => setPeople(current => [...current, { name: '', email: '' }])} disabled={people.length >= 100 || saving}><UserPlus size={16} />Adicionar pessoa</button>
      <div className="dialog-error" role="alert">{error}</div>
      <div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar pessoas'}</button></div>
    </form>
  </dialog>;
}
