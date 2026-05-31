/**
 * FamilySocialFeed — TikTok-style vertical full-screen feed
 * for family-private video & photo sharing.
 *
 * Used by both parent and kid social screens.
 */
import React, {
  useState, useRef, useCallback, useEffect,
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Dimensions, Animated, TextInput, Modal, ScrollView,
  Alert, KeyboardAvoidingView, Platform,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { MicButton } from "./voice-text-input";
import { MemeStickerPicker, StickerDisplay, decodeStickerUri } from "./meme-sticker-picker";
import { Colors, FontSize, Radius } from "../lib/theme";
import { uid, nowIso } from "../lib/utils";
import type { FamilySocialPost, FamilySocialComment } from "../lib/data/types";
import { useData } from "../lib/data/store";

const { width: W, height: H } = Dimensions.get("window");
const POST_H = H; // full screen height per card

// ─── Helpers ─────────────────────────────────────────────────────────────────
function authorLabel(authorId: string, kids: any[], parentName: string) {
  if (authorId === "parent") return `👤 ${parentName}`;
  const k = kids.find((k: any) => k.profile.id === authorId);
  return k ? `⭐ ${k.profile.name}` : authorId;
}

function timeSince(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Single video player item ─────────────────────────────────────────────────
function VideoItem({ uri, isActive }: { uri: string; isActive: boolean }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

// ─── Heart burst animation ────────────────────────────────────────────────────
function HeartBurst({ visible }: { visible: boolean }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.4, damping: 8, stiffness: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 900, delay: 400, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.Text style={[fb.heart, { transform: [{ scale }], opacity }]}>❤️</Animated.Text>
  );
}

// ─── Post card ───────────────────────────────────────────────────────────────
function PostCard({
  post,
  isActive,
  viewerId,
  viewerIsParent,
  parentName,
  kids,
  onOpenComments,
}: {
  post: FamilySocialPost;
  isActive: boolean;
  viewerId: string;
  viewerIsParent: boolean;
  parentName: string;
  kids: any[];
  onOpenComments: (post: FamilySocialPost) => void;
}) {
  const { dispatch } = useData();
  const [heartVisible, setHeartVisible] = useState(false);
  const lastTap = useRef(0);
  const isLiked = post.likes.includes(viewerId);

  // Mark viewed
  useEffect(() => {
    if (isActive && !post.viewedBy.includes(viewerId)) {
      dispatch({ type: "SOCIAL_POST_VIEW", postId: post.id, viewerId });
    }
  }, [isActive]);

  function toggleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLiked) {
      dispatch({ type: "SOCIAL_POST_UNLIKE", postId: post.id, authorId: viewerId });
    } else {
      dispatch({ type: "SOCIAL_POST_LIKE", postId: post.id, authorId: viewerId });
    }
  }

  function handleDoubleTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap → like
      if (!isLiked) {
        dispatch({ type: "SOCIAL_POST_LIKE", postId: post.id, authorId: viewerId });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setHeartVisible(true);
      setTimeout(() => setHeartVisible(false), 1200);
    }
    lastTap.current = now;
  }

  function handleDelete() {
    Alert.alert("Delete Post", "Remove this post for everyone?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "SOCIAL_POST_DELETE", postId: post.id }) },
    ]);
  }

  const isOwn = post.authorId === viewerId || viewerIsParent;

  return (
    <View style={fb.card}>
      {/* Media layer */}
      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={handleDoubleTap}>
        {post.type === "video" && post.mediaUris[0] ? (
          <VideoItem uri={post.mediaUris[0]} isActive={isActive} />
        ) : post.type === "gif" && post.mediaUris[0] ? (
          // Animated GIF via expo-image
          <Image
            source={{ uri: post.mediaUris[0] }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : post.type === "meme" && post.mediaUris[0] ? (
          // Meme template image
          <Image
            source={{ uri: post.mediaUris[0] }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : post.type === "sticker" && post.mediaUris[0] ? (
          // Full-screen sticker card
          <StickerDisplay uri={post.mediaUris[0]} size="full" />
        ) : post.mediaUris.length === 1 ? (
          <Image source={{ uri: post.mediaUris[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : post.mediaUris.length > 1 ? (
          // Multi-photo horizontal scroll inside full-screen
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill}>
            {post.mediaUris.map((uri, i) => (
              <Image key={i} source={{ uri }} style={{ width: W, height: POST_H }} contentFit="cover" />
            ))}
          </ScrollView>
        ) : (
          // Text-only post
          <View style={fb.textBg}>
            <Text style={fb.textCaption}>{post.caption}</Text>
          </View>
        )}

        {/* Dark gradient overlay at bottom */}
        {post.type !== "text" && post.type !== "sticker" && <View style={fb.overlay} />}
      </TouchableOpacity>

      {/* Heart burst on double tap */}
      <HeartBurst visible={heartVisible} />

      {/* New badge */}
      {!post.viewedBy.includes(viewerId) && (
        <View style={fb.newBadge}><Text style={fb.newBadgeText}>NEW</Text></View>
      )}

      {/* Pinned badge */}
      {post.pinned && (
        <View style={fb.pinnedBadge}><Text style={fb.pinnedText}>📌 Pinned</Text></View>
      )}

      {/* Type badge */}
      {(post.type === "gif" || post.type === "meme" || post.type === "sticker") && (
        <View style={fb.typeBadge}>
          <Text style={fb.typeBadgeText}>
            {post.type === "gif" ? "🎬 GIF" : post.type === "meme" ? "😂 MEME" : "🎭 Sticker"}
          </Text>
        </View>
      )}

      {/* Right-side actions */}
      <View style={fb.actions}>
        {/* Like */}
        <TouchableOpacity style={fb.actionBtn} onPress={toggleLike}>
          <Text style={[fb.actionIcon, isLiked && { color: "#FF4069" }]}>{isLiked ? "❤️" : "🤍"}</Text>
          <Text style={fb.actionCount}>{post.likes.length}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={fb.actionBtn} onPress={() => onOpenComments(post)}>
          <Text style={fb.actionIcon}>💬</Text>
          <Text style={fb.actionCount}>{post.comments.length}</Text>
        </TouchableOpacity>

        {/* Delete (owner or parent) */}
        {isOwn && (
          <TouchableOpacity style={fb.actionBtn} onPress={handleDelete}>
            <Text style={fb.actionIcon}>🗑️</Text>
          </TouchableOpacity>
        )}

        {/* Pin (parent only) */}
        {viewerIsParent && (
          <TouchableOpacity style={fb.actionBtn} onPress={() => dispatch({ type: "SOCIAL_POST_PIN", postId: post.id, pinned: !post.pinned })}>
            <Text style={fb.actionIcon}>{post.pinned ? "📌" : "📍"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom info */}
      <View style={fb.info}>
        <Text style={fb.authorName}>{authorLabel(post.authorId, kids, parentName)}</Text>
        {post.type !== "text" && post.caption ? (
          <Text style={fb.caption} numberOfLines={3}>{post.caption}</Text>
        ) : null}
        <Text style={fb.timeAgo}>{timeSince(post.createdAt)}</Text>
        {post.mediaUris.length > 1 && (
          <Text style={fb.swipeHint}>← Swipe photos →</Text>
        )}
      </View>
    </View>
  );
}

// ─── Comments sheet ───────────────────────────────────────────────────────────
function CommentsSheet({
  post,
  viewerId,
  viewerIsParent,
  kids,
  parentName,
  onClose,
}: {
  post: FamilySocialPost | null;
  viewerId: string;
  viewerIsParent: boolean;
  kids: any[];
  parentName: string;
  onClose: () => void;
}) {
  const { dispatch } = useData();
  const [text, setText] = useState("");

  function send() {
    if (!post || !text.trim()) return;
    const comment: FamilySocialComment = {
      id: uid(), authorId: viewerId, text: text.trim(), createdAt: nowIso(),
    };
    dispatch({ type: "SOCIAL_COMMENT_ADD", postId: post.id, comment });
    setText("");
  }

  function deleteComment(commentId: string) {
    if (!post) return;
    Alert.alert("Delete comment?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "SOCIAL_COMMENT_DELETE", postId: post.id, commentId }) },
    ]);
  }

  return (
    <Modal visible={!!post} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={cs.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={cs.sheet}>
          <View style={cs.handle} />
          <Text style={cs.title}>💬 Comments ({post?.comments.length ?? 0})</Text>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, padding: 16 }}>
            {(post?.comments ?? []).length === 0 && (
              <View style={{ alignItems: "center", paddingTop: 40 }}>
                <Text style={{ fontSize: 40 }}>💬</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8 }}>Be first to comment!</Text>
              </View>
            )}
            {[...(post?.comments ?? [])].reverse().map(c => {
              const isMe = c.authorId === viewerId;
              const canDel = isMe || viewerIsParent;
              return (
                <View key={c.id} style={[cs.comment, isMe && cs.commentMine]}>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.commentAuthor}>{authorLabel(c.authorId, kids, parentName)}</Text>
                    <Text style={cs.commentText}>{c.text}</Text>
                    <Text style={cs.commentTime}>{timeSince(c.createdAt)}</Text>
                  </View>
                  {canDel && (
                    <TouchableOpacity onPress={() => deleteComment(c.id)} style={{ paddingLeft: 8 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={cs.inputRow}>
            <TextInput
              style={cs.input}
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <MicButton appendTo={text} onAppend={setText} onResult={setText} size={36} />
            <TouchableOpacity style={[cs.sendBtn, !text.trim() && { opacity: 0.4 }]} onPress={send} disabled={!text.trim()}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Create post modal ────────────────────────────────────────────────────────
export function CreatePostModal({
  visible,
  authorId,
  onClose,
}: {
  visible: boolean;
  authorId: string;
  onClose: () => void;
}) {
  const { dispatch, state } = useData();
  const [step, setStep] = useState<"pick" | "preview" | "caption">("pick");
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<"video" | "photo" | "multi_photo" | "text" | "gif" | "meme" | "sticker">("photo");
  const [caption, setCaption] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [showFunPicker, setShowFunPicker] = useState(false);

  function reset() { setStep("pick"); setMediaUris([]); setCaption(""); setMediaType("photo"); setShowFunPicker(false); }
  function handleClose() { reset(); onClose(); }

  function handleFunSelect(uri: string, type: "meme" | "gif" | "sticker") {
    setShowFunPicker(false);
    setMediaUris([uri]);
    setMediaType(type);
    setStep("caption");
  }

  async function pickVideo() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.9, videoMaxDuration: 60 });
    if (!r.canceled) { setMediaUris([r.assets[0].uri]); setMediaType("video"); setStep("caption"); }
  }

  async function recordVideo() {
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], videoMaxDuration: 60, cameraType: ImagePicker.CameraType.back });
    if (!r.canceled) { setMediaUris([r.assets[0].uri]); setMediaType("video"); setStep("caption"); }
  }

  async function pickPhotos() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.85, selectionLimit: 10 });
    if (!r.canceled) {
      const uris = r.assets.map(a => a.uri);
      setMediaUris(uris);
      setMediaType(uris.length > 1 ? "multi_photo" : "photo");
      setStep("caption");
    }
  }

  async function takePhoto() {
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, cameraType: ImagePicker.CameraType.front });
    if (!r.canceled) { setMediaUris([r.assets[0].uri]); setMediaType("photo"); setStep("caption"); }
  }

  function textPost() { setMediaType("text"); setStep("caption"); }

  function post() {
    if (mediaType !== "text" && mediaUris.length === 0) return;
    if (mediaType === "text" && !caption.trim()) return;

    const p: FamilySocialPost = {
      id: uid(),
      authorId,
      type: mediaType,
      mediaUris,
      caption: caption.trim(),
      likes: [],
      comments: [],
      viewedBy: [authorId],
      pinned: false,
      createdAt: nowIso(),
    };
    dispatch({ type: "SOCIAL_POST_ADD", post: p });

    // Notify everyone else
    const othersKids = state.kids.filter(k => k.profile.id !== authorId);
    const authorName = authorId === "parent"
      ? (state.parentSettings.name || "Parent")
      : state.kids.find(k => k.profile.id === authorId)?.profile.name ?? "Someone";

    othersKids.forEach(k => {
      dispatch({
        type: "NOTIFICATION_ADD",
        kidId: k.profile.id,
        notification: {
          id: uid(), kidId: k.profile.id, kind: "ping",
          title: `📱 ${authorName} posted something new!`,
          body: caption.trim() || (mediaType === "video" ? "A new video!" : "A new photo!"),
          emoji: "📱", read: false, createdAt: nowIso(),
        },
      });
    });

    handleClose();
  }

  const TEXT_COLORS = ["#FFFFFF", "#FFB347", "#7C5CFF", "#34D399", "#FF6B9D", "#60A5FA", "#F59E0B", "#000000"];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={cp.root}>
        {/* Top bar */}
        <View style={cp.topBar}>
          <TouchableOpacity onPress={handleClose}><Text style={{ color: Colors.error, fontWeight: "700", fontSize: 16 }}>Cancel</Text></TouchableOpacity>
          <Text style={cp.topTitle}>
            {step === "pick" ? "📱 New Post" : step === "caption" ? "✏️ Add Caption" : "Preview"}
          </Text>
          {step === "caption"
            ? <TouchableOpacity onPress={post} style={[cp.postBtn, (mediaType !== "text" && mediaUris.length === 0) && { opacity: 0.4 }]}><Text style={cp.postBtnText}>Post 🚀</Text></TouchableOpacity>
            : <View style={{ width: 70 }} />
          }
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
          {step === "pick" && (
            <>
              <Text style={cp.sectionTitle}>What do you want to share?</Text>
              <View style={cp.grid}>
                <TouchableOpacity style={[cp.optCard, { backgroundColor: "#FF6B9D20", borderColor: "#FF6B9D40" }]} onPress={recordVideo}>
                  <Text style={{ fontSize: 40 }}>🎥</Text>
                  <Text style={cp.optLabel}>Record Video</Text>
                  <Text style={cp.optHint}>Film something now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[cp.optCard, { backgroundColor: "#7C5CFF20", borderColor: "#7C5CFF40" }]} onPress={pickVideo}>
                  <Text style={{ fontSize: 40 }}>📹</Text>
                  <Text style={cp.optLabel}>Upload Video</Text>
                  <Text style={cp.optHint}>From your gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[cp.optCard, { backgroundColor: "#34D39920", borderColor: "#34D39940" }]} onPress={takePhoto}>
                  <Text style={{ fontSize: 40 }}>📸</Text>
                  <Text style={cp.optLabel}>Take Photo</Text>
                  <Text style={cp.optHint}>Selfie or shot</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[cp.optCard, { backgroundColor: "#60A5FA20", borderColor: "#60A5FA40" }]} onPress={pickPhotos}>
                  <Text style={{ fontSize: 40 }}>🖼️</Text>
                  <Text style={cp.optLabel}>Upload Photos</Text>
                  <Text style={cp.optHint}>Up to 10 images</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[cp.optCard, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B40" }]} onPress={textPost}>
                  <Text style={{ fontSize: 40 }}>✏️</Text>
                  <Text style={cp.optLabel}>Text Post</Text>
                  <Text style={cp.optHint}>Words only</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[cp.optCard, cp.funCard]} onPress={() => setShowFunPicker(true)}>
                  <Text style={{ fontSize: 40 }}>😂</Text>
                  <Text style={[cp.optLabel, { color: "#FFD700" }]}>Memes &amp; GIFs</Text>
                  <Text style={cp.optHint}>Stickers too!</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === "caption" && (
            <>
              {/* Preview */}
              {mediaUris.length > 0 && mediaType !== "text" && mediaType !== "sticker" && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  {mediaUris.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={cp.previewThumb} contentFit="cover" cachePolicy="memory-disk" />
                  ))}
                </ScrollView>
              )}
              {mediaType === "sticker" && mediaUris[0] && (
                <View style={cp.stickerPreview}>
                  <StickerDisplay uri={mediaUris[0]} size="small" />
                </View>
              )}

              {mediaType === "text" && (
                <View style={[cp.textPreview, { backgroundColor: "#1A1A2E" }]}>
                  <Text style={[cp.textPreviewText, { color: textColor }]}>
                    {caption || "Your text will appear here…"}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 8 }}>
                    {TEXT_COLORS.map(c => (
                      <TouchableOpacity key={c} style={[cp.colorDot, { backgroundColor: c }, textColor === c && cp.colorDotActive]} onPress={() => setTextColor(c)} />
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={cp.label}>{mediaType === "text" ? "Your message" : "Caption (optional)"}</Text>
                <MicButton appendTo={caption} onAppend={setCaption} onResult={setCaption} size={32} />
              </View>
              <TextInput
                style={cp.captionInput}
                value={caption}
                onChangeText={setCaption}
                placeholder={mediaType === "text" ? "Write something to share with your family… 💙" : "Say something about this…"}
                multiline
                numberOfLines={4}
                autoFocus
              />

              <View style={cp.tips}>
                <Text style={cp.tipsTitle}>💡 Ideas:</Text>
                <Text style={cp.tipsText}>• Share what you made, learned or are proud of{"\n"}• Share a funny moment{"\n"}• Show your family your art, drawing or project{"\n"}• Tell them something exciting that happened!</Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
      {/* Meme / Sticker / GIF picker */}
      <MemeStickerPicker
        visible={showFunPicker}
        onClose={() => setShowFunPicker(false)}
        onSelect={handleFunSelect}
      />
    </Modal>
  );
}

// ─── Main feed component ──────────────────────────────────────────────────────
export function FamilySocialFeed({
  viewerId,
  viewerIsParent,
  parentName,
}: {
  viewerId: string;
  viewerIsParent: boolean;
  parentName: string;
}) {
  const { state } = useData();
  const kids = state.kids;

  const posts = [...(state.familySocialPosts ?? [])].sort((a, b) => {
    // Pinned first, then newest first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [commentPost, setCommentPost] = useState<FamilySocialPost | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  });

  // Count unseen
  const unseenCount = posts.filter(p => !p.viewedBy.includes(viewerId)).length;

  return (
    <View style={feed.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {posts.length === 0 ? (
        <View style={feed.empty}>
          <Text style={{ fontSize: 80 }}>📱</Text>
          <Text style={feed.emptyTitle}>Family Social</Text>
          <Text style={feed.emptySub}>Share videos, photos and moments{"\n"}with your family — only you can see it!</Text>
          <View style={feed.emptyTips}>
            {["🎥 Record a funny video", "📸 Share a photo you love", "🎨 Show off your artwork", "✏️ Write something for the family"].map(t => (
              <View key={t} style={feed.emptyTip}><Text style={feed.emptyTipText}>{t}</Text></View>
            ))}
          </View>
          <TouchableOpacity style={feed.createBtn} onPress={() => setShowCreate(true)}>
            <Text style={feed.createBtnText}>+ Create First Post</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* TikTok-style vertical swipe feed */}
          <FlatList
            data={posts}
            keyExtractor={p => p.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={POST_H}
            snapToAlignment="start"
            decelerationRate="fast"
            viewabilityConfig={viewabilityConfig.current}
            onViewableItemsChanged={onViewableItemsChanged.current}
            renderItem={({ item, index }) => (
              <PostCard
                post={item}
                isActive={index === activeIndex}
                viewerId={viewerId}
                viewerIsParent={viewerIsParent}
                parentName={parentName}
                kids={kids}
                onOpenComments={setCommentPost}
              />
            )}
            getItemLayout={(_, index) => ({ length: POST_H, offset: POST_H * index, index })}
          />

          {/* Floating header */}
          <View style={feed.header} pointerEvents="box-none">
            <Text style={feed.headerTitle}>📱 Family Social</Text>
            {unseenCount > 0 && (
              <View style={feed.unseenBadge}>
                <Text style={feed.unseenText}>{unseenCount} new</Text>
              </View>
            )}
          </View>

          {/* Scroll hint */}
          <View style={feed.scrollHint} pointerEvents="none">
            <Text style={feed.scrollHintText}>↕ Swipe to browse</Text>
          </View>

          {/* Post count */}
          <View style={feed.counter} pointerEvents="none">
            <Text style={feed.counterText}>{activeIndex + 1} / {posts.length}</Text>
          </View>
        </>
      )}

      {/* Floating create button */}
      <TouchableOpacity style={feed.fab} onPress={() => setShowCreate(true)}>
        <Text style={feed.fabText}>+</Text>
      </TouchableOpacity>

      {/* Comments sheet */}
      <CommentsSheet
        post={commentPost}
        viewerId={viewerId}
        viewerIsParent={viewerIsParent}
        kids={kids}
        parentName={parentName}
        onClose={() => setCommentPost(null)}
      />

      {/* Create modal */}
      <CreatePostModal
        visible={showCreate}
        authorId={viewerId}
        onClose={() => setShowCreate(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const feed = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0A1A", paddingHorizontal: 24, gap: 14,
  },
  emptyTitle: { fontSize: 26, fontWeight: "900", color: "#fff", textAlign: "center" },
  emptySub: { fontSize: 15, color: "#AAA", textAlign: "center", lineHeight: 22 },
  emptyTips: { gap: 8, width: "100%" },
  emptyTip: { backgroundColor: "#1A1A2E", borderRadius: 12, padding: 12 },
  emptyTipText: { color: "#CCC", fontSize: 14 },
  createBtn: { backgroundColor: Colors.primary, borderRadius: 30, paddingHorizontal: 32, paddingVertical: 14 },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingTop: Platform.OS === "ios" ? 50 : 16, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: "transparent",
  },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 18, textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  unseenBadge: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  unseenText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  scrollHint: { position: "absolute", bottom: 100, left: 0, right: 0, alignItems: "center" },
  scrollHintText: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  counter: { position: "absolute", top: Platform.OS === "ios" ? 52 : 18, right: 16 },
  counterText: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700" },
  fab: {
    position: "absolute", bottom: 40, right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 10,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", marginTop: -2 },
});

const fb = StyleSheet.create({
  card: { width: W, height: POST_H, backgroundColor: "#000" },
  textBg: {
    flex: 1, backgroundColor: "#1A1A2E",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  textCaption: { fontSize: 28, color: "#fff", fontWeight: "800", textAlign: "center", lineHeight: 38 },
  overlay: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 300,
    // Linear gradient simulation with overlapping views
    backgroundColor: "transparent",
  },
  actions: {
    position: "absolute", right: 14, bottom: 120,
    gap: 20, alignItems: "center",
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionIcon: { fontSize: 30 },
  actionCount: { color: "#fff", fontSize: 12, fontWeight: "700", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  info: {
    position: "absolute", bottom: 0, left: 0, right: 80,
    padding: 16, paddingBottom: Platform.OS === "ios" ? 40 : 20,
    gap: 4,
  },
  authorName: { color: "#fff", fontWeight: "900", fontSize: 15, textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  caption: { color: "#fff", fontSize: 14, lineHeight: 20, textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  timeAgo: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  swipeHint: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontStyle: "italic" },
  heart: {
    position: "absolute", top: "40%", left: "40%",
    fontSize: 80, zIndex: 99,
  },
  newBadge: {
    position: "absolute", top: 16, left: 16,
    backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  pinnedBadge: {
    position: "absolute", top: 16, left: 16,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  pinnedText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  typeBadge: {
    position: "absolute", top: 16, right: 70,
    backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  typeBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});

const cs = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: "#1A1A2E", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: H * 0.75, minHeight: H * 0.4,
  },
  handle: { width: 40, height: 4, backgroundColor: "#444", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  title: { color: "#fff", fontWeight: "800", fontSize: 16, textAlign: "center", marginBottom: 4 },
  comment: {
    flexDirection: "row", backgroundColor: "#252540", borderRadius: 14, padding: 12, gap: 10,
  },
  commentMine: { backgroundColor: Colors.primary + "25" },
  commentAuthor: { color: "#AAA", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  commentText: { color: "#fff", fontSize: 14 },
  commentTime: { color: "#666", fontSize: 10, marginTop: 4 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderTopWidth: 1, borderTopColor: "#333",
  },
  input: {
    flex: 1, backgroundColor: "#252540", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 14,
  },
  sendBtn: {
    backgroundColor: Colors.primary, width: 40, height: 40,
    borderRadius: 20, alignItems: "center", justifyContent: "center",
  },
});

const cp = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A1A" },
  topBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#222",
  },
  topTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  postBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  postBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  sectionTitle: { color: "#AAA", fontSize: 14, fontWeight: "700", textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  optCard: {
    width: "44%", borderRadius: 18, padding: 18, alignItems: "center",
    gap: 6, borderWidth: 1.5,
  },
  optLabel: { color: "#fff", fontWeight: "800", fontSize: 14 },
  optHint: { color: "#888", fontSize: 11, textAlign: "center" },
  previewThumb: { width: 140, height: 200, borderRadius: 12, marginRight: 8 },
  textPreview: {
    borderRadius: 16, padding: 20, minHeight: 180,
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  textPreviewText: { fontSize: 22, fontWeight: "800", textAlign: "center", lineHeight: 30 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff" },
  label: { color: "#AAA", fontSize: 13, fontWeight: "700" },
  captionInput: {
    backgroundColor: "#1E1E38", color: "#fff", borderRadius: 14,
    padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: "top",
    borderWidth: 1, borderColor: "#333",
  },
  tips: { backgroundColor: "#1A1A2E", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#333" },
  tipsTitle: { color: "#888", fontSize: 13, fontWeight: "700", marginBottom: 6 },
  tipsText: { color: "#666", fontSize: 12, lineHeight: 20 },
  funCard: { backgroundColor: "#FFD70020", borderColor: "#FFD70060", borderWidth: 2 },
  stickerPreview: {
    height: 160, borderRadius: 16, overflow: "hidden",
    backgroundColor: "#1A1A2E", marginBottom: 4, borderWidth: 1, borderColor: "#333",
  },
});
