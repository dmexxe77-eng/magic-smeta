/* Стартовое меню сайта: выбор версии ЗАМЕРX. Каждая версия открывается по своей ссылке */
import React from 'react';
import { VERSIONS } from './links.js';
import './launcher.css';

const ICONS = {
  main: <path d="M4 5h16v14H4zM4 9h16M9 9v10" />,
  design: <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2" />,
  online: <path d="M3 5h18v11H3zM8 20h8M12 16v4" />,
};

function Card({ version }) {
  const body = (
    <>
      <span className="launch-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[version.id]}</svg></span>
      <span className="launch-badge">{version.badge}</span>
      <b className="launch-title">{version.title}</b>
      <span className="launch-text">{version.text}</span>
      <span className="launch-device">{version.device}</span>
    </>
  );
  if (!version.href) return <div className="launch-card is-disabled" aria-disabled="true">{body}<span className="launch-soon">Ссылка появится после публикации</span></div>;
  return <a className={'launch-card' + (version.id === 'main' ? ' is-primary' : '')} href={version.href}>{body}</a>;
}

export default function Launcher() {
  return (
    <main className="launch">
      <header className="launch-head">
        <svg className="launch-mark" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
          <defs><linearGradient id="lx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3d8bff" /><stop offset="1" stopColor="#0f5cf0" /></linearGradient></defs>
          <rect width="64" height="64" rx="14" fill="#0b1119" stroke="rgba(255,255,255,0.08)" />
          <path d="M13 50V16.5a3.5 3.5 0 0 1 3.5-3.5H50" fill="none" stroke="#e6ebf4" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M22 13v5M30 13v6.5M38 13v5M46 13v6.5M13 24h5M13 32h6.5M13 40h5" stroke="#e6ebf4" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M22 23h10.5l21 27H43z" fill="#eef2f8" /><path d="M42.5 23H54L31 50H19.5z" fill="url(#lx)" />
        </svg>
        <h1>ЗАМЕР<span>X</span></h1>
        <p>Выберите версию</p>
      </header>
      <nav className="launch-grid" aria-label="Версии приложения">
        {VERSIONS.map(v => <Card key={v.id} version={v} />)}
      </nav>
      <footer className="launch-foot">Данные каждой версии хранятся отдельно</footer>
    </main>
  );
}
