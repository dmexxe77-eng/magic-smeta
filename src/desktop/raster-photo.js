export const MAX_PHOTO_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTO_DATA_URL_LENGTH = 600 * 1024;
export const PHOTO_MAX_SIDE = 1024;

const abortIfNeeded = signal => {
  if (signal?.aborted) throw new DOMException('Photo processing cancelled', 'AbortError');
};

export function rasterPhotoType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte)) return 'image/png';
  if ([82,73,70,70].every((byte,index)=>bytes[index]===byte)
    && [87,69,66,80].every((byte,index)=>bytes[index+8]===byte)) return 'image/webp';
  return null;
}

export function fitPhotoDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Не удалось прочитать размеры фото. Выберите другой файл.');
  }
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

export async function decodeRasterPhoto(file, signal, {
  createBitmap = globalThis.createImageBitmap?.bind(globalThis),
  createImage = () => new Image(),
  createObjectURL = value => URL.createObjectURL(value),
  revokeObjectURL = value => URL.revokeObjectURL(value),
} = {}) {
  abortIfNeeded(signal);
  if (typeof createBitmap === 'function') {
    try {
      const image = await createBitmap(file);
      if (signal?.aborted) {image.close();abortIfNeeded(signal);}
      return {image,width:image.width,height:image.height,close:()=>image.close()};
    } catch {
      abortIfNeeded(signal);
      // Some browsers expose createImageBitmap but cannot decode every supported raster.
    }
  }
  return new Promise((resolve,reject)=>{
    const image = createImage(),url = createObjectURL(file);
    const cleanup = () => {revokeObjectURL(url);signal?.removeEventListener('abort',cancel);image.onload=null;image.onerror=null;};
    const cancel = () => {cleanup();image.src='';reject(new DOMException('Photo processing cancelled','AbortError'));};
    image.onload = () => {cleanup();resolve({image,width:image.naturalWidth,height:image.naturalHeight,close:()=>{image.src='';}});};
    image.onerror = () => {cleanup();reject(new Error('Invalid image'));};
    signal?.addEventListener('abort',cancel,{once:true});
    image.src = url;
  });
}

function encodePhoto(canvas) {
  let dataUrl;
  try {dataUrl=canvas.toDataURL('image/webp',0.82);}
  catch {dataUrl=canvas.toDataURL('image/png');}
  // Safari can return PNG when the requested WebP encoder is unavailable.
  if (!/^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    throw new Error('Браузер не смог сохранить фото в формате PNG или WebP. Попробуйте другой браузер.');
  }
  return dataUrl;
}

/** Accept only decoded raster files and retain a bounded browser-local image draft. */
export async function prepareRasterPhoto(file, {
  signal,
  decode = decodeRasterPhoto,
  createCanvas = () => document.createElement('canvas'),
} = {}) {
  abortIfNeeded(signal);
  if (!file || !Number.isFinite(file.size) || file.size <= 0) throw new Error('Выберите непустой файл фото.');
  if (file.size > MAX_PHOTO_FILE_BYTES) throw new Error('Фото больше 8 МБ. Выберите файл поменьше.');
  let bytes;
  try {bytes = new Uint8Array(await file.slice(0,16).arrayBuffer());}
  catch {abortIfNeeded(signal);throw new Error('Не удалось прочитать файл фото. Выберите другой файл.');}
  abortIfNeeded(signal);
  if (!rasterPhotoType(bytes)) throw new Error('Подойдёт фото JPG, PNG или WebP.');
  let decoded;
  try {
    try {decoded = await decode(file,signal);}
    catch (error) {
      abortIfNeeded(signal);
      if (error?.name === 'AbortError') throw error;
      throw new Error('Не удалось открыть фото JPG, PNG или WebP. Выберите другой файл.');
    }
    abortIfNeeded(signal);
    let {width,height} = fitPhotoDimensions(decoded.width,decoded.height);
    const canvas = createCanvas();
    for (let attempt=0;attempt<8;attempt++) {
      canvas.width=width;canvas.height=height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(decoded.image,0,0,width,height);
      const dataUrl = encodePhoto(canvas);
      abortIfNeeded(signal);
      if (dataUrl.length <= MAX_PHOTO_DATA_URL_LENGTH) return dataUrl;
      const nextWidth=Math.max(1,Math.floor(width*0.75)),nextHeight=Math.max(1,Math.floor(height*0.75));
      if (width===nextWidth && height===nextHeight) break;
      width=nextWidth;height=nextHeight;
    }
    throw new Error('Фото получилось слишком большим. Выберите другое изображение.');
  } catch (error) {
    if (error?.name === 'AbortError' || /^(Фото |Не удалось (прочитать|открыть)|Браузер не смог)/.test(error?.message)) throw error;
    throw new Error('Браузер не смог преобразовать фото. Попробуйте другой файл.');
  } finally {
    decoded?.close?.();
  }
}
