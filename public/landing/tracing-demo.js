const tracingDemo = document.querySelector('#tracing');

if (tracingDemo) {
  const elements = Object.fromEntries([
    ['start', 'trace-start'],
    ['count', 'trace-count'],
    ['message', 'trace-message'],
    ['line', 'trace-active-line'],
    ['points', 'trace-active-points'],
    ['cursor', 'trace-cursor'],
    ['stage', 'trace-stage'],
    ['name', 'trace-room-name'],
    ['add', 'trace-add-room'],
    ['editor', 'trace-room-editor'],
    ['list', 'trace-added-rooms'],
    ['restart', 'trace-restart'],
    ['skip', 'trace-skip'],
    ['progress', 'trace-progressbar'],
  ].map(([key, id]) => [key, tracingDemo.querySelector(`#${id}`)]));

  if (Object.values(elements).every(Boolean)) initializeTracingDemo(elements);
}

function initializeTracingDemo(ui) {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const areaFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
  const roomElements = [...tracingDemo.querySelectorAll('[data-trace-room]')];
  const rooms = [
    { name: 'Кабинет', area: 12.4, points: [[55, 45], [145, 45], [145, 205], [55, 205]] },
    { name: 'Детская', area: 11.8, points: [[155, 45], [245, 45], [245, 205], [155, 205]] },
    { name: 'Гостиная', area: 22.6, points: [[255, 45], [395, 45], [395, 205], [255, 205]] },
    { name: 'Гардеробная', area: 8.2, points: [[405, 45], [485, 45], [485, 205], [405, 205]] },
    { name: 'Спальня', area: 10.5, points: [[495, 45], [585, 45], [585, 205], [495, 205]] },
    { name: 'Кухня', area: 9.6, points: [[55, 215], [245, 215], [245, 295], [55, 295]] },
    { name: 'Столовая', area: 9.2, points: [[55, 305], [245, 305], [245, 385], [55, 385]] },
    { name: 'Коридор', area: 18.4, points: [[255, 215], [395, 215], [395, 385], [255, 385]] },
    { name: 'Ванная', area: 9, points: [[405, 215], [585, 215], [585, 295], [405, 295]] },
    { name: 'Прихожая', area: 8.8, points: [[405, 305], [585, 305], [585, 385], [405, 385]] },
  ];

  if (roomElements.length !== rooms.length) return;

  let state = 'idle';
  let generation = 0;
  let steps = [];
  let nextStep = 0;
  let pendingDelay = null;
  let cursorMotion = null;
  let activePoints = [];

  function hide(element, hidden) {
    element.toggleAttribute('hidden', hidden);
  }

  function updateButtons() {
    const labels = {
      idle: 'Посмотреть обводку',
      running: 'Пауза',
      paused: 'Продолжить обводку',
      done: 'Повторить обводку',
    };
    ui.start.textContent = labels[state];
    ui.start.dataset.state = state;
    hide(ui.restart, state === 'idle');
    hide(ui.skip, state === 'idle' || state === 'done');
    tracingDemo.classList.toggle('is-paused', state === 'paused');
  }

  function cancelTimer() {
    if (pendingDelay?.timer != null) window.clearTimeout(pendingDelay.timer);
    pendingDelay = null;
  }

  function clearActiveDrawing() {
    activePoints = [];
    ui.line.setAttribute('points', '');
    ui.points.replaceChildren();
    hide(ui.cursor, true);
    hide(ui.editor, true);
    ui.name.value = '';
    ui.add.textContent = 'Добавить помещение';
    ui.add.classList.remove('is-confirming');
    cursorMotion = null;
  }

  function updateProgress(count) {
    ui.count.textContent = `${count} из ${rooms.length}`;
    ui.progress.max = rooms.length;
    ui.progress.value = count;
  }

  function appendRoom(room) {
    const item = document.createElement('li');
    item.className = 'trace-room-item';
    const check = document.createElementNS(svgNamespace, 'svg');
    check.setAttribute('class', 'icon');
    check.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svgNamespace, 'use');
    use.setAttribute('href', '#i-check');
    check.append(use);
    const name = document.createElement('span');
    name.className = 'trace-room-title';
    name.textContent = room.name;
    const area = document.createElement('span');
    area.className = 'trace-room-area';
    area.textContent = `${areaFormat.format(room.area)} м²`;
    item.append(check, name, area);
    ui.list.append(item);
    ui.list.scrollTop = ui.list.scrollHeight;
  }

  function reset() {
    generation += 1;
    cancelTimer();
    state = 'idle';
    nextStep = 0;
    steps = [];
    clearActiveDrawing();
    ui.list.replaceChildren();
    roomElements.forEach((room) => room.classList.remove('is-drawing', 'is-traced'));
    updateProgress(0);
    ui.stage.textContent = 'Точки → контур → название → помещение';
    ui.message.textContent = 'Посмотрите, как помещения появляются в проекте по одному.';
    updateButtons();
  }

  function finish(showAll = false) {
    generation += 1;
    cancelTimer();
    if (showAll) {
      ui.list.replaceChildren();
      rooms.forEach(appendRoom);
      roomElements.forEach((room) => {
        room.classList.remove('is-drawing');
        room.classList.add('is-traced');
      });
    }
    clearActiveDrawing();
    state = 'done';
    updateProgress(rooms.length);
    ui.stage.textContent = 'Все помещения добавлены';
    ui.message.textContent = `${rooms.length} потолков готовы к расчёту. Это демонстрационный план.`;
    updateButtons();
  }

  function moveCursor(point, duration = 500) {
    const target = `translate(${point[0]}px, ${point[1]}px)`;
    hide(ui.cursor, false);
    ui.cursor.style.transition = `transform ${duration}ms ease-in-out`;
    ui.cursor.style.transform = target;
    cursorMotion = { target };
  }

  function placePoint(point) {
    cursorMotion = null;
    activePoints.push(point);
    ui.line.setAttribute('points', activePoints.map((value) => value.join(',')).join(' '));
    const circle = document.createElementNS(svgNamespace, 'circle');
    circle.setAttribute('class', 'trace-vertex');
    circle.setAttribute('cx', point[0]);
    circle.setAttribute('cy', point[1]);
    circle.setAttribute('r', '4.5');
    ui.points.append(circle);
  }

  function buildSteps() {
    const sequence = [];
    const add = (run, delay) => sequence.push({ run, delay });
    rooms.forEach((room, roomIndex) => {
      add(() => {
        clearActiveDrawing();
        ui.stage.textContent = `Помещение ${roomIndex + 1} · Ставим точки`;
        ui.message.textContent = `Обводим помещение: ${room.name.toLowerCase()}.`;
        ui.cursor.style.transition = 'none';
        ui.cursor.style.transform = `translate(${room.points[0][0]}px, ${room.points[0][1]}px)`;
      }, 300);

      room.points.forEach((point, pointIndex) => {
        add(() => {
          ui.stage.textContent = `${room.name} · Точка ${pointIndex + 1} из ${room.points.length}`;
          moveCursor(point);
        }, 500);
        add(() => placePoint(point), 150);
      });

      add(() => {
        ui.stage.textContent = `${room.name} · Замыкаем контур`;
        moveCursor(room.points[0]);
      }, 500);
      add(() => {
        cursorMotion = null;
        ui.line.setAttribute('points', [...activePoints, activePoints[0]].map((point) => point.join(',')).join(' '));
        roomElements[roomIndex].classList.add('is-drawing');
        ui.message.textContent = `Контур замкнут. Вводим название помещения.`;
        hide(ui.cursor, true);
      }, 650);
      add(() => {
        ui.stage.textContent = `${room.name} · Название помещения`;
        hide(ui.editor, false);
      }, 500);
      [...room.name].forEach((_, letterIndex) => {
        add(() => { ui.name.value = room.name.slice(0, letterIndex + 1); }, 100);
      });
      add(() => { ui.stage.textContent = `${room.name} · Добавляем в проект`; }, 500);
      add(() => { ui.add.classList.add('is-confirming'); }, 500);
      add(() => {
        roomElements[roomIndex].classList.remove('is-drawing');
        roomElements[roomIndex].classList.add('is-traced');
        appendRoom(room);
        updateProgress(roomIndex + 1);
        ui.add.textContent = 'Помещение добавлено';
        ui.stage.textContent = `Помещение «${room.name}» добавлено`;
        ui.message.textContent = `Добавлено помещение «${room.name}». ${roomIndex + 1} из ${rooms.length}.`;
      }, 650);
    });
    return sequence;
  }

  function schedule(delay) {
    const token = generation;
    const remaining = Math.max(0, delay);
    pendingDelay = { remaining, startedAt: performance.now(), timer: null };
    pendingDelay.timer = window.setTimeout(() => {
      if (generation !== token || state !== 'running') return;
      pendingDelay = null;
      advance();
    }, remaining);
  }

  function advance() {
    if (state !== 'running') return;
    const step = steps[nextStep];
    if (!step) {
      finish();
      return;
    }
    nextStep += 1;
    step.run();
    schedule(step.delay);
  }

  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    if (pendingDelay) {
      window.clearTimeout(pendingDelay.timer);
      pendingDelay.remaining = Math.max(0, pendingDelay.remaining - (performance.now() - pendingDelay.startedAt));
      pendingDelay.timer = null;
    }
    if (cursorMotion) {
      const currentTransform = window.getComputedStyle(ui.cursor).transform;
      ui.cursor.style.transition = 'none';
      ui.cursor.style.transform = currentTransform;
    }
    ui.message.textContent = 'Пауза. Нажмите «Продолжить обводку», чтобы продолжить с этого шага.';
    updateButtons();
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'running';
    const remaining = pendingDelay?.remaining ?? 0;
    if (cursorMotion) {
      ui.cursor.style.transition = `transform ${remaining}ms ease-in-out`;
      ui.cursor.style.transform = cursorMotion.target;
    }
    ui.message.textContent = 'Продолжаем обводку с сохранённого шага.';
    updateButtons();
    schedule(remaining);
  }

  function start() {
    reset();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish(true);
      return;
    }
    state = 'running';
    steps = buildSteps();
    updateButtons();
    advance();
  }

  ui.start.addEventListener('click', () => {
    if (state === 'running') pause();
    else if (state === 'paused') resume();
    else start();
  });
  ui.restart.addEventListener('click', start);
  ui.skip.addEventListener('click', () => finish(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  reset();
}
