import { ORIGINAL_ORIGIN, CANDIDATE_ORIGIN, applyComparisonSeed } from './seed-storage.js';

const sender = window.opener;
const status = document.querySelector('#status');
const back = document.querySelector('#source');
let accepted = false;
const fail = message => { status.textContent = message; back.hidden = false; };
const timer = setTimeout(() => fail('Не удалось получить исходные данные. Откройте вариант через страницу сравнения.'), 15000);

if (!sender || location.origin !== CANDIDATE_ORIGIN) {
  clearTimeout(timer); fail('Откройте этот вариант кнопкой «Открыть упрощённый» на странице сравнения.');
} else {
  window.addEventListener('message', event => {
    if (accepted || event.origin !== ORIGINAL_ORIGIN || event.source !== sender) return;
    if (event.data?.type === 'zamer:comparison-error') { clearTimeout(timer); fail('Не удалось прочитать исходные данные. Они сохранены в текущем варианте.'); return; }
    if (event.data?.type !== 'zamer:comparison-seed') return;
    accepted = true; clearTimeout(timer);
    try {
      applyComparisonSeed(localStorage, event.data.seed);
      sender.postMessage({ type: 'zamer:comparison-opened' }, ORIGINAL_ORIGIN);
      window.opener = null;
      location.replace('/design/index.html?screen=app&previewDevice=iphone-pro-max');
    } catch (cause) {
      sender.postMessage({ type: 'zamer:comparison-failed' }, ORIGINAL_ORIGIN);
      fail(cause?.message || 'Не удалось сохранить отдельную копию. Проверьте доступное место в браузере.');
    }
  });
  sender.postMessage({ type: 'zamer:comparison-ready' }, ORIGINAL_ORIGIN);
}
