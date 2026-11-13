import { htmlToPdf } from '../utils/pdf.js';
import { estimateHtml } from '../utils/estimate-html.js';
import { collectPdfAvoidRanges, pdfContentEnd, paginatePdf } from '../utils/pdf-pagination.js';
import { fitToStage } from './stage.js';

export { estimateHtml } from '../utils/estimate-html.js';
export { normalizeEstimateAdjustment, estimateAdjustmentRates, updateEstimateAdjustment, calculateEstimateTotals, adjustmentLabel } from '../utils/estimate-adjustment.js';
export { estimateAdjustmentVisibility, setEstimateAdjustmentVisibility, normalizeEstimateExportOptions } from '../utils/estimate-export-options.js';
export { prepareEstimateExport } from '../utils/estimate-export.js';
export { getCompanyDetails, getCompanyProfile } from './company-profile.js';
export { mergeAccountProfilePatch } from './account-profile.js';
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
  viewport.setAttribute('aria-label', 'Предпросмотр PDF');
  const source = document.createElement('div');
  source.setAttribute('aria-hidden', 'true');
  source.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;width:800px;background:#fff;z-index:-1';
  source.innerHTML = estimateHtml(options);
  const article = source.firstElementChild;
  host.append(header, viewport);
  document.body.append(host, source);
  const detachStage = fitToStage(host);
  let active = true, frame = 0, previousLayout = '';
  const measure = () => {
    if (!active) return;
    const padding = getComputedStyle(viewport);
    const availableWidth = viewport.clientWidth - (parseFloat(padding.paddingLeft) || 0) - (parseFloat(padding.paddingRight) || 0);
    const rect = article.getBoundingClientRect();
    const canvasWidth = Math.max(1, Math.ceil(rect.width) * 2), canvasHeight = Math.max(1, Math.ceil(rect.height) * 2);
    const scaleY = canvasHeight / Math.max(1, article.scrollHeight);
    const toRange = element => { const bounds = element.getBoundingClientRect(); return { top: Math.max(0, Math.floor((bounds.top - rect.top) * scaleY)), bottom: Math.min(canvasHeight, Math.ceil((bounds.bottom - rect.top) * scaleY)) }; };
    const slices = paginatePdf({ height: canvasHeight, pageHeight: Math.max(1, Math.floor(277 * canvasWidth / 190)), edgeTolerance: 1,
      avoidRanges: collectPdfAvoidRanges(article, toRange), breakBefore: [...article.querySelectorAll('[data-pdf-break-before]')].map(element => toRange(element).top), contentEnd: pdfContentEnd(article, toRange) });
    const layout = JSON.stringify({ availableWidth, canvasWidth, slices });
    if (layout === previousLayout) return;
    previousLayout = layout;
    const contentWidth = canvasWidth / 2, mm = contentWidth / 190, pageWidth = 210 * mm, pageHeight = 297 * mm, margin = 10 * mm;
    const scale = Math.min(1, Math.max(1, availableWidth) / pageWidth);
    const pages = slices.map((slice, index) => {
      const figure = document.createElement('figure');
      figure.className = 'z-estimate-pdf-page';
      figure.dataset.pdfPage = String(index + 1);
      figure.style.cssText = `width:${pageWidth * scale}px;margin:0 auto 16px`;
      const caption = document.createElement('figcaption');
      caption.style.cssText = 'margin:0 0 5px;color:#6f7688;font-size:10px;line-height:1.4;text-align:right';
      caption.textContent = `${index + 1} / ${slices.length}`;
      const page = document.createElement('div');
      page.setAttribute('role', 'img'); page.setAttribute('aria-label', `Страница ${index + 1} из ${slices.length}`);
      page.style.cssText = `position:relative;width:${pageWidth * scale}px;height:${pageHeight * scale}px`;
      const sheet = document.createElement('div');
      sheet.style.cssText = `position:absolute;left:0;top:0;width:${pageWidth}px;height:${pageHeight}px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px #dde1ea;transform-origin:top left;transform:scale(${scale})`;
      sheet.setAttribute('aria-hidden', 'true');
      const clip = document.createElement('div');
      clip.style.cssText = `position:absolute;left:${margin}px;top:${margin}px;width:${contentWidth}px;height:${(slice.bottom - slice.top) / 2}px;overflow:hidden`;
      const content = document.createElement('div');
      content.style.cssText = `width:${contentWidth}px;transform:translateY(-${slice.top / 2}px);transform-origin:top left`;
      content.append(article.cloneNode(true)); clip.append(content); sheet.append(clip); page.append(sheet); figure.append(caption, page);
      return figure;
    });
    viewport.replaceChildren(...pages);
  };
  const schedule = () => { if (!active) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  observer?.observe(viewport); observer?.observe(article);
  document.fonts?.ready.then(schedule);
  source.addEventListener('load', schedule, true);
  window.addEventListener('resize', schedule);
  const onKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); closePreview?.(); }
    if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
  };
  closePreview = () => {
    active = false; cancelAnimationFrame(frame);
    detachStage();
    observer?.disconnect();
    source.removeEventListener('load', schedule, true); source.remove();
    window.removeEventListener('resize', schedule);
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
