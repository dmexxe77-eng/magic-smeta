/**
 * Corner Detection — simplified, reliable approach
 * Harris on grayscale + filter: only corners near dark/contrasty lines
 */

import { Skia } from '@shopify/react-native-skia';

export interface DetectedCorner {
  x: number;
  y: number;
  strength: number;
}

export async function detectCorners(
  imageUri: string,
  maxCorners: number = 150,
): Promise<DetectedCorner[]> {
  try {
    // Try loading image
    let skImage;
    try {
      const skData = await Skia.Data.fromURI(imageUri);
      skImage = Skia.Image.MakeImageFromEncoded(skData);
    } catch {
      // fromURI may fail with ph:// — try fetch
      try {
        const resp = await fetch(imageUri);
        const blob = await resp.blob();
        const ab = await blob.arrayBuffer();
        const skData = Skia.Data.fromBytes(new Uint8Array(ab));
        skImage = Skia.Image.MakeImageFromEncoded(skData);
      } catch {
        return [];
      }
    }
    if (!skImage) return [];

    const w = skImage.width();
    const h = skImage.height();
    const sc = Math.min(1, 400 / Math.max(w, h));
    const sw = Math.round(w * sc);
    const sh = Math.round(h * sc);

    const surface = Skia.Surface.Make(sw, sh);
    if (!surface) return [];
    const canvas = surface.getCanvas();
    canvas.drawImageRect(skImage, Skia.XYWHRect(0, 0, w, h), Skia.XYWHRect(0, 0, sw, sh), Skia.Paint());
    const snapshot = surface.makeImageSnapshot();
    const pd = snapshot.readPixels(0, 0, { width: sw, height: sh, colorType: 4, alphaType: 1 });
    if (!pd) return [];
    const px = new Uint8Array(pd);

    // Grayscale normalized
    const g = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      g[i] = (0.299 * px[i*4] + 0.587 * px[i*4+1] + 0.114 * px[i*4+2]) / 255;
    }

    // Sobel gradients
    const Ix = new Float32Array(sw * sh);
    const Iy = new Float32Array(sw * sh);
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        Ix[i] = -g[(y-1)*sw+(x-1)] + g[(y-1)*sw+(x+1)] - 2*g[y*sw+(x-1)] + 2*g[y*sw+(x+1)] - g[(y+1)*sw+(x-1)] + g[(y+1)*sw+(x+1)];
        Iy[i] = -g[(y-1)*sw+(x-1)] - 2*g[(y-1)*sw+x] - g[(y-1)*sw+(x+1)] + g[(y+1)*sw+(x-1)] + 2*g[(y+1)*sw+x] + g[(y+1)*sw+(x+1)];
      }
    }

    // Harris
    const bs = 4, half = 2, k = 0.04;
    const R = new Float32Array(sw * sh);
    let maxR = 0;
    for (let y = half+1; y < sh-half-1; y++) {
      for (let x = half+1; x < sw-half-1; x++) {
        let sxx=0, sxy=0, syy=0;
        for (let dy=-half; dy<=half; dy++) for (let dx=-half; dx<=half; dx++) {
          const i = (y+dy)*sw+(x+dx);
          sxx += Ix[i]*Ix[i]; sxy += Ix[i]*Iy[i]; syy += Iy[i]*Iy[i];
        }
        const r = sxx*syy - sxy*sxy - k*(sxx+syy)*(sxx+syy);
        R[y*sw+x] = r;
        if (r > maxR) maxR = r;
      }
    }
    if (maxR === 0) return [];

    // NMS
    const nms = 8;
    const corners: DetectedCorner[] = [];
    const thr = 0.02 * maxR;

    for (let y = nms; y < sh-nms; y++) {
      for (let x = nms; x < sw-nms; x++) {
        const v = R[y*sw+x];
        if (v < thr) continue;
        let isMax = true;
        outer: for (let dy=-nms; dy<=nms; dy++) for (let dx=-nms; dx<=nms; dx++) {
          if (dx===0 && dy===0) continue;
          if (R[(y+dy)*sw+(x+dx)] > v) { isMax = false; break outer; }
        }
        if (!isMax) continue;

        // Filter: check local contrast — must have strong gradient in area
        let totalGrad = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const i = (y+dy)*sw+(x+dx);
          totalGrad += Math.abs(Ix[i]) + Math.abs(Iy[i]);
        }
        if (totalGrad < 2.0) continue; // weak area, skip

        corners.push({ x: x/sc, y: y/sc, strength: v });
      }
    }

    corners.sort((a, b) => b.strength - a.strength);
    return corners.slice(0, maxCorners);
  } catch (e) {
    console.warn('Corner detection error:', e);
    return [];
  }
}
