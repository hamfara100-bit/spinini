/**
 * Kid Stories Screen
 *
 * Handles all story types sent by parents:
 *  - ai-text / ai-voice-clone  → Text reader with word-by-word karaoke highlighting
 *  - voice-audio               → Audio player with waveform visuals
 *  - voice-video               → Full-screen video player
 *  - YouTube / video / audio   → Media tab (existing)
 *  - My Stories                → Kid can write + record their own
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, ActivityIndicator, Image, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import * as WebBrowser from "expo-web-browser";
import { useAudioRecorder, useAudioPlayer, AudioModule, RecordingPresets } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { StoryItem, KidStory, StoryMedia, StoryMediaKind, StoryRecordingType } from "../../../../lib/data/types";

// ─── YouTube helpers ──────────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#/]+)/,
    /youtube\.com\/shorts\/([^?&#/]+)/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m?.[1]) return m[1]; }
  return null;
}

function youtubeThumbnail(url: string): string | undefined {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined;
}

// ─── Word tokenizer for karaoke highlighting ──────────────────────────────────
interface WordToken { word: string; start: number; end: number; displayWord: string }

function tokenizeText(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const regex = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    tokens.push({ word: m[0], displayWord: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

function wordIdxFromCharIndex(tokens: WordToken[], charIndex: number): number {
  for (let i = 0; i < tokens.length; i++) {
    if (charIndex >= tokens[i].start && charIndex <= tokens[i].end + 1) return i;
  }
  return -1;
}

// ─── Inline Audio Player (for media tab) ─────────────────────────────────────
function InlineAudioPlayer({ url, title }: { url: string; title: string }) {
  const player = useAudioPlayer(url);
  return (
    <View style={media.audioPlayer}>
      <Text style={media.audioTitle} numberOfLines={1}>{title}</Text>
      <TouchableOpacity
        style={[media.audioBtn, player.playing && media.audioBtnPlaying]}
        onPress={() => player.playing ? player.pause() : player.play()}
      >
        <Text style={media.audioBtnText}>{player.playing ? "⏸ Pause" : "▶ Play"}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Media Card (YouTube / video / audio links) ───────────────────────────────
const KIND_META: Record<StoryMediaKind, { label: string; color: string; icon: string }> = {
  youtube: { label: "YouTube", color: "#EF4444", icon: "▶" },
  video:   { label: "Video",   color: "#8B5CF6", icon: "🎬" },
  audio:   { label: "Audio",   color: "#10B981", icon: "🎵" },
};

function MediaCard({ item }: { item: StoryMedia }) {
  const [showVideo, setShowVideo] = useState(false);
  const meta = KIND_META[item.kind];
  const thumb = item.thumbnailUrl ?? (item.kind === "youtube" ? youtubeThumbnail(item.url) : undefined);
  const videoPlayer = useVideoPlayer(item.kind === "video" ? item.url : null, p => { p.play(); });

  async function handlePress() {
    if (item.kind === "youtube") await WebBrowser.openBrowserAsync(item.url);
    else if (item.kind === "video") setShowVideo(true);
  }

  return (
    <View style={media.card}>
      {thumb ? (
        <TouchableOpacity onPress={item.kind !== "audio" ? handlePress : undefined} activeOpacity={0.85}>
          <Image source={{ uri: thumb }} style={media.thumb} resizeMode="cover" />
          {item.kind === "youtube" && (
            <View style={media.playOverlay}>
              <View style={media.playCircle}><Text style={media.playArrow}>▶</Text></View>
            </View>
          )}
        </TouchableOpacity>
      ) : null}
      <View style={media.cardBody}>
        <View style={[media.badge, { backgroundColor: meta.color + "20" }]}>
          <Text style={[media.badgeText, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
        </View>
        <Text style={media.cardTitle}>{item.title}</Text>
        {item.description ? <Text style={media.cardDesc}>{item.description}</Text> : null}
        <Text style={media.cardFrom}>Shared by {item.fromParentName}</Text>
        {item.kind === "audio" && <InlineAudioPlayer url={item.url} title={item.title} />}
        {item.kind !== "audio" && !thumb && (
          <TouchableOpacity style={[media.watchBtn, { backgroundColor: meta.color }]} onPress={handlePress}>
            <Text style={media.watchBtnText}>{item.kind === "youtube" ? "▶ Watch on YouTube" : "🎬 Play Video"}</Text>
          </TouchableOpacity>
        )}
      </View>
      {showVideo && (
        <Modal visible animationType="fade" onRequestClose={() => setShowVideo(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
              <TouchableOpacity onPress={() => setShowVideo(false)} style={{ paddingRight: 12 }}>
                <Text style={{ color: "#A78BFA", fontWeight: "700", fontSize: FontSize.base }}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={{ flex: 1, color: "#fff", fontWeight: "700", fontSize: FontSize.sm }}>{item.title}</Text>
            </View>
            <VideoView player={videoPlayer} style={{ width: "100%", height: 240 }} nativeControls allowsFullscreen />
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

// ─── Voice Audio Reader ───────────────────────────────────────────────────────
function VoiceAudioReader({ story, onClose }: { story: StoryItem; onClose: () => void }) {
  const player = useAudioPlayer(story.audioUri ?? null);
  return (
    <Modal visible animationType="slide" onRequestClose={() => { player.pause(); onClose(); }}>
      <SafeAreaView style={va.container}>
        <View style={va.topBar}>
          <TouchableOpacity onPress={() => { player.pause(); onClose(); }} style={va.closeBtn}>
            <Text style={va.closeBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={va.body}>
          <Text style={va.emoji}>{story.coverEmoji ?? "🎙"}</Text>
          <Text style={va.title}>{story.title}</Text>
          <Text style={va.byLine}>Recorded by {story.authorName}</Text>
          <View style={va.playerRow}>
            <TouchableOpacity
              style={[va.playBtn, player.playing && va.pauseBtn]}
              onPress={() => player.playing ? player.pause() : player.play()}
            >
              <Text style={va.playBtnText}>{player.playing ? "⏸  Pause" : "▶  Play"}</Text>
            </TouchableOpacity>
          </View>
          <View style={va.waveRow}>
            {[...Array(24)].map((_, i) => (
              <View
                key={i}
                style={[va.bar, { height: 12 + Math.abs(Math.sin(i * 0.8)) * 24 }, player.playing && va.barActive]}
              />
            ))}
          </View>
          <Text style={va.hint}>🎧 Put on headphones for the best experience!</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const va = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A1040" },
  topBar: { paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  closeBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  closeBtnText: { color: "#A78BFA", fontWeight: "700", fontSize: FontSize.base },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: Spacing.lg },
  emoji: { fontSize: 72 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: "#fff", textAlign: "center", lineHeight: 36 },
  byLine: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.5)" },
  playerRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  playBtn: { backgroundColor: "#7C5CFF", borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: 48, ...Shadow.md },
  pauseBtn: { backgroundColor: "#F59E0B" },
  playBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 4, height: 48 },
  bar: { width: 5, borderRadius: 3, backgroundColor: "rgba(167,139,250,0.35)" },
  barActive: { backgroundColor: "#7C5CFF" },
  hint: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.4)", textAlign: "center" },
});

// ─── Voice Video Reader ───────────────────────────────────────────────────────
function VoiceVideoReader({ story, onClose }: { story: StoryItem; onClose: () => void }) {
  const player = useVideoPlayer(story.videoUri ?? null, p => { p.play(); });
  return (
    <Modal visible animationType="slide" onRequestClose={() => { player.pause(); onClose(); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
          <TouchableOpacity onPress={() => { player.pause(); onClose(); }}>
            <Text style={{ color: "#A78BFA", fontWeight: "700", fontSize: FontSize.base }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, color: "#fff", fontWeight: "700", fontSize: FontSize.sm, marginLeft: 12 }} numberOfLines={1}>{story.title}</Text>
        </View>
        <VideoView player={player} style={{ width: "100%", flex: 1, maxHeight: 480 }} nativeControls allowsFullscreen />
        <View style={{ alignItems: "center", padding: Spacing.lg }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: FontSize.sm, textAlign: "center" }}>
            📖 Bedtime story from {story.authorName}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Text Story Reader (with word-by-word karaoke highlight) ─────────────────
type ReadSpeed = 0.7 | 1.0 | 1.4;

function TextStoryReader({
  story,
  onClose,
}: {
  story: StoryItem | KidStory;
  onClose: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed]     = useState<ReadSpeed>(1.0);
  const [currentWord, setCurrentWord] = useState(-1);
  const wordScrollRef = useRef<ScrollView>(null);

  // Pre-tokenize words once
  const wordTokens = useMemo(() => tokenizeText(story.text ?? ""), [story.text]);

  // Timer-based fallback for platforms where onBoundary is unreliable
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordCursor = useRef(0);

  function startTimerHighlight(wordsPerMin: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    const msPerWord = (60 / wordsPerMin) * 1000;
    wordCursor.current = 0;
    timerRef.current = setInterval(() => {
      if (wordCursor.current >= wordTokens.length) {
        clearInterval(timerRef.current!);
        return;
      }
      setCurrentWord(wordCursor.current);
      wordCursor.current += 1;
    }, msPerWord);
  }

  function stopHighlight() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCurrentWord(-1);
  }

  useEffect(() => () => {
    Speech.stop();
    stopHighlight();
  }, []);

  const wpm: Record<ReadSpeed, number> = { 0.7: 100, 1.0: 145, 1.4: 200 };

  function startReading() {
    Speech.stop();
    stopHighlight();
    let boundaryFired = false;
    Speech.speak(story.text, {
      language: "en-US",
      rate: speed,
      pitch: 1.0,
      onBoundary: ({ charIndex }: { charIndex: number }) => {
        boundaryFired = true;
        const idx = wordIdxFromCharIndex(wordTokens, charIndex);
        if (idx !== -1) setCurrentWord(idx);
      },
      onStart: () => {
        // Start timer fallback; cancel it if onBoundary fires
        setTimeout(() => { if (!boundaryFired) startTimerHighlight(wpm[speed]); }, 600);
      },
      onDone:    () => { setPlaying(false); stopHighlight(); },
      onStopped: () => { setPlaying(false); stopHighlight(); },
      onError:   () => { setPlaying(false); stopHighlight(); },
    });
    setPlaying(true);
  }

  function stopReading() {
    Speech.stop();
    stopHighlight();
    setPlaying(false);
  }

  const speedLabels: Record<ReadSpeed, string> = { 0.7: "🐢 Slow", 1.0: "▶ Normal", 1.4: "⚡ Fast" };

  // Voice recording for kid-authored stories
  const voiceUri = (story as KidStory).voiceUri;
  const voicePlayer = useAudioPlayer(voiceUri ?? null);

  return (
    <Modal visible animationType="slide" onRequestClose={() => { stopReading(); onClose(); }}>
      <SafeAreaView style={tr.container}>
        <View style={tr.topBar}>
          <TouchableOpacity onPress={() => { stopReading(); onClose(); }} style={tr.closeBtn}>
            <Text style={tr.closeBtnText}>← Back</Text>
          </TouchableOpacity>
          {"authorName" in story && (
            <Text style={tr.author}>
              By {(story as StoryItem).authorName}{(story as StoryItem).aiGenerated ? " ✨" : ""}
            </Text>
          )}
        </View>

        <ScrollView
          ref={wordScrollRef}
          contentContainerStyle={tr.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={tr.titleText}>{story.title}</Text>

          {/* Word-by-word highlighted text */}
          <Text style={tr.body}>
            {wordTokens.map((token, idx) => (
              <Text
                key={idx}
                style={idx === currentWord ? tr.wordHighlight : undefined}
              >
                {token.displayWord}{" "}
              </Text>
            ))}
          </Text>
          <View style={{ height: 160 }} />
        </ScrollView>

        {/* Controls */}
        <View style={tr.controls}>
          {/* Speed */}
          <View style={tr.speedRow}>
            {([0.7, 1.0, 1.4] as ReadSpeed[]).map(sp => (
              <TouchableOpacity
                key={sp}
                style={[tr.speedBtn, speed === sp && tr.speedBtnActive]}
                onPress={() => { stopReading(); setSpeed(sp); }}
              >
                <Text style={[tr.speedText, speed === sp && tr.speedTextActive]}>{speedLabels[sp]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Play / Stop */}
          <TouchableOpacity style={[tr.playBtn, playing && tr.stopBtn]} onPress={playing ? stopReading : startReading}>
            <Text style={tr.playBtnText}>{playing ? "⏹ Stop Reading" : "🔊 Read Aloud"}</Text>
          </TouchableOpacity>

          {/* Kid's own voice playback */}
          {voiceUri && (
            <TouchableOpacity
              style={tr.voiceBtn}
              onPress={() => voicePlayer.playing ? voicePlayer.pause() : voicePlayer.play()}
            >
              <Text style={tr.voiceBtnText}>
                {voicePlayer.playing ? "⏸ Pause My Voice" : "🎙 Play My Voice Recording"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Story Reader — dispatcher ────────────────────────────────────────────────
function StoryReader({ story, onClose }: { story: StoryItem | KidStory; onClose: () => void }) {
  const recType: StoryRecordingType | undefined = (story as StoryItem).recordingType;

  if (recType === "voice-video") return <VoiceVideoReader story={story as StoryItem} onClose={onClose} />;
  if (recType === "voice-audio") return <VoiceAudioReader story={story as StoryItem} onClose={onClose} />;
  // ai-text, ai-voice-clone, kid stories, undefined → text reader with highlights
  return <TextStoryReader story={story} onClose={onClose} />;
}

// ─── Write Story Modal (kid-authored stories) ─────────────────────────────────
function WriteStoryModal({ kidId, onSave, onClose }: { kidId: string; onSave: (s: KidStory) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player   = useAudioPlayer(voiceUri ?? null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try { recorder.stop(); } catch {}
  }, []);

  async function startRec() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) { Alert.alert("Microphone permission needed."); return; }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true); setRecordSec(0);
    timerRef.current = setInterval(() => setRecordSec(s => s + 1), 1000);
  }

  async function stopRec() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await recorder.stop();
    setRecording(false);
    if (recorder.uri) setVoiceUri(recorder.uri);
  }

  function fmtTime(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

  function save() {
    if (!title.trim()) { Alert.alert("Give your story a title!"); return; }
    if (!text.trim() && !voiceUri) { Alert.alert("Write or record your story first!"); return; }
    onSave({ id: uid(), kidId, title: title.trim(), text: text.trim() || "(Voice story — press play to listen)", voiceUri: voiceUri ?? undefined, createdAt: nowIso() });
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={wr.container}>
        <ScrollView contentContainerStyle={wr.scroll} keyboardShouldPersistTaps="handled">
          <View style={wr.topBar}>
            <TouchableOpacity onPress={onClose}><Text style={wr.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={wr.heading}>✏️ Write a Story</Text>
            <TouchableOpacity onPress={save}><Text style={wr.saveText}>Save</Text></TouchableOpacity>
          </View>
          <TextInput style={wr.titleInput} value={title} onChangeText={setTitle} placeholder="Story title…" placeholderTextColor={Colors.textMuted} autoFocus />
          <View style={wr.inputCard}>
            <View style={wr.inputHint}><Text style={wr.inputHintText}>✏️ Type your story or use 🎙 to record!</Text></View>
            <TextInput style={wr.bodyInput} value={text} onChangeText={setText} placeholder={"Once upon a time…"} placeholderTextColor={Colors.textMuted} multiline textAlignVertical="top" />
          </View>
          <View style={wr.recCard}>
            <Text style={wr.recCardTitle}>🎙 Record Your Story in Your Voice</Text>
            <Text style={wr.recCardSub}>Record yourself telling the story — your voice gets saved with it!</Text>
            {!recording && !voiceUri && (
              <TouchableOpacity style={wr.recBtn} onPress={startRec}>
                <Text style={wr.recBtnEmoji}>🎙</Text>
                <Text style={wr.recBtnText}>Start Recording</Text>
              </TouchableOpacity>
            )}
            {recording && (
              <View style={wr.recLive}>
                <View style={wr.recDot} />
                <Text style={wr.recTimer}>Recording… {fmtTime(recordSec)}</Text>
                <TouchableOpacity style={wr.recStopBtn} onPress={stopRec}><Text style={wr.recStopText}>⏹ Stop</Text></TouchableOpacity>
              </View>
            )}
            {!recording && voiceUri && (
              <View style={wr.voiceSaved}>
                <Text style={wr.voiceSavedText}>✅ Recorded! ({fmtTime(recordSec)})</Text>
                <View style={wr.voiceBtns}>
                  <TouchableOpacity style={wr.playBtn} onPress={() => player.playing ? player.pause() : player.play()}>
                    <Text style={wr.playBtnText}>{player.playing ? "⏸ Pause" : "▶ Play"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={wr.reRecBtn} onPress={() => { setVoiceUri(null); setRecordSec(0); }}>
                    <Text style={wr.reRecText}>🔄 Re-record</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          <TouchableOpacity style={wr.submitBtn} onPress={save}><Text style={wr.submitText}>💾 Save My Story</Text></TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StoriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();
  const kid = useKid(id);

  const [tab, setTab]       = useState<"parent" | "media" | "mine">("parent");
  const [reading, setReading] = useState<StoryItem | KidStory | null>(null);
  const [writing, setWriting] = useState(false);

  const parentStories = state.stories.filter(st => st.targetKids.length === 0 || st.targetKids.includes(id));
  const storyMedia    = (state.storyMedia ?? []).filter(m => m.targetKids.length === 0 || m.targetKids.includes(id));
  const myStories     = kid?.myStories ?? [];

  function saveMyStory(story: KidStory) {
    dispatch({ type: "KID_STORY_ADD", kidId: id, story });
    setWriting(false);
  }

  function deleteMyStory(storyId: string) {
    Alert.alert("Delete story?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "KID_STORY_REMOVE", kidId: id, storyId }) },
    ]);
  }

  function markRead(storyId: string) {
    if (!state.stories.find(st => st.id === storyId)?.readBy.includes(id)) {
      dispatch({ type: "STORY_READ", storyId, kidId: id });
    }
  }

  const TYPE_ICON: Record<string, string> = {
    "ai-text": "✨", "voice-audio": "🎙", "voice-video": "🎥", "ai-voice-clone": "🤖",
  };
  const TYPE_HINT: Record<string, string> = {
    "ai-text": "🔊 Read aloud", "voice-audio": "🎙 Voice recording", "voice-video": "🎥 Watch video", "ai-voice-clone": "🤖 AI voiced",
  };

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🌙 Bedtime Stories</Text>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
        <TouchableOpacity style={[s.tab, tab === "parent" && s.tabActive]} onPress={() => setTab("parent")}>
          <Text style={[s.tabText, tab === "parent" && s.tabTextActive]}>📖 Stories</Text>
          {parentStories.some(st => !st.readBy.includes(id)) && <View style={s.tabDot} />}
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "media" && s.tabActive]} onPress={() => setTab("media")}>
          <Text style={[s.tabText, tab === "media" && s.tabTextActive]}>📺 Videos & Audio</Text>
          {storyMedia.length > 0 && <View style={s.tabBadge}><Text style={s.tabBadgeText}>{storyMedia.length}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "mine" && s.tabActive]} onPress={() => setTab("mine")}>
          <Text style={[s.tabText, tab === "mine" && s.tabTextActive]}>✏️ My Stories</Text>
          {myStories.length > 0 && <View style={s.tabBadge}><Text style={s.tabBadgeText}>{myStories.length}</Text></View>}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Stories tab ── */}
      {tab === "parent" && (
        <>
          <View style={s.hint}>
            <Text style={s.hintEmoji}>🌙</Text>
            <Text style={s.hintText}>Tap a story to open it. Voice and video stories play automatically — AI stories highlight each word as it's read!</Text>
          </View>
          {parentStories.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 56 }}>🌙</Text>
              <Text style={s.emptyTitle}>No stories yet</Text>
              <Text style={s.emptySub}>Your parent will add bedtime stories here for you to enjoy!</Text>
            </View>
          ) : (
            parentStories.map(story => {
              const isNew = !story.readBy.includes(id);
              const recType = story.recordingType ?? "ai-text";
              const icon = TYPE_ICON[recType] ?? "📖";
              const hintLabel = TYPE_HINT[recType] ?? "🔊 Read aloud";
              return (
                <TouchableOpacity
                  key={story.id}
                  style={[s.card, isNew && s.cardNew]}
                  onPress={() => { markRead(story.id); setReading(story); }}
                  activeOpacity={0.85}
                >
                  <Text style={s.cardEmoji}>{story.coverEmoji ?? icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{story.title}</Text>
                    <Text style={s.cardMeta}>By {story.authorName}</Text>
                    {(recType === "ai-text" || recType === "ai-voice-clone") && story.text && (
                      <Text style={s.cardPreview} numberOfLines={2}>{story.text}</Text>
                    )}
                    <View style={s.badgeRow}>
                      {isNew && <View style={s.newBadge}><Text style={s.newBadgeText}>NEW ✨</Text></View>}
                      <View style={s.hintBadge}><Text style={s.hintBadgeText}>{hintLabel}</Text></View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </>
      )}

      {/* ── Videos & Audio tab ── */}
      {tab === "media" && (
        <>
          <View style={s.hint}>
            <Text style={s.hintEmoji}>📺</Text>
            <Text style={s.hintText}>Videos and sounds sent by your parent. YouTube opens in browser — audio plays right here!</Text>
          </View>
          {storyMedia.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 56 }}>📺</Text>
              <Text style={s.emptyTitle}>Nothing here yet</Text>
              <Text style={s.emptySub}>Your parent can send you YouTube videos, sounds, and music to enjoy at bedtime.</Text>
            </View>
          ) : (
            storyMedia.map(item => <MediaCard key={item.id} item={item} />)
          )}
        </>
      )}

      {/* ── My Stories tab ── */}
      {tab === "mine" && (
        <>
          <TouchableOpacity style={s.writeBtn} onPress={() => setWriting(true)}>
            <Text style={s.writeBtnText}>✏️ Write a New Story</Text>
          </TouchableOpacity>
          <View style={s.hint}>
            <Text style={s.hintEmoji}>🎙</Text>
            <Text style={s.hintText}>Write your story and record your voice reading it — then play it back anytime!</Text>
          </View>
          {myStories.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 56 }}>✏️</Text>
              <Text style={s.emptyTitle}>No stories written yet!</Text>
              <Text style={s.emptySub}>Tap the button above to write your first story. You can type it or tell it in your own voice!</Text>
            </View>
          ) : (
            myStories.map(story => (
              <TouchableOpacity
                key={story.id}
                style={s.card}
                onPress={() => setReading(story)}
                onLongPress={() => deleteMyStory(story.id)}
                delayLongPress={600}
              >
                <Text style={s.cardEmoji}>{story.voiceUri ? "🎙" : "✏️"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{story.title}</Text>
                  <Text style={s.cardMeta}>{new Date(story.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{story.voiceUri ? "  ·  🎙 Voice" : ""}</Text>
                  <Text style={s.cardPreview} numberOfLines={2}>{story.text}</Text>
                  <View style={s.badgeRow}>
                    <View style={s.hintBadge}><Text style={s.hintBadgeText}>🔊 Read aloud</Text></View>
                    {story.voiceUri && <View style={s.voiceBadge}><Text style={s.voiceBadgeText}>🎙 My voice</Text></View>}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </>
      )}

      {reading && <StoryReader story={reading} onClose={() => setReading(null)} />}
      {writing && <WriteStoryModal kidId={id} onSave={saveMyStory} onClose={() => setWriting(false)} />}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  tab: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 18, borderRadius: Radius.full, flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: Colors.cardLight },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  tabBadge: { backgroundColor: Colors.secondary, borderRadius: Radius.full, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  tabBadgeText: { fontSize: 10, fontWeight: "800", color: Colors.textPrimary },
  tabDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B" },
  hint: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "10", borderRadius: Radius.lg, padding: 10, marginBottom: Spacing.sm },
  hintEmoji: { fontSize: 20 },
  hintText: { flex: 1, fontSize: FontSize.xs, color: Colors.primary, fontWeight: "600", lineHeight: 18 },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 12 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardNew: { borderLeftWidth: 4, borderLeftColor: Colors.secondary },
  cardEmoji: { fontSize: 32, marginTop: 2 },
  cardTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  cardMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  cardPreview: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  newBadge: { backgroundColor: Colors.secondary, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  newBadgeText: { fontSize: 10, fontWeight: "800", color: Colors.textPrimary },
  hintBadge: { backgroundColor: Colors.primary + "15", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  hintBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.primary },
  voiceBadge: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  voiceBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.success },
  writeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginBottom: Spacing.sm, ...Shadow.md },
  writeBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});

// Text story reader styles
const tr = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A1040" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  closeBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  closeBtnText: { color: "#A78BFA", fontWeight: "700", fontSize: FontSize.base },
  author: { color: "rgba(255,255,255,0.45)", fontSize: FontSize.xs },
  scroll: { padding: Spacing.lg },
  titleText: { fontSize: FontSize.xxl, fontWeight: "800", color: "#fff", marginBottom: Spacing.lg, lineHeight: 42 },
  body: { fontSize: 18, color: "rgba(255,255,255,0.9)", lineHeight: 32 },
  wordHighlight: { backgroundColor: "#7C5CFF", color: "#fff", borderRadius: 4 },
  controls: { backgroundColor: "#0E0830", padding: Spacing.md, paddingBottom: 24, gap: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  speedRow: { flexDirection: "row", gap: 8 },
  speedBtn: { flex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: Radius.full, alignItems: "center", paddingVertical: 8 },
  speedBtnActive: { backgroundColor: "rgba(124,92,255,0.3)", borderColor: "#7C5CFF" },
  speedText: { color: "rgba(255,255,255,0.4)", fontWeight: "600", fontSize: FontSize.xs },
  speedTextActive: { color: "#A78BFA" },
  playBtn: { backgroundColor: "#7C5CFF", borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  stopBtn: { backgroundColor: "#EF4444" },
  playBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  voiceBtn: { borderWidth: 2, borderColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  voiceBtnText: { color: Colors.success, fontWeight: "700" },
});

// Write modal styles
const wr = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { padding: Spacing.md },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  cancel: { color: Colors.textSecondary, fontWeight: "700", fontSize: FontSize.base },
  heading: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  saveText: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base },
  titleInput: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, borderBottomWidth: 2, borderBottomColor: Colors.border, paddingBottom: 10, marginBottom: Spacing.md },
  inputCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, overflow: "hidden", marginBottom: Spacing.md, ...Shadow.sm },
  inputHint: { backgroundColor: Colors.primary + "12", padding: 10 },
  inputHintText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "600" },
  bodyInput: { padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 200, lineHeight: 26 },
  recCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  recCardTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  recCardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  recBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  recBtnEmoji: { fontSize: 22 },
  recBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  recLive: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.error + "15", borderRadius: Radius.lg, padding: 12 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.error },
  recTimer: { flex: 1, fontSize: FontSize.base, fontWeight: "700", color: Colors.error },
  recStopBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8 },
  recStopText: { color: "#fff", fontWeight: "700" },
  voiceSaved: { gap: 10 },
  voiceSavedText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.success, textAlign: "center" },
  voiceBtns: { flexDirection: "row", gap: 10 },
  playBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  playBtnText: { color: "#fff", fontWeight: "700" },
  reRecBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  reRecText: { color: Colors.textSecondary, fontWeight: "700" },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 16, ...Shadow.md, marginTop: 4 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
});

// Media styles
const media = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 12, overflow: "hidden", ...Shadow.sm },
  thumb: { width: "100%", height: 180 },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  playArrow: { color: "#fff", fontSize: 22, marginLeft: 4 },
  cardBody: { padding: Spacing.md, gap: 6 },
  badge: { alignSelf: "flex-start", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: "800" },
  cardTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  cardFrom: { fontSize: FontSize.xs, color: Colors.textMuted },
  watchBtn: { borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, marginTop: 4 },
  watchBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  audioPlayer: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: 10, marginTop: 4, gap: 10 },
  audioTitle: { flex: 1, fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  audioBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  audioBtnPlaying: { backgroundColor: Colors.error },
  audioBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.xs },
});
