/* Оверлеи занимают рабочую область приложения. Старые прототипы без явной
   рабочей области сохраняют привязку к экрану устройства. */

const MIN_W = 280, MAX_W = 680, MIN_H = 420, MIN_RADIUS = 16;

/* Экран телефона: скруглённый блок с обрезкой по краям, уже окна и достаточно высокий */
function stageEl() {
  const explicit = document.querySelector('[data-zamer-app-stage]');
  if (explicit) return explicit;
  const root = document.getElementById('dc-root') || document.body;
  let best = null, bestArea = 0;
  root.querySelectorAll('div').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') return;
    if ((parseFloat(cs.borderTopLeftRadius) || 0) < MIN_RADIUS) return;
    const r = el.getBoundingClientRect();
    if (r.width < MIN_W || r.width > MAX_W || r.height < MIN_H) return;
    if (r.width >= window.innerWidth - 8) return; // это не корпус, а блок во всю ширину
    const area = r.width * r.height;
    if (area > bestArea) { best = el; bestArea = area; }
  });
  return best;
}

/* Привязывает host к рабочей области и следит за её геометрией.
   Возвращает функцию отписки. */
export function fitToStage(host) {
  let watched = null, ro = null, active = true;
  const apply = () => {
    if (!active) return;
    const el = stageEl();
    if (el !== watched && ro) { if (watched) ro.unobserve(watched); if (el) ro.observe(el); }
    watched = el;
    const r = el?.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) {
      Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', right: '0px', bottom: '0px', width: '', height: '', borderRadius: '', overflow: '' });
      return;
    }
    const cs = getComputedStyle(el);
    Object.assign(host.style, {
      position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
      right: 'auto', bottom: 'auto', borderRadius: cs.borderRadius, overflow: 'hidden',
    });
  };
  if (window.ResizeObserver) { ro = new ResizeObserver(apply); ro.observe(document.documentElement); }
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('scroll', apply, true);
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', apply);
  viewport?.addEventListener('scroll', apply);
  return () => {
    active = false;
    window.removeEventListener('resize', apply);
    window.removeEventListener('scroll', apply, true);
    viewport?.removeEventListener('resize', apply);
    viewport?.removeEventListener('scroll', apply);
    if (ro) ro.disconnect();
  };
}
