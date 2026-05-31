/**
 * Local data export — "Export my data" + "Save photos to gallery".
 * ----------------------------------------------------------------------------
 * Replaces the old Google Drive/Photos API backup. Instead of uploading to
 * Google (which needed restricted OAuth scopes), we package everything into a
 * neat .zip the user can hand to Drive / Files / anywhere via the system share
 * sheet, and optionally drop the photos straight into the device gallery under
 * an app album.
 *
 * Zip layout (per child):
 *   <Brand> Export <date>/
 *     README.txt
 *     <ChildName>/
 *       notes/    journal entries + notes, as .txt
 *       ideas/    saved ideas, as .txt
 *       photos/   every picture attached to that child's content
 *       data.json full structured data (for re-import; image blobs stripped)
 *     family/memories/  shared family memories (story .txt + photos)
 *
 * Photos are gathered by deep-walking each child's state for image URIs
 * (data:image, file://, content://), so no picture is missed regardless of which
 * feature created it.
 */

import { File, Directory, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as DocumentPicker from "expo-document-picker";
import { buildZip, readZip, utf8Decode, type ZipEntry } from "./zip";

/** App brand — used for the zip name and the gallery album. One-line rename. */
export const APP_BRAND = "Spinini";

/** Sentinel that stands in for an image inside the restore manifest. On import
 *  it's resolved back to a real file by reading the referenced zip entry, so the
 *  manifest never duplicates the (already-stored) photo bytes. */
const PHOTO_TOKEN = "spinini-photo://";
/** Path of the machine-restorable manifest inside the export zip. */
const RESTORE_PATH = "_restore/state.json";

export interface ExportResult {
  fileUri: string;
  kids: number;
  noteCount: number;
  ideaCount: number;
  photoCount: number;
}

// ─── base64 → bytes (no atob in Hermes) ──────────────────────────────────────
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64_CHARS.length; i++) t[B64_CHARS.charCodeAt(i)] = i;
  return t;
})();

function b64ToBytes(input: string): Uint8Array {
  const b64 = input.replace(/[^A-Za-z0-9+/=]/g, "");
  let len = Math.floor(b64.length * 0.75);
  if (b64.endsWith("==")) len -= 2;
  else if (b64.endsWith("=")) len -= 1;
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const e1 = B64_LOOKUP[b64.charCodeAt(i)];
    const e2 = B64_LOOKUP[b64.charCodeAt(i + 1)];
    const e3 = B64_LOOKUP[b64.charCodeAt(i + 2)];
    const e4 = B64_LOOKUP[b64.charCodeAt(i + 3)];
    if (p < len) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (e3 !== -1 && p < len) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (e4 !== -1 && p < len) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
}

// ─── image discovery + reading ───────────────────────────────────────────────
const IMG_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp)(?:\?.*)?$/i;

/** Returns an image extension for a URI we consider a picture, else null. */
function imageExtOf(uri: string): string | null {
  if (uri.startsWith("data:image")) {
    const mime = uri.slice(5, uri.indexOf(";"));
    const sub = mime.split("/")[1] ?? "jpg";
    return (sub === "jpeg" ? "jpg" : sub).toLowerCase();
  }
  if (uri.startsWith("file://") || uri.startsWith("content://")) {
    const m = IMG_EXT_RE.exec(uri);
    if (m) return (m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase());
  }
  return null;
}

/** Deep-walk any value collecting picture URIs (capped, depth-limited). */
function collectImages(node: any, out: Set<string>, depth = 0): void {
  if (node == null || depth > 8 || out.size >= 1000) return;
  if (typeof node === "string") {
    if (imageExtOf(node)) out.add(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectImages(v, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    for (const k in node) collectImages((node as any)[k], out, depth + 1);
  }
}

async function readImageBytes(uri: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  const ext = imageExtOf(uri);
  if (!ext) return null;
  try {
    if (uri.startsWith("data:")) {
      const comma = uri.indexOf(",");
      return { bytes: b64ToBytes(uri.slice(comma + 1)), ext };
    }
    const b64 = await new File(uri).base64();
    return { bytes: b64ToBytes(b64), ext };
  } catch {
    return null; // unreadable (e.g. some content:// or remote uris) — skip it
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function sanitize(name: string): string {
  const s = (name ?? "").replace(/[^\w\-. ]+/g, "_").trim().slice(0, 60);
  return s || "untitled";
}

const pad3 = (n: number) => String(n).padStart(3, "0");

/** Pretty JSON with embedded image blobs stripped (they live in photos/). */
function safeJson(obj: any): string {
  return JSON.stringify(
    obj,
    (_k, v) =>
      typeof v === "string" && v.startsWith("data:") && v.length > 200
        ? "[embedded image omitted — see photos/ folder]"
        : v,
    2,
  );
}

// ─── build the zip ───────────────────────────────────────────────────────────
export async function buildExportZip(state: any): Promise<ExportResult> {
  const entries: ZipEntry[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const root = `${APP_BRAND} Export ${today}`;
  let noteCount = 0, ideaCount = 0, photoCount = 0;

  // original image URI → path inside the zip. Dedups across the whole export and
  // lets the restore manifest reference photos by path instead of duplicating them.
  const photoMap = new Map<string, string>();
  async function addPhotos(node: any, dirPrefix: string): Promise<void> {
    const uris = new Set<string>();
    collectImages(node, uris);
    let pi = 0;
    for (const uri of uris) {
      if (photoMap.has(uri)) continue;
      const img = await readImageBytes(uri);
      if (!img) continue;
      const path = `${dirPrefix}/photo-${pad3(++pi)}.${img.ext}`;
      entries.push({ path, data: img.bytes });
      photoMap.set(uri, path);
      photoCount++;
    }
  }

  entries.push({
    path: `${root}/README.txt`,
    data:
      `${APP_BRAND} data export\nCreated: ${new Date().toLocaleString()}\n\n` +
      `Your family's notes, ideas and photos, organised by child.\n` +
      `  notes/     journal entries and notes (plain text)\n` +
      `  ideas/     saved ideas (plain text)\n` +
      `  photos/    pictures attached to that child's entries\n` +
      `  data.json  full structured data, for re-importing later\n\n` +
      `Tip: upload this whole .zip to Google Drive (or any cloud) to keep it safe.\n`,
  });

  const kids = state.kids ?? [];
  for (const kid of kids) {
    const kidName = sanitize(kid?.profile?.name ?? "Child");
    const base = `${root}/${kidName}`;

    (kid.journal ?? []).forEach((j: any, i: number) => {
      const date = String(j.createdAt ?? "").slice(0, 10);
      entries.push({
        path: `${base}/notes/journal-${pad3(i + 1)}-${date || "entry"}.txt`,
        data: `Date: ${date || "—"}\nMood: ${j.mood ?? "—"}\n\n${j.text ?? ""}\n`,
      });
      noteCount++;
    });

    (kid.kidNotes ?? []).forEach((n: any, i: number) => {
      entries.push({
        path: `${base}/notes/note-${pad3(i + 1)}-${sanitize(n.title ?? "note")}.txt`,
        data: `${n.title ?? "Note"}\n\n${n.content ?? ""}\n`,
      });
      noteCount++;
    });

    (kid.ideas ?? []).forEach((idea: any, i: number) => {
      const body = idea.content ?? idea.text ?? "";
      entries.push({
        path: `${base}/ideas/idea-${pad3(i + 1)}-${sanitize(idea.title ?? "idea")}.txt`,
        data: `${idea.title ?? "Idea"}\n\n${body}\n`,
      });
      ideaCount++;
    });

    await addPhotos(kid, `${base}/photos`);

    entries.push({ path: `${base}/data.json`, data: safeJson(kid) });
  }

  // Shared family memories (story + photos).
  const memories = state.memories ?? [];
  memories.forEach((m: any, i: number) => {
    const date = String(m.date ?? m.createdAt ?? "").slice(0, 10);
    entries.push({
      path: `${root}/family/memories/memory-${pad3(i + 1)}-${date || "memory"}.txt`,
      data: `${m.title ?? "Memory"}\nDate: ${date || "—"}\nMood: ${m.mood ?? ""}\n\n${m.story ?? ""}\n`,
    });
    noteCount++;
  });
  if (memories.length) {
    await addPhotos(memories, `${root}/family/memories/photos`);
  }

  // Machine-restorable manifest: the FULL app state, with every image swapped for
  // a PHOTO_TOKEN + zip-path reference (so photos aren't stored twice). Import
  // reads this back and resolves the references to real files. Lives at the zip
  // root so import can find it regardless of the dated folder name.
  const tokenizeImages = (n: any): any => {
    if (typeof n === "string") return photoMap.has(n) ? PHOTO_TOKEN + photoMap.get(n)! : n;
    if (Array.isArray(n)) return n.map(tokenizeImages);
    if (n && typeof n === "object") {
      const o: any = {};
      for (const k in n) o[k] = tokenizeImages((n as any)[k]);
      return o;
    }
    return n;
  };
  entries.push({ path: RESTORE_PATH, data: JSON.stringify(tokenizeImages(state)) });

  const zipBytes = buildZip(entries);
  const file = new File(Paths.cache, `${APP_BRAND.toLowerCase()}-export-${today}.zip`);
  try { if (file.exists) file.delete(); } catch { /* fresh write below */ }
  file.create();
  file.write(zipBytes);

  return { fileUri: file.uri, kids: kids.length, noteCount, ideaCount, photoCount };
}

/** Open the OS share sheet for an already-built export file. */
export async function shareFile(fileUri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: "application/zip",
    dialogTitle: `Share your ${APP_BRAND} export`,
    UTI: "public.zip-archive",
  });
}

/** Build the export zip and immediately hand it to the share sheet. */
export async function exportAndShare(state: any): Promise<ExportResult> {
  const result = await buildExportZip(state);
  await shareFile(result.fileUri);
  return result;
}

// ─── save photos to the device gallery (album) ───────────────────────────────
/**
 * Save every picture in the family's data into the device gallery, grouped in
 * an album named after the app. Returns how many were saved.
 */
export async function savePhotosToGallery(state: any): Promise<number> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) throw new Error("Photo library permission is needed to save pictures.");

  const uris = new Set<string>();
  collectImages(state.kids ?? [], uris);
  collectImages(state.memories ?? [], uris);

  let album = await MediaLibrary.getAlbumAsync(APP_BRAND);
  let saved = 0;
  for (const uri of uris) {
    try {
      // MediaLibrary needs a real file with an extension; data: URIs get written
      // to a temp file first, file:// uris are used directly, others skipped.
      let localUri = uri;
      if (uri.startsWith("data:")) {
        const img = await readImageBytes(uri);
        if (!img) continue;
        const tmp = new File(Paths.cache, `gallery-${saved}-${Date.now()}.${img.ext}`);
        try { if (tmp.exists) tmp.delete(); } catch { /* overwrite */ }
        tmp.create();
        tmp.write(img.bytes);
        localUri = tmp.uri;
      } else if (!uri.startsWith("file://")) {
        continue;
      }

      const asset = await MediaLibrary.createAssetAsync(localUri);
      if (!album) album = await MediaLibrary.createAlbumAsync(APP_BRAND, asset, false);
      else await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      saved++;
    } catch {
      /* skip this one picture, keep going */
    }
  }
  return saved;
}

// ─── import / restore (device migration) ─────────────────────────────────────
export interface ImportSummary {
  /** The restored full app state — apply with the store's @@HYDRATE. */
  state: any;
  kids: number;
  photosRestored: number;
}

/**
 * Let the user pick a Spinini export .zip and rebuild the full app state from
 * its `_restore/state.json` manifest. Referenced photos are written to the app's
 * document directory and re-linked as file:// uris, so the restored state stays
 * small. Returns null if the user cancels the picker.
 *
 * This is the other half of "a kid changes device": export on the old phone,
 * import here on the new one. The caller applies the result via @@HYDRATE, which
 * replaces and persists the state.
 *
 * NOTE: device-local secrets kept in SecureStore (Google login tokens, the
 * password-vault entries) are NOT in the export and won't transfer — only the
 * family content does.
 */
export async function importBackup(): Promise<ImportSummary | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/zip", "application/octet-stream", "*/*"],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const zipBytes = b64ToBytes(await new File(picked.assets[0].uri).base64());

  let map: Map<string, Uint8Array>;
  try {
    map = readZip(zipBytes);
  } catch {
    throw new Error("That file isn't a valid Spinini export (.zip).");
  }

  const manifest = map.get(RESTORE_PATH);
  if (!manifest) throw new Error("This .zip isn't a Spinini backup (no restore data inside).");
  const restored = JSON.parse(utf8Decode(manifest));

  // Resolve photo references back into real files under the document directory.
  const dir = new Directory(Paths.document, "imported-photos");
  try { if (!dir.exists) dir.create(); } catch { /* may already exist */ }

  let photosRestored = 0;
  let idx = 0;
  const resolve = (n: any): any => {
    if (typeof n === "string") {
      if (!n.startsWith(PHOTO_TOKEN)) return n;
      const zipPath = n.slice(PHOTO_TOKEN.length);
      const bytes = map.get(zipPath);
      if (!bytes) return undefined; // photo missing from archive — drop the link
      const ext = (zipPath.split(".").pop() || "jpg").toLowerCase();
      const f = new File(dir, `img-${idx++}.${ext}`);
      try { if (f.exists) f.delete(); } catch { /* overwrite */ }
      f.create();
      f.write(bytes);
      photosRestored++;
      return f.uri;
    }
    if (Array.isArray(n)) return n.map(resolve);
    if (n && typeof n === "object") {
      const o: any = {};
      for (const k in n) o[k] = resolve((n as any)[k]);
      return o;
    }
    return n;
  };

  const state = resolve(restored);
  const kids = Array.isArray(state?.kids) ? state.kids.length : 0;
  return { state, kids, photosRestored };
}
