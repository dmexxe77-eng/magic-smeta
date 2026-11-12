import { useEffect, useRef, useState } from 'react';
import './tracing.css';

let nextPanelId = 0;

function ViewIcon({ name }) {
  const paths = {
    fit: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const visibilityOptions = [
  ['dimensions', 'Размеры сторон'],
  ['roomNames', 'Названия помещений'],
  ['completed', 'Готовые помещения'],
];

export default function TracingViewControls({ view, onViewChange, zoom, onZoom, onFit, onActualSize }) {
  const [open, setOpen] = useState(false);
  const [panelId] = useState(() => `trace-view-panel-${++nextPanelId}`);
  const toggleRef = useRef(null);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return <div className="trace-view-controls">
    <button ref={toggleRef} type="button" className="trace-view-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <ViewIcon name="fit" /><span>Вид</span>
    </button>
    {open && <section id={panelId} className="trace-view-panel" aria-label="Вид плана">
      <div className="trace-view-heading">
        <b>Вид плана</b>
        <button type="button" aria-label="Закрыть настройки вида" onClick={close}><ViewIcon name="close" /></button>
      </div>
      <div className="trace-view-actions">
        <button type="button" onClick={onFit}><ViewIcon name="fit" /><span>Вписать в экран</span></button>
        <button type="button" onClick={onActualSize}>100%</button>
      </div>
      <label className="trace-view-option trace-right-angles">
        <input type="checkbox" aria-label="Выравнивать углы" aria-describedby={`${panelId}-right-angles-help`} checked={view.rightAngles} onChange={event => onViewChange({ rightAngles: event.target.checked })} />
        <span>Выравнивать углы<small id={`${panelId}-right-angles-help`} style={{display:'block',fontSize:10,fontWeight:500,color:'#6f7688'}}>Привязка к 90°</small></span>
      </label>
      <div className="trace-view-zoom">
        <button type="button" aria-label="Уменьшить чертёж" disabled={zoom <= 0.05} onClick={() => onZoom(1 / 1.3)}><ViewIcon name="minus" /></button>
        <span>Масштаб<output>{Math.round(zoom * 100)}%</output></span>
        <button type="button" aria-label="Увеличить чертёж" disabled={zoom >= 15} onClick={() => onZoom(1.3)}><ViewIcon name="plus" /></button>
      </div>
      <label className="trace-view-opacity">
        <span><b>Видимость плана</b><output>{Math.round(view.opacity * 100)}%</output></span>
        <input type="range" min="0" max="100" step="5" value={Math.round(view.opacity * 100)} aria-label="Видимость плана" onChange={event => onViewChange({ opacity: Number(event.target.value) / 100 })} />
      </label>
      <div className="trace-view-options">
        {visibilityOptions.map(([key, label]) => <label key={key} className="trace-view-option">
          <input type="checkbox" checked={view[key]} onChange={event => onViewChange({ [key]: event.target.checked })} />
          <span>{label}</span>
        </label>)}
      </div>
      <p>Масштаб и видимость не меняют размеры.</p>
    </section>}
  </div>;
}
