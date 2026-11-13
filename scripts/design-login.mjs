import { mobileViewportHead } from '../src/design-bridge/mobile-viewport.js';

/** Entry for the mobile prototype's login and registration screens. */
export function loginPreviewPage({ fonts = '' } = {}) {
  return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">${mobileViewportHead()}
<meta name="theme-color" content="#ffffff"><title>ЗАМЕРX — Вход</title>
<style>${fonts.replace(/<\/style/gi, '<\\/style')}</style><link rel="stylesheet" href="./login.css">
</head><body><div id="login-root"></div>
<script src="./vendor/react.js"></script><script src="./vendor/react-dom.js"></script><script src="./login.js"></script>
<noscript>Для просмотра страницы входа включите JavaScript.</noscript>
</body></html>`;
}
