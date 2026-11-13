const workspace = document.querySelector('#workspace');

if (workspace) {
  const tabs = [...workspace.querySelectorAll('[data-jw-tab]')];
  const panels = [...workspace.querySelectorAll('[data-jw-panel]')];
  const views = new Set(tabs.map((tab) => tab.dataset.jwTab));
  const tablist = workspace.querySelector('.jw-tabs');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const indicator = document.createElement('span');
  indicator.className = 'jw-tab-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  tablist.append(indicator);
  let selectedView = null;
  let positioningFrame = 0;
  let panelAnimations = [];

  function positionIndicator(snap = false) {
    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    if (!selected) return;
    const immediate = snap || reducedMotion.matches || !tablist.classList.contains('has-indicator');
    if (immediate) tablist.classList.add('is-positioning');
    tablist.style.setProperty('--jw-indicator-x', `${selected.offsetLeft}px`);
    tablist.style.setProperty('--jw-indicator-y', `${selected.offsetTop}px`);
    tablist.style.setProperty('--jw-indicator-width', `${selected.offsetWidth}px`);
    tablist.style.setProperty('--jw-indicator-height', `${selected.offsetHeight}px`);
    tablist.classList.add('has-indicator');
    if (immediate) {
      if (positioningFrame) window.cancelAnimationFrame(positioningFrame);
      // Commit the resized geometry before restoring transitions.
      indicator.getBoundingClientRect();
      positioningFrame = window.requestAnimationFrame(() => {
        positioningFrame = 0;
        tablist.classList.remove('is-positioning');
      });
    }
  }

  function cancelPanelAnimations() {
    panelAnimations.forEach((animation) => animation.cancel());
    panelAnimations = [];
  }

  function selectWorkspace(view, focus = false, animate = true) {
    if (!views.has(view)) return;
    const changed = selectedView !== view;
    if (changed) cancelPanelAnimations();
    tabs.forEach((tab) => {
      const selected = tab.dataset.jwTab === view;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus({ preventScroll: true });
    });
    if (!changed) return;
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.jwPanel !== view;
    });
    selectedView = view;
    positionIndicator(!animate);
    const incoming = panels.find((panel) => panel.dataset.jwPanel === view);
    if (!animate || !incoming) return;
    incoming.classList.add('jw-activated');
    if (reducedMotion.matches || document.hidden) return;
    incoming.querySelectorAll('.jw-description, .jw-screen').forEach((element) => {
      if (typeof element.animate !== 'function') return;
      const animation = element.animate([
        { opacity: .5, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 250, easing: 'ease-out' });
      panelAnimations.push(animation);
      animation.onfinish = () => { panelAnimations = panelAnimations.filter((active) => active !== animation); };
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectWorkspace(tab.dataset.jwTab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectWorkspace(tabs[next].dataset.jwTab, true);
    });
  });

  document.querySelectorAll('[data-workspace-target]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      selectWorkspace(link.dataset.workspaceTarget);
    });
  });

  reducedMotion.addEventListener('change', () => {
    cancelPanelAnimations();
    positionIndicator(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelPanelAnimations();
  });
  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => positionIndicator(true));
    resizeObserver.observe(tablist);
  } else window.addEventListener('resize', () => positionIndicator(true));
  document.fonts?.ready.then(() => positionIndicator(true));
  selectWorkspace('calendar', false, false);
}
