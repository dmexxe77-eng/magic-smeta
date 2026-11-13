const SCREENS = new Set(['login', 'register', 'app']);
export const PROTOTYPE_SCREEN_MESSAGE = 'zamer:prototype-screen';

/** Preview routes carry no account data, passwords or authentication tokens. */
export function prototypeScreenUrl(screen, href) {
  if (!SCREENS.has(screen)) throw new Error('Неизвестный экран');
  const current = new URL(href);
  const next = new URL(screen === 'app' ? './app.html' : './login.html', current);
  next.search = current.search;
  next.searchParams.set('screen', screen);
  next.hash = '';
  return next.href;
}

export function notifyPrototypeScreen(screen, target = window) {
  if (!SCREENS.has(screen)) return;
  if (target.parent !== target) target.parent.postMessage({ type: PROTOTYPE_SCREEN_MESSAGE, screen }, target.location.origin);
}

export function navigatePrototypeScreen(screen, target = window) {
  const next = prototypeScreenUrl(screen, target.location.href);
  notifyPrototypeScreen(screen, target);
  target.location.replace(next);
}

export function openLogin() { navigatePrototypeScreen('login'); }
