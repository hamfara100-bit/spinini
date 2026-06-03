/**
 * Paint-bucket flood fill for the drawing canvas.
 *
 * The canvas is vector (SVG), so a true bucket fill is a raster operation: we
 * snapshot the canvas to a PNG, flood-fill the contiguous region under the tap
 * (stopping at drawn lines/edges), and write the result back out as a PNG that
 * the canvas shows as its background. MS-Paint style.
 */
import UPNG from "upng-js";
import { File, Paths } from "expo-file-system";
import { uid } from "./utils";

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Scanline flood fill: fill the region around (sx,sy) whose colour matches the
// start pixel within `tol`, with `fill`. Stops at lines/different colours.
function scanlineFill(
  data: Uint8Array, w: number, h: number,
  sx: number, sy: number, fill: [number, number, number], tol: number,
) {
  const at = (x: number, y: number) => (y * w + x) * 4;
  const start = at(sx, sy);
  const tr = data[start], tg = data[start + 1], tb = data[start + 2], ta = data[start + 3];
  const [fr, fg, fb] = fill;
  if (tr === fr && tg === fg && tb === fb && ta === 255) return; // already that colour

  const visited = new Uint8Array(w * h);
  const match = (x: number, y: number) => {
    const i = at(x, y);
    const dr = data[i] - tr, dg = data[i + 1] - tg, db = data[i + 2] - tb, da = data[i + 3] - ta;
    return dr * dr + dg * dg + db * db + da * da <= tol;
  };

  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (visited[y * w + x] || !match(x, y)) continue;
    // find span extent on this row
    let xl = x; while (xl > 0 && !visited[y * w + (xl - 1)] && match(xl - 1, y)) xl--;
    let xr = x; while (xr < w - 1 && !visited[y * w + (xr + 1)] && match(xr + 1, y)) xr++;
    let upPrev = false, downPrev = false;
    for (let i = xl; i <= xr; i++) {
      const p = at(i, y);
      data[p] = fr; data[p + 1] = fg; data[p + 2] = fb; data[p + 3] = 255;
      visited[y * w + i] = 1;
      if (y > 0) {
        const up = !visited[(y - 1) * w + i] && match(i, y - 1);
        if (up && !upPrev) { stack.push(i, y - 1); }
        upPrev = up;
      }
      if (y < h - 1) {
        const dn = !visited[(y + 1) * w + i] && match(i, y + 1);
        if (dn && !downPrev) { stack.push(i, y + 1); }
        downPrev = dn;
      }
    }
  }
}

/**
 * Flood-fill a captured canvas PNG at the given fractional tap point and return
 * the URI of the filled PNG (or null on failure).
 */
export async function floodFillImage(
  captureUri: string,
  tapXFrac: number,
  tapYFrac: number,
  fillHex: string,
): Promise<string | null> {
  try {
    const bytes = await new File(captureUri).bytes();
    if (!bytes || bytes.length === 0) return null;
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const img: any = UPNG.decode(buf);
    const w: number = img.width, h: number = img.height;
    const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);

    const sx = Math.min(w - 1, Math.max(0, Math.round(tapXFrac * w)));
    const sy = Math.min(h - 1, Math.max(0, Math.round(tapYFrac * h)));

    // Tolerance covers anti-aliased edges without bleeding through thin lines.
    const TOL = 48 * 48 * 3;
    scanlineFill(rgba, w, h, sx, sy, hexToRgb(fillHex), TOL);

    const png = UPNG.encode([rgba.buffer], w, h, 0); // 0 = lossless 32-bit
    const out = new File(Paths.cache, `fill-${uid()}.png`);
    out.write(new Uint8Array(png));
    return out.uri;
  } catch {
    return null;
  }
}
