/**
 * Corner snap — Harris corner detection with central differences
 *
 * Uses central difference gradients (no 3×3 Sobel blur) for sharp localization,
 * 5×5 Gaussian-weighted structure tensor for robust corner detection,
 * and parabolic sub-pixel refinement for pixel-perfect accuracy.
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

    // High resolution cache — more pixels = more precise corner localization
    const sc = Math.min(1, 3000 / Math.max(w, h));
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

// Gaussian kernel 5×5 (σ≈1.0, sum=273)
const GAUSS5 = [
  1, 4, 7, 4, 1,
  4,16,26,16, 4,
  7,26,41,26, 7,
  4,16,26,16, 4,
  1, 4, 7, 4, 1,
];

/**
 * Snap to nearest corner using Harris detection with central differences.
 * Central differences give gradient at the exact pixel (no Sobel 3×3 blur),
 * 5×5 Gaussian window gives precise, robust corner localization.
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

  // Direct array access (faster than function call in hot loop)
  const g = (x: number, y: number): number =>
    d[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];

  // Harris response using central differences + 5×5 Gaussian structure tensor
  const harrisAt = (px: number, py: number): number => {
    let sxx = 0, syy = 0, sxy = 0;
    let gi = 0;
    for (let wy = -2; wy <= 2; wy++) {
      for (let wx = -2; wx <= 2; wx++) {
        const qx = px + wx, qy = py + wy;
        // Central difference: exact gradient at pixel (no 3×3 smoothing)
        const ix = g(qx + 1, qy) - g(qx - 1, qy);
        const iy = g(qx, qy + 1) - g(qx, qy - 1);
        const gw = GAUSS5[gi++];
        sxx += gw * ix * ix;
        syy += gw * iy * iy;
        sxy += gw * ix * iy;
      }
    }
    // Harris: det(M) - k * trace(M)²
    return (sxx * syy - sxy * sxy) - 0.05 * (sxx + syy) * (sxx + syy);
  };

  // Search radius — tight, only snap when close
  const natRadius = mode === 'loupe' ? 12 : 7;
  const R = Math.min(10, Math.max(3, Math.round(natRadius * sc)));

  let bx = cx, by = cy, bs = -1;

  for (let y = Math.max(3, cy - R); y <= Math.min(h - 4, cy + R); y++) {
    for (let x = Math.max(3, cx - R); x <= Math.min(w - 4, cx + R); x++) {
      // Fast contrast reject — skip uniform areas
      const c = g(x, y);
      const tl = g(x-2,y-2), tr = g(x+2,y-2), bl = g(x-2,y+2), br = g(x+2,y+2);
      const lo = Math.min(c, tl, tr, bl, br);
      const hi = Math.max(c, tl, tr, bl, br);
      if (hi - lo < 50) continue;

      const hr = harrisAt(x, y);
      if (hr < 100000) continue; // only real corners

      // Distance penalty — prefer closest corner
      const dist = Math.hypot(x - cx, y - cy);
      const score = hr * (1 - (dist / R) * 0.7);

      if (score > bs) { bs = score; bx = x; by = y; }
    }
  }

  // Refine: find exact Harris peak in 3px neighborhood
  if (bs > 0) {
    let rbx = bx, rby = by, rbs = -Infinity;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const rx = bx + dx, ry = by + dy;
        if (rx < 3 || ry < 3 || rx >= w - 4 || ry >= h - 4) continue;
        const rs = harrisAt(rx, ry);
        if (rs > rbs) { rbs = rs; rbx = rx; rby = ry; }
      }
    }
    bx = rbx; by = rby;
  }

  // Sub-pixel refinement: 2D parabolic fit on Harris response
  let subX = bx, subY = by;
  if (bs > 0 && bx > 4 && by > 4 && bx < w - 5 && by < h - 5) {
    const h0 = harrisAt(bx, by);
    const hL = harrisAt(bx - 1, by), hR = harrisAt(bx + 1, by);
    const hU = harrisAt(bx, by - 1), hD = harrisAt(bx, by + 1);
    // Parabolic fit in X
    const denomX = hL + hR - 2 * h0;
    if (denomX < 0) { // concave down = peak
      subX = bx + Math.max(-0.5, Math.min(0.5, (hL - hR) / (2 * denomX)));
    }
    // Parabolic fit in Y
    const denomY = hU + hD - 2 * h0;
    if (denomY < 0) {
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
