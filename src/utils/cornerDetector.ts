/**
 * Corner Detection for architectural building plans
 *
 * Strategy: Harris on grayscale + post-filter near dark wall lines.
 * Only keeps corners where dark pixels exist in 2+ directions nearby.
 */

import { Skia } from '@shopify/react-native-skia';

export interface DetectedCorner {
  x: number;
  y: number;
  strength: number;
}

export async function detectCorners(
  imageUri: string,
  maxCorners: number = 100,
): Promise<DetectedCorner[]> {
  try {
    const skData = await Skia.Data.fromURI(imageUri);
    const skImage = Skia.Image.MakeImageFromEncoded(skData);
    if (!skImage) return [];

    const w = skImage.width();
    const h = skImage.height();
    const sc = Math.min(1, 500 / Math.max(w, h));
    const sw = Math.round(w * sc);
    const sh = Math.round(h * sc);

    const surface = Skia.Surface.Make(sw, sh);
    if (!surface) return [];
    const canvas = surface.getCanvas();
    canvas.drawImageRect(skImage, Skia.XYWHRect(0, 0, w, h), Skia.XYWHRect(0, 0, sw, sh), Skia.Paint());
    const snapshot = surface.makeImageSnapshot();
    const pixelData = snapshot.readPixels(0, 0, { width: sw, height: sh, colorType: 4, alphaType: 1 });
    if (!pixelData) return [];
    const pixels = new Uint8Array(pixelData);

    // Grayscale (0-255)
    const gray = new Uint8Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      gray[i] = Math.round(0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]);
    }

    // Find dark threshold — wall lines are typically the darkest 15% of pixels
    const hist = new Uint32Array(256);
    for (let i = 0; i < sw * sh; i++) hist[gray[i]]++;
    let cumulative = 0;
    let darkThreshold = 80;
    const targetDark = sw * sh * 0.15;
    for (let v = 0; v < 256; v++) {
      cumulative += hist[v];
      if (cumulative >= targetDark) { darkThreshold = v; break; }
    }

    // Boolean dark map
    const isDark = new Uint8Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) isDark[i] = gray[i] <= darkThreshold ? 1 : 0;

    // Sobel on grayscale (float normalized)
    const grayF = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) grayF[i] = gray[i] / 255;

    const Ix = new Float32Array(sw * sh);
    const Iy = new Float32Array(sw * sh);
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        Ix[i] = -grayF[(y-1)*sw+(x-1)] + grayF[(y-1)*sw+(x+1)]
               - 2*grayF[y*sw+(x-1)] + 2*grayF[y*sw+(x+1)]
               - grayF[(y+1)*sw+(x-1)] + grayF[(y+1)*sw+(x+1)];
        Iy[i] = -grayF[(y-1)*sw+(x-1)] - 2*grayF[(y-1)*sw+x] - grayF[(y-1)*sw+(x+1)]
               + grayF[(y+1)*sw+(x-1)] + 2*grayF[(y+1)*sw+x] + grayF[(y+1)*sw+(x+1)];
      }
    }

    // Harris response
    const blockSize = 5;
    const kFactor = 0.04;
    const R = new Float32Array(sw * sh);
    const half = Math.floor(blockSize / 2);
    let maxR = 0;

    for (let y = half + 1; y < sh - half - 1; y++) {
      for (let x = half + 1; x < sw - half - 1; x++) {
        let sxx = 0, sxy = 0, syy = 0;
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const i = (y + dy) * sw + (x + dx);
            sxx += Ix[i] * Ix[i];
            sxy += Ix[i] * Iy[i];
            syy += Iy[i] * Iy[i];
          }
        }
        const det = sxx * syy - sxy * sxy;
        const trace = sxx + syy;
        const r = det - kFactor * trace * trace;
        R[y * sw + x] = r;
        if (r > maxR) maxR = r;
      }
    }

    if (maxR === 0) return [];

    // NMS + dark-line filter
    const nmsR = 8;
    const corners: DetectedCorner[] = [];
    const absThr = 0.03 * maxR;

    for (let y = nmsR; y < sh - nmsR; y++) {
      for (let x = nmsR; x < sw - nmsR; x++) {
        const val = R[y * sw + x];
        if (val < absThr) continue;

        // NMS
        let isMax = true;
        for (let dy = -nmsR; dy <= nmsR && isMax; dy++) {
          for (let dx = -nmsR; dx <= nmsR && isMax; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (R[(y + dy) * sw + (x + dx)] > val) isMax = false;
          }
        }
        if (!isMax) continue;

        // POST-FILTER: must have dark pixels nearby in at least 2 directions
        // Check 4 rays from the corner point (up, down, left, right)
        const rayLen = 6;
        let darkDirs = 0;
        // Up
        let hasDark = false;
        for (let d = 1; d <= rayLen && !hasDark; d++) if (y - d >= 0 && isDark[(y - d) * sw + x]) hasDark = true;
        if (hasDark) darkDirs++;
        // Down
        hasDark = false;
        for (let d = 1; d <= rayLen && !hasDark; d++) if (y + d < sh && isDark[(y + d) * sw + x]) hasDark = true;
        if (hasDark) darkDirs++;
        // Left
        hasDark = false;
        for (let d = 1; d <= rayLen && !hasDark; d++) if (x - d >= 0 && isDark[y * sw + (x - d)]) hasDark = true;
        if (hasDark) darkDirs++;
        // Right
        hasDark = false;
        for (let d = 1; d <= rayLen && !hasDark; d++) if (x + d < sw && isDark[y * sw + (x + d)]) hasDark = true;
        if (hasDark) darkDirs++;

        // Must have dark lines in at least 2 directions (= corner of wall)
        if (darkDirs < 2) continue;

        corners.push({ x: x / sc, y: y / sc, strength: val });
      }
    }

    corners.sort((a, b) => b.strength - a.strength);
    return corners.slice(0, maxCorners);
  } catch (e) {
    console.warn('Corner detection failed:', e);
    return [];
  }
}
