import { PRESETS } from '../design-src/device-preview.js';

function attr(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function styleText(value) {
  return String(value).replace(/<\/style/gi, '<\\/style');
}

/** Render a host only; the prototype itself is mounted exactly once in app.html. */
export function devicePreviewPage({ css = '', scriptUrl = './device-preview.js', fonts = '' } = {}) {
  const groups = [...new Set(PRESETS.map((preset) => preset.group))];
  const options = groups.map((group) => `<optgroup label="${attr(group)}">${PRESETS
    .filter((preset) => preset.group === group)
    .map((preset) => `<option value="${attr(preset.id)}"${preset.id === 'iphone-14' ? ' selected' : ''}>${attr(preset.name)}${preset.width ? ` · ${preset.width} × ${preset.height}` : ''}</option>`)
    .join('')}</optgroup>`).join('');
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#eff1f6">
  <title>ЗАМЕРX — упрощённый вариант</title>
  <style>${styleText(fonts)}\n${styleText(css)}</style>
</head>
<body>
  <main class="preview-host" aria-label="Предпросмотр на устройствах">
    <header class="preview-toolbar">
      <div class="preview-brand">ЗАМЕР<span>X</span><small style="display:block;margin-top:3px;font-size:10px;line-height:1.3;font-weight:600;letter-spacing:0;color:#6f7688">Упрощённый вариант</small></div>
      <label class="preview-device" for="preview-device">
        <span class="preview-label">Устройство</span>
        <select class="preview-select" id="preview-device" aria-label="Устройство">${options}</select>
      </label>
      <button class="preview-button" id="preview-rotate" type="button" aria-label="Повернуть устройство" aria-pressed="false" title="Повернуть устройство">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7V3m0 0H3m4 0 3.1 3.1M17 17v4m0 0h4m-4 0-3.1-3.1"/><rect x="8" y="7" width="9" height="13" rx="2" transform="rotate(-35 12.5 13.5)"/></svg>
        <span id="preview-orientation">Книжная</span>
      </button>
      <div class="preview-zoom" role="group" aria-label="Масштаб предпросмотра">
        <button class="preview-button" id="preview-fit" type="button" aria-pressed="true">Вписать</button>
        <button class="preview-button" id="preview-actual" type="button" aria-pressed="false">100%</button>
      </div>
      <output class="preview-readout" id="preview-readout" aria-label="Размер и масштаб экрана" aria-live="polite"></output>
    </header>
    <section class="preview-stage" id="preview-stage" aria-label="Экран устройства">
      <div class="preview-canvas"><div class="preview-artboard" id="preview-artboard"><iframe class="preview-frame" id="preview-frame" title="Предпросмотр ЗАМЕРX" allow="web-share; clipboard-write"></iframe></div></div>
      <div class="preview-status" id="preview-status" role="status"><span id="preview-status-text">Загружаем приложение…</span><button class="preview-button" id="preview-retry" type="button" hidden>Повторить загрузку</button></div>
    </section>
  </main>
  <noscript><p class="preview-noscript">Для работы приложения включите JavaScript. <a href="./app.html">Открыть приложение</a></p></noscript>
  <script type="module" src="${attr(scriptUrl)}"></script>
</body>
</html>`;
}
