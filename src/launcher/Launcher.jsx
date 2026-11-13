/* Стартовое меню ЗАМЕРX: прототипы приложения и лендинг. */
import React from 'react';
import { VERSIONS, MAGIC_RESOURCES } from './links.js';
import './launcher.css';

const ICONS = {
  landing: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18" /></>,
  design: <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2" />,
  crm: <path d="M4 4h16v16H4zM4 9h16M10 9v11M14 13h3m-3 3h3" />,
  lighting: <path d="M8 14a6 6 0 1 1 8 0l-1 3H9l-1-3Zm1 6h6M12 1v1M3 5l1 1m16-1-1 1M1 12h2m18 0h2" />,
  online: <path d="M3 5h18v11H3zM8 20h8M12 16v4" />,
};

function Icon({ children, className = '' }) {
  return <svg className={'launch-svg ' + className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function Card({ version, resource = false }) {
  const Heading = resource ? 'h3' : 'h2';
  const className = ['launch-card', version.primary && 'is-primary', resource && 'is-resource', !version.href && 'is-disabled'].filter(Boolean).join(' ');
  const body = (
    <>
      <div className="launch-card-top">
        <span className="launch-icon"><Icon>{ICONS[version.icon || version.id]}</Icon></span>
        {version.device && <span className="launch-device">{version.device}</span>}
      </div>
      <div className="launch-card-copy">
        <Heading className="launch-title">{version.title}</Heading>
        <p className="launch-text">{version.text}</p>
      </div>
      <span className="launch-action">
        {version.href ? version.action : version.pending || 'Ссылка появится после публикации'}
        {version.href && <Icon><path d="M5 12h14m-5-5 5 5-5 5" /></Icon>}
      </span>
    </>
  );
  if (!version.href) return <div className={className} aria-disabled="true">{body}</div>;
  return <a className={className} href={version.href}>{body}</a>;
}

export default function Launcher() {
  return (
    <div className="launch">
      <a className="launch-skip" href="#launch-content">К выбору раздела</a>
      <header className="launch-header">
        <div className="launch-container launch-header-inner">
          <a className="launch-brand" href="/" aria-label="ЗАМЕРX — главная">
            <img src="/landing/favicon.svg" width="36" height="36" alt="" />
            <span>ЗАМЕР<span className="launch-brand-x">X</span></span>
          </a>
          <span className="launch-header-caption">Замеры. Расчёты. Сметы.</span>
        </div>
      </header>
      <main id="launch-content" className="launch-container launch-main">
        <div className="launch-intro">
          <h1>Ваше рабочее пространство</h1>
          <p>Выберите, где продолжить работу с ЗАМЕРX.</p>
        </div>
        <nav className="launch-grid" aria-label="Прототипы и сайт ЗАМЕРX">
          {VERSIONS.map(version => <Card key={version.id} version={version} />)}
        </nav>
        <p className="launch-note"><Icon><path d="M12 3 3.5 7v5c0 4.5 4.5 7.8 8.5 9 4-1.2 8.5-4.5 8.5-9V7zM8.5 12l2.5 2.5 4.5-5" /></Icon>Данные онлайн-версии и мобильного прототипа хранятся отдельно</p>
        <section className="launch-resources" aria-labelledby="magic-resources-title">
          <div className="launch-section-heading">
            <h2 id="magic-resources-title">Magic Ресурсы</h2>
            <p>Рабочие инструменты вашей команды</p>
          </div>
          <nav className="launch-grid launch-resource-grid" aria-label="Magic Ресурсы">
            {MAGIC_RESOURCES.map(resource => <Card key={resource.id} version={resource} resource />)}
          </nav>
        </section>
      </main>
      <footer className="launch-container launch-footer"><span>ЗАМЕРX</span><span>От замера до готовой сметы</span></footer>
    </div>
  );
}
