const positive = value => Number.isFinite(value) && value > 0 ? value : 0;
const offset = (value, limit) => Math.min(Math.max(0, Number.isFinite(value) ? value : 0), limit);

/** Fixed elements use layout coordinates; the keyboard can pan the visual viewport. */
export function visualViewportBounds(win) {
  const html = win.document.documentElement, viewport = win.visualViewport;
  const layoutWidth = Math.max(positive(win.innerWidth), positive(html.clientWidth), 1);
  const layoutHeight = Math.max(positive(win.innerHeight), positive(html.clientHeight), 1);
  const width = Math.min(layoutWidth, positive(viewport?.width) || layoutWidth);
  const height = Math.min(layoutHeight, positive(viewport?.height) || layoutHeight);
  return {
    left: offset(viewport?.offsetLeft, layoutWidth - width),
    top: offset(viewport?.offsetTop, layoutHeight - height), width, height,
  };
}

/** Scroll the form pane, never the document underneath a fixed editor. */
export function revealFocusedControl(win) {
  const field = win.document.activeElement;
  if (!field?.matches?.('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,[contenteditable="true"]')) return;
  revealElementInPane(win, field);
}

export function revealElementInPane(win, field) {
  for (let pane = field.parentElement; pane && pane !== win.document.body; pane = pane.parentElement) {
    if (!/(auto|scroll)/.test(win.getComputedStyle(pane).overflowY) || pane.scrollHeight <= pane.clientHeight) continue;
    const viewport = visualViewportBounds(win), bounds = pane.getBoundingClientRect(), rect = field.getBoundingClientRect();
    const top = Math.max(bounds.top + pane.clientTop, viewport.top) + 8;
    const bottom = Math.min(bounds.top + pane.clientTop + pane.clientHeight, viewport.top + viewport.height) - 8;
    if (bottom <= top) return;
    const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? Math.min(rect.bottom - bottom, rect.top - top) : 0;
    if (delta) pane.scrollTop = Math.max(0, Math.min(pane.scrollHeight - pane.clientHeight, pane.scrollTop + delta));
    return;
  }
}
