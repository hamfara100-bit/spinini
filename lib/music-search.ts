/**
 * music-search.ts — free song search for the family social feed.
 *
 * Uses Apple's iTunes Search API (https://performance-partners.apple.com/
 * search-api). It's free, needs NO API key, is CORS-friendly, and returns a
 * 30-second `previewUrl` (m4a) for almost every track — perfect for attaching a
 * clip to a photo/video the TikTok way. Deezer is used as a fallback.
 *
 * Nothing is downloaded or stored: we keep the streaming preview URL on the post
 * and play it on demand.
 */

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl?: string;
}

const ITUNES = "https://itunes.apple.com/search";
const DEEZER = "https://api.deezer.com/search";

/** Higher-res artwork than the default 100×100 Apple thumbnail. */
function bumpArtwork(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+bb\./, "/300x300bb.");
}

async function searchItunes(query: string, limit: number): Promise<MusicTrack[]> {
  const url = `${ITUNES}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  const json = await res.json();
  return (json.results ?? [])
    .filter((r: any) => r.previewUrl)
    .map((r: any) => ({
      id: String(r.trackId ?? `${r.artistName}-${r.trackName}`),
      title: r.trackName ?? "Unknown",
      artist: r.artistName ?? "Unknown artist",
      previewUrl: r.previewUrl as string,
      artworkUrl: bumpArtwork(r.artworkUrl100 ?? r.artworkUrl60),
    }));
}

async function searchDeezer(query: string, limit: number): Promise<MusicTrack[]> {
  const url = `${DEEZER}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`deezer ${res.status}`);
  const json = await res.json();
  return (json.data ?? [])
    .filter((r: any) => r.preview)
    .map((r: any) => ({
      id: String(r.id),
      title: r.title ?? "Unknown",
      artist: r.artist?.name ?? "Unknown artist",
      previewUrl: r.preview as string,
      artworkUrl: r.album?.cover_medium ?? r.album?.cover,
    }));
}

/**
 * Search songs by title / artist. Tries iTunes first, then Deezer. Returns up to
 * `limit` tracks that have a playable preview. Never throws — returns [] on error.
 */
export async function searchMusic(query: string, limit = 25): Promise<MusicTrack[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const r = await searchItunes(q, limit);
    if (r.length > 0) return r;
  } catch {}
  try {
    return await searchDeezer(q, limit);
  } catch {}
  return [];
}

/** A few ready-made searches to seed the picker before the user types. */
export const MUSIC_SUGGESTIONS = [
  "Happy", "Birthday", "Summer hits", "Kids songs",
  "Pop 2024", "Feel good", "Party", "Chill",
];
