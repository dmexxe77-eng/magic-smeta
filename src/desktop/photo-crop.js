import {
  decodeRasterPhoto, rasterPhotoType, MAX_PHOTO_FILE_BYTES, MAX_PHOTO_DATA_URL_LENGTH,
} from './raster-photo.js';

export const DEFAULT_PHOTO_CROP = Object.freeze({zoom:1,x:0,y:0});
export const MAX_PHOTO_ZOOM = 6;

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const bound = (value, limit) => Math.max(-limit,Math.min(limit,value)) || 0;
const abortIfNeeded = signal => {
  if (signal?.aborted) throw new DOMException('Photo processing cancelled','AbortError');
};
const dimensions = (width,height) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width<=0 || height<=0) {
    throw new Error('Не удалось прочитать размеры фото. Выберите другой файл.');
  }
};

/** Pan is measured in square-frame units, independently of the preview size. */
export function normalizePhotoCrop(crop = DEFAULT_PHOTO_CROP) {
  return {
    zoom:Math.max(1,Math.min(MAX_PHOTO_ZOOM,finite(crop?.zoom,1))),
    x:finite(crop?.x,0),
    y:finite(crop?.y,0),
  };
}

export function clampPhotoCrop(width,height,crop) {
  dimensions(width,height);
  const normalized=normalizePhotoCrop(crop),longest=Math.max(width,height);
  // A short side can move within its white margin; an enlarged side can pan to its edges.
  return {
    zoom:normalized.zoom,
    x:bound(normalized.x,Math.abs(width/longest*normalized.zoom-1)/2),
    y:bound(normalized.y,Math.abs(height/longest*normalized.zoom-1)/2),
  };
}

export function photoCropLayout(width,height,crop,frame=1) {
  dimensions(width,height);
  if (!Number.isFinite(frame) || frame<=0) throw new Error('Неверный размер рамки фото.');
  const normalized=clampPhotoCrop(width,height,crop);
  const scale=frame/Math.max(width,height)*normalized.zoom;
  const renderedWidth=width*scale,renderedHeight=height*scale;
  return {
    width:renderedWidth,height:renderedHeight,
    left:(frame-renderedWidth)/2+normalized.x*frame,
    top:(frame-renderedHeight)/2+normalized.y*frame,
    scale,...normalized,
  };
}

/** dx/dy are pointer deltas divided by the displayed frame size. */
export function cropFromDrag(startCrop,dx,dy,width,height) {
  const normalized=normalizePhotoCrop(startCrop);
  const next={...normalized,x:normalized.x+finite(dx,0),y:normalized.y+finite(dy,0)};
  return width===undefined || height===undefined ? next : clampPhotoCrop(width,height,next);
}

export function photoCropSourceUrl(source,baseUrl=globalThis.location?.href ?? 'http://localhost/') {
  if (typeof source!=='string' || !source) throw new Error('Сначала добавьте фото.');
  if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(source)) {
    if (source.length>MAX_PHOTO_FILE_BYTES*4/3+64) throw new Error('Фото больше 8 МБ. Выберите файл поменьше.');
    return source;
  }
  let url,base;
  try {base=new URL(baseUrl);url=new URL(source,base);}
  catch {throw new Error('Не удалось открыть фото. Выберите JPG, PNG или WebP.');}
  if (!['http:','https:'].includes(url.protocol) || url.origin!==base.origin || url.username || url.password) {
    throw new Error('Не удалось открыть фото. Выберите JPG, PNG или WebP.');
  }
  return url.href;
}

/** Decode verified raster bytes, including same-origin catalogue pictures. */
export async function decodePhotoCropSource(source,signal,{
  fetchPhoto = globalThis.fetch?.bind(globalThis),
  decode = decodeRasterPhoto,
  baseUrl,
} = {}) {
  abortIfNeeded(signal);
  const url=photoCropSourceUrl(source,baseUrl);
  let decoded;
  try {
    const response=await fetchPhoto(url,{signal,credentials:'same-origin',redirect:'error'});
    abortIfNeeded(signal);
    if (!response.ok) throw new Error('Photo unavailable');
    const file=await response.blob();
    abortIfNeeded(signal);
    if (!file.size || file.size>MAX_PHOTO_FILE_BYTES) throw new Error('Photo size unavailable');
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    abortIfNeeded(signal);
    if (!rasterPhotoType(bytes)) throw new Error('Invalid raster photo');
    decoded=await decode(file,signal);
    abortIfNeeded(signal);
    dimensions(decoded.width,decoded.height);
    return decoded;
  } catch (error) {
    decoded?.close?.();
    abortIfNeeded(signal);
    if (error?.name==='AbortError') throw error;
    throw new Error('Не удалось открыть фото. Загрузите JPG, PNG или WebP заново.');
  }
}

function encodeCrop(canvas) {
  let result;
  try {result=canvas.toDataURL('image/webp',0.82);}
  catch {
    try {result=canvas.toDataURL('image/png');}
    catch {throw new Error('Браузер не смог сохранить обработанное фото. Попробуйте ещё раз.');}
  }
  // Safari may supply PNG even when WebP was requested.
  if (!/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(result)) {
    throw new Error('Браузер не смог сохранить обработанное фото в PNG или WebP.');
  }
  return result;
}

/** Export the same square shown in the editor; the source remains untouched. */
export async function renderCroppedPhoto(source,crop,{
  signal,size=512,
  decodeSource=decodePhotoCropSource,
  createCanvas=()=>document.createElement('canvas'),
} = {}) {
  abortIfNeeded(signal);
  photoCropSourceUrl(source);
  if (!Number.isFinite(size) || size<1 || size>1024) throw new Error('Неверный размер рамки фото.');
  let decoded;
  try {
    decoded=await decodeSource(source,signal);
    abortIfNeeded(signal);
    const canvas=createCanvas();
    let side=Math.max(1,Math.round(size));
    for (let attempt=0;attempt<8;attempt++) {
      canvas.width=side;canvas.height=side;
      const context=canvas.getContext('2d');
      if (!context) throw new Error('Браузер не смог открыть редактор фото.');
      const layout=photoCropLayout(decoded.width,decoded.height,crop,side);
      context.fillStyle='#ffffff';
      context.fillRect(0,0,side,side);
      context.drawImage(decoded.image,layout.left,layout.top,layout.width,layout.height);
      const result=encodeCrop(canvas);
      abortIfNeeded(signal);
      if (result.length<=MAX_PHOTO_DATA_URL_LENGTH) return result;
      const next=Math.max(1,Math.floor(side*0.75));
      if (next===side) break;
      side=next;
    }
    throw new Error('Обработанное фото получилось слишком большим. Попробуйте уменьшить масштаб.');
  } finally {
    decoded?.close?.();
  }
}
