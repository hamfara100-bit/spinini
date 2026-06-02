/**
 * Cross-device media sharing.
 * ----------------------------------------------------------------------------
 * Media picked/recorded on one device lives at a local `file://` URI that means
 * nothing on another device. To make it show everywhere we either:
 *   1. upload the bytes to Supabase Storage and sync the public URL, OR
 *   2. (images only, when no storage bucket exists) shrink the image and embed
 *      it as a base64 data URI right in the synced payload.
 *
 * This means PHOTOS work cross-device with ZERO setup. Audio/video need the
 * `family-media` storage bucket (run supabase/storage.sql once) — without it
 * they gracefully stay local (the author still sees them).
 */
import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";
import { uid } from "./utils";

const BUCKET = "family-media";
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "gif"]);

function extOf(uri: string): string {
  return (uri.split("?")[0].split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
}
function isImageUri(uri: string): boolean {
  return uri.startsWith("data:image") || IMAGE_EXT.has(extOf(uri));
}
function contentTypeFor(ext: string): string {
  switch (ext) {
    case "png":  return "image/png";
    case "gif":  return "image/gif";
    case "webp": return "image/webp";
    case "heic":
    case "heif": return "image/heic";
    case "mp4":
    case "m4v":  return "video/mp4";
    case "mov":  return "video/quicktime";
    case "m4a":
    case "aac":  return "audio/aac";
    case "mp3":  return "audio/mpeg";
    case "wav":  return "audio/wav";
    default:      return "image/jpeg";
  }
}

// Shrink + compress an image to keep payloads small (≈100-250 KB). Returns the
// compressed file uri and its base64 (JPEG, no data: prefix).
async function prepImage(uri: string): Promise<{ uri: string; base64: string } | null> {
  try {
    const r = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
      compress: 0.5, format: SaveFormat.JPEG, base64: true,
    });
    return { uri: r.uri, base64: r.base64 ?? "" };
  } catch {
    return null;
  }
}

async function tryStorageUpload(bytes: Uint8Array, path: string, contentType: string): Promise<string | null> {
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Make a local media URI shareable across devices. Returns a public URL or a
 * base64 data URI, or `null` if it can't be shared (caller should keep the
 * original local URI as a fallback so the author still sees it).
 */
export async function uploadMedia(localUri: string, opts?: { folder?: string }): Promise<string | null> {
  try {
    if (!localUri) return null;
    if (/^https?:\/\//i.test(localUri)) return localUri; // already remote
    if (/^data:/i.test(localUri)) return localUri;        // already embedded
    const folder = opts?.folder ?? "shared";

    if (isImageUri(localUri)) {
      const prepped = await prepImage(localUri);
      // 1) Try storage (efficient).
      try {
        const bytes = await new File(prepped?.uri ?? localUri).bytes();
        if (bytes && bytes.length > 0) {
          const url = await tryStorageUpload(bytes, `${folder}/${uid()}.jpg`, "image/jpeg");
          if (url) return url;
        }
      } catch {}
      // 2) No bucket / upload failed → embed as base64 so it STILL shows.
      if (prepped?.base64) return `data:image/jpeg;base64,${prepped.base64}`;
      return null;
    }

    // Audio / video — only storage can carry these.
    const bytes = await new File(localUri).bytes();
    if (!bytes || bytes.length === 0) return null;
    const ext = extOf(localUri) || "bin";
    return await tryStorageUpload(bytes, `${folder}/${uid()}.${ext}`, contentTypeFor(ext));
  } catch {
    return null;
  }
}

/** Upload several media URIs, preserving order; failures keep their local URI. */
export async function uploadMediaMany(localUris: string[], opts?: { folder?: string }): Promise<string[]> {
  const out: string[] = [];
  for (const uri of localUris) {
    const res = await uploadMedia(uri, opts);
    out.push(res ?? uri);
  }
  return out;
}
