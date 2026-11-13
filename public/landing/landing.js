const billingButtons = [...document.querySelectorAll('[data-billing]')];
const billingSwitch = document.querySelector('.billing-switch');
const billingReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const billingPrice = document.querySelector('#plan-price');
const billingAccessible = document.querySelector('#plan-price-accessible');
const billingDisplay = document.querySelector('#plan-price-display');
const billingNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
let billingPeriod = null;
let billingFrame = 0;
let displayedBillingPrice = null;
let targetBillingPrice = 0;

function finishBillingCount() {
  if (billingFrame) window.cancelAnimationFrame(billingFrame);
  billingFrame = 0;
  displayedBillingPrice = targetBillingPrice;
  if (billingDisplay) billingDisplay.textContent = billingNumber.format(targetBillingPrice);
  else if (billingPrice) billingPrice.textContent = billingNumber.format(targetBillingPrice);
  billingPrice?.classList.remove('is-counting');
}

function renderBillingPrice(amount) {
  if (billingAccessible) billingAccessible.textContent = billingNumber.format(amount);
  const previousTarget = targetBillingPrice;
  targetBillingPrice = amount;
  if (displayedBillingPrice === null || !billingDisplay || billingReducedMotion.matches || document.hidden) {
    finishBillingCount();
    return;
  }
  if (amount === previousTarget) return;
  if (billingFrame) window.cancelAnimationFrame(billingFrame);
  const from = displayedBillingPrice;
  const started = window.performance.now();
  billingPrice?.classList.add('is-counting');
  const step = (now) => {
    const progress = Math.min(1, Math.max(0, (now - started) / 400));
    displayedBillingPrice = from + (amount - from) * (1 - (1 - progress) ** 3);
    billingDisplay.textContent = billingNumber.format(Math.round(displayedBillingPrice));
    if (progress < 1) billingFrame = window.requestAnimationFrame(step);
    else finishBillingCount();
  };
  billingFrame = window.requestAnimationFrame(step);
}

function selectBilling(period) {
  const firstPaint = billingPeriod === null;
  billingPeriod = period;
  const yearly = period === 'year';
  const label = document.querySelector('#plan-period');
  const note = document.querySelector('#billing-note');
  const saving = document.querySelector('#annual-saving');
  renderBillingPrice(yearly ? 4000 : 500);
  if (label) label.textContent = yearly ? '₽ / год' : '₽ / месяц';
  if (note) note.textContent = yearly ? '333 ₽ в месяц при оплате за год' : 'Оплата каждый месяц';
  if (saving) saving.hidden = !yearly;
  billingButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.billing === period)));
  if (billingSwitch) {
    if (firstPaint) billingSwitch.classList.add('is-initializing');
    billingSwitch.classList.toggle('is-yearly', yearly);
    billingSwitch.classList.add('is-enhanced');
    if (firstPaint) {
      billingSwitch.getBoundingClientRect();
      window.requestAnimationFrame(() => billingSwitch.classList.remove('is-initializing'));
    }
  }
}

billingButtons.forEach((button) => {
  button.addEventListener('click', () => selectBilling(button.dataset.billing));
});
billingReducedMotion.addEventListener('change', finishBillingCount);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) finishBillingCount();
});
selectBilling('year');

const menuToggle = document.querySelector('#menu-toggle');
const mainNav = document.querySelector('#main-nav');

function closeMenu() {
  if (!mainNav || !menuToggle) return;
  mainNav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mainNav.classList.contains('is-open')) {
      closeMenu();
      menuToggle.focus();
    }
  });
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const revealElements = [...document.querySelectorAll('[data-reveal]')];
const blueprintScenes = [...document.querySelectorAll('[data-blueprint-scene]')];
let revealObserver = null;
let blueprintObserver = null;
let cleanupBlueprintSpotlights = () => {};

function revealElement(element) {
  element.classList.add('is-visible');
  revealObserver?.unobserve(element);
}

function configureReveals() {
  revealObserver?.disconnect();
  revealObserver = null;
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealElements.forEach(revealElement);
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // Only arm the effect after the browser has observed the element.
      entry.target.classList.add('reveal-ready');
      if (entry.isIntersecting) revealElement(entry.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px -32px 0px' });
  revealElements.filter((element) => !element.classList.contains('is-visible'))
    .forEach((element) => revealObserver.observe(element));
}

function configureBlueprintScenes() {
  blueprintObserver?.disconnect();
  blueprintObserver = null;
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    blueprintScenes.forEach((scene) => scene.classList.add('is-drawn', 'blueprint-static'));
    return;
  }
  const pendingScenes = new Set(blueprintScenes.filter((scene) => !scene.classList.contains('is-drawn')));
  if (!pendingScenes.size) return;
  blueprintObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-drawn');
      observer.unobserve(entry.target);
      pendingScenes.delete(entry.target);
    });
    if (!pendingScenes.size) {
      observer.disconnect();
      if (blueprintObserver === observer) blueprintObserver = null;
    }
  }, { threshold: 0, rootMargin: '0px 0px -80px 0px' });
  pendingScenes.forEach((scene) => blueprintObserver.observe(scene));
}

function configureBlueprintSpotlights() {
  cleanupBlueprintSpotlights();
  cleanupBlueprintSpotlights = () => {};
  if (reducedMotion.matches || !finePointer.matches || !('IntersectionObserver' in window)) return;
  const clearScenes = new Map();
  const cleanups = [];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) clearScenes.get(entry.target)?.();
    });
  });
  const clearAll = () => clearScenes.forEach((clear) => clear());
  const onVisibilityChange = () => { if (document.hidden) clearAll(); };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', clearAll);

  blueprintScenes.filter((scene) => scene.matches('.hero, .closing-section')).forEach((scene) => {
    const artwork = scene.querySelector(':scope > svg.blueprint-art');
    if (!artwork) return;
    const spotlight = document.createElement('div');
    spotlight.className = 'blueprint-spotlight';
    spotlight.setAttribute('aria-hidden', 'true');
    const litArtwork = artwork.cloneNode(true);
    litArtwork.removeAttribute('id');
    litArtwork.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    litArtwork.classList.add('blueprint-spotlight-art');
    spotlight.append(litArtwork);
    scene.insertBefore(spotlight, scene.querySelector(':scope > .container'));
    scene.classList.add('has-blueprint-spotlight');

    let frame = 0;
    let clientX = 0;
    let clientY = 0;
    const clear = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      scene.classList.remove('is-pointer-lit');
    };
    const move = (event) => {
      if (event.pointerType === 'touch' || document.hidden) return;
      clientX = event.clientX;
      clientY = event.clientY;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const bounds = scene.getBoundingClientRect();
        scene.style.setProperty('--spotlight-x', `${clientX - bounds.left}px`);
        scene.style.setProperty('--spotlight-y', `${clientY - bounds.top}px`);
        scene.classList.add('is-pointer-lit');
      });
    };
    scene.addEventListener('pointerenter', move);
    scene.addEventListener('pointermove', move);
    scene.addEventListener('pointerleave', clear);
    scene.addEventListener('pointercancel', clear);
    clearScenes.set(scene, clear);
    observer.observe(scene);
    cleanups.push(() => {
      clear();
      scene.removeEventListener('pointerenter', move);
      scene.removeEventListener('pointermove', move);
      scene.removeEventListener('pointerleave', clear);
      scene.removeEventListener('pointercancel', clear);
      scene.classList.remove('has-blueprint-spotlight');
      scene.style.removeProperty('--spotlight-x');
      scene.style.removeProperty('--spotlight-y');
      spotlight.remove();
    });
  });

  cleanupBlueprintSpotlights = () => {
    observer.disconnect();
    cleanups.forEach((cleanup) => cleanup());
    clearScenes.clear();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', clearAll);
  };
}

document.addEventListener('focusin', (event) => {
  if (!(event.target instanceof Element)) return;
  let element = event.target.closest('[data-reveal]');
  while (element) {
    revealElement(element);
    element = element.parentElement?.closest('[data-reveal]');
  }
});

reducedMotion.addEventListener('change', configureReveals);
reducedMotion.addEventListener('change', configureBlueprintScenes);
reducedMotion.addEventListener('change', configureBlueprintSpotlights);
finePointer.addEventListener('change', configureBlueprintSpotlights);
configureReveals();
configureBlueprintScenes();
configureBlueprintSpotlights();

const siteHeader = document.querySelector('.site-header');
if (siteHeader) {
  let progressFrame = 0;
  let previousProgress = -1;
  const updateReadingProgress = () => {
    progressFrame = 0;
    if (document.hidden) return;
    const page = document.scrollingElement || document.documentElement;
    const distance = page.scrollHeight - page.clientHeight;
    const progress = distance > 0 ? Math.max(0, Math.min(1, page.scrollTop / distance)) : 0;
    if (progress === previousProgress) return;
    previousProgress = progress;
    siteHeader.style.setProperty('--page-progress', String(progress));
  };
  const scheduleReadingProgress = () => {
    if (!progressFrame && !document.hidden) progressFrame = window.requestAnimationFrame(updateReadingProgress);
  };
  window.addEventListener('scroll', scheduleReadingProgress, { passive: true });
  window.addEventListener('resize', scheduleReadingProgress, { passive: true });
  window.addEventListener('pageshow', scheduleReadingProgress);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (progressFrame) window.cancelAnimationFrame(progressFrame);
      progressFrame = 0;
    } else scheduleReadingProgress();
  });
  if ('ResizeObserver' in window) {
    const pageResizeObserver = new ResizeObserver(scheduleReadingProgress);
    pageResizeObserver.observe(document.body);
  }
  scheduleReadingProgress();
}
