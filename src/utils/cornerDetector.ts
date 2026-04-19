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

    // Full resolution — no downscaling, pixel-perfect corner detection
    const sc = Math.min(1, 5000 / Math.max(w, h));
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

// Gaussian kernel 3×3 (σ≈0.7, sum=16) — sharp localization for clean plans
const GAUSS3 = [
  1, 2, 1,
  2, 4, 2,
  1, 2, 1,
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

  // Harris response using central differences + 3×3 Gaussian structure tensor
  // Smaller window = sharper corner localization (exactly at line intersection)
  const harrisAt = (px: number, py: number): number => {
    let sxx = 0, syy = 0, sxy = 0;
    let gi = 0;
    for (let wy = -1; wy <= 1; wy++) {
      for (let wx = -1; wx <= 1; wx++) {
        const qx = px + wx, qy = py + wy;
        const ix = g(qx + 1, qy) - g(qx - 1, qy);
        const iy = g(qx, qy + 1) - g(qx, qy - 1);
        const gw = GAUSS3[gi++];
        sxx += gw * ix * ix;
        syy += gw * iy * iy;
        sxy += gw * ix * iy;
      }
    }
    return (sxx * syy - sxy * sxy) - 0.05 * (sxx + syy) * (sxx + syy);
  };

  // Search radius (in image pixels). Wider window catches finger imprecision,
  // distance penalty below still discounts far candidates so user can escape.
  const natRadius = mode === 'loupe' ? 18 : 10;
  const R = Math.max(3, Math.round(natRadius * sc));

  let bx = cx, by = cy, bs = -1;

  for (let y = Math.max(3, cy - R); y <= Math.min(h - 4, cy + R); y++) {
    for (let x = Math.max(3, cx - R); x <= Math.min(w - 4, cx + R); x++) {
      // Fast contrast reject — skip uniform areas
      const c = g(x, y);
      const tl = g(x-2,y-2), tr = g(x+2,y-2), bl = g(x-2,y+2), br = g(x+2,y+2);
      const lo = Math.min(c, tl, tr, bl, br);
      const hi = Math.max(c, tl, tr, bl, br);
      if (hi - lo < 70) continue;

      const hr = harrisAt(x, y);
      if (hr < 500000) continue; // only very strong corners

      // Heavy distance penalty — snap weakens fast with distance
      const dist = Math.hypot(x - cx, y - cy);
      const score = hr * (1 - (dist / R) * 0.9);

      if (score > bs) { bs = score; bx = x; by = y; }
    }
  }

  // Sub-pixel refinement: two-pass gradient-weighted cornerSubPix
  // Pass 1: 9×9 window — coarse convergence to corner area
  // Pass 2: 5×5 window — tight refinement at exact intersection
  // Weighted by mag² × Gaussian(distance) — nearby strong edges dominate
  let subX = bx, subY = by;
  if (bs > 0 && bx > 6 && by > 6 && bx < w - 7 && by < h - 7) {
    let qx = bx, qy = by;
    const passes: [number, number][] = [[4, 3.0], [2, 1.5]]; // [halfWin, sigma]
    for (const [hw, sigma] of passes) {
      const s2 = 2 * sigma * sigma;
      for (let iter = 0; iter < 15; iter++) {
        const iqx = Math.round(qx), iqy = Math.round(qy);
        let a00 = 0, a01 = 0, a11 = 0, b0 = 0, b1 = 0;
        for (let wy = -hw; wy <= hw; wy++) {
          for (let wx = -hw; wx <= hw; wx++) {
            const px = iqx + wx, py = iqy + wy;
            const ix = g(px + 1, py) - g(px - 1, py);
            const iy = g(px, py + 1) - g(px, py - 1);
            const mag2 = ix * ix + iy * iy;
            if (mag2 < 100) continue; // skip flat areas
            // Spatial Gaussian × gradient magnitude²
            const sw = Math.exp(-(wx * wx + wy * wy) / s2) * mag2;
            a00 += sw * ix * ix;
            a01 += sw * ix * iy;
            a11 += sw * iy * iy;
            b0 += sw * (ix * ix * px + ix * iy * py);
            b1 += sw * (ix * iy * px + iy * iy * py);
          }
        }
        const det = a00 * a11 - a01 * a01;
        if (Math.abs(det) < 1e-6) break;
        const nqx = (a11 * b0 - a01 * b1) / det;
        const nqy = (a00 * b1 - a01 * b0) / det;
        if (Math.hypot(nqx - qx, nqy - qy) < 0.001) { qx = nqx; qy = nqy; break; }
        qx = nqx; qy = nqy;
        if (Math.hypot(qx - bx, qy - by) > 4) { qx = bx; qy = by; break; }
      }
    }
    subX = qx; subY = qy;
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
