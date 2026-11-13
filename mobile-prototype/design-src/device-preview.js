/** CSS viewport sizes; the iframe keeps these dimensions at every visual scale. */
export const PRESETS = Object.freeze([
  { id: 'iphone-se', name: 'iPhone SE', group: 'Телефоны', width: 375, height: 667 },
  { id: 'iphone-14', name: 'iPhone 13 / 14', group: 'Телефоны', width: 390, height: 844 },
  { id: 'iphone-pro-max', name: 'iPhone Pro Max', group: 'Телефоны', width: 430, height: 932 },
  { id: 'galaxy-s', name: 'Galaxy S', group: 'Телефоны', width: 360, height: 800 },
  { id: 'pixel', name: 'Google Pixel', group: 'Телефоны', width: 412, height: 915 },
  { id: 'ipad-mini', name: 'iPad mini', group: 'Планшеты', width: 768, height: 1024 },
  { id: 'ipad-11', name: 'iPad 11″', group: 'Планшеты', width: 834, height: 1194 },
  { id: 'ipad-pro-13', name: 'iPad Pro 13″', group: 'Планшеты', width: 1024, height: 1366 },
  { id: 'galaxy-tab', name: 'Galaxy Tab', group: 'Планшеты', width: 800, height: 1280 },
  { id: 'responsive', name: 'По окну', group: 'Браузер', width: 0, height: 0 },
].map(Object.freeze));

const DEFAULT_DEVICE = 'iphone-14';
const HOST_PARAMETERS = ['preview', 'previewDevice', 'previewOrientation', 'previewZoom'];

export function isNativeDevice({ maxTouchPoints = 0, coarse = false, hoverFine = false } = {}) {
  return Number(maxTouchPoints) > 1 || Boolean(coarse) || !hoverFine;
}

export function resolvePreviewMode(search = '', capabilities = {}) {
  const override = new URLSearchParams(search).get('preview');
  if (override === '1') return 'preview';
  if (override === '0') return 'native';
  return isNativeDevice(capabilities) ? 'native' : 'preview';
}

export function resolveDevice(id) {
  return PRESETS.find((preset) => preset.id === id)
    || PRESETS.find((preset) => preset.id === DEFAULT_DEVICE);
}

function positive(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function computePreviewLayout({
  deviceId = DEFAULT_DEVICE,
  orientation = 'portrait',
  zoom = 'fit',
  stageWidth = 0,
  stageHeight = 0,
  padding = 24,
} = {}) {
  const preset = resolveDevice(deviceId);
  const inset = Number.isFinite(Number(padding)) ? Math.max(0, Number(padding)) : 24;
  const availableWidth = Math.max(1, positive(stageWidth) - inset * 2);
  const availableHeight = Math.max(1, positive(stageHeight) - inset * 2);
  let width = preset.width;
  let height = preset.height;
  if (preset.id === 'responsive') {
    width = Math.max(1, Math.floor(availableWidth));
    height = Math.max(1, Math.floor(availableHeight));
  } else if (orientation === 'landscape') {
    [width, height] = [height, width];
  }
  const scale = zoom === '100' || preset.id === 'responsive'
    ? 1
    : Math.min(1, availableWidth / width, availableHeight / height);
  return { width, height, scale, displayWidth: width * scale, displayHeight: height * scale };
}

export function appLocation(href) {
  const current = new URL(href);
  const target = new URL('./app.html', current);
  target.search = current.search;
  target.hash = current.hash;
  for (const parameter of HOST_PARAMETERS) target.searchParams.delete(parameter);
  return target.href;
}

function boot() {
  const media = (query) => Boolean(window.matchMedia?.(query).matches);
  const mode = resolvePreviewMode(window.location.search, {
    maxTouchPoints: navigator.maxTouchPoints,
    coarse: media('(pointer: coarse)'),
    hoverFine: media('(hover: hover) and (pointer: fine)'),
  });
  const target = appLocation(window.location.href);
  if (mode === 'native') {
    window.location.replace(target);
    return;
  }

  const select = document.getElementById('preview-device');
  const rotate = document.getElementById('preview-rotate');
  const orientationLabel = document.getElementById('preview-orientation');
  const fit = document.getElementById('preview-fit');
  const actual = document.getElementById('preview-actual');
  const stage = document.getElementById('preview-stage');
  const artboard = document.getElementById('preview-artboard');
  const frame = document.getElementById('preview-frame');
  const readout = document.getElementById('preview-readout');
  const status = document.getElementById('preview-status');
  const statusText = document.getElementById('preview-status-text');
  const retry = document.getElementById('preview-retry');
  if (!select || !rotate || !orientationLabel || !fit || !actual || !stage || !artboard || !frame || !readout || !status || !statusText || !retry) return;

  const parameters = new URLSearchParams(window.location.search);
  const state = {
    deviceId: resolveDevice(parameters.get('previewDevice')).id,
    orientation: parameters.get('previewOrientation') === 'landscape' ? 'landscape' : 'portrait',
    zoom: parameters.get('previewZoom') === '100' ? '100' : 'fit',
  };

  function render() {
    const layout = computePreviewLayout({
      ...state,
      stageWidth: stage.clientWidth,
      stageHeight: stage.clientHeight,
    });
    const responsive = state.deviceId === 'responsive';
    select.value = state.deviceId;
    rotate.disabled = responsive;
    rotate.setAttribute('aria-pressed', String(state.orientation === 'landscape'));
    orientationLabel.textContent = state.orientation === 'landscape' ? 'Альбомная' : 'Книжная';
    fit.setAttribute('aria-pressed', String(state.zoom === 'fit'));
    actual.setAttribute('aria-pressed', String(state.zoom === '100'));
    artboard.style.width = `${layout.displayWidth}px`;
    artboard.style.height = `${layout.displayHeight}px`;
    frame.style.width = `${layout.width}px`;
    frame.style.height = `${layout.height}px`;
    frame.style.transform = `scale(${layout.scale})`;
    readout.textContent = `${layout.width} × ${layout.height} · ${Math.round(layout.scale * 100)}%`;
  }

  function change(patch) {
    Object.assign(state, patch);
    render();
    stage.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    const current = new URL(window.location.href);
    current.searchParams.set('previewDevice', state.deviceId);
    current.searchParams.set('previewOrientation', state.orientation);
    current.searchParams.set('previewZoom', state.zoom);
    window.history.replaceState(window.history.state, '', current);
  }

  select.addEventListener('change', () => change({ deviceId: resolveDevice(select.value).id }));
  rotate.addEventListener('click', () => change({
    orientation: state.orientation === 'portrait' ? 'landscape' : 'portrait',
  }));
  fit.addEventListener('click', () => change({ zoom: 'fit' }));
  actual.addEventListener('click', () => change({ zoom: '100' }));
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(render) : null;
  let watching = false;
  let readyTimer;
  let readinessDeadline;
  let awaitingReady = false;
  function startWatching() {
    if (watching) return;
    watching = true;
    window.addEventListener('resize', render);
    observer?.observe(stage);
  }
  function pauseWatching() {
    watching = false;
    window.clearTimeout(readyTimer);
    observer?.disconnect();
    window.removeEventListener('resize', render);
  }
  function checkReady() {
    window.clearTimeout(readyTimer);
    if (!watching || !awaitingReady) return;
    let ready = false;
    try {
      ready = Boolean(frame.contentDocument?.querySelector('[data-zamer-app-stage]'));
    } catch {
      // A failed navigation can leave a browser-owned error page in the frame.
    }
    if (ready) {
      awaitingReady = false;
      status.hidden = true;
    } else if (Date.now() < readinessDeadline) {
      readyTimer = window.setTimeout(checkReady, 100);
    } else {
      awaitingReady = false;
      status.hidden = false;
      statusText.textContent = 'Не удалось загрузить приложение';
      retry.hidden = false;
    }
  }
  function loadApp() {
    status.hidden = false;
    statusText.textContent = 'Загружаем приложение…';
    retry.hidden = true;
    awaitingReady = true;
    readinessDeadline = Date.now() + 15000;
    // Resizing never calls this function: the app keeps its route, form, and draft.
    frame.src = target;
    checkReady();
  }
  frame.addEventListener('load', checkReady);
  retry.addEventListener('click', loadApp);
  window.addEventListener('pagehide', pauseWatching);
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    startWatching();
    render();
    if (awaitingReady) {
      readinessDeadline = Date.now() + 15000;
      checkReady();
    }
  });

  document.documentElement.dataset.previewMode = 'preview';
  startWatching();
  render();
  loadApp();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') boot();
