import React, { useRef, useState } from 'react';
import './trace-welcome.css';

const ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';
const FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const STEPS = [
  ['Загрузите планировку', 'Выберите PDF или фото чертежа.'],
  ['Обведите помещение', 'Нажмите по углам вдоль его периметра.'],
  ['Укажите длину одной стены', 'Этот размер задаст масштаб всего плана.'],
];

export default function TraceWelcome({ onFile, onBack }) {
  const input = useRef(null);
  const [error, setError] = useState('');

  const selectFile = event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!FILE_TYPES.has(file.type) && !/\.(pdf|jpe?g|png)$/i.test(file.name || '')) {
      setError('Выберите чертёж в формате PDF, JPEG или PNG.');
      return;
    }
    setError('');
    onFile(file);
  };

  return (
    <div className="trace-welcome">
      <header className="trace-welcome-header">
        <button className="trace-welcome-back" type="button" onClick={onBack} aria-label="Назад из обводки чертежа">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m12 5-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1>Обводка чертежа</h1>
          <p>Из PDF или фото планировки</p>
        </div>
      </header>

      <div className="trace-welcome-scroll">
        <main className="trace-welcome-content">
          <section className="trace-welcome-upload-card" aria-label="Загрузка чертежа">
            <div className="trace-welcome-art">
              <img src="/design/assets/trace-upload-hero.png" alt="План квартиры с названиями и площадями помещений, синими контурами и лупой для точной обводки" width="1448" height="1086" />
            </div>
            <div className="trace-welcome-upload-content">
              <button className="trace-welcome-upload" type="button" onClick={() => input.current?.click()} aria-describedby="trace-welcome-formats">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 15V3m0 0L8 7m4-4 4 4M5 13v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Загрузить чертёж
              </button>
              <input ref={input} type="file" accept={ACCEPT} onChange={selectFile} hidden />
              <p className="trace-welcome-formats" id="trace-welcome-formats">PDF, JPEG или PNG</p>
              <p className="trace-welcome-file-note">Для PDF можно выбрать нужный лист</p>
              {error && <p className="trace-welcome-error" role="alert">{error}</p>}
            </div>
          </section>

          <section className="trace-welcome-guide" aria-labelledby="trace-welcome-guide-title">
            <h2 id="trace-welcome-guide-title">Как это работает</h2>
            <ol>
              {STEPS.map(([title, description], index) => (
                <li key={title}>
                  <span className="trace-welcome-step" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </li>
              ))}
            </ol>
            <div className="trace-welcome-result">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5.5 10 3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p>Остальные размеры и площадь рассчитаем автоматически.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
