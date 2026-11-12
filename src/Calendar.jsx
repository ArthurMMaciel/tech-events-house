import { useEffect, useState } from 'react';

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Calendar({ month, events, eventDate, renderEvent }) {
  const [selectedDay, setSelectedDay] = useState(null);
  useEffect(() => setSelectedDay(null), [month]);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const byDay = new Map();
  for (const event of events) {
    const day = eventDate(event.start)?.getDate();
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(event);
  }
  const today = new Date();
  const selectedEvents = byDay.get(selectedDay) || [];
  const selectedLabel = selectedDay && new Date(year, monthIndex, selectedDay).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return <section className="calendar-section" aria-label="Calendário mensal">
    <div className="calendar-intro"><span>{events.length === 1 ? '1 evento neste mês' : `${events.length} eventos neste mês`}</span><span>Selecione um dia para ver os detalhes</span></div>
    <div className="calendar-grid" role="group" aria-label={`Dias de ${month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}>
      {weekdays.map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
      {Array.from({ length: cells }, (_, index) => {
        const day = index - firstWeekday + 1;
        if (day < 1 || day > daysInMonth) return <div className="calendar-blank" key={`empty-${index}`} aria-hidden="true" />;
        const dayEvents = byDay.get(day) || [];
        const isToday = today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === day;
        const dateLabel = new Date(year, monthIndex, day).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return <button type="button" className={`calendar-day ${selectedDay === day ? 'selected' : ''} ${isToday ? 'today' : ''}`} key={day} aria-pressed={selectedDay === day} aria-label={`${dateLabel}, ${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}`} onClick={() => setSelectedDay(day)}>
          <span className="calendar-day-number">{day}</span>
          <span className="calendar-event-list" aria-hidden="true">{dayEvents.slice(0, 2).map(event => <span className="calendar-event" key={event.id}>{event.title}</span>)}{dayEvents.length > 2 && <span className="calendar-more">+{dayEvents.length - 2}</span>}</span>
          {dayEvents.length > 0 && <span className="calendar-dot" aria-hidden="true" />}
        </button>;
      })}
    </div>
    {selectedDay ? <div className="calendar-details"><div className="calendar-details-heading"><div><div className="tagline">Neste dia</div><h2>{selectedLabel}</h2></div><span>{selectedEvents.length === 1 ? '1 evento' : `${selectedEvents.length} eventos`}</span></div><div className="event-list">{selectedEvents.length ? selectedEvents.map(renderEvent) : <div className="empty"><strong>Nenhum evento neste dia</strong>Selecione outro dia ou adicione eventos à sua agenda.</div>}</div></div> : <p className="calendar-help">Os eventos aparecem no dia de início. Selecione uma data para ver as pessoas e acessar o evento.</p>}
  </section>;
}
