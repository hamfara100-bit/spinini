import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, ScrollView,
  Alert, StatusBar, Dimensions, Platform, Linking, Image, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as MediaLibrary from "expo-media-library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { DrawingCanvas } from "../../../../components/drawing-canvas";
import { Colors, FontSize, Radius, Spacing, Shadow } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import { uploadMedia, uploadMediaMany } from "../../../../lib/media-upload";
import { StopMotionStudio } from "../../../../components/stop-motion-studio";
import { generateColoringSVG } from "../../../../lib/ai";
import type { DrawingPath, DrawingSticker, ColoringPage } from "../../../../lib/data/types";

const DRAFT_KEY = (kidId: string) => `@famkids/drawing_draft_${kidId}`;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DrawingDraftData {
  paths: DrawingPath[];
  stickers: DrawingSticker[];
  savedAt: string;
}

const SCREEN_W = Dimensions.get("window").width;

type Tab = "draw" | "coloring" | "stopmotion";

// ─── External Drawing Apps ────────────────────────────────────────────────────

interface DrawingApp {
  id: string;
  name: string;
  developer: string;
  emoji: string;
  tagline: string;
  iosScheme: string | null;
  androidPackage: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  iosOnly?: boolean;
  free?: boolean;
}

const DRAWING_APPS: DrawingApp[] = [
  {
    id: "sketchbook",
    name: "Sketchbook",
    developer: "Autodesk",
    emoji: "📐",
    tagline: "Pro pencils, brushes & layers",
    iosScheme: "sketchbook://",
    androidPackage: "com.adsk.sketchbook",
    appStoreUrl: "https://apps.apple.com/app/sketchbook/id883738213",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.adsk.sketchbook",
    free: true,
  },
  {
    id: "ibispaint",
    name: "ibis Paint X",
    developer: "ibis inc.",
    emoji: "🖌️",
    tagline: "Manga, anime & illustration art",
    iosScheme: "ibispaint://",
    androidPackage: "jp.ne.ibis.ibispaintx.app",
    appStoreUrl: "https://apps.apple.com/app/ibis-paint-x/id585426613",
    playStoreUrl: "https://play.google.com/store/apps/details?id=jp.ne.ibis.ibispaintx.app",
    free: true,
  },
  {
    id: "procreate",
    name: "Procreate",
    developer: "Savage Interactive",
    emoji: "🎭",
    tagline: "Award-winning illustration (iPad)",
    iosScheme: "procreate://",
    androidPackage: null,
    appStoreUrl: "https://apps.apple.com/app/procreate/id425073498",
    playStoreUrl: null,
    iosOnly: true,
    free: false,
  },
  {
    id: "medibang",
    name: "MediBang Paint",
    developer: "MediBang Inc.",
    emoji: "🎌",
    tagline: "Comics, manga & digital painting",
    iosScheme: "medibang://",
    androidPackage: "com.medibang.android.paint.tablet",
    appStoreUrl: "https://apps.apple.com/app/medibang-paint-make-comic/id905076775",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.medibang.android.paint.tablet",
    free: true,
  },
  {
    id: "fresco",
    name: "Adobe Fresco",
    developer: "Adobe",
    emoji: "🅰️",
    tagline: "Live brushes & vector drawing",
    iosScheme: "adobefresco://",
    androidPackage: "com.adobe.fresco",
    appStoreUrl: "https://apps.apple.com/app/adobe-fresco/id1458660369",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.adobe.fresco",
    free: true,
  },
  {
    id: "infinite",
    name: "Infinite Painter",
    developer: "Infinite Studio",
    emoji: "♾️",
    tagline: "Natural painting & sketching",
    iosScheme: "infinitepainter://",
    androidPackage: "com.brakefield.painter",
    appStoreUrl: "https://apps.apple.com/app/infinite-painter/id366318175",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.brakefield.painter",
    free: true,
  },
  {
    id: "sketches",
    name: "Tayasui Sketches",
    developer: "Tayasui",
    emoji: "✏️",
    tagline: "Simple, beautiful sketching",
    iosScheme: "tayasui-sketches://",
    androidPackage: "com.tayasui.sketches",
    appStoreUrl: "https://apps.apple.com/app/tayasui-sketches/id641900855",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.tayasui.sketches",
    free: true,
  },
];

// ─── Root Screen ──────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const { openShare: openFlipbookShare, ShareModal: FlipbookShareModal } = useShareToSocial(id);
  const [tab, setTab] = useState<Tab>("draw");
  const [editingDrawing, setEditingDrawing] = useState<any | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ paths: DrawingPath[]; stickers: any[]; imageUri: string } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [saveToGallery, setSaveToGallery] = useState(false);
  const [draft, setDraft] = useState<DrawingDraftData | null>(null);
  const [resumeBannerVisible, setResumeBannerVisible] = useState(false);
  // draft paths/stickers to seed canvas when resuming
  const resumePathsRef = useRef<DrawingPath[]>([]);
  const resumeStickersRef = useRef<DrawingSticker[]>([]);

  // ── Load draft on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(DRAFT_KEY(id)).then(raw => {
      if (!raw) return;
      try {
        const d: DrawingDraftData = JSON.parse(raw);
        const age = Date.now() - new Date(d.savedAt).getTime();
        if (age > DRAFT_MAX_AGE_MS) { AsyncStorage.removeItem(DRAFT_KEY(id)); return; }
        if (!d.paths?.length && !d.stickers?.length) return;
        setDraft(d);
        // Auto-open if the kid was JUST drawing (< 2 hours ago)
        if (age < 2 * 60 * 60 * 1000) {
          resumePathsRef.current = d.paths ?? [];
          resumeStickersRef.current = d.stickers ?? [];
          setEditingDrawing({ id: "__draft__", title: "Last Drawing", paths: d.paths, stickers: d.stickers ?? [] });
          setDrawOpen(true);
        } else {
          setResumeBannerVisible(true);
        }
      } catch {}
    });
  }, [id]);

  // ── Auto-save callback (called by DrawingCanvas) ─────────────────────────
  async function handleAutoSave(paths: DrawingPath[], stickers: DrawingSticker[]) {
    if (!id) return;
    const data: DrawingDraftData = { paths, stickers, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(DRAFT_KEY(id), JSON.stringify(data));
  }

  // ── Clear draft after committing a real save ─────────────────────────────
  async function clearDraft() {
    if (id) await AsyncStorage.removeItem(DRAFT_KEY(id));
    setDraft(null);
    setResumeBannerVisible(false);
  }

  function openNewDrawing() {
    setEditingDrawing(null);
    setDrawOpen(true);
  }

  function openEditDrawing(drawing: any) {
    setEditingDrawing(drawing);
    setDrawOpen(true);
  }

  function resumeDraft() {
    if (!draft) return;
    setResumeBannerVisible(false);
    setEditingDrawing({ id: "__draft__", title: "Last Drawing", paths: draft.paths, stickers: draft.stickers ?? [] });
    setDrawOpen(true);
  }

  function discardDraft() {
    clearDraft();
    setResumeBannerVisible(false);
  }

  function onCanvasSave(paths: DrawingPath[], stickers: any[], imageUri: string) {
    setDrawOpen(false);
    setPendingSave({ paths, stickers, imageUri });
    setDraftName(editingDrawing?.id === "__draft__" ? "" : (editingDrawing?.title ?? ""));
    setNameModalVisible(true);
  }

  async function commitSave(name: string) {
    if (!pendingSave) return;
    const { paths, stickers, imageUri } = pendingSave;
    const title = name.trim() || `Drawing ${new Date().toLocaleDateString()}`;
    // Upload the rendered image so it shows on the parent's device too.
    const sharedImage = imageUri ? (await uploadMedia(imageUri, { folder: "drawings" })) ?? imageUri : imageUri;

    if (editingDrawing && editingDrawing.id !== "__draft__") {
      dispatch({
        type: "UPDATE_DRAWING",
        kidId: id,
        drawingId: editingDrawing.id,
        payload: { paths, stickers, imageUri: sharedImage, title },
      });
    } else {
      dispatch({
        type: "ADD_DRAWING",
        kidId: id,
        drawing: { id: uid(), kidId: id, paths, stickers, imageUri: sharedImage, title, createdAt: nowIso() },
      });
    }
    // Clear the draft since it's been properly saved
    clearDraft();

    // Optionally save to device gallery
    if (saveToGallery && imageUri) {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.saveToLibraryAsync(imageUri);
        } else {
          Alert.alert("Permission denied", "Could not save to gallery — permission was not granted.");
        }
      } catch {
        Alert.alert("Oops!", "Could not save to gallery.");
      }
    }

    setPendingSave(null);
    setEditingDrawing(null);
    setNameModalVisible(false);
    setDraftName("");
    setSaveToGallery(false);
  }

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "draw",       label: "Draw",     emoji: "✏️" },
    { id: "coloring",   label: "AI/Coloring", emoji: "🖌️" },
    { id: "stopmotion", label: "Flipbook", emoji: "🎬" },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎨 Create</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabs}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.tabEmoji}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Resume-draft banner */}
      {resumeBannerVisible && (
        <View style={styles.resumeBanner}>
          <Text style={styles.resumeIcon}>🎨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.resumeTitle}>Continue your drawing?</Text>
            <Text style={styles.resumeSub}>You left off {draft ? new Date(draft.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</Text>
          </View>
          <TouchableOpacity style={styles.resumeBtn} onPress={resumeDraft}>
            <Text style={styles.resumeBtnText}>Resume ▶</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resumeDiscard} onPress={discardDraft}>
            <Text style={styles.resumeDiscardText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {tab === "draw" && (
          <DrawTab
            kidId={id}
            drawings={kid?.drawings ?? []}
            dispatch={dispatch}
            onNew={openNewDrawing}
            onEdit={openEditDrawing}
          />
        )}
        {tab === "coloring" && (
          <ColoringTab kidId={id} pages={kid?.coloringPages ?? []} dispatch={dispatch} />
        )}
        {tab === "stopmotion" && (
          <StopMotionStudio
            kidId={id}
            projects={kid?.stopMotionProjects ?? []}
            onSave={async project => {
              // Upload every frame so the flipbook plays on the parent's device.
              const uris = await uploadMediaMany(project.frames.map(f => f.uri), { folder: "stopmotion" });
              const frames = project.frames.map((f, i) => ({ ...f, uri: uris[i] }));
              dispatch({ type: "ADD_STOP_MOTION", kidId: id, project: { ...project, frames } });
            }}
            onUpdate={async (projectId, payload) => {
              let p = payload;
              if (payload.frames) {
                const uris = await uploadMediaMany(payload.frames.map(f => f.uri), { folder: "stopmotion" });
                p = { ...payload, frames: payload.frames.map((f, i) => ({ ...f, uri: uris[i] })) };
              }
              dispatch({ type: "UPDATE_STOP_MOTION", kidId: id, projectId, payload: p });
            }}
            onDelete={projectId => dispatch({ type: "REMOVE_STOP_MOTION", kidId: id, projectId })}
            onShare={project => openFlipbookShare(project.frames?.[0]?.uri, project.title)}
            onSubmit={projectId => {
              dispatch({ type: "FLIPBOOK_SUBMIT", kidId: id, projectId });
              dispatch({
                type: "NOTIFICATION_ADD", kidId: id,
                notification: {
                  id: Math.random().toString(36).slice(2),
                  kidId: id, kind: "ping",
                  title: `🎬 Flipbook submitted!`,
                  body: `"${kid?.stopMotionProjects.find(p => p.id === projectId)?.title ?? "Flipbook"}" is waiting for your review.`,
                  read: false, createdAt: new Date().toISOString(),
                },
              });
            }}
          />
        )}
      </View>

      {/* Full-screen draw modal */}
      <Modal
        visible={drawOpen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDrawOpen(false)}
      >
        <SafeAreaView style={styles.fullscreenModal}>
          <StatusBar barStyle="light-content" backgroundColor="#090920" />
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity onPress={() => setDrawOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.fullscreenTitle} numberOfLines={1}>
              {editingDrawing ? `✏️ Edit: ${editingDrawing.title ?? "Drawing"}` : "✏️ Drawing Studio"}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <DrawingCanvas
            onSave={onCanvasSave}
            onAutoSave={handleAutoSave}
            initialPaths={editingDrawing?.paths ?? []}
            initialStickers={editingDrawing?.stickers ?? []}
          />
        </SafeAreaView>
      </Modal>

      {/* Name prompt modal */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => commitSave(draftName)}
      >
        <View style={styles.nameOverlay}>
          <View style={styles.nameCard}>
            <Text style={styles.nameTitle}>🎨 Name your drawing</Text>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="e.g. My Dragon, Space Adventure…"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={() => commitSave(draftName)}
            />
            {/* Also save to Camera Roll toggle */}
            <View style={styles.galleryToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.galleryToggleLabel}>📱 Also save to Camera Roll</Text>
                <Text style={styles.galleryToggleSub}>Save a copy to your device photos</Text>
              </View>
              <Switch
                value={saveToGallery}
                onValueChange={setSaveToGallery}
                trackColor={{ true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.nameActions}>
              <TouchableOpacity
                style={styles.nameSkipBtn}
                onPress={() => commitSave("")}
              >
                <Text style={styles.nameSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nameSaveBtn}
                onPress={() => commitSave(draftName)}
              >
                <Text style={styles.nameSaveText}>💾 Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Flipbook share-to-social modal */}
      {FlipbookShareModal}
    </View>
  );
}

// ─── Share to Family Social ─────────────────────────────────────────────────────

function useShareToSocial(kidId: string) {
  const { state, dispatch } = useData();
  const [shareUri, setShareUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  function openShare(uri: string | undefined | null, defaultTitle?: string) {
    if (!uri) {
      Alert.alert("Nothing to share yet", "Finish your creation first, then share it to the Family Social page!");
      return;
    }
    setTitle(defaultTitle ?? "");
    setShareUri(uri);
  }

  function confirm() {
    if (!shareUri) return;
    const caption = title.trim() || "My creation";
    dispatch({
      type: "SOCIAL_POST_ADD",
      post: {
        id: uid(), authorId: kidId, type: "photo",
        mediaUris: [shareUri], caption,
        likes: [], comments: [], viewedBy: [kidId], pinned: false, createdAt: nowIso(),
      },
    });
    const authorName = state.kids.find(k => k.profile.id === kidId)?.profile.name ?? "Someone";
    state.kids.filter(k => k.profile.id !== kidId).forEach(k => {
      dispatch({
        type: "NOTIFICATION_ADD",
        kidId: k.profile.id,
        notification: {
          id: uid(), kidId: k.profile.id, kind: "ping",
          title: `📱 ${authorName} posted something new!`,
          body: caption, emoji: "📱", read: false, createdAt: nowIso(),
        },
      });
    });
    setShareUri(null);
    setTitle("");
    Alert.alert("Posted! 🎉", "Your creation is now on the Family Social page!");
  }

  const ShareModal = (
    <Modal visible={!!shareUri} transparent animationType="fade" onRequestClose={() => setShareUri(null)}>
      <View style={styles.nameOverlay}>
        <View style={styles.nameCard}>
          <Text style={styles.nameTitle}>📱 Share to Family Social</Text>
          <Text style={styles.shareSub}>Give your creation a title so everyone knows what it is!</Text>
          <TextInput
            style={styles.nameInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. My Lego War 🧱"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={confirm}
          />
          <View style={styles.nameActions}>
            <TouchableOpacity style={styles.nameSkipBtn} onPress={() => { setShareUri(null); setTitle(""); }}>
              <Text style={styles.nameSkipText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nameSaveBtn} onPress={confirm}>
              <Text style={styles.nameSaveText}>📱 Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return { openShare, ShareModal };
}

// ─── Draw Tab ─────────────────────────────────────────────────────────────────

function DrawTab({
  kidId, drawings, dispatch, onNew, onEdit,
}: { kidId: string; drawings: any[]; dispatch: any; onNew: () => void; onEdit: (d: any) => void }) {
  const { openShare, ShareModal } = useShareToSocial(kidId);
  function confirmDelete(d: any) {
    Alert.alert("Delete Drawing", `Delete "${d.title ?? "this drawing"}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "REMOVE_DRAWING", kidId, drawingId: d.id }) },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.drawTabContent} showsVerticalScrollIndicator={false}>

      {/* New Drawing Hero Button */}
      <TouchableOpacity style={styles.newDrawBtn} onPress={onNew} activeOpacity={0.85}>
        <View style={styles.newDrawBtnInner}>
          <Text style={styles.newDrawBtnIcon}>🎨</Text>
          <Text style={styles.newDrawBtnTitle}>New Drawing</Text>
          <Text style={styles.newDrawBtnSub}>Full screen • Glow mode • Stickers • Photo background</Text>
        </View>
      </TouchableOpacity>

      {/* Feature chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featureChips}>
        {[
          { icon: "✨", label: "Glow Mode" },
          { icon: "🎈", label: "Balloons" },
          { icon: "🐾", label: "Animals" },
          { icon: "🔤", label: "Alphabet" },
          { icon: "🖼️", label: "Photo BG" },
          { icon: "📷", label: "Camera BG" },
        ].map(f => (
          <TouchableOpacity key={f.label} style={styles.featureChip} onPress={onNew}>
            <Text style={{ fontSize: 20 }}>{f.icon}</Text>
            <Text style={styles.featureChipLabel}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Pro Apps Launcher ── */}
      <AppLauncher kidId={kidId} dispatch={dispatch} />

      {/* Previous drawings */}
      {drawings.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>My Drawings 🖼️</Text>
          <View style={styles.drawingGrid}>
            {drawings.slice().reverse().map((d, i) => (
              <View key={d.id ?? i} style={styles.drawingCard}>
                {/* Thumbnail — real image or fallback */}
                <TouchableOpacity onPress={() => onEdit(d)} activeOpacity={0.85} style={styles.drawingThumbArea}>
                  {d.imageUri ? (
                    <Image
                      source={{ uri: d.imageUri }}
                      style={styles.drawingThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.drawingThumb, styles.drawingThumbFallback]}>
                      <Text style={{ fontSize: 36 }}>🎨</Text>
                      <Text style={styles.drawingThumbFallbackText}>{d.paths?.length ?? 0} strokes</Text>
                    </View>
                  )}
                  {/* Edit overlay chip */}
                  <View style={styles.editChip}>
                    <Text style={styles.editChipText}>✏️ Edit</Text>
                  </View>
                </TouchableOpacity>

                {/* Title + actions */}
                <View style={styles.drawingCardFooter}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawingCardTitle} numberOfLines={1}>{d.title ?? "Untitled"}</Text>
                    <Text style={styles.drawingCardDate}>{new Date(d.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => openShare(d.imageUri, d.title)} style={styles.drawingShareBtn}>
                    <Text style={styles.drawingShareIcon}>📱</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(d)} style={styles.drawingDeleteBtn}>
                    <Text style={styles.drawingDeleteIcon}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
      {ShareModal}
    </ScrollView>
  );
}

// ─── App Launcher ─────────────────────────────────────────────────────────────

function AppLauncher({ kidId, dispatch }: { kidId: string; dispatch: any }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [askModal, setAskModal] = useState<DrawingApp | null>(null);

  const visibleApps = DRAWING_APPS.filter(
    a => Platform.OS !== "android" || a.androidPackage !== null
  );

  async function handleAppPress(app: DrawingApp) {
    setChecking(app.id);

    const scheme = Platform.OS === "ios" ? app.iosScheme : `intent://launch/#Intent;package=${app.androidPackage};end`;

    // Skip unsupported platform
    if (Platform.OS === "android" && !app.androidPackage) {
      setChecking(null);
      Alert.alert(`${app.name} is not available on Android.`);
      return;
    }
    if (Platform.OS === "ios" && !app.iosScheme) {
      setChecking(null);
      Alert.alert(`${app.name} is not available on iOS.`);
      return;
    }

    try {
      // On iOS use the scheme, on Android use package intent
      const checkUrl = Platform.OS === "ios"
        ? app.iosScheme!
        : `https://play.google.com/store/apps/details?id=${app.androidPackage}`;

      const canOpen = await Linking.canOpenURL(app.iosScheme ?? checkUrl);

      if (canOpen) {
        await Linking.openURL(app.iosScheme ?? `intent://launch/#Intent;package=${app.androidPackage};launchFlags=0x10000000;end`);
      } else {
        setAskModal(app);
      }
    } catch {
      setAskModal(app);
    } finally {
      setChecking(null);
    }
  }

  function sendInstallRequest(app: DrawingApp) {
    // Add to kid's wish list so parent sees it
    dispatch({
      type: "WISH_ADD",
      kidId,
      wish: {
        id: uid(),
        kidId,
        title: `Please install ${app.name} for me! ${app.emoji}`,
        note: `${app.name} by ${app.developer} — ${app.tagline}. I want to use it for drawing!`,
        category: "App",
        moodEmoji: "🙏",
        decision: "pending",
        createdAt: nowIso(),
      },
    });
    setAskModal(null);
    Alert.alert(
      "Request Sent! 🎉",
      `Your parent will see your request to install ${app.name} in the Wish List.`,
      [{ text: "OK 👍" }]
    );
  }

  async function openStore(app: DrawingApp) {
    const url = Platform.OS === "ios" ? app.appStoreUrl : app.playStoreUrl;
    if (url) {
      try { await Linking.openURL(url); } catch {}
    }
  }

  return (
    <View style={styles.appLauncherSection}>
      {/* Section header / toggle button */}
      <TouchableOpacity
        style={styles.appLauncherToggle}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.85}
      >
        <View style={styles.appLauncherToggleLeft}>
          <Text style={styles.appLauncherToggleIcon}>🚀</Text>
          <View>
            <Text style={styles.appLauncherToggleTitle}>Draw with a Pro App</Text>
            <Text style={styles.appLauncherToggleSub}>Open Sketchbook, ibis Paint X & more</Text>
          </View>
        </View>
        <Text style={[styles.appLauncherChevron, open && styles.appLauncherChevronOpen]}>
          ▼
        </Text>
      </TouchableOpacity>

      {/* Dropdown list */}
      {open && (
        <View style={styles.appList}>
          {visibleApps.map(app => (
            <TouchableOpacity
              key={app.id}
              style={styles.appRow}
              onPress={() => handleAppPress(app)}
              activeOpacity={0.8}
              disabled={checking === app.id}
            >
              {/* App icon */}
              <View style={styles.appIconBubble}>
                <Text style={styles.appIconEmoji}>{app.emoji}</Text>
              </View>

              {/* App info */}
              <View style={styles.appInfo}>
                <View style={styles.appNameRow}>
                  <Text style={styles.appName}>{app.name}</Text>
                  {app.free && (
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeText}>FREE</Text>
                    </View>
                  )}
                  {app.iosOnly && (
                    <View style={styles.iosBadge}>
                      <Text style={styles.iosBadgeText}>iOS only</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.appDeveloper}>{app.developer}</Text>
                <Text style={styles.appTagline}>{app.tagline}</Text>
              </View>

              {/* Open button */}
              <View style={styles.appOpenBtn}>
                {checking === app.id ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.appOpenBtnText}>Open →</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Not Installed modal */}
      <Modal
        visible={!!askModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAskModal(null)}
      >
        <View style={styles.askOverlay}>
          <View style={styles.askCard}>
            <Text style={styles.askEmoji}>{askModal?.emoji ?? "📱"}</Text>
            <Text style={styles.askTitle}>{askModal?.name} is not installed</Text>
            <Text style={styles.askBody}>
              You need <Text style={{ fontWeight: "800" }}>{askModal?.name}</Text> to draw with it.
              You can ask your parent to install it, or open the app store to get it!
            </Text>

            <TouchableOpacity
              style={styles.askPrimaryBtn}
              onPress={() => askModal && sendInstallRequest(askModal)}
            >
              <Text style={styles.askPrimaryBtnText}>🙏 Ask Parent to Install</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.askSecondaryBtn}
              onPress={() => { askModal && openStore(askModal); setAskModal(null); }}
            >
              <Text style={styles.askSecondaryBtnText}>
                {Platform.OS === "ios" ? "📱 Open App Store" : "🛒 Open Play Store"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.askCancelBtn} onPress={() => setAskModal(null)}>
              <Text style={styles.askCancelText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Coloring Tab ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "A magical dragon 🐉", "Underwater castle 🏰", "Space rocket 🚀",
  "Friendly robot 🤖", "Rainbow unicorn 🦄", "Enchanted forest 🌳",
  "Pirate ship 🏴‍☠️", "Dinosaur adventure 🦕",
];

function ColoringTab({ kidId, pages, dispatch }: { kidId: string; pages: ColoringPage[]; dispatch: any }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<ColoringPage | null>(null);
  const { openShare, ShareModal } = useShareToSocial(kidId);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const svg = await generateColoringSVG(prompt.trim());
      const page: ColoringPage = {
        id: uid(), kidId, prompt: prompt.trim(),
        outlineSvg: svg, fromParent: false, createdAt: nowIso(), paths: [],
      };
      dispatch({ type: "COLORING_ADD", kidId, page });
      setPrompt("");
      setActivePage(page);
    } catch {
      Alert.alert("Oops!", "Could not generate page. Try again!");
    } finally {
      setLoading(false);
    }
  }

  async function savePaths(paths: DrawingPath[], stickers: any[], _imageUri: string) {
    if (!activePage) return;
    const coloredUri = _imageUri ? (await uploadMedia(_imageUri, { folder: "coloring" })) ?? _imageUri : _imageUri;
    dispatch({ type: "COLORING_UPDATE", kidId, pageId: activePage.id, payload: { paths, stickers, coloredUri } });
    setActivePage(null);
  }

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <Text style={styles.coloringSub}>✨ Ask AI to draw a coloring page for you!</Text>

        <TextInput
          style={styles.coloringInput}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe your coloring page…"
          placeholderTextColor={Colors.textMuted}
          multiline
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroll}>
          {SUGGESTIONS.map(s => (
            <TouchableOpacity key={s} style={styles.chip} onPress={() => setPrompt(s)}>
              <Text style={styles.chipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.genBtn, (loading || !prompt.trim()) && { opacity: 0.6 }]}
          onPress={generate}
          disabled={loading || !prompt.trim()}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.genBtnText}>✨ Generate Coloring Page!</Text>}
        </TouchableOpacity>

        {pages.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>My Coloring Pages 🖌️</Text>
            {pages.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.pageCard}
                onPress={() => setActivePage(pages.find(x => x.id === p.id) ?? p)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 32 }}>{(p.paths?.length ?? 0) > 0 ? "🎨" : "🖼️"}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.pagePrompt}>{p.prompt}</Text>
                  <Text style={styles.pageDate}>
                    {(p.paths?.length ?? 0) > 0 ? "✏️ In progress" : "⬜ Not started"} • {new Date(p.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {p.coloredUri ? (
                  <TouchableOpacity
                    onPress={() => openShare(p.coloredUri, p.prompt)}
                    style={styles.coloringShareBtn}
                  >
                    <Text style={styles.coloringShareIcon}>📱</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.paintArrow}>Paint →</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
      {ShareModal}

      <Modal
        visible={!!activePage}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setActivePage(null)}
      >
        <SafeAreaView style={styles.fullscreenModal}>
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity onPress={() => setActivePage(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.fullscreenTitle} numberOfLines={1}>{activePage?.prompt}</Text>
            <View style={{ width: 36 }} />
          </View>
          {activePage && (
            <DrawingCanvas
              key={activePage.id}
              initialPaths={activePage.paths ?? []}
              backgroundSvg={activePage.outlineSvg}
              onSave={savePaths}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  content: { flex: 1, paddingHorizontal: Spacing.md },

  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  tabActive: { backgroundColor: Colors.primary },
  tabEmoji: { fontSize: 18 },
  tabLabel: { fontSize: 10, fontWeight: "600", color: Colors.textSecondary, marginTop: 2 },
  tabLabelActive: { color: "#fff" },

  // Resume banner
  resumeBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.primary + "18",
    borderWidth: 1.5, borderColor: Colors.primary + "55",
    borderRadius: Radius.xl, margin: Spacing.md, marginBottom: 0,
    padding: Spacing.sm, gap: 8,
  },
  resumeIcon: { fontSize: 28 },
  resumeTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },
  resumeSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  resumeBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  resumeBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  resumeDiscard: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.cardLight,
    alignItems: "center", justifyContent: "center",
  },
  resumeDiscardText: { color: Colors.textSecondary, fontWeight: "700", fontSize: 14 },

  // Draw tab
  drawTabContent: { paddingBottom: Spacing.xl },
  newDrawBtn: { borderRadius: Radius.xl, overflow: "hidden", marginBottom: Spacing.md, ...Shadow.md },
  newDrawBtnInner: {
    backgroundColor: Colors.primary, padding: Spacing.xl,
    alignItems: "center", borderRadius: Radius.xl, gap: 8,
  },
  newDrawBtnIcon: { fontSize: 56 },
  newDrawBtnTitle: { fontSize: FontSize.xl, fontWeight: "900", color: "#fff" },
  newDrawBtnSub: { fontSize: FontSize.sm, color: "#ffffff99", textAlign: "center" },

  featureChips: { flexGrow: 0, marginBottom: Spacing.md },
  featureChip: {
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.cardLight, borderRadius: Radius.lg,
    marginRight: 8, gap: 2, minWidth: 70,
  },
  featureChipLabel: { fontSize: 10, fontWeight: "600", color: Colors.textSecondary },

  sectionHeader: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.md },

  drawingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  drawingCard: {
    width: (SCREEN_W - Spacing.md * 2 - 10) / 2,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.xl, overflow: "hidden", ...Shadow.sm,
  },
  drawingThumbArea: { position: "relative" },
  drawingThumb: {
    width: "100%", aspectRatio: 1,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
  },
  drawingThumbFallback: {
    backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center", gap: 4,
  },
  drawingThumbFallbackText: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },
  editChip: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: "#000000AA", borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  editChipText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  drawingCardFooter: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.sm, paddingVertical: 8, gap: 4,
  },
  drawingCardTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  drawingCardDate: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  drawingDeleteBtn: { padding: 4 },
  drawingDeleteIcon: { fontSize: 16 },
  drawingShareBtn: { padding: 4 },
  drawingShareIcon: { fontSize: 16 },
  coloringShareBtn: { padding: 6, marginRight: 4 },
  coloringShareIcon: { fontSize: 18 },
  shareSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginTop: -6 },
  // Name modal
  nameOverlay: { flex: 1, backgroundColor: "#00000077", justifyContent: "center", padding: Spacing.lg },
  nameCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.xl, gap: 16, ...Shadow.md,
  },
  nameTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  nameInput: {
    borderWidth: 2, borderColor: Colors.primary + "55", borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary,
    backgroundColor: Colors.bgLight,
  },
  galleryToggleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.bgLight, borderRadius: Radius.lg,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  galleryToggleLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  galleryToggleSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  nameActions: { flexDirection: "row", gap: 10 },
  nameSkipBtn: {
    flex: 1, padding: 12, borderRadius: Radius.lg,
    backgroundColor: Colors.cardLight, alignItems: "center",
  },
  nameSkipText: { color: Colors.textSecondary, fontWeight: "700" },
  nameSaveBtn: {
    flex: 2, padding: 12, borderRadius: Radius.lg,
    backgroundColor: Colors.primary, alignItems: "center",
  },
  nameSaveText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // App Launcher
  appLauncherSection: { marginBottom: Spacing.md },
  appLauncherToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm,
  },
  appLauncherToggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  appLauncherToggleIcon: { fontSize: 30 },
  appLauncherToggleTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  appLauncherToggleSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  appLauncherChevron: { fontSize: 13, color: Colors.textMuted, fontWeight: "700", transform: [{ rotate: "0deg" }] },
  appLauncherChevronOpen: { transform: [{ rotate: "180deg" }] },

  appList: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: Colors.border,
    marginTop: 4, overflow: "hidden",
  },
  appRow: {
    flexDirection: "row", alignItems: "center",
    padding: Spacing.md, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appIconBubble: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: Colors.cardLight,
    alignItems: "center", justifyContent: "center",
    ...Shadow.sm,
  },
  appIconEmoji: { fontSize: 26 },
  appInfo: { flex: 1 },
  appNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  appName: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  freeBadge: {
    backgroundColor: "#22C55E22", borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  freeBadgeText: { fontSize: 9, fontWeight: "800", color: "#16A34A" },
  iosBadge: {
    backgroundColor: "#3B82F622", borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  iosBadgeText: { fontSize: 9, fontWeight: "700", color: "#2563EB" },
  appDeveloper: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  appTagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  appOpenBtn: {
    backgroundColor: Colors.primary + "18", borderRadius: Radius.lg,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.primary + "33",
    minWidth: 64, alignItems: "center",
  },
  appOpenBtnText: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.sm },

  // Ask parent modal
  askOverlay: { flex: 1, backgroundColor: "#00000077", justifyContent: "center", padding: Spacing.lg },
  askCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: "center", gap: 12, ...Shadow.md,
  },
  askEmoji: { fontSize: 56 },
  askTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  askBody: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 20,
  },
  askPrimaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: 14, paddingHorizontal: 24,
    width: "100%", alignItems: "center", ...Shadow.md,
  },
  askPrimaryBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  askSecondaryBtn: {
    backgroundColor: Colors.cardLight, borderRadius: Radius.lg,
    paddingVertical: 12, paddingHorizontal: 24,
    width: "100%", alignItems: "center",
    borderWidth: 1.5, borderColor: Colors.border,
  },
  askSecondaryBtnText: { color: Colors.textPrimary, fontWeight: "700", fontSize: FontSize.base },
  askCancelBtn: { paddingVertical: 4 },
  askCancelText: { color: Colors.textMuted, fontSize: FontSize.sm, textDecorationLine: "underline" },

  // Fullscreen modal
  fullscreenModal: { flex: 1, backgroundColor: "#090920" },
  fullscreenHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: "#0E0E2A", borderBottomWidth: 1, borderBottomColor: "#2D2870",
  },
  fullscreenTitle: {
    flex: 1, fontSize: FontSize.base, fontWeight: "700",
    color: "#fff", textAlign: "center", marginHorizontal: 8,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#ffffff22", alignItems: "center", justifyContent: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Coloring
  coloringSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, fontWeight: "600" },
  coloringInput: {
    borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: FontSize.base, minHeight: 72,
    textAlignVertical: "top", backgroundColor: Colors.surfaceLight,
    marginBottom: Spacing.sm, color: Colors.textPrimary,
  },
  suggestionScroll: { flexGrow: 0, marginBottom: Spacing.sm },
  chip: {
    backgroundColor: Colors.cardLight, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
  },
  chipText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  genBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    alignItems: "center", padding: Spacing.md, marginBottom: Spacing.lg, ...Shadow.md,
  },
  genBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  pageCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 8, ...Shadow.sm,
  },
  pagePrompt: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  pageDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  paintArrow: { color: Colors.primary, fontWeight: "700" },

});
