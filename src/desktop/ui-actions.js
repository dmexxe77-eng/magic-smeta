import { desktopToday } from './engine-base.js';

/** A project transition must never reuse a room belonging to another project. */
export function openProjectCalculation(engine, view = 'calc') {
  const project = engine.cur();
  if (!project) return;
  const room = project.rooms.find(item => item.id === engine.state.tab) || project.rooms[0];
  if (!room && view !== 'estimate') {
    engine.go('addRoom', { tab:null, desktopView:null });
    return;
  }
  engine.go('calc', { tab:room?.id || null, desktopView:view });
}

export function projectValues(engine) {
  const previous = engine.state;
  try {
    engine.state = { ...previous, screen:'project' };
    return engine.projectVals();
  } finally {
    engine.state = previous;
  }
}

/** Global navigation discards an uncommitted preset transaction before proceeding. */
export function goSection(engine, screen, extra) {
  if (engine._presetDraft) engine.finishPresetDraft(false);
  engine.go(screen, { drawingSession:null, ...extra });
}

/** The desktop owns navigation; the shared editor keeps the unsaved geometry draft. */
export function openDrawingWorkspace(engine, room) {
  const project = engine.cur();
  if (!project) return;
  const existing = room ? project.rooms.find(item => item.id === room.id) : null;
  if (room && !existing) {
    engine.toast('Помещение не найдено в этом проекте');
    return;
  }
  const previous = engine.state;
  const session = {
    id:globalThis.crypto.randomUUID(), projectId:project.id, roomId:existing?.id || null,
    roomName:existing?.name || `Помещение ${project.rooms.length + 1}`,
    initial:existing ? JSON.parse(JSON.stringify({ verts:existing.v, holes:existing.holes || [], draw:existing.draw || null })) : null,
    returnTo:{ screen:previous.screen, tab:previous.tab || null, desktopView:previous.desktopView || null },
  };
  engine.go('drawing', { drawingSession:session, sheet:null, fin:null });
}

export function cancelDrawingWorkspace(engine, session) {
  if (engine.state.drawingSession?.id !== session.id) return;
  const project = engine.state.projects.find(item => item.id === session.projectId);
  if (!project) return engine.go('home', {drawingSession:null, curId:null, tab:null});
  const target = session.returnTo || {screen:project.rooms.length ? 'calc' : 'addRoom', tab:project.rooms[0]?.id || null};
  engine.go(target.screen, {curId:project.id, tab:target.tab, desktopView:target.desktopView, drawingSession:null});
}

/** Commit one completed editor result without replacing room options or presets. */
export function finishDrawingWorkspace(engine, session, result, createRoom) {
  if (engine.state.screen !== 'drawing' || engine.state.drawingSession?.id !== session.id) return false;
  const project = engine.state.projects.find(item => item.id === session.projectId);
  if (!project || (session.roomId && !project.rooms.some(room => room.id === session.roomId))) {
    engine.toast('Проект или помещение больше не существует');
    return false;
  }
  const geometry = { name:result.name, v:result.verts, holes:result.holes?.length ? result.holes : undefined, draw:result.draw || null };
  let roomId = session.roomId;
  if (roomId) engine.upd(project.id, item => ({...item, rooms:item.rooms.map(room => room.id === roomId ? {...room, ...geometry} : room)}));
  else {
    const room = {...createRoom(result.name, result.verts), ...geometry};
    roomId = room.id;
    engine.upd(project.id, item => ({...item, rooms:[...item.rooms, room], status:item.status === 'order' ? 'estimate' : item.status}));
  }
  engine.go('calc', {curId:project.id, tab:roomId, desktopView:'calc', drawingSession:null});
  engine.toast(session.roomId ? 'Контур обновлён' : `${result.name} добавлено`);
  return true;
}

/** Reconcile only a schedule the operator just changed, preserving imported statuses. */
export function reconcileInstallationStatus(engine, projectId, today = desktopToday()) {
  const project = engine.state.projects.find(item => item.id === projectId);
  if (!project || !['contract', 'install'].includes(project.status)) return;
  const first = engine.installStart(project);
  const status = first && first <= today ? 'install' : 'contract';
  if (status !== project.status) engine.upd(projectId, item => ({ ...item, status }));
}
