/* Наши оверлеи (построитель, обводка, договор) должны жить в том же «телефоне», что и
   прототип: на широком экране страница дизайна рисует корпус со скруглёнными углами,
   а оверлей, растянутый на весь viewport, выбивался из макета.
   Находим прямоугольник экрана телефона и держим оверлей ровно в нём. Если корпуса нет
   (узкий экран, мобильный режим) — остаётся обычный полноэкранный оверлей. */

const MIN_W = 280, MAX_W = 680, MIN_H = 420, MIN_RADIUS = 16;

/* Экран телефона: скруглённый блок с обрезкой по краям, уже окна и достаточно высокий */
function stageEl() {
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

/* Привязывает host к экрану телефона и следит за его геометрией.
   Возвращает функцию отписки. */
export function fitToStage(host) {
  let watched = null, ro = null;
  const apply = () => {
    const el = stageEl();
    if (el !== watched && ro) { if (watched) ro.unobserve(watched); if (el) ro.observe(el); }
    watched = el;
    if (!el) {
      Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', right: '0px', bottom: '0px', width: '', height: '', borderRadius: '', overflow: '' });
      return;
    }
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    Object.assign(host.style, {
      position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
      right: 'auto', bottom: 'auto', borderRadius: cs.borderRadius, overflow: 'hidden',
    });
  };
  if (window.ResizeObserver) { ro = new ResizeObserver(apply); ro.observe(document.documentElement); }
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('scroll', apply, true);
  return () => {
    window.removeEventListener('resize', apply);
    window.removeEventListener('scroll', apply, true);
    if (ro) ro.disconnect();
  };
}
