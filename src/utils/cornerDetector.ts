/**
 * Corner snap — web-version approach
 *
 * NOT pre-computed. Called in real-time when user taps/moves loupe.
 * Scans pixels in small radius around touch point.
 * Corner = pixel where Sobel gradient is strong in BOTH X and Y.
 */

import { Skia } from '@shopify/react-native-skia';

// Cached pixel data for current image
let cachedUri: string | null = null;
let cachedGray: Uint8Array | null = null;
let cachedW = 0;
let cachedH = 0;

/**
 * Load and cache grayscale pixel data for an image
 */
export async function loadImagePixels(imageUri: string): Promise<boolean> {
  if (cachedUri === imageUri && cachedGray) return true;

  try {
    let skImage;
    try {
      const skData = await Skia.Data.fromURI(imageUri);
      skImage = Skia.Image.MakeImageFromEncoded(skData);
    } catch {
      try {
        const resp = await fetch(imageUri);
        const blob = await resp.blob();
        const ab = await blob.arrayBuffer();
        skImage = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(ab)));
      } catch { return false; }
    }
    if (!skImage) return false;

    const w = skImage.width();
    const h = skImage.height();

    // Keep reasonable size for pixel scanning
    const sc = Math.min(1, 800 / Math.max(w, h));
    const sw = Math.round(w * sc);
    const sh = Math.round(h * sc);

    const surface = Skia.Surface.Make(sw, sh);
    if (!surface) return false;
    surface.getCanvas().drawImageRect(skImage, Skia.XYWHRect(0,0,w,h), Skia.XYWHRect(0,0,sw,sh), Skia.Paint());
    const snap = surface.makeImageSnapshot();
    const pd = snap.readPixels(0, 0, { width: sw, height: sh, colorType: 4, alphaType: 1 });
    if (!pd) return false;

    const px = new Uint8Array(pd);
    const gray = new Uint8Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      gray[i] = Math.round((px[i*4] + px[i*4+1] + px[i*4+2]) / 3);
    }

    cachedUri = imageUri;
    cachedGray = gray;
    cachedW = sw;
    cachedH = sh;
    return true;
  } catch (e) {
    console.warn('loadImagePixels failed:', e);
    return false;
  }
}

/**
 * Get scale factor from natural image size to cached pixel size
 */
export function getPixelScale(naturalW: number): number {
  if (!cachedGray) return 1;
  return cachedW / naturalW;
}

/**
 * Snap to nearest corner in real-time (web-version approach)
 *
 * @param imgX - touch point in natural image pixels
 * @param imgY - touch point in natural image pixels
 * @param naturalW - natural image width
 * @param zoom - current zoom level
 * @param mode - 'tap' (small radius) or 'loupe' (larger radius)
 * @returns snapped point in natural image pixels, or original if no corner found
 */
export function snapToCorner(
  imgX: number,
  imgY: number,
  naturalW: number,
  zoom: number,
  mode: 'tap' | 'loupe' = 'loupe',
): { x: number; y: number; snapped: boolean } {
  if (!cachedGray) return { x: imgX, y: imgY, snapped: false };

  const sc = cachedW / naturalW;
  // Convert to cached pixel coords
  const cx = Math.round(imgX * sc);
  const cy = Math.round(imgY * sc);

  const w = cachedW;
  const h = cachedH;
  const d = cachedGray;

  const gray = (x: number, y: number): number => {
    const px = Math.max(0, Math.min(w - 1, Math.round(x)));
    const py = Math.max(0, Math.min(h - 1, Math.round(y)));
    return d[py * w + px];
  };

  // Tiny search radius — snap only when nearly on top of corner
  const R = mode === 'loupe'
    ? Math.min(8, Math.max(3, Math.round(5 / (zoom * sc))))
    : Math.min(5, Math.max(2, Math.round(3 / (zoom * sc))));

  let bx = cx, by = cy, bs = -1;

  for (let y = Math.max(1, cy - R); y <= Math.min(h - 2, cy + R); y++) {
    for (let x = Math.max(1, cx - R); x <= Math.min(w - 2, cx + R); x++) {
      // Sobel 3x3
      const gx = gray(x+1,y-1) + 2*gray(x+1,y) + gray(x+1,y+1)
               - gray(x-1,y-1) - 2*gray(x-1,y) - gray(x-1,y+1);
      const gy = gray(x-1,y+1) + 2*gray(x,y+1) + gray(x+1,y+1)
               - gray(x-1,y-1) - 2*gray(x,y-1) - gray(x+1,y-1);

      // Corner = strong gradient in BOTH directions
      const agx = Math.abs(gx), agy = Math.abs(gy);
      if (agx < 50 || agy < 50) continue;
      const cornerScore = Math.min(agx, agy);
      if (cornerScore < 80) continue;

      // Heavy distance penalty — strongly prefer closest corner
      const dist = Math.hypot(x - cx, y - cy);
      const distPenalty = dist / R;
      const score = cornerScore * (1 - distPenalty * 0.85);

      if (score > bs) { bs = score; bx = x; by = y; }
    }
  }

  // Refine: find exact maximum in 2px neighborhood
  if (bs > 0) {
    let rbx = bx, rby = by, rbs = bs;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const rx = bx + dx, ry = by + dy;
        if (rx < 1 || ry < 1 || rx >= w - 1 || ry >= h - 1) continue;
        const rgx = gray(rx+1,ry-1)+2*gray(rx+1,ry)+gray(rx+1,ry+1)-gray(rx-1,ry-1)-2*gray(rx-1,ry)-gray(rx-1,ry+1);
        const rgy = gray(rx-1,ry+1)+2*gray(rx,ry+1)+gray(rx+1,ry+1)-gray(rx-1,ry-1)-2*gray(rx,ry-1)-gray(rx+1,ry-1);
        const rs = Math.min(Math.abs(rgx), Math.abs(rgy));
        if (rs > rbs) { rbs = rs; rbx = rx; rby = ry; }
      }
    }
    bx = rbx; by = rby;
  }

  return {
    x: bx / sc,
    y: by / sc,
    snapped: bs > 0,
  };
}

// Legacy export for compatibility
export interface DetectedCorner { x: number; y: number; strength: number; }
export async function detectCorners(imageUri: string): Promise<DetectedCorner[]> {
  await loadImagePixels(imageUri);
  return []; // No pre-computed corners — snap is real-time now
}
