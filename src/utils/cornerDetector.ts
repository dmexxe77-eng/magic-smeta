/**
 * Corner Detection for building plans
 *
 * Tuned for architectural drawings:
 * - Binarization to isolate wall lines (dark lines on light background)
 * - Large block size to ignore text/numbers
 * - Strong NMS to avoid clusters
 * - Only detects where dark lines meet at ~90°
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

    // Downsample to max 500px for speed
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

    // ── Step 1: Grayscale + binarize (dark lines = 1, light areas = 0) ──
    const bin = new Float32Array(sw * sh);

    // Find threshold using Otsu-like method (simplified)
    let totalBright = 0;
    for (let i = 0; i < sw * sh; i++) {
      totalBright += 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
    }
    const avgBright = totalBright / (sw * sh);
    const threshold = avgBright * 0.55; // darker than average = wall line

    for (let i = 0; i < sw * sh; i++) {
      const brightness = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
      bin[i] = brightness < threshold ? 1.0 : 0.0;
    }

    // ── Step 2: Sobel on binarized image ────────────────────────────
    const Ix = new Float32Array(sw * sh);
    const Iy = new Float32Array(sw * sh);

    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        Ix[i] = -bin[(y-1)*sw+(x-1)] + bin[(y-1)*sw+(x+1)]
               - 2*bin[y*sw+(x-1)] + 2*bin[y*sw+(x+1)]
               - bin[(y+1)*sw+(x-1)] + bin[(y+1)*sw+(x+1)];
        Iy[i] = -bin[(y-1)*sw+(x-1)] - 2*bin[(y-1)*sw+x] - bin[(y-1)*sw+(x+1)]
               + bin[(y+1)*sw+(x-1)] + 2*bin[(y+1)*sw+x] + bin[(y+1)*sw+(x+1)];
      }
    }

    // ── Step 3: Harris response with large block ────────────────────
    const blockSize = 7;  // large block — ignores small features
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

    // ── Step 4: Strong NMS with large radius ────────────────────────
    const nmsR = 15; // large radius — no clusters
    const corners: DetectedCorner[] = [];
    const absThr = 0.08 * maxR; // only strong corners

    for (let y = nmsR; y < sh - nmsR; y++) {
      for (let x = nmsR; x < sw - nmsR; x++) {
        const val = R[y * sw + x];
        if (val < absThr) continue;

        let isMax = true;
        for (let dy = -nmsR; dy <= nmsR && isMax; dy++) {
          for (let dx = -nmsR; dx <= nmsR && isMax; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (R[(y + dy) * sw + (x + dx)] > val) isMax = false;
          }
        }

        if (isMax) {
          corners.push({ x: x / sc, y: y / sc, strength: val });
        }
      }
    }

    corners.sort((a, b) => b.strength - a.strength);
    return corners.slice(0, maxCorners);
  } catch (e) {
    console.warn('Corner detection failed:', e);
    return [];
  }
}
