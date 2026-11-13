import React, { useEffect, useRef, useState } from 'react';
import { F, geom } from './engine.js';
import { Icon } from './Icons.jsx';
import { openProjectCalculation } from './ui-actions.js';

export function ProjectStatistics({ project, engine }) {
  const geometry = project.rooms.map(room => geom(room.v, room.holes));
  const included = project.rooms.filter(room => room.on).length;
  return <section className="d-surface d-object-statistics">
    <div className="d-section-heading"><h2>Статистика объекта</h2><button className="d-btn" onClick={() => openProjectCalculation(engine)}><Icon name="ruler" size={16}/>{project.rooms.length ? 'Открыть расчёт' : 'Добавить помещение'}</button></div>
    <dl><div><dt>Количество потолков</dt><dd>{project.rooms.length}</dd></div><div><dt>Общая площадь</dt><dd>{F(geometry.reduce((sum, value) => sum + value.a, 0))}<small> м²</small></dd></div><div><dt>Общий периметр</dt><dd>{F(geometry.reduce((sum, value) => sum + value.p, 0))}<small> м.п.</small></dd></div></dl>
    {included !== project.rooms.length && <p>В смете {included} из {project.rooms.length} потолков</p>}
  </section>;
}

export function RoomNavigation({ project, selectedId, onSelect, onAdd }) {
  const row = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = () => {
    const el = row.current;
    if (el) setEdges(previous => {
      const next = { start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 };
      return previous.start === next.start && previous.end === next.end ? previous : next;
    });
  };
  useEffect(() => {
    const el = row.current;
    const active = el.querySelector('[aria-pressed="true"]');
    if (active) {
      if (active.offsetLeft < el.scrollLeft) el.scrollLeft = active.offsetLeft;
      else if (active.offsetLeft + active.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = active.offsetLeft + active.offsetWidth - el.clientWidth;
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedId, project.rooms]);
  const scroll = direction => row.current?.scrollBy({ left: direction * row.current.clientWidth * .75, behavior: 'instant' });
  return <section className="d-surface d-room-navigation">
    <div className="d-section-heading"><h2>Помещения</h2><span>{project.rooms.length}</span><div className="d-room-navigation-actions"><button className="d-icon-btn" aria-label="Предыдущие помещения" disabled={edges.start} onClick={() => scroll(-1)}><Icon name="chevronLeft" size={16}/></button><button className="d-icon-btn" aria-label="Следующие помещения" disabled={edges.end} onClick={() => scroll(1)}><Icon name="chevronRight" size={16}/></button><button className="d-btn" onClick={onAdd}><Icon name="plus" size={16}/>Добавить помещение</button></div></div>
    <nav ref={row} className="d-room-tabs" aria-label="Помещения объекта" onScroll={measure}>{project.rooms.map(room => <button key={room.id} type="button" aria-pressed={room.id === selectedId} className={room.id === selectedId ? 'is-selected' : ''} title={room.name} onClick={() => onSelect(room.id)}><b>{room.name}</b><span>{F(geom(room.v, room.holes).a)} м²{!room.on && ' · Не в смете'}</span></button>)}</nav>
  </section>;
}
