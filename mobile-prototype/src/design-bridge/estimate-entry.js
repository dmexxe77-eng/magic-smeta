import { htmlToPdf } from '../utils/pdf.js';
import { estimateHtml } from '../utils/estimate-html.js';
import { fitToStage } from './stage.js';

export { estimateHtml } from '../utils/estimate-html.js';
export { normalizeEstimateAdjustment, estimateAdjustmentRates, updateEstimateAdjustment, calculateEstimateTotals, adjustmentLabel } from '../utils/estimate-adjustment.js';
export { estimateAdjustmentVisibility, setEstimateAdjustmentVisibility } from '../utils/estimate-export-options.js';
export { prepareEstimateExport } from '../utils/estimate-export.js';
export { getCompanyDetails, getCompanyProfile } from './company-profile.js';
export { withEstimateImages } from './estimate-images.js';

const fileName = options => `Смета_${options?.project?.name || 'Проект'}`.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_');

export async function downloadEstimate(options) {
  if (!await htmlToPdf(estimateHtml(options), fileName(options))) throw new Error('Не удалось создать PDF. Попробуйте ещё раз.');
  return { status: 'downloaded' };
}

export async function shareEstimate(options) {
  if (!navigator.share || typeof File === 'undefined') return downloadEstimate(options);
  const blob = await htmlToPdf(estimateHtml(options), fileName(options), { blob: true });
  if (!blob) throw new Error('Не удалось создать PDF для отправки.');
  const file = new File([blob], `${fileName(options)}.pdf`, { type: 'application/pdf' });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { status: 'downloaded' };
  }
  try {
    await navigator.share({ files: [file], title: `Смета — ${options?.project?.name || 'Проект'}` });
    return { status: 'shared' };
  } catch (error) {
    if (error?.name === 'AbortError') return { status: 'cancelled' };
    throw error;
  }
}

let closePreview = null;

export async function previewEstimate(options) {
  closePreview?.();
  const previousFocus = document.activeElement;
  const host = document.createElement('div');
  host.className = 'z-estimate-shell';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', 'Предпросмотр сметы');
  host.style.cssText = 'z-index:9500;background:#f3f3fa;display:flex;flex-direction:column;color:#0f1620;font:14px Manrope,system-ui,sans-serif';
  const header = document.createElement('div');
  header.className = 'z-estimate-header';
  header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px;background:white;border-bottom:1px solid #e4e4ee';
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрыть предпросмотр сметы');
  close.textContent = 'Назад';
  close.style.cssText = 'border:0;border-radius:9px;min-height:44px;padding:0 14px;background:#f3f3fa;color:#1461ee;font:600 13px Manrope,system-ui,sans-serif;cursor:pointer';
  const title = document.createElement('strong');
  title.textContent = 'Предпросмотр сметы';
  header.append(close, title);
  const viewport = document.createElement('div');
  viewport.className = 'z-estimate-viewport';
  viewport.style.cssText = 'flex:1;min-height:0;overflow:auto;padding:12px';
  const paper = document.createElement('div');
  paper.innerHTML = estimateHtml(options);
  const article = paper.firstElementChild;
  article.style.transformOrigin = 'top left';
  viewport.append(paper);
  host.append(header, viewport);
  document.body.append(host);
  const detachStage = fitToStage(host);
  const measure = () => {
    const padding = getComputedStyle(viewport);
    const availableWidth = viewport.clientWidth - (parseFloat(padding.paddingLeft) || 0) - (parseFloat(padding.paddingRight) || 0);
    const scale = Math.min(1, Math.max(1, availableWidth) / 768);
    article.style.transform = `scale(${scale})`;
    paper.style.height = `${Math.ceil(article.scrollHeight * scale)}px`;
    paper.style.width = `${768 * scale}px`;
    paper.style.margin = '0 auto';
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
  observer?.observe(viewport);
  window.addEventListener('resize', measure);
  const onKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); closePreview?.(); }
    if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
  };
  closePreview = () => {
    detachStage();
    observer?.disconnect();
    window.removeEventListener('resize', measure);
    document.removeEventListener('keydown', onKey, true);
    host.remove();
    previousFocus?.focus?.();
    closePreview = null;
  };
  close.addEventListener('click', () => closePreview?.());
  document.addEventListener('keydown', onKey, true);
  measure();
  close.focus();
  return { status: 'previewed' };
}
