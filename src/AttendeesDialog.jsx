import { useEffect, useRef, useState } from 'react';

export default function AttendeesDialog({ event, saving, onClose, onConfirm }) {
  const dialog = useRef(null);
  const [people, setPeople] = useState(() => event.attendees?.length ? event.attendees.map(person => ({ ...person })) : [{ name: '', email: '' }]);
  const [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  function change(index, field, value) { setPeople(current => current.map((person, i) => i === index ? { ...person, [field]: value } : person)); }
  async function submit(e) {
    e.preventDefault();
    const normalized = people.map(person => ({ name: person.name.trim(), email: person.email.trim() }));
    const invalid = normalized.findIndex(person => !person.name || !/^\S+@\S+\.\S+$/.test(person.email));
    if (invalid !== -1) { setError(`Informe nome e e-mail válidos para a pessoa ${invalid + 1}.`); dialog.current.querySelector(`[data-person="${invalid}"]`)?.focus(); return; }
    setError('');
    const result = await onConfirm(event, normalized);
    if (result) setError(result);
  }
  return <dialog ref={dialog} className="attendees-dialog" aria-labelledby="attendees-title" aria-describedby="attendees-description" onCancel={e => { e.preventDefault(); if (!saving) onClose(); }}><form onSubmit={submit} noValidate><div className="dialog-heading"><div><div className="tagline">Sua agenda</div><h2 id="attendees-title">Quem vai participar?</h2></div><button type="button" className="dialog-close" aria-label="Fechar" onClick={onClose} disabled={saving}>×</button></div><p id="attendees-description" className="dialog-description">Adicione as pessoas para <strong>{event.title}</strong>. O convite será enviado quando o Gmail estiver configurado. A inscrição deve ser feita no site do evento.</p><div className="attendee-list">{people.map((person, index) => <fieldset className="attendee" key={index}><legend>Pessoa {index + 1}</legend>{people.length > 1 && <button type="button" className="remove-person" onClick={() => setPeople(current => current.filter((_, i) => i !== index))}>Remover</button>}<label className="field">Nome<input data-person={index} className="control" value={person.name} onChange={e => change(index, 'name', e.target.value)} autoComplete="name" maxLength={150} /></label><label className="field">E-mail<input className="control" type="email" value={person.email} onChange={e => change(index, 'email', e.target.value)} autoComplete="email" maxLength={254} /></label></fieldset>)}</div><button type="button" className="add-person" onClick={() => setPeople(current => [...current, { name: '', email: '' }])} disabled={people.length >= 50 || saving}>+ Adicionar outra pessoa</button><div className="dialog-error" role="alert">{error}</div><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar pessoas'}</button></div></form></dialog>;
}
