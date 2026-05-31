/**
 * MemeStickerPicker — 3-tab modal for browsing & selecting:
 *   😂 Memes   (Imgflip API — free, no key)
 *   🎭 Stickers (curated built-in emoji packs)
 *   🎬 GIFs     (Tenor API v1 — free anonymous key)
 *
 * onSelect(uri, type) is called with the selected media.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, FlatList, ActivityIndicator, ScrollView,
  Dimensions, Platform,
} from "react-native";
import { Image } from "expo-image";
import { Colors, Radius } from "../lib/theme";

const { width: W, height: H } = Dimensions.get("window");

// ─── Free APIs ───────────────────────────────────────────────────────────────
const IMGFLIP_URL = "https://api.imgflip.com/get_memes";
// Tenor v1 free anonymous key (widely used in open-source non-commercial projects)
const TENOR_KEY  = "LIVDSRZULELA";
const TENOR_BASE = "https://api.tenor.com/v1";

// ─── Built-in sticker packs ──────────────────────────────────────────────────
type StickerCategory = { label: string; stickers: { emoji: string; caption: string; color: string }[] };

const STICKER_PACKS: StickerCategory[] = [
  {
    label: "😂 Funny",
    stickers: [
      { emoji: "😂", caption: "DEAD 💀",        color: "#FFE066" },
      { emoji: "🤣", caption: "LMAOOO",          color: "#FF9F43" },
      { emoji: "💀", caption: "I can't even",   color: "#A29BFE" },
      { emoji: "🫠", caption: "Send help",       color: "#74B9FF" },
      { emoji: "😭", caption: "Why tho 😭",      color: "#FD79A8" },
      { emoji: "🤡", caption: "Classic clown",  color: "#FF7675" },
      { emoji: "🫣", caption: "I saw nothing",  color: "#55EFC4" },
      { emoji: "🤦", caption: "Not again...",   color: "#FDCB6E" },
      { emoji: "🙈", caption: "No no no",       color: "#00B894" },
      { emoji: "😤", caption: "Fine then!",     color: "#E17055" },
      { emoji: "🥴", caption: "Uh oh",          color: "#6C5CE7" },
      { emoji: "😵‍💫", caption: "Brain broken",   color: "#81ECEC" },
    ],
  },
  {
    label: "🔥 Hype",
    stickers: [
      { emoji: "🔥", caption: "FIRE!!!",        color: "#FF6348" },
      { emoji: "💯", caption: "100%",           color: "#2ED573" },
      { emoji: "🚀", caption: "To the moon",   color: "#1E90FF" },
      { emoji: "👑", caption: "King/Queen",     color: "#FFD700" },
      { emoji: "💪", caption: "Let's go!",      color: "#FF4757" },
      { emoji: "🎉", caption: "PARTY TIME",     color: "#7BED9F" },
      { emoji: "⚡", caption: "Lightning fast", color: "#FFA502" },
      { emoji: "🏆", caption: "Winner winner",  color: "#ECCC68" },
      { emoji: "😎", caption: "Too cool",       color: "#3498DB" },
      { emoji: "🤩", caption: "Star struck",    color: "#F368E0" },
      { emoji: "💥", caption: "Boom!",          color: "#FF6B81" },
      { emoji: "🎯", caption: "Nailed it",      color: "#26DE81" },
    ],
  },
  {
    label: "💙 Sweet",
    stickers: [
      { emoji: "🥰", caption: "So cute",        color: "#FF9FF3" },
      { emoji: "💖", caption: "Love you!",      color: "#FF6B9D" },
      { emoji: "🤗", caption: "Big hug!",       color: "#FFE0B2" },
      { emoji: "🌈", caption: "Rainbow day",    color: "#74B9FF" },
      { emoji: "🦋", caption: "Flutter by",     color: "#A29BFE" },
      { emoji: "🌸", caption: "Blossom",        color: "#FFD6E0" },
      { emoji: "✨", caption: "Sparkle!",       color: "#FFF9C4" },
      { emoji: "🍪", caption: "Cookie time",    color: "#FFCC80" },
      { emoji: "🐶", caption: "Good boy",       color: "#D7CCC8" },
      { emoji: "🌟", caption: "You're a star",  color: "#FFE082" },
      { emoji: "🦄", caption: "Magical",        color: "#E1BEE7" },
      { emoji: "🍭", caption: "Sweet!",         color: "#F8BBD0" },
    ],
  },
  {
    label: "😏 Sassy",
    stickers: [
      { emoji: "💅", caption: "Not my problem", color: "#CE93D8" },
      { emoji: "🙄", caption: "Really tho?",   color: "#90CAF9" },
      { emoji: "😒", caption: "Okay sure",      color: "#A5D6A7" },
      { emoji: "🤨", caption: "Suspicious...",  color: "#FFCC80" },
      { emoji: "😌", caption: "No drama here",  color: "#80DEEA" },
      { emoji: "🫡", caption: "Yes boss",       color: "#EF9A9A" },
      { emoji: "🧢", caption: "Cap detected",   color: "#80CBC4" },
      { emoji: "👀", caption: "I see you",      color: "#BCAAA4" },
      { emoji: "🫶", caption: "We love this",   color: "#FF8A65" },
      { emoji: "😏", caption: "Oh really?",     color: "#B39DDB" },
      { emoji: "🤭", caption: "Oops lol",       color: "#F48FB1" },
      { emoji: "👁️‍🗨️", caption: "Watching...",   color: "#AED581" },
    ],
  },
  {
    label: "🐾 Animals",
    stickers: [
      { emoji: "🐱", caption: "Meow!",          color: "#FFE0B2" },
      { emoji: "🐶", caption: "Woof woof",      color: "#D7CCC8" },
      { emoji: "🐸", caption: "Ribbit",         color: "#A5D6A7" },
      { emoji: "🦊", caption: "Foxy!",          color: "#FFAB91" },
      { emoji: "🐼", caption: "Nom nom",        color: "#B0BEC5" },
      { emoji: "🦁", caption: "Roarrr",         color: "#FFCC80" },
      { emoji: "🐧", caption: "Waddle on",      color: "#80D8FF" },
      { emoji: "🦋", caption: "Beautiful",      color: "#CE93D8" },
      { emoji: "🦜", caption: "Pretty bird",    color: "#A5D6A7" },
      { emoji: "🐨", caption: "Chilling",       color: "#CFD8DC" },
      { emoji: "🦄", caption: "Magic!",         color: "#EF9A9A" },
      { emoji: "🦭", caption: "Bloop",          color: "#80DEEA" },
    ],
  },
];

// Pack a sticker into a URI-like string to pass back (type stays "sticker")
export function encodeStickerUri(emoji: string, caption: string, color: string) {
  return `sticker://${encodeURIComponent(emoji)}|${encodeURIComponent(caption)}|${encodeURIComponent(color)}`;
}
export function decodeStickerUri(uri: string): { emoji: string; caption: string; color: string } | null {
  if (!uri.startsWith("sticker://")) return null;
  const [emoji, caption, color] = uri.replace("sticker://", "").split("|").map(decodeURIComponent);
  return { emoji, caption, color };
}

// ─── Meme item ────────────────────────────────────────────────────────────────
type MemeTemplate = { id: string; name: string; url: string };

function MemeGrid({ onSelect }: { onSelect: (url: string) => void }) {
  const [memes, setMemes] = useState<MemeTemplate[]>([]);
  const [filtered, setFiltered] = useState<MemeTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(IMGFLIP_URL)
      .then(r => r.json())
      .then((d: any) => {
        const list: MemeTemplate[] = d?.data?.memes ?? [];
        setMemes(list);
        setFiltered(list);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!query.trim()) { setFiltered(memes); return; }
    setFiltered(memes.filter(m => m.name.toLowerCase().includes(query.toLowerCase())));
  }, [query, memes]);

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /><Text style={s.loadingText}>Loading memes…</Text></View>;
  if (error)   return <View style={s.center}><Text style={{ fontSize: 40 }}>😵</Text><Text style={s.errorText}>Couldn't load memes{"\n"}Check your connection</Text></View>;

  const CELL = (W - 48) / 2;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchRow}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search memes…"
          placeholderTextColor="#888"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}><Text style={s.clearBtn}>✕</Text></TouchableOpacity>
        )}
      </View>
      {filtered.length === 0 && (
        <View style={s.center}><Text style={{ fontSize: 40 }}>🔍</Text><Text style={s.errorText}>No memes found for "{query}"</Text></View>
      )}
      <FlatList
        data={filtered}
        keyExtractor={m => m.id}
        numColumns={2}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onSelect(item.url)} style={[s.memeCard, { width: CELL }]}>
            <Image
              source={{ uri: item.url }}
              style={{ width: CELL, height: CELL * 0.8, borderRadius: Radius.md }}
              contentFit="cover"
              transition={200}
            />
            <Text style={s.memeName} numberOfLines={2}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ─── Sticker grid ─────────────────────────────────────────────────────────────
function StickerGrid({ onSelect }: { onSelect: (uri: string) => void }) {
  const [catIndex, setCatIndex] = useState(0);
  const [query, setQuery] = useState("");

  const currentPack = STICKER_PACKS[catIndex];
  const stickers = query.trim()
    ? STICKER_PACKS.flatMap(p => p.stickers).filter(
        s => s.emoji.includes(query) || s.caption.toLowerCase().includes(query.toLowerCase())
      )
    : currentPack.stickers;

  const CELL = (W - 48) / 3;

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={s.searchRow}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search stickers…"
          placeholderTextColor="#888"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}><Text style={s.clearBtn}>✕</Text></TouchableOpacity>
        )}
      </View>

      {/* Category tabs */}
      {!query.trim() && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          {STICKER_PACKS.map((p, i) => (
            <TouchableOpacity
              key={p.label}
              style={[s.catTab, catIndex === i && s.catTabActive]}
              onPress={() => setCatIndex(i)}
            >
              <Text style={[s.catTabText, catIndex === i && s.catTabTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Sticker grid */}
      <FlatList
        data={stickers}
        keyExtractor={(_, i) => String(i)}
        numColumns={3}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.stickerCard, { width: CELL, height: CELL, backgroundColor: item.color + "44" }]}
            onPress={() => onSelect(encodeStickerUri(item.emoji, item.caption, item.color))}
          >
            <Text style={{ fontSize: CELL * 0.35 }}>{item.emoji}</Text>
            <Text style={[s.stickerCaption, { fontSize: CELL * 0.1 + 5 }]} numberOfLines={2}>{item.caption}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.center}><Text style={{ fontSize: 40 }}>🔍</Text><Text style={s.errorText}>No stickers match</Text></View>
        }
      />
    </View>
  );
}

// ─── GIF grid ─────────────────────────────────────────────────────────────────
type TenorGif = { id: string; url: string; preview: string };

function GifGrid({ onSelect }: { onSelect: (url: string) => void }) {
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const debounceRef = useRef<any>(null);

  function fetchGifs(q: string) {
    setLoading(true);
    setError(false);
    const endpoint = q.trim()
      ? `${TENOR_BASE}/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=24&media_filter=minimal`
      : `${TENOR_BASE}/trending?key=${TENOR_KEY}&limit=24&media_filter=minimal`;

    fetch(endpoint)
      .then(r => r.json())
      .then((d: any) => {
        const results: TenorGif[] = (d?.results ?? []).map((r: any) => ({
          id: r.id,
          url: r.media?.[0]?.gif?.url ?? "",
          preview: r.media?.[0]?.tinygif?.url ?? r.media?.[0]?.gif?.url ?? "",
        })).filter((g: TenorGif) => g.url);
        setGifs(results);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => { fetchGifs(""); }, []);

  function handleSearch(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(q), 500);
  }

  const CELL = (W - 48) / 2;

  if (error) return (
    <View style={s.center}>
      <Text style={{ fontSize: 40 }}>📡</Text>
      <Text style={s.errorText}>Couldn't load GIFs{"\n"}Check your connection</Text>
      <TouchableOpacity style={s.retryBtn} onPress={() => fetchGifs(query)}>
        <Text style={s.retryBtnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchRow}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Search GIFs…"
          placeholderTextColor="#888"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(""); fetchGifs(""); }}>
            <Text style={s.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick-search pills */}
      {!query.trim() && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          {["😂 funny", "🎉 party", "💀 dead", "🔥 fire", "🐱 cat", "🐶 dog", "💖 love", "😴 sleep", "🤣 lol", "🎮 gaming"].map(pill => (
            <TouchableOpacity key={pill} style={s.pillBtn} onPress={() => handleSearch(pill.split(" ")[1])}>
              <Text style={s.pillText}>{pill}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /><Text style={s.loadingText}>Loading GIFs…</Text></View>
      ) : (
        <FlatList
          data={gifs}
          keyExtractor={g => g.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          columnWrapperStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => onSelect(item.url)} style={{ width: CELL }}>
              <Image
                source={{ uri: item.preview }}
                style={{ width: CELL, height: CELL * 0.75, borderRadius: Radius.md }}
                contentFit="cover"
                transition={100}
                cachePolicy="memory-disk"
              />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={s.errorText}>No GIFs found{query ? ` for "${query}"` : ""}</Text>
            </View>
          }
        />
      )}
      <Text style={s.poweredBy}>Powered by Tenor</Text>
    </View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
type PickerTab = "meme" | "sticker" | "gif";

interface MemeStickerPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (uri: string, type: "meme" | "gif" | "sticker") => void;
}

export function MemeStickerPicker({ visible, onClose, onSelect }: MemeStickerPickerProps) {
  const [tab, setTab] = useState<PickerTab>("meme");

  const TABS: { id: PickerTab; label: string }[] = [
    { id: "meme",    label: "😂 Memes"    },
    { id: "sticker", label: "🎭 Stickers" },
    { id: "gif",     label: "🎬 GIFs"     },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Fun Stuff 🎉</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, tab === t.id && s.tabActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {tab === "meme"    && <MemeGrid    onSelect={url => onSelect(url, "meme")}    />}
          {tab === "sticker" && <StickerGrid onSelect={uri => onSelect(uri, "sticker")} />}
          {tab === "gif"     && <GifGrid     onSelect={url => onSelect(url, "gif")}     />}
        </View>
      </View>
    </Modal>
  );
}

// ─── Sticker render helper (used in PostCard) ─────────────────────────────────
export function StickerDisplay({ uri, size = "full" }: { uri: string; size?: "full" | "small" }) {
  const data = decodeStickerUri(uri);
  if (!data) return null;
  const { emoji, caption, color } = data;
  const isSmall = size === "small";
  return (
    <View style={[sd.root, { backgroundColor: color + "55" }, isSmall && sd.rootSmall]}>
      <Text style={[sd.emoji, isSmall && sd.emojiSmall]}>{emoji}</Text>
      <Text style={[sd.caption, isSmall && sd.captionSmall]} numberOfLines={2}>{caption}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D1A" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 16 : 12, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "#1E1E36",
  },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 18 },
  closeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#1E1E36", borderRadius: 22 },
  closeBtnText: { color: "#888", fontSize: 18 },
  tabBar: {
    flexDirection: "row", gap: 0,
    backgroundColor: "#1A1A2E", marginHorizontal: 16, marginVertical: 12,
    borderRadius: 14, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { color: "#888", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingText: { color: "#888", fontSize: 14, marginTop: 8 },
  errorText: { color: "#888", fontSize: 15, textAlign: "center", lineHeight: 22 },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1E1E36", marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, paddingHorizontal: 12, gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 12 },
  clearBtn: { color: "#888", fontSize: 18, paddingHorizontal: 4 },
  memeCard: { borderRadius: Radius.md, overflow: "hidden", backgroundColor: "#1A1A2E" },
  memeName: { color: "#AAA", fontSize: 11, padding: 6, textAlign: "center" },
  stickerCard: {
    borderRadius: 18, alignItems: "center", justifyContent: "center",
    gap: 4, borderWidth: 2, borderColor: "transparent",
  },
  stickerCaption: { color: "#333", fontWeight: "800", textAlign: "center", paddingHorizontal: 4 },
  catTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1E1E36" },
  catTabActive: { backgroundColor: Colors.primary },
  catTabText: { color: "#888", fontSize: 13, fontWeight: "700" },
  catTabTextActive: { color: "#fff" },
  pillBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1E1E36" },
  pillText: { color: "#CCC", fontSize: 13 },
  poweredBy: { textAlign: "center", color: "#444", fontSize: 10, paddingBottom: 8 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
});

const sd = StyleSheet.create({
  root: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 12, padding: 24,
  },
  rootSmall: { padding: 8, gap: 4, borderRadius: 16 },
  emoji: { fontSize: 96 },
  emojiSmall: { fontSize: 48 },
  caption: { fontSize: 28, fontWeight: "900", color: "#1A1A2E", textAlign: "center" },
  captionSmall: { fontSize: 14 },
});
