const workspace = document.querySelector('#workspace');

if (workspace) {
  const tabs = [...workspace.querySelectorAll('[data-workspace-tab]')];
  const panels = [...workspace.querySelectorAll('[data-workspace-panel]')];
  const views = new Set(tabs.map((tab) => tab.dataset.workspaceTab));

  function selectWorkspace(view, focus = false) {
    if (!views.has(view)) return;
    tabs.forEach((tab) => {
      const selected = tab.dataset.workspaceTab === view;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus({ preventScroll: true });
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.workspacePanel !== view;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectWorkspace(tab.dataset.workspaceTab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectWorkspace(tabs[next].dataset.workspaceTab, true);
    });
  });

  document.querySelectorAll('[data-workspace-target]').forEach((link) => {
    link.addEventListener('click', () => selectWorkspace(link.dataset.workspaceTarget));
  });

  selectWorkspace('calendar');
}
