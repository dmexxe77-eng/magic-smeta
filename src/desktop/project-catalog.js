import {nomImage, resolveNom} from './nomenclature-identity.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && value.length > 0 || Number.isFinite(value);
const safeBlockId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value)
  && !['__proto__', 'constructor', 'prototype'].includes(value);
const position = value => record(value) && typeof value.n === 'string' && typeof value.u === 'string'
  && Number.isFinite(value.p) && value.p >= 0;
const rowKey = row => row?.nid ?? row?.nomId ?? row?.n;
const referenceKey = value => record(value) ? value.nid ?? value.nomId ?? value.id ?? value.n : value;
const sameRow = (row, reference) => rowKey(row) === referenceKey(reference);
function cloneData(value, omitted) {
  const ancestors = new WeakSet();
  const copy = (item, key = '') => {
    if (item !== null && typeof item === 'object' && typeof item.toJSON === 'function') item = item.toJSON(key);
    if (typeof item === 'bigint') throw new TypeError('Cannot clone BigInt project data');
    if (typeof item === 'number') return Number.isFinite(item) ? item : null;
    if (typeof item === 'undefined' || typeof item === 'function' || typeof item === 'symbol') return undefined;
    if (item === null || typeof item !== 'object') return item;
    if (ancestors.has(item)) throw new TypeError('Cannot clone circular project data');
    ancestors.add(item);
    let result;
    if (Array.isArray(item)) result = Array.from({length:item.length}, (_,index) => copy(item[index],String(index)) ?? null);
    else {
      result = {};
      for (const name of Object.keys(item)) {
        if (omitted?.has(name)) continue;
        const child = copy(item[name],name);
        if (child !== undefined) Object.defineProperty(result,name,{value:child,enumerable:true,writable:true,configurable:true});
      }
    }
    ancestors.delete(item);
    return result;
  };
  return copy(value);
}

/** Copy editable JSON-shaped objects without serializing repeated, immutable image strings. */
export function cloneProjectData(value) { return cloneData(value); }
const clone = cloneProjectData;
// Calculations retain a ready photograph, while editing originals remain in the global catalogue.
const editingPhotoFields = new Set(['photoSource','photoCrop']);
const catalogClone = value => cloneData(value,editingPhotoFields);
const instances = (room, block) => Array.isArray(room?.[block.id]) ? room[block.id]
  : record(room?.[block.id]) ? [room[block.id]] : [];
const eachRow = (preset, visit) => (preset?.items || []).forEach(row => {
  visit(row);
  (row.variants || []).forEach(visit);
});
const presetPosition = value => position(value) && (value.variants == null
  || Array.isArray(value.variants) && value.variants.every(position));
const validPreset = value => record(value) && value.version === 1 && Array.isArray(value.items)
  && value.items.every(presetPosition) && (value.missing === true || identifier(value.id) && typeof value.name === 'string');

function validRoomCatalog(value) {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.blocks) || !Array.isArray(value.roomOpts)) return false;
  if (value.capturedAt != null && (!Number.isFinite(value.capturedAt) || value.capturedAt < 0)
    || value.legacyUnits != null && (!record(value.legacyUnits)
      || !Object.values(value.legacyUnits).every(unit => typeof unit === 'string' && unit.length > 0))) return false;
  const ids = new Set();
  for (const block of value.blocks) {
    if (!record(block) || !safeBlockId(block.id) || ids.has(block.id) || typeof block.title !== 'string'
      || block.single != null && typeof block.single !== 'boolean'
      || ['canvas','main'].includes(block.id) && block.single !== true
      || block.source != null && !['area','perim','manual'].includes(block.source)
      || block.unit != null && (typeof block.unit !== 'string' || !block.unit.length)) return false;
    ids.add(block.id);
  }
  return ids.has('canvas') && ids.has('main')
    && value.roomOpts.every(option => position(option) && identifier(option.id))
    && new Set(value.roomOpts.map(option => option.id)).size === value.roomOpts.length;
}

function photoRow(row, nomenclature = []) {
  if (row._photoFrozen) return catalogClone(row);
  const source = resolveNom(nomenclature, row?.nid || row?.nomId ? {nid:row.nid ?? row.nomId} : row?.n);
  const photoRemoved = source?.photoRemoved ?? row.photoRemoved;
  const img = photoRemoved ? undefined : nomImage(source) || nomImage(row) || row.img;
  return {...catalogClone(row), img, imageUrl:img, photoRemoved:!!photoRemoved, _photoFrozen:true};
}

function freezePreset(preset, instance, library) {
  if (!preset) return {version:1,id:instance.pid ?? instance.btnId ?? null,name:'',items:[],missing:true};
  const frozen = catalogClone(preset);
  frozen.version = 1;
  frozen.items = frozen.items.map(row => {
    const next = photoRow(row,library.nom);
    if (row.variants) next.variants = row.variants.map(option => photoRow(option,library.nom));
    return next;
  });
  return frozen;
}

/** A new selection captures the current assembly, independently of equal preset IDs elsewhere. */
export function captureInstancePreset(instance, bid, library) {
  const pid = instance?.pid ?? instance?.btnId;
  const preset = library.presets?.[bid]?.find(item => item.id === pid);
  return {...clone(instance),presetSnapshot:freezePreset(preset,instance,library)};
}

/** Freeze room definitions and existing instances without refreshing any previously captured data. */
export function captureRoomCatalog(room, library) {
  const next = clone(room);
  const initial = !validRoomCatalog(next.catalogSnapshot);
  if (initial) next.catalogSnapshot = {
    version:1,blocks:catalogClone(library.blocks || []),roomOpts:(library.roomOpts || []).map(option => photoRow(option,library.nom)),
    capturedAt:Date.now(),
  };
  for (const block of next.catalogSnapshot.blocks) {
    const capture = instance => validPreset(instance.presetSnapshot) ? instance : captureInstancePreset(instance,block.id,library);
    if (Array.isArray(next[block.id])) next[block.id] = next[block.id].map(capture);
    else if (record(next[block.id])) next[block.id] = capture(next[block.id]);
  }
  if (next.extraItems) next.extraItems = next.extraItems.map(item => photoRow(item,library.nom));
  if (initial) {
    const units = new Map(), remember = row => {
      const key = rowKey(row);
      if (key == null) return;
      for (const name of [String(key),`${key}|${next.id}`]) if (!units.has(name)) units.set(name,row.u);
    };
    for (const block of next.catalogSnapshot.blocks) for (const instance of instances(next,block)) eachRow(instance.presetSnapshot,remember);
    next.catalogSnapshot.roomOpts.forEach(remember);
    (next.extraItems || []).forEach(remember);
    next.catalogSnapshot.legacyUnits = Object.fromEntries(units);
    if (next.estEd) next.estEd = bindEstimateOverrideUnits(next.estEd,next.catalogSnapshot.legacyUnits);
  }
  return next;
}

/** Migration is additive: an old calculation never adopts library edits merely by being opened. */
export function captureProjectCatalog(project, library) {
  return {...clone(project),calculationSnapshotVersion:1,rooms:(project.rooms || []).map(room => captureRoomCatalog(room,library))};
}

export function ensureProjectCatalog(project, library) {
  return validProjectCalculation(project) ? project : captureProjectCatalog(project,library);
}

export function blocksForRoom(room, library = {}) {
  return validRoomCatalog(room?.catalogSnapshot) ? room.catalogSnapshot.blocks : library.blocks || [];
}

export function optionsForRoom(room, library = {}) {
  return validRoomCatalog(room?.catalogSnapshot) ? room.catalogSnapshot.roomOpts : library.roomOpts || [];
}

export function presetForInstance(instance, bid, library = {}) {
  return validPreset(instance?.presetSnapshot) ? instance.presetSnapshot
    : library.presets?.[bid]?.find(preset => preset.id === (instance?.pid ?? instance?.btnId));
}

function currentPosition(row, item, bid) {
  const updated = {...row};
  for (const field of ['n','p','u','m','category','cv','mult','pInst','pCost','br','note','imageUrl','img','photoRemoved']) {
    if (Object.hasOwn(item,field)) updated[field] = clone(item[field]);
    else delete updated[field];
  }
  if (item.m && item.category !== 'equipment' && (item.cv || row.cv || !row.nid && row.m && bid === 'canvas')) updated.cv = 1;
  if (item.nid != null || item.id != null) updated.nid = referenceKey(item);
  if (!item._unresolved) delete updated._unresolved;
  delete updated._photoFrozen;
  return photoRow(updated,[item]);
}

function allProjectRows(project, visit) {
  for (const room of project.rooms || []) {
    for (const block of blocksForRoom(room)) for (const instance of instances(room,block)) eachRow(instance.presetSnapshot,visit);
    optionsForRoom(room).forEach(visit);
    (room.extraItems || []).forEach(visit);
  }
}

/** Keys are exported for the engine's project-level estimate override map. */
export function projectNomPriceKeys(project, reference) {
  const keys = new Set();
  allProjectRows(project,row => {if (sameRow(row,reference)) keys.add(String(rowKey(row)));});
  return keys;
}

export function projectPresetPriceKeys(project, bid, pid, nextPreset) {
  const keys = new Set();
  for (const room of project.rooms || []) {
    const block = blocksForRoom(room).find(definition => definition.id === bid);
    if (!block) continue;
    for (const instance of instances(room,block)) if ((instance.pid ?? instance.btnId) === pid) {
      eachRow(instance.presetSnapshot,row => keys.add(String(rowKey(row))));
    }
  }
  eachRow(nextPreset,row => keys.add(String(rowKey(row))));
  return keys;
}

/** Legacy override units remain bound even after every original contributing row has been removed. */
export function bindEstimateOverrideUnits(edits, units = {}) {
  if (!record(edits)) return edits;
  return Object.fromEntries(Object.entries(edits).map(([key,edit]) => {
    if (!record(edit) || Object.hasOwn(edit,'u')) return [key,edit];
    let unit = Object.hasOwn(units,key) ? units[key] : null;
    if (unit == null) {
      const split = key.lastIndexOf('|unit:');
      if (split >= 0 && Object.hasOwn(units,key.slice(0,split))) {
        try {unit = decodeURIComponent(key.slice(split + 6));} catch { /* An unknown legacy key stays unchanged. */ }
      }
    }
    return [key,typeof unit === 'string' && unit.length ? {...edit,u:unit} : edit];
  }));
}

export function clearProjectPriceOverrides(edits, keys) {
  if (!record(edits)) return edits;
  return Object.fromEntries(Object.entries(edits).flatMap(([key,edit]) => {
    if (!keys.has(key) && ![...keys].some(reference => key.startsWith(`${reference}|`))) return [[key,edit]];
    const next = {...edit};
    delete next.p;
    return Object.keys(next).some(field => field !== 'u') ? [[key,next]] : [];
  }));
}

function clearPrices(project, keys) {
  for (const room of project.rooms || []) if (room.estEd) room.estEd = clearProjectPriceOverrides(room.estEd,keys);
  if (project.estEd) project.estEd = clearProjectPriceOverrides(project.estEd,keys);
}

function remapIdentity(project, previous, next) {
  if (previous === String(next)) return;
  const remap = (map, namespaced = false, values = false) => !record(map) ? map : Object.fromEntries(
    Object.entries(map).map(([key,value]) => [key === previous ? String(next)
      : namespaced && key.startsWith(`${previous}|`) ? String(next) + key.slice(previous.length) : key,
    values && String(value) === previous ? next : value]),
  );
  for (const room of project.rooms || []) {
    for (const block of blocksForRoom(room)) for (const instance of instances(room,block)) {
      for (const field of ['off','iq','oq']) if (instance[field]) instance[field] = remap(instance[field]);
      if (instance.variants) instance.variants = remap(instance.variants,false,true);
    }
    if (room.estEd) room.estEd = remap(room.estEd,true);
  }
  if (project.estEd) project.estEd = remap(project.estEd,true);
}

function refreshVariantSelections(instance, nextPreset) {
  const previousRows = instance.presetSnapshot.items;
  const previousKeys = new Set(previousRows.map(row => String(rowKey(row))));
  const retainedKeys = new Set(nextPreset.items.map(row => String(rowKey(row))).filter(key => previousKeys.has(key)));
  for (const field of ['off','iq','oq','variants']) if (record(instance[field])) {
    instance[field] = Object.fromEntries(Object.entries(instance[field]).filter(([key]) => retainedKeys.has(key)));
  }
  const effective = (row,selected) => row?.variants?.find(option => rowKey(option) === selected) || row?.variants?.[0] || row;
  for (const row of nextPreset.items) {
    const key = rowKey(row), selected = instance.variants?.[key];
    const choices = row.variants || [];
    const current = choices.find(option => rowKey(option) === selected);
    const previousRow = previousRows.find(item => rowKey(item) === key);
    const previousEffective = effective(previousRow,selected), nextEffective = effective(row,selected);
    if (selected != null && !current) {
      if (choices.length) instance.variants[key] = rowKey(choices[0]);
      else delete instance.variants[key];
    }
    if (previousEffective && (rowKey(previousEffective) !== rowKey(nextEffective) || previousEffective.u !== nextEffective.u)
      && instance.iq) delete instance.iq[key];
  }
}

/** Only an explicit catalogue Save adopts the edited record in the current project. */
export function refreshProjectNom(project, reference, item) {
  if (!validProjectCalculation(project) || !position(item)) return project;
  const keys = projectNomPriceKeys(project,reference);
  if (!keys.size) return project;
  const next = clone(project), update = (row,bid) => sameRow(row,reference) ? currentPosition(row,item,bid) : row;
  for (const room of next.rooms) {
    for (const block of blocksForRoom(room)) for (const instance of instances(room,block)) {
      instance.presetSnapshot.items = instance.presetSnapshot.items.map(row => {
        const selected = instance.variants?.[rowKey(row)];
        const effective = row.variants?.find(option => rowKey(option) === selected) || row.variants?.[0] || row;
        if (sameRow(effective,reference) && effective.u !== item.u && instance.iq) delete instance.iq[rowKey(row)];
        const updated = update(row,block.id);
        if (row.variants) updated.variants = row.variants.map(option => update(option,block.id));
        return updated;
      });
    }
    room.catalogSnapshot.roomOpts = room.catalogSnapshot.roomOpts.map(option => update(option));
    if (room.extraItems) room.extraItems = room.extraItems.map(extra => update(extra));
  }
  clearPrices(next,keys);
  for (const key of keys) remapIdentity(next,key,referenceKey(item));
  return next;
}

/** A restored global assembly adopts current catalogue records while retaining its saved composition. */
export function restoreLibraryPreset(preset, bid, library) {
  const fresh = catalogClone(preset);
  delete fresh.version;
  delete fresh.missing;
  const update = row => {
    const source = resolveNom(library.nom || [],row?.nid || row?.nomId ? {nid:row.nid ?? row.nomId} : row.n);
    const next = source ? currentPosition(row,source,bid) : catalogClone(row);
    delete next._photoFrozen;
    if (source) for (const field of ['img','imageUrl']) if (next[field]?.startsWith('data:')) delete next[field];
    return next;
  };
  fresh.items = fresh.items.map(row => {
    const next = update(row);
    if (row.variants) next.variants = row.variants.map(update);
    return next;
  });
  return fresh;
}

/** Adopting one assembly refreshes matching instances only; all entered quantities remain intact. */
export function refreshProjectPreset(project, bid, pid, library) {
  if (!validProjectCalculation(project)) return project;
  const current = library.presets?.[bid]?.find(preset => preset.id === pid);
  if (!current) return project;
  const next = clone(project), keys = projectPresetPriceKeys(project,bid,pid,current);
  let changed = false;
  const fresh = restoreLibraryPreset(current,bid,library);
  for (const room of next.rooms) {
    const block = blocksForRoom(room).find(definition => definition.id === bid);
    if (!block) continue;
    for (const instance of instances(room,block)) if ((instance.pid ?? instance.btnId) === pid) {
      refreshVariantSelections(instance,fresh);
      instance.presetSnapshot = freezePreset(fresh,instance,library);
      changed = true;
    }
  }
  if (!changed) return project;
  clearPrices(next,keys);
  return next;
}

/** Embedded calculation data is checked independently of the editable global catalogue. */
export function validProjectCalculation(project) {
  if (!record(project) || project.calculationSnapshotVersion !== 1 || !Array.isArray(project.rooms)) return false;
  return project.rooms.every(room => record(room) && validRoomCatalog(room.catalogSnapshot)
    && room.catalogSnapshot.blocks.every(block => {
      const value = room[block.id], single = block.single || block.id === 'canvas' || block.id === 'main';
      if (value == null) return block.id !== 'canvas' && block.id !== 'main';
      const list = single ? record(value) ? [value] : null : Array.isArray(value) ? value : null;
      return !!list && list.every(instance => record(instance) && validPreset(instance.presetSnapshot));
    })
    && (room.extraItems == null || Array.isArray(room.extraItems) && room.extraItems.every(position)));
}
