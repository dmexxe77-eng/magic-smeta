import { visualViewportBounds, revealFocusedControl } from './viewport-geometry.js';

export const MOBILE_VIEWPORT = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
export const MOBILE_VIEWPORT_CSS = 'html.z-mobile-viewport,html.z-mobile-viewport body{touch-action:pan-x pan-y;-webkit-text-size-adjust:100%;text-size-adjust:100%;overflow:hidden;overscroll-behavior:none}html.z-mobile-viewport .z-design-shell,html.z-mobile-viewport #login-root{position:fixed;left:var(--z-viewport-left,0px);top:var(--z-viewport-top,0px);width:var(--z-viewport-width,100%);height:var(--z-viewport-height,100dvh)}';

export function mobileViewportMeta() {
  return `<meta name="viewport" content="${MOBILE_VIEWPORT}">`;
}

export function mobileViewportHead() {
  return `${mobileViewportMeta()}\n<style>${MOBILE_VIEWPORT_CSS}</style>\n<script src="/design/viewport.js"></script>`;
}

/** Raise small inline form text without shrinking larger amount/drawing fields. */
export function mobileInputTemplate(template) {
  return template.replace(/<(?:input|textarea|select)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, tag => {
    if (/\btype\s*=\s*["'](?:checkbox|radio|hidden|file|range|color|button|submit|reset)["']/i.test(tag)) return tag;
    return tag.replace(/(\bstyle\s*=\s*)(["'])([\s\S]*?)\2/gi, (_, prefix, quote, style) => {
      const safeStyle = style.replace(/\bfont-size\s*:\s*(\d+(?:\.\d+)?)px\b/gi, (rule, size) => Number(size) < 16 ? 'font-size:16px' : rule);
      return prefix + quote + safeStyle + quote;
    });
  });
}

export function isMobileViewport(win) {
  const media = query => Boolean(win.matchMedia?.(query).matches);
  return Number(win.navigator?.maxTouchPoints) > 1 || win.navigator?.standalone === true
    || media('(pointer: coarse)') || media('(display-mode: standalone)');
}

export function installMobileKeyboardViewport(win) {
  const doc = win.document, html = doc.documentElement, viewport = win.visualViewport;
  const properties = ['left', 'top', 'width', 'height'].map(name => '--z-viewport-' + name);
  const previous = properties.map(name => html.style.getPropertyValue(name));
  let active = true, frame = 0, revealFrame = 0, reveal = false;
  const apply = () => {
    frame = 0;
    if (!active) return;
    const bounds = visualViewportBounds(win);
    for (const name of ['left', 'top', 'width', 'height']) html.style.setProperty('--z-viewport-' + name, bounds[name] + 'px');
    if (reveal) {
      reveal = false;
      win.cancelAnimationFrame(revealFrame);
      revealFrame = win.requestAnimationFrame(() => { revealFrame = 0; if (active) revealFocusedControl(win); });
    }
  };
  const schedule = shouldReveal => {
    reveal ||= shouldReveal;
    if (!frame) frame = win.requestAnimationFrame(apply);
  };
  const resize = () => schedule(true), pan = () => schedule(false);
  win.addEventListener('resize', resize);
  win.addEventListener('scroll', pan);
  viewport?.addEventListener('resize', resize);
  viewport?.addEventListener('scroll', pan);
  doc.addEventListener('focusin', resize);
  apply();
  return () => {
    active = false;
    win.cancelAnimationFrame(frame); win.cancelAnimationFrame(revealFrame);
    win.removeEventListener('resize', resize); win.removeEventListener('scroll', pan);
    viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', pan);
    doc.removeEventListener('focusin', resize);
    properties.forEach((name, index) => previous[index] ? html.style.setProperty(name, previous[index]) : html.style.removeProperty(name));
  };
}

/** Cancel Safari's page-zoom default, leaving canvas touch/pointer handlers alone. */
const guardKey = Symbol.for('zamer.mobileViewportGuard');
export function installMobileViewportGuard(win) {
  if (!isMobileViewport(win)) return () => {};
  const doc = win.document, html = doc.documentElement;
  if (win[guardKey]?.html === html) return win[guardKey].cleanup;
  win[guardKey]?.cleanup();
  html.classList.add('z-mobile-viewport');
  const detachKeyboard = installMobileKeyboardViewport(win);
  const preventPageZoom = event => { if (event.cancelable) event.preventDefault(); };
  const options = { passive: false };
  doc.addEventListener('gesturestart', preventPageZoom, options);
  doc.addEventListener('gesturechange', preventPageZoom, options);
  const cleanup = () => {
    detachKeyboard();
    doc.removeEventListener('gesturestart', preventPageZoom, options);
    doc.removeEventListener('gesturechange', preventPageZoom, options);
    html.classList.remove('z-mobile-viewport');
    if (win[guardKey]?.cleanup === cleanup) delete win[guardKey];
  };
  win[guardKey] = { html, cleanup };
  return cleanup;
}

if (typeof window !== 'undefined' && window.document?.documentElement) installMobileViewportGuard(window);
