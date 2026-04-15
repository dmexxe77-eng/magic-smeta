/**
 * Corner Detection for architectural plans
 *
 * Works with any plan style:
 * - Black lines on white/colored background
 * - Gray hatched walls on white
 * - Colored contour lines (pink, blue)
 *
 * Approach: Harris on EDGE MAP (not raw grayscale).
 * Edge map captures boundaries regardless of color.
 * Post-filter: corner must be at intersection of edges in 2+ directions.
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

    // Grayscale
    const gray = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      gray[i] = (0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]) / 255;
    }

    // ── Step 1: Sobel edge magnitude ────────────────────────────────
    // This captures ALL edges — color transitions, line boundaries, etc.
    const edgeMag = new Float32Array(sw * sh);
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        const gx = -gray[(y-1)*sw+(x-1)] + gray[(y-1)*sw+(x+1)]
                   - 2*gray[y*sw+(x-1)] + 2*gray[y*sw+(x+1)]
                   - gray[(y+1)*sw+(x-1)] + gray[(y+1)*sw+(x+1)];
        const gy = -gray[(y-1)*sw+(x-1)] - 2*gray[(y-1)*sw+x] - gray[(y-1)*sw+(x+1)]
                   + gray[(y+1)*sw+(x-1)] + 2*gray[(y+1)*sw+x] + gray[(y+1)*sw+(x+1)];
        edgeMag[i] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // ── Step 2: Edge threshold — find strong edges ──────────────────
    let maxEdge = 0;
    for (let i = 0; i < sw * sh; i++) if (edgeMag[i] > maxEdge) maxEdge = i;
    // Actually find max value
    maxEdge = 0;
    for (let i = 0; i < sw * sh; i++) if (edgeMag[i] > maxEdge) maxEdge = edgeMag[i];

    const edgeThreshold = maxEdge * 0.15; // top 85% edges are "strong"
    const isEdge = new Uint8Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) isEdge[i] = edgeMag[i] > edgeThreshold ? 1 : 0;

    // ── Step 3: Harris on edge map ──────────────────────────────────
    // Compute gradients on the EDGE map (not grayscale)
    const Ix = new Float32Array(sw * sh);
    const Iy = new Float32Array(sw * sh);
    const edgeF = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) edgeF[i] = edgeMag[i] / (maxEdge || 1);

    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        Ix[i] = -edgeF[(y-1)*sw+(x-1)] + edgeF[(y-1)*sw+(x+1)]
               - 2*edgeF[y*sw+(x-1)] + 2*edgeF[y*sw+(x+1)]
               - edgeF[(y+1)*sw+(x-1)] + edgeF[(y+1)*sw+(x+1)];
        Iy[i] = -edgeF[(y-1)*sw+(x-1)] - 2*edgeF[(y-1)*sw+x] - edgeF[(y-1)*sw+(x+1)]
               + edgeF[(y+1)*sw+(x-1)] + 2*edgeF[(y+1)*sw+x] + edgeF[(y+1)*sw+(x+1)];
      }
    }

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

    // ── Step 4: NMS + edge intersection filter ──────────────────────
    const nmsR = 10;
    const corners: DetectedCorner[] = [];
    const absThr = 0.05 * maxR;

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

        // Must be near strong edges in 2+ perpendicular directions
        // Check 4 rays: find edges along each
        const rayLen = 8;
        let edgeDirs = 0;

        // Horizontal edges (check up and down)
        let hasH = false;
        for (let d = -rayLen; d <= rayLen && !hasH; d++) {
          if (d === 0) continue;
          const cy = y + d;
          if (cy >= 0 && cy < sh && isEdge[cy * sw + x]) {
            // Check if this edge pixel has horizontal extent
            let hExtent = 0;
            for (let dx = -3; dx <= 3; dx++) {
              if (x + dx >= 0 && x + dx < sw && isEdge[cy * sw + (x + dx)]) hExtent++;
            }
            if (hExtent >= 3) hasH = true;
          }
        }
        if (hasH) edgeDirs++;

        // Vertical edges (check left and right)
        let hasV = false;
        for (let d = -rayLen; d <= rayLen && !hasV; d++) {
          if (d === 0) continue;
          const cx = x + d;
          if (cx >= 0 && cx < sw && isEdge[y * sw + cx]) {
            let vExtent = 0;
            for (let dy = -3; dy <= 3; dy++) {
              if (y + dy >= 0 && y + dy < sh && isEdge[(y + dy) * sw + cx]) vExtent++;
            }
            if (vExtent >= 3) hasV = true;
          }
        }
        if (hasV) edgeDirs++;

        if (edgeDirs < 2) continue;

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
