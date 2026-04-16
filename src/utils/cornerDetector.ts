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

    // Higher resolution cache for precise corner detection (loupe needs sub-pixel accuracy)
    const sc = Math.min(1, 2000 / Math.max(w, h));
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
 * Snap to nearest corner using Harris corner detection.
 * Harris finds the exact intersection point of two lines/edges,
 * unlike Sobel which responds to edge transitions.
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

  // Sobel gradient at a pixel
  const sobelX = (x: number, y: number): number =>
    gray(x+1,y-1) + 2*gray(x+1,y) + gray(x+1,y+1) - gray(x-1,y-1) - 2*gray(x-1,y) - gray(x-1,y+1);
  const sobelY = (x: number, y: number): number =>
    gray(x-1,y+1) + 2*gray(x,y+1) + gray(x+1,y+1) - gray(x-1,y-1) - 2*gray(x,y-1) - gray(x+1,y-1);

  // Harris corner response at a pixel (structure tensor over 3×3 window)
  const harrisAt = (px: number, py: number): number => {
    let sxx = 0, syy = 0, sxy = 0;
    for (let wy = -1; wy <= 1; wy++) {
      for (let wx = -1; wx <= 1; wx++) {
        const ix = sobelX(px + wx, py + wy);
        const iy = sobelY(px + wx, py + wy);
        sxx += ix * ix;
        syy += iy * iy;
        sxy += ix * iy;
      }
    }
    // Harris: det(M) - k * trace(M)²  where k=0.04
    return (sxx * syy - sxy * sxy) - 0.04 * (sxx + syy) * (sxx + syy);
  };

  // Search radius — tight, only snap when close to a real corner
  const natRadius = mode === 'loupe' ? 10 : 6;
  const R = Math.min(8, Math.max(3, Math.round(natRadius * sc)));

  let bx = cx, by = cy, bs = -1;

  for (let y = Math.max(3, cy - R); y <= Math.min(h - 4, cy + R); y++) {
    for (let x = Math.max(3, cx - R); x <= Math.min(w - 4, cx + R); x++) {
      // Local contrast check first (fast reject for uniform areas)
      let minV = 255, maxV = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const v = gray(x + dx, y + dy);
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
      if (maxV - minV < 60) continue;

      const hr = harrisAt(x, y);
      if (hr < 500000) continue; // only strong corners

      // Distance penalty — prefer closest corner
      const dist = Math.hypot(x - cx, y - cy);
      const score = hr * (1 - (dist / R) * 0.7);

      if (score > bs) { bs = score; bx = x; by = y; }
    }
  }

  // Refine: find exact Harris maximum in 2px neighborhood
  if (bs > 0) {
    let rbx = bx, rby = by, rbs = -1;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const rx = bx + dx, ry = by + dy;
        if (rx < 3 || ry < 3 || rx >= w - 3 || ry >= h - 3) continue;
        const rs = harrisAt(rx, ry);
        if (rs > rbs) { rbs = rs; rbx = rx; rby = ry; }
      }
    }
    bx = rbx; by = rby;
  }

  // Sub-pixel refinement via parabolic interpolation on Harris response
  let subX = bx, subY = by;
  if (bs > 0 && bx > 3 && by > 3 && bx < w - 4 && by < h - 4) {
    const h0 = harrisAt(bx, by);
    // Parabolic fit in X
    const hL = harrisAt(bx - 1, by), hR = harrisAt(bx + 1, by);
    const denomX = hL + hR - 2 * h0;
    if (denomX !== 0) {
      subX = bx + Math.max(-0.5, Math.min(0.5, (hL - hR) / (2 * denomX)));
    }
    // Parabolic fit in Y
    const hU = harrisAt(bx, by - 1), hD = harrisAt(bx, by + 1);
    const denomY = hU + hD - 2 * h0;
    if (denomY !== 0) {
      subY = by + Math.max(-0.5, Math.min(0.5, (hU - hD) / (2 * denomY)));
    }
  }

  return {
    x: subX / sc,
    y: subY / sc,
    snapped: bs > 0,
  };
}

// Legacy export for compatibility
export interface DetectedCorner { x: number; y: number; strength: number; }
export async function detectCorners(imageUri: string): Promise<DetectedCorner[]> {
  await loadImagePixels(imageUri);
  return []; // No pre-computed corners — snap is real-time now
}
