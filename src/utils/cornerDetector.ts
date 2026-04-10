/**
 * Harris Corner Detection using @shopify/react-native-skia
 *
 * Detects corners on building plans/blueprints by analyzing pixel data.
 * Steps: grayscale → Sobel gradients → Harris response → NMS → top N corners.
 */

import { Skia } from '@shopify/react-native-skia';

export interface DetectedCorner {
  x: number;
  y: number;
  strength: number;
}

/**
 * Detect corners in an image using Harris corner detection.
 */
export async function detectCorners(
  imageUri: string,
  maxCorners: number = 150,
  blockSize: number = 5,
  kFactor: number = 0.04,
  threshold: number = 0.05,
): Promise<DetectedCorner[]> {
  try {
    // Load image via Skia — supports file://, ph://, content:// URIs
    const skData = await Skia.Data.fromURI(imageUri);
    const skImage = Skia.Image.MakeImageFromEncoded(skData);
    if (!skImage) {
      console.warn('Skia: failed to decode image');
      return [];
    }

    const w = skImage.width();
    const h = skImage.height();

    // Downsample for performance (max 600px)
    const sc = Math.min(1, 600 / Math.max(w, h));
    const sw = Math.round(w * sc);
    const sh = Math.round(h * sc);

    // Render to offscreen surface
    const surface = Skia.Surface.Make(sw, sh);
    if (!surface) return [];

    const canvas = surface.getCanvas();
    canvas.drawImageRect(
      skImage,
      Skia.XYWHRect(0, 0, w, h),
      Skia.XYWHRect(0, 0, sw, sh),
      Skia.Paint(),
    );

    const snapshot = surface.makeImageSnapshot();
    const pixelData = snapshot.readPixels(0, 0, {
      width: sw,
      height: sh,
      colorType: 4, // RGBA_8888
      alphaType: 1,
    });

    if (!pixelData) {
      console.warn('Skia: readPixels returned null');
      return [];
    }

    const pixels = new Uint8Array(pixelData);

    // Grayscale
    const gray = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      gray[i] = (0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]) / 255;
    }

    // Sobel gradients
    const Ix = new Float32Array(sw * sh);
    const Iy = new Float32Array(sw * sh);

    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        Ix[i] = -gray[(y-1)*sw+(x-1)] + gray[(y-1)*sw+(x+1)]
               - 2*gray[y*sw+(x-1)] + 2*gray[y*sw+(x+1)]
               - gray[(y+1)*sw+(x-1)] + gray[(y+1)*sw+(x+1)];
        Iy[i] = -gray[(y-1)*sw+(x-1)] - 2*gray[(y-1)*sw+x] - gray[(y-1)*sw+(x+1)]
               + gray[(y+1)*sw+(x-1)] + 2*gray[(y+1)*sw+x] + gray[(y+1)*sw+(x+1)];
      }
    }

    // Harris response
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

    // Non-maximum suppression (larger radius = fewer clustered detections)
    const nmsR = 10;
    const corners: DetectedCorner[] = [];
    const absThr = threshold * maxR;

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
