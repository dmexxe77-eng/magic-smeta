/* Стартовое меню сайта: выбор версии ZAMER.PRO. Основная версия открывается здесь же, остальные — по ссылкам */
import React from 'react';
import { VERSIONS } from './links.js';
import './launcher.css';

const ICONS = {
  main: <path d="M4 5h16v14H4zM4 9h16M9 9v10" />,
  design: <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2" />,
  online: <path d="M3 5h18v11H3zM8 20h8M12 16v4" />,
};

function Card({ version, onMain }) {
  const body = (
    <>
      <span className="launch-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[version.id]}</svg></span>
      <span className="launch-badge">{version.badge}</span>
      <b className="launch-title">{version.title}</b>
      <span className="launch-text">{version.text}</span>
      <span className="launch-device">{version.device}</span>
    </>
  );
  if (version.id === 'main') return <button className="launch-card is-primary" onClick={onMain}>{body}</button>;
  if (!version.href) return <div className="launch-card is-disabled" aria-disabled="true">{body}<span className="launch-soon">Ссылка появится после публикации</span></div>;
  return <a className="launch-card" href={version.href}>{body}</a>;
}

export default function Launcher({ onMain }) {
  return (
    <main className="launch">
      <header className="launch-head">
        <span className="launch-mark" aria-hidden="true"><i /><i /><i /></span>
        <h1>ZAMER<span>.PRO</span></h1>
        <p>Выберите версию</p>
      </header>
      <nav className="launch-grid" aria-label="Версии приложения">
        {VERSIONS.map(v => <Card key={v.id} version={v} onMain={onMain} />)}
      </nav>
      <footer className="launch-foot">Данные каждой версии хранятся отдельно</footer>
    </main>
  );
}
