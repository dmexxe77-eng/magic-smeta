/**
 * Harris Corner Detection using @shopify/react-native-skia
 *
 * Detects corners on building plans/blueprints by analyzing pixel data.
 * Steps: grayscale → Sobel gradients → Harris response → NMS → top N corners.
 */

import { Skia } from '@shopify/react-native-skia';

export interface DetectedCorner {
  x: number; // image pixel X
  y: number; // image pixel Y
  strength: number;
}

/**
 * Detect corners in an image using Harris corner detection.
 * Returns up to `maxCorners` corners sorted by strength.
 */
export async function detectCorners(
  imageUri: string,
  maxCorners: number = 300,
  blockSize: number = 3,
  kFactor: number = 0.04,
  threshold: number = 0.01,
): Promise<DetectedCorner[]> {
  try {
    // Load image data via Skia
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    const skData = Skia.Data.fromBytes(data);
    const skImage = Skia.Image.MakeImageFromEncoded(skData);
    if (!skImage) return [];

    const w = skImage.width();
    const h = skImage.height();

    // Downsample for performance (max 800px wide)
    const scale = Math.min(1, 800 / w);
    const sw = Math.round(w * scale);
    const sh = Math.round(h * scale);

    // Read pixels
    const surface = Skia.Surface.Make(sw, sh)!;
    const canvas = surface.getCanvas();
    const paint = Skia.Paint();

    canvas.drawImageRect(
      skImage,
      Skia.XYWHRect(0, 0, w, h),
      Skia.XYWHRect(0, 0, sw, sh),
      paint,
    );

    const snapshot = surface.makeImageSnapshot();
    const pixelData = snapshot.readPixels(0, 0, {
      width: sw,
      height: sh,
      colorType: 4, // RGBA_8888
      alphaType: 1, // Premul
    });

    if (!pixelData) return [];
    const pixels = new Uint8Array(pixelData);

    // Convert to grayscale
    const gray = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }

    // Sobel gradients
    const Ix = new Float32Array(sw * sh);
    const Iy = new Float32Array(sw * sh);

    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const idx = y * sw + x;
        Ix[idx] =
          -gray[(y - 1) * sw + (x - 1)] + gray[(y - 1) * sw + (x + 1)]
          - 2 * gray[y * sw + (x - 1)] + 2 * gray[y * sw + (x + 1)]
          - gray[(y + 1) * sw + (x - 1)] + gray[(y + 1) * sw + (x + 1)];

        Iy[idx] =
          -gray[(y - 1) * sw + (x - 1)] - 2 * gray[(y - 1) * sw + x] - gray[(y - 1) * sw + (x + 1)]
          + gray[(y + 1) * sw + (x - 1)] + 2 * gray[(y + 1) * sw + x] + gray[(y + 1) * sw + (x + 1)];
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
            const idx = (y + dy) * sw + (x + dx);
            sxx += Ix[idx] * Ix[idx];
            sxy += Ix[idx] * Iy[idx];
            syy += Iy[idx] * Iy[idx];
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

    // Non-maximum suppression
    const nmsRadius = 5;
    const corners: DetectedCorner[] = [];
    const absThreshold = threshold * maxR;

    for (let y = nmsRadius; y < sh - nmsRadius; y++) {
      for (let x = nmsRadius; x < sw - nmsRadius; x++) {
        const val = R[y * sw + x];
        if (val < absThreshold) continue;

        let isMax = true;
        for (let dy = -nmsRadius; dy <= nmsRadius && isMax; dy++) {
          for (let dx = -nmsRadius; dx <= nmsRadius && isMax; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (R[(y + dy) * sw + (x + dx)] > val) isMax = false;
          }
        }

        if (isMax) {
          // Convert back to original image coordinates
          corners.push({
            x: x / scale,
            y: y / scale,
            strength: val,
          });
        }
      }
    }

    // Sort by strength, take top N
    corners.sort((a, b) => b.strength - a.strength);
    return corners.slice(0, maxCorners);
  } catch (e) {
    console.warn('Corner detection failed:', e);
    return [];
  }
}
