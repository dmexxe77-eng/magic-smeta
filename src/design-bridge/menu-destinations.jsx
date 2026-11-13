import React, { useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { fitToStage } from './stage.js';
import './menu-destinations.css';

const FEATURES = ['Планировщик задач монтажа', 'Готовая база актуальных номенклатур', 'Обводка чертежа PDF и фото', 'Экспорт сметы в PDF', 'Автоматическое создание договора'];
const FILTERS = [['all', 'Все'], ['open', 'Ожидают'], ['progress', 'В работе'], ['answered', 'Ответ'], ['closed', 'Закрытые']];
const TITLES = { designers: 'Дизайнеры', support: 'Поддержка', appeals: 'Обращения', subscription: 'Подписка PRO', training: 'Обучение', logout: 'Выйти из аккаунта?', cancelSubscription: 'Отменить подписку?' };

function Destination({ opts, close }) {
  const [notice, setNotice] = useState(''), [confirmed, setConfirmed] = useState(false);
  const confirmationButton = useRef(null);
  useLayoutEffect(() => { if (confirmed) confirmationButton.current?.focus(); }, [confirmed]);
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [filter, setFilter] = useState('all');
  const id = opts.id, pro = opts.plan !== 'free', allowed = id !== 'appeals' || opts.profile?.role === 'ADMIN';
  const modal = ['logout', 'cancelSubscription', 'training'].includes(id);
  const heading = TITLES[id] || 'Раздел';
  const limitation = text => setNotice(text);
  const confirm = () => { setConfirmed(true); setNotice(id === 'logout' ? 'В прототипе нет активной сессии. Данные проектов сохранены.' : 'Изменение подписки доступно в приложении с аккаунтом.'); };

  if (modal) return <div className="nm-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section className="nm-dialog" role="alertdialog" aria-modal="true" aria-label={heading}>
      <h2>{heading}</h2>
      <p>{id === 'training' ? 'Раздел появится позже.' : id === 'cancelSubscription' ? 'Сейчас тариф сразу станет бесплатным. Позже отмена будет действовать до конца оплаченного месяца.' : 'Выйти из текущего аккаунта?'}</p>
      {notice && <p role="status" className="nm-notice">{notice}</p>}
      {id === 'training' || confirmed ? <button ref={confirmationButton} className="nm-primary" onClick={close}>Понятно</button> : <div className="nm-dialog-actions"><button className="nm-secondary" onClick={close}>{id === 'cancelSubscription' ? 'Оставить PRO' : 'Отмена'}</button><button className="nm-danger" onClick={confirm}>{id === 'cancelSubscription' ? 'Отменить подписку' : 'Выйти'}</button></div>}
    </section>
  </div>;

  return <section className="nm-page" role="dialog" aria-modal="true" aria-label={heading}>
    <header className="nm-header"><button aria-label={'Назад из раздела «' + heading + '»'} className="nm-back" onClick={close}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button><h1>{heading}</h1>{id === 'designers' && <button className="nm-header-action" aria-label="Добавить дизайнера" onClick={() => limitation('Добавление дизайнеров доступно в приложении с аккаунтом.')}>+ Добавить</button>}</header>
    <div className="nm-content">
      {!allowed ? <div className="nm-card"><h2>Нет доступа</h2><p>Раздел доступен только администраторам.</p></div> : <>
        {id === 'designers' && <div className="nm-card nm-empty-designers"><h2>Пока нет дизайнеров</h2><p>Добавьте дизайнера, чтобы указывать его в проектах и считать бонус</p><button className="nm-primary" onClick={() => limitation('Добавление дизайнеров доступно в приложении с аккаунтом.')}>Добавить дизайнера</button></div>}
        {id === 'support' && <>
          <form className="nm-card nm-support-form" onSubmit={event => { event.preventDefault(); limitation('В прототипе обращения не отправляются. Обратитесь в поддержку из приложения с аккаунтом.'); }}>
            <h2>Новое обращение</h2>
            <label>Заголовок<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Кратко о сути вопроса" maxLength={120} /></label>
            <label>Текст<textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Опишите проблему или вопрос" maxLength={4000} /></label>
            <button className="nm-primary" type="submit" aria-label="Отправить обращение" disabled={title.trim().length < 3 || body.trim().length < 1}>Отправить</button>
          </form>
          <h2 className="nm-list-title">Ваши обращения</h2>
        </>}
        {['support', 'appeals'].includes(id) && <><div className="nm-filters" role="group" aria-label="Статусы обращений">{FILTERS.map(([key, text]) => <button key={key} aria-pressed={filter === key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>{id === 'appeals' ? ({ open: 'Новые', answered: 'Отвеченные' })[key] || text : text}</button>)}</div><p className="nm-empty">Пока нет обращений</p></>}
        {id === 'subscription' && <div className={'nm-card nm-plan ' + (pro ? 'is-pro' : 'is-free')}>
          <div className="nm-plan-head"><h2>{pro ? 'PRO' : 'Free'}</h2><span>{pro ? 'активна' : 'ограничено'}</span></div>
          <p className="nm-plan-price">{pro ? '499 ₽/мес' : 'бесплатно'}</p>
          <p>{pro ? 'Неограниченный функционал приложения' : 'Откройте все возможности с подпиской PRO'}</p>
          <ul>{FEATURES.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
          <button className={pro ? 'nm-secondary' : 'nm-primary'} onClick={() => limitation('Оплата и изменение тарифа доступны в приложении с аккаунтом.')}>{pro ? 'Отменить подписку' : 'Симулировать оплату'}</button>
        </div>}
        <p className="nm-local-hint">{id === 'support' || id === 'appeals' ? 'Переписка доступна в приложении с аккаунтом.' : id === 'designers' ? 'Справочник из аккаунта здесь не подключён.' : 'Подписка аккаунта в прототипе не изменяется.'}</p>
      </>}
      {notice && <p className="nm-notice" role="status">{notice}</p>}
    </div>
  </section>;
}

/** Separate native destinations keep menu links honest in the offline prototype. */
export function openMenuDestination(opts = {}) {
  const previous = document.activeElement, host = document.createElement('div');
  host.className = 'nm-host';
  document.body.append(host);
  const detach = fitToStage(host), root = ReactDOM.createRoot(host);
  let active = true;
  const close = () => {
    if (!active) return;
    active = false; document.removeEventListener('keydown', onKey, true);
    root.unmount(); detach(); host.remove();
    if (previous?.isConnected) previous.focus?.();
  };
  const requestClose = () => { close(); opts.onClose?.(); };
  const onKey = event => {
    if (!host.contains(document.activeElement)) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose(); }
    if (event.key === 'Tab') {
      const controls = [...host.querySelectorAll('button:not(:disabled),input,textarea')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  root.render(<Destination opts={opts} close={requestClose} />);
  requestAnimationFrame(() => { if (active) host.querySelector('button')?.focus(); });
  return { close };
}
