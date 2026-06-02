/**
 * Cross-device media upload.
 * ----------------------------------------------------------------------------
 * Photos/videos picked on one device live at a local `file://` URI that means
 * nothing on another device. To share them across the family we upload the bytes
 * to Supabase Storage and sync the resulting public URL instead of the local
 * path. Both devices then load the media over the network.
 *
 * Requires the `family-media` storage bucket + policies — run supabase/storage.sql
 * once in the Supabase SQL editor.
 */
import { File } from "expo-file-system";
import { supabase } from "./supabase";
import { uid } from "./utils";

const BUCKET = "family-media";

function contentTypeFor(ext: string): string {
  switch (ext) {
    case "png":  return "image/png";
    case "gif":  return "image/gif";
    case "webp": return "image/webp";
    case "heic": return "image/heic";
    case "mp4":  return "video/mp4";
    case "mov":  return "video/quicktime";
    case "m4v":  return "video/mp4";
    default:      return "image/jpeg";
  }
}

/**
 * Upload a local media file and return its public URL. Returns the original URI
 * unchanged if it's already an http(s) URL, or `null` if the upload fails (the
 * caller can then fall back to the local URI so the author at least still sees
 * their own media).
 */
export async function uploadMedia(localUri: string, opts?: { folder?: string }): Promise<string | null> {
  try {
    if (!localUri) return null;
    if (/^https?:\/\//i.test(localUri)) return localUri; // already remote
    const bytes = await new File(localUri).bytes();
    if (!bytes || bytes.length === 0) return null;
    const ext = (localUri.split("?")[0].split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const path = `${opts?.folder ?? "shared"}/${uid()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: contentTypeFor(ext), upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Upload several local media files, preserving order. Any that fail to upload
 * keep their original local URI (so the author still sees them).
 */
export async function uploadMediaMany(localUris: string[], opts?: { folder?: string }): Promise<string[]> {
  const out: string[] = [];
  for (const uri of localUris) {
    const url = await uploadMedia(uri, opts);
    out.push(url ?? uri);
  }
  return out;
}
