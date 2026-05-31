/**
 * Minimal ZIP writer (STORE method, no compression) — dependency-free.
 * ----------------------------------------------------------------------------
 * The data export bundles photos (already-compressed JPEG/PNG) and small text
 * files. Storing them uncompressed produces a valid `.zip` that every OS opens,
 * while avoiding a heavyweight dependency (jszip + pako) that doesn't love
 * React Native's Hermes runtime. We build the byte layout by hand: a local file
 * header + data per entry, then the central directory, then the end-of-central-
 * directory record (see the PKZIP APPNOTE spec).
 */

export interface ZipEntry {
  /** Path inside the archive, e.g. "Export/Emma/notes/day-1.txt". */
  path: string;
  /** UTF-8 text (encoded for you) or raw bytes (images). */
  data: Uint8Array | string;
}

// CRC-32 (IEEE) lookup table — required in every zip entry header.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** UTF-8 decode bytes → string (global TextDecoder, present in Hermes/SDK 54). */
export function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  // Minimal fallback (covers the ASCII + common multi-byte cases we emit).
  let s = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    if (b < 0x80) s += String.fromCharCode(b);
    else if (b < 0xe0) s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (b < 0xf0) s += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    else {
      const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const c = cp - 0x10000;
      s += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    }
  }
  return s;
}

/**
 * Read a STORE-method .zip (the kind buildZip produces) into a path→bytes map.
 * We parse the central directory, then jump to each local header to find the
 * real data offset. Compressed entries (method != 0, e.g. a file re-zipped by
 * another tool) are skipped — we only ever read our own uncompressed archives.
 */
export function readZip(zip: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const map = new Map<string, Uint8Array>();

  // Locate the End Of Central Directory record (scan back; our comment is empty).
  let eocd = -1;
  const minStart = Math.max(0, zip.length - 22 - 0xffff);
  for (let i = zip.length - 22; i >= minStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a valid .zip file.");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true); // central directory start offset

  for (let n = 0; n < count; n++) {
    if (p + 46 > zip.length || view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = utf8Decode(zip.subarray(p + 46, p + 46 + nameLen));

    // The local header's name/extra lengths can differ from the central dir's.
    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    if (method === 0) map.set(name, zip.subarray(dataStart, dataStart + compSize));

    p += 46 + nameLen + extraLen + commentLen;
  }
  return map;
}

/** UTF-8 encode, preferring the global TextEncoder (present in Hermes/SDK 54). */
function utf8(s: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) { out.push(c); }
    else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
    else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = s.charCodeAt(++i);
      c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
  }
  return new Uint8Array(out);
}

/** Build a complete .zip archive (STORE method) from the given entries. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0; // running offset of each local header within the file

  for (const e of entries) {
    const nameBytes = utf8(e.path);
    const data = typeof e.data === "string" ? utf8(e.data) : e.data;
    const crc = crc32(data);
    const size = data.length;

    // Local file header (30 bytes + name) — sizes equal since STORE.
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true);         // version needed
    lv.setUint16(6, 0x0800, true);     // flags: UTF-8 filename
    lv.setUint16(8, 0, true);          // method: 0 = store
    lv.setUint16(10, 0, true);         // mod time
    lv.setUint16(12, 0, true);         // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);      // compressed size
    lv.setUint32(22, size, true);      // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // extra field length
    local.set(nameBytes, 30);
    localChunks.push(local, data);

    // Central directory record (46 bytes + name).
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true);         // version made by
    cv.setUint16(6, 20, true);         // version needed
    cv.setUint16(8, 0x0800, true);     // flags
    cv.setUint16(10, 0, true);         // method
    cv.setUint16(12, 0, true);         // time
    cv.setUint16(14, 0, true);         // date
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);         // extra length
    cv.setUint16(32, 0, true);         // comment length
    cv.setUint16(34, 0, true);         // disk number start
    cv.setUint16(36, 0, true);         // internal attrs
    cv.setUint32(38, 0, true);         // external attrs
    cv.setUint32(42, offset, true);    // offset of local header
    cd.set(nameBytes, 46);
    centralChunks.push(cd);

    offset += local.length + data.length;
  }

  const centralSize = centralChunks.reduce((n, c) => n + c.length, 0);
  const centralOffset = offset;

  // End of central directory record (22 bytes, no comment).
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);                    // this disk number
  ev.setUint16(6, 0, true);                    // disk with central dir
  ev.setUint16(8, entries.length, true);       // entries on this disk
  ev.setUint16(10, entries.length, true);      // total entries
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);                   // comment length

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of localChunks)   { out.set(c, p); p += c.length; }
  for (const c of centralChunks) { out.set(c, p); p += c.length; }
  out.set(eocd, p);
  return out;
}
