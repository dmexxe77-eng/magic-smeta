const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const icon = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const diagonal = icon('<path d="M5 5h14v14H5z" stroke-dasharray="2 3"/><path d="m5 19 14-14"/><circle cx="5" cy="19" r="2" fill="var(--surface)"/><circle cx="19" cy="5" r="2" fill="var(--surface)"/>');
const angle = icon('<path d="M5 5v14h14M5 11a8 8 0 0 1 8 8"/><circle cx="5" cy="19" r="2" fill="var(--surface)"/>');

export function measurementToolbar(pick, label) {
  const prompt = pick?.mode === 'diag'
    ? pick.a == null ? 'Нажмите первую вершину диагонали.' : `Выбрана ${label(pick.a)}. Нажмите вторую вершину диагонали.`
    : pick?.mode === 'ang' ? 'Нажмите угол на чертеже и введите градусы.' : 'Диагональ — две вершины. Угол — одна.';
  return `<div class="measure-tool-buttons" role="toolbar" aria-label="Измерения на чертеже">
    <button type="button" data-act="pickDiag" aria-pressed="${pick?.mode === 'diag'}" title="Выбрать две вершины и ввести длину диагонали">${diagonal}<span>Диагональ</span></button>
    <button type="button" data-act="pickAng" aria-pressed="${pick?.mode === 'ang'}" title="Выбрать угол и ввести градусы">${angle}<span>Угол</span></button>
    ${pick ? '<button type="button" class="measure-cancel" data-act="pickCancel">Отмена</button>' : ''}
  </div><div class="measure-tool-prompt" role="status" aria-live="polite">${escape(prompt)}</div>`;
}
