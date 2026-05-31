export type EmbedType = "youtube" | "unknown";

export interface EmbedInfo {
  type: EmbedType;
  id: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
}

export function parseEmbed(url: string): EmbedInfo {
  const yt = extractYouTubeId(url);
  if (yt) {
    return {
      type: "youtube",
      id: yt,
      thumbnailUrl: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${yt}`,
    };
  }

  return { type: "unknown", id: null, thumbnailUrl: null, embedUrl: null };
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#/]+)/,
    /youtube\.com\/shorts\/([^?&#/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|mkv|webm)(\?.*)?$/i.test(url);
}
