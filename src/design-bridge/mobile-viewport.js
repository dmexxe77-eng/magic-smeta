export const MOBILE_VIEWPORT = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
export const MOBILE_VIEWPORT_CSS = 'html.z-mobile-viewport,html.z-mobile-viewport body{touch-action:pan-x pan-y;-webkit-text-size-adjust:100%;text-size-adjust:100%}';

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

/** Cancel Safari's page-zoom default, leaving canvas touch/pointer handlers alone. */
export function installMobileViewportGuard(win) {
  if (!isMobileViewport(win)) return () => {};
  const doc = win.document;
  doc.documentElement.classList.add('z-mobile-viewport');
  const preventPageZoom = event => { if (event.cancelable) event.preventDefault(); };
  const options = { passive: false };
  doc.addEventListener('gesturestart', preventPageZoom, options);
  doc.addEventListener('gesturechange', preventPageZoom, options);
  return () => {
    doc.removeEventListener('gesturestart', preventPageZoom, options);
    doc.removeEventListener('gesturechange', preventPageZoom, options);
    doc.documentElement.classList.remove('z-mobile-viewport');
  };
}

if (typeof window !== 'undefined' && window.document?.documentElement) installMobileViewportGuard(window);
