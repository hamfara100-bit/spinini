import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, Modal, TextInput, Dimensions, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { Colors, FontSize, Radius, Spacing, Shadow } from "../lib/theme";
import { uid, nowIso } from "../lib/utils";
import { callAI } from "../lib/ai";
import type { StopMotionProject, StopMotionFrame } from "../lib/data/types";

const { width: SW } = Dimensions.get("window");
const FRAME_THUMB = 64;
const FPS_OPTIONS = [2, 4, 8, 12, 16, 24];

interface StopMotionStudioProps {
  kidId: string;
  projects: StopMotionProject[];
  onSave: (project: StopMotionProject) => void;
  onUpdate: (projectId: string, payload: Partial<StopMotionProject>) => void;
  onDelete: (projectId: string) => void;
  onSubmit?: (projectId: string) => void;
  onShare?: (project: StopMotionProject) => void;
}

export function StopMotionStudio({ kidId, projects, onSave, onUpdate, onDelete, onSubmit, onShare }: StopMotionStudioProps) {
  const [view, setView] = useState<"list" | "studio">("list");
  const [activeProject, setActiveProject] = useState<StopMotionProject | null>(null);

  function newProject() {
    const p: StopMotionProject = {
      id: uid(), kidId, title: `Flipbook ${projects.length + 1}`,
      frames: [], fps: 8, createdAt: nowIso(),
    };
    onSave(p);
    setActiveProject(p);
    setView("studio");
  }

  function openProject(p: StopMotionProject) {
    setActiveProject(p);
    setView("studio");
  }

  function handleUpdate(projectId: string, payload: Partial<StopMotionProject>) {
    onUpdate(projectId, payload);
    setActiveProject(prev => prev ? { ...prev, ...payload } : prev);
  }

  function handleDelete(projectId: string) {
    Alert.alert("Delete Flipbook", "Delete this project? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        onDelete(projectId);
        setView("list");
        setActiveProject(null);
      }},
    ]);
  }

  if (view === "studio" && activeProject) {
    return (
      <StudioView
        project={activeProject}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onSubmit={onSubmit}
        onBack={() => { setView("list"); setActiveProject(null); }}
      />
    );
  }

  // Project list
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>🎬 Flipbook Studio</Text>
        <TouchableOpacity style={styles.newBtn} onPress={newProject}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🎬</Text>
          <Text style={styles.emptyTitle}>Make your first flipbook!</Text>
          <Text style={styles.emptySub}>Take photos one by one and watch them come to life as an animation.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={newProject}>
            <Text style={styles.emptyBtnText}>Start Creating</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {projects.map(p => (
            <TouchableOpacity key={p.id} style={styles.projectCard} onPress={() => openProject(p)}>
              {p.frames.length > 0
                ? <Image source={{ uri: p.frames[0].uri }} style={styles.projectThumb} />
                : <View style={[styles.projectThumb, styles.projectThumbEmpty]}>
                    <Text style={{ fontSize: 28 }}>🎞️</Text>
                  </View>
              }
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.projectTitle}>{p.title}</Text>
                <Text style={styles.projectMeta}>{p.frames.length} frames · {p.fps} fps</Text>
                {p.parentApproved === true && (
                  <View style={styles.approvedBadge}>
                    <Text style={styles.approvedBadgeText}>✅ Approved! +{p.pointsAwarded ?? 0} pts</Text>
                  </View>
                )}
                {p.submittedAt && p.parentApproved === null && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>⏳ Waiting for parent…</Text>
                  </View>
                )}
              </View>
              {onShare && p.frames.length > 0 && (
                <TouchableOpacity
                  onPress={() => onShare(p)}
                  style={styles.shareBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.shareBtnText}>📱</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.projectArrow}>▶</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── AI Smooth result ─────────────────────────────────────────────────────────

interface AISmoothResult {
  strategy: string;
  explanation: string;
  frameIndices: number[];
  fps: number;
}

// ─── Studio View ──────────────────────────────────────────────────────────────

interface StudioViewProps {
  project: StopMotionProject;
  onUpdate: (projectId: string, payload: Partial<StopMotionProject>) => void;
  onDelete: (projectId: string) => void;
  onSubmit?: (projectId: string) => void;
  onBack: () => void;
}

function StudioView({ project, onUpdate, onDelete, onSubmit, onBack }: StudioViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [frames, setFrames] = useState<StopMotionFrame[]>(project.frames);
  const [fps, setFps] = useState(project.fps);
  const [facing, setFacing] = useState<CameraType>("back");
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const [onionSkin, setOnionSkin] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(project.title);
  const cameraRef = useRef<CameraView>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── AI Smooth state ───────────────────────────────────────────────────────
  const [aiSmoothing, setAiSmoothing] = useState(false);
  const [smoothResult, setSmoothResult] = useState<AISmoothResult | null>(null);
  const [smoothPreviewPlaying, setSmoothPreviewPlaying] = useState(false);
  const [smoothPreviewIdx, setSmoothPreviewIdx] = useState(0);
  const smoothIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync frames to store whenever they change
  useEffect(() => {
    onUpdate(project.id, { frames, fps, title });
  }, [frames, fps, title]);

  // Original playback interval
  useEffect(() => {
    if (playing && frames.length > 1) {
      playIntervalRef.current = setInterval(() => {
        setPlayIndex(i => (i + 1) % frames.length);
      }, 1000 / fps);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      if (!playing) setPlayIndex(0);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [playing, fps, frames.length]);

  // Smooth preview playback interval
  useEffect(() => {
    if (smoothPreviewPlaying && smoothResult) {
      smoothIntervalRef.current = setInterval(() => {
        setSmoothPreviewIdx(i => (i + 1) % smoothResult.frameIndices.length);
      }, 1000 / smoothResult.fps);
    } else {
      if (smoothIntervalRef.current) clearInterval(smoothIntervalRef.current);
      if (!smoothPreviewPlaying) setSmoothPreviewIdx(0);
    }
    return () => { if (smoothIntervalRef.current) clearInterval(smoothIntervalRef.current); };
  }, [smoothPreviewPlaying, smoothResult]);

  async function captureFrame() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (!photo) return;
      const newFrame: StopMotionFrame = { uri: photo.uri, capturedAt: nowIso() };
      setFrames(prev => [...prev, newFrame]);
      setSelectedFrame(frames.length);
    } catch {
      Alert.alert("Error", "Could not capture frame. Try again.");
    }
  }

  function deleteFrame(index: number) {
    Alert.alert("Delete frame", `Delete frame ${index + 1}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        setFrames(prev => prev.filter((_, i) => i !== index));
        setSelectedFrame(null);
      }},
    ]);
  }

  function cycleFps() {
    const idx = FPS_OPTIONS.indexOf(fps);
    setFps(FPS_OPTIONS[(idx + 1) % FPS_OPTIONS.length]);
  }

  async function saveToGallery() {
    if (frames.length === 0) { Alert.alert("No frames yet!", "Capture some frames first."); return; }
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to save frames."); return; }
    let saved = 0;
    for (const frame of frames) {
      try { await MediaLibrary.saveToLibraryAsync(frame.uri); saved++; } catch {}
    }
    Alert.alert("✅ Saved!", `${saved} frame${saved !== 1 ? "s" : ""} saved to your Camera Roll.`);
  }

  function submitForPoints() {
    if (frames.length < 2) { Alert.alert("Not enough frames", "Add at least 2 frames to submit your flipbook!"); return; }
    if (project.submittedAt && project.parentApproved === null) {
      Alert.alert("Already submitted", "Your flipbook is already waiting for parent approval. Hang tight! ⏳");
      return;
    }
    Alert.alert(
      "⭐ Submit for Points?",
      `Send "${project.title}" to your parent for review and earn screen-time points!`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Submit! 🚀", onPress: () => {
          onSubmit?.(project.id);
          Alert.alert("🎉 Submitted!", "Your parent will review your flipbook and give you points!");
        }},
      ]
    );
  }

  // ── AI Smooth ─────────────────────────────────────────────────────────────

  async function runAiSmooth() {
    if (frames.length < 3) {
      Alert.alert("Need more frames", "Add at least 3 frames before AI can smooth your animation!");
      return;
    }
    setAiSmoothing(true);
    try {
      const maxOutput = Math.min(frames.length * 5, 80);
      const raw = await callAI(
        [{
          role: "user",
          content:
            `I have a stop-motion animation called "${title}" with ${frames.length} frames at ${fps} FPS ` +
            `(${(frames.length / fps).toFixed(1)}s total). ` +
            `Create a smoother version by rearranging/repeating the original frames. ` +
            `Use ONLY frame indices 0–${frames.length - 1}. Keep total under ${maxOutput} frames. ` +
            `Pick the best strategy: ease-in/out, duplicate transitions, ping-pong loop, or speed ramp. ` +
            `Reply ONLY with valid JSON (no markdown): ` +
            `{"strategy":"name","explanation":"1-2 fun sentences for a kid","frameIndices":[0,0,1,...],"fps":8}`,
        }],
        "You are an animation expert. Reply ONLY with a single valid JSON object — no markdown fences, no extra text.",
        512,
      );

      // Parse — strip any accidental markdown fences
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const result = JSON.parse(jsonMatch[0]) as AISmoothResult;

      // Validate
      if (!Array.isArray(result.frameIndices) || result.frameIndices.length < 2) throw new Error("Invalid frame list");
      // Clamp indices to valid range
      result.frameIndices = result.frameIndices
        .map(i => Math.max(0, Math.min(frames.length - 1, Math.round(i))))
        .slice(0, maxOutput);
      result.fps = Math.max(2, Math.min(24, Math.round(result.fps ?? fps)));

      setSmoothResult(result);
      setSmoothPreviewPlaying(true);
    } catch (err) {
      Alert.alert("AI couldn't smooth it", "Try again or add more frames first!");
    } finally {
      setAiSmoothing(false);
    }
  }

  function applySmoothResult() {
    if (!smoothResult) return;
    const smoothedFrames = smoothResult.frameIndices.map(i => frames[i]);
    setFrames(smoothedFrames);
    setFps(smoothResult.fps);
    setSmoothResult(null);
    setSmoothPreviewPlaying(false);
    Alert.alert("✨ Done!", `Your flipbook is now smoother! (${smoothedFrames.length} frames @ ${smoothResult.fps} fps)`);
  }

  function discardSmoothResult() {
    setSmoothResult(null);
    setSmoothPreviewPlaying(false);
    setSmoothPreviewIdx(0);
  }

  if (!permission) return <View style={{ flex: 1 }} />;

  if (!permission.granted) {
    return (
      <View style={styles.permBox}>
        <Text style={{ fontSize: 48 }}>📷</Text>
        <Text style={styles.permTitle}>Camera needed</Text>
        <Text style={styles.permSub}>Allow camera access to capture frames for your flipbook.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const prevFrame = frames.length > 0 ? frames[frames.length - 1] : null;
  const duration = frames.length > 0 ? (frames.length / fps).toFixed(1) : "0";

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>

      {/* Top bar */}
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.topBtn}>
            <Text style={styles.topBtnText}>← Back</Text>
          </TouchableOpacity>

          {editingTitle ? (
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              onBlur={() => setEditingTitle(false)}
              autoFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingTitle(true)}>
              <Text style={styles.topTitle}>{title}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.topActions}>
            {/* ── AI Smooth button ── */}
            <TouchableOpacity
              onPress={runAiSmooth}
              disabled={aiSmoothing || frames.length < 3}
              style={[
                styles.topActionBtn, styles.topActionBtnAI,
                (aiSmoothing || frames.length < 3) && { opacity: 0.5 },
              ]}
            >
              {aiSmoothing
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.topActionText}>🪄 AI Smooth</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={saveToGallery} style={styles.topActionBtn}>
              <Text style={styles.topActionText}>💾 Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={submitForPoints}
              style={[styles.topActionBtn, styles.topActionBtnSubmit,
                project.submittedAt && project.parentApproved === null && { opacity: 0.6 }]}
            >
              <Text style={styles.topActionText}>
                {project.parentApproved === true ? "✅ Done" : project.submittedAt ? "⏳ Sent" : "⭐ Submit"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onDelete(project.id)} style={styles.topBtn}>
              <Text style={[styles.topBtnText, { color: "#ff6b6b" }]}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Camera / Playback area */}
      <View style={styles.cameraWrap}>
        {playing && frames.length > 0 ? (
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            <Image source={{ uri: frames[playIndex].uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            <View style={styles.playOverlay}>
              <Text style={styles.playFrameLabel}>Frame {playIndex + 1} / {frames.length}</Text>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing}>
              {onionSkin && prevFrame && (
                <Image
                  source={{ uri: prevFrame.uri }}
                  style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
                  resizeMode="cover"
                />
              )}
              <View style={styles.frameBadge}>
                <Text style={styles.frameBadgeText}>{frames.length} frames · {duration}s</Text>
              </View>
            </CameraView>
          </View>
        )}
      </View>

      {/* Frame strip */}
      {frames.length > 0 && (
        <View style={styles.filmStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 6, gap: 4 }}>
            {frames.map((f, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setSelectedFrame(selectedFrame === i ? null : i)}
                onLongPress={() => deleteFrame(i)}
              >
                <Image
                  source={{ uri: f.uri }}
                  style={[
                    styles.frameThumbnail,
                    selectedFrame === i && styles.frameThumbnailSelected,
                    i === frames.length - 1 && styles.frameThumbnailLast,
                  ]}
                />
                <Text style={styles.frameNum}>{i + 1}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedFrame !== null && (
            <TouchableOpacity style={styles.deleteFrameBtn} onPress={() => deleteFrame(selectedFrame)}>
              <Text style={styles.deleteFrameBtnText}>🗑 Delete frame {selectedFrame + 1}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Controls */}
      <SafeAreaView style={styles.controls}>
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setFacing(f => f === "back" ? "front" : "back")}>
            <Text style={styles.controlBtnText}>🔄</Text>
            <Text style={styles.controlBtnLabel}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlBtn, onionSkin && styles.controlBtnActive]} onPress={() => setOnionSkin(o => !o)}>
            <Text style={styles.controlBtnText}>👁</Text>
            <Text style={styles.controlBtnLabel}>Ghost</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureBtn} onPress={captureFrame} disabled={playing}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={cycleFps}>
            <Text style={styles.controlBtnText}>{fps}</Text>
            <Text style={styles.controlBtnLabel}>FPS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, playing && styles.controlBtnActive]}
            onPress={() => setPlaying(p => !p)}
            disabled={frames.length < 2}
          >
            <Text style={styles.controlBtnText}>{playing ? "⏹" : "▶️"}</Text>
            <Text style={styles.controlBtnLabel}>{playing ? "Stop" : "Play"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── AI Smooth Preview Modal ── */}
      <Modal
        visible={!!smoothResult}
        animationType="slide"
        transparent
        onRequestClose={discardSmoothResult}
      >
        <View style={styles.smoothOverlay}>
          <View style={styles.smoothCard}>

            {/* Header */}
            <View style={styles.smoothHeader}>
              <Text style={styles.smoothHeaderIcon}>🪄</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.smoothTitle}>AI Smooth Result</Text>
                <Text style={styles.smoothStrategy}>{smoothResult?.strategy ?? ""}</Text>
              </View>
            </View>

            {/* AI explanation */}
            <View style={styles.smoothExplainBox}>
              <Text style={styles.smoothExplainText}>{smoothResult?.explanation ?? ""}</Text>
            </View>

            {/* Stats comparison */}
            <View style={styles.smoothStats}>
              <View style={styles.smoothStatCol}>
                <Text style={styles.smoothStatLabel}>Original</Text>
                <Text style={styles.smoothStatVal}>{frames.length} frames</Text>
                <Text style={styles.smoothStatVal}>{fps} fps</Text>
                <Text style={styles.smoothStatVal}>{(frames.length / fps).toFixed(1)}s</Text>
              </View>
              <Text style={styles.smoothArrow}>→</Text>
              <View style={[styles.smoothStatCol, styles.smoothStatColNew]}>
                <Text style={[styles.smoothStatLabel, { color: "#A78BFA" }]}>Smoothed</Text>
                <Text style={[styles.smoothStatVal, { color: "#A78BFA" }]}>{smoothResult?.frameIndices.length ?? 0} frames</Text>
                <Text style={[styles.smoothStatVal, { color: "#A78BFA" }]}>{smoothResult?.fps ?? fps} fps</Text>
                <Text style={[styles.smoothStatVal, { color: "#A78BFA" }]}>
                  {smoothResult ? ((smoothResult.frameIndices.length / smoothResult.fps).toFixed(1)) : "0"}s
                </Text>
              </View>
            </View>

            {/* Preview player */}
            {smoothResult && frames.length > 0 && (
              <View style={styles.smoothPreview}>
                <Image
                  source={{ uri: frames[smoothResult.frameIndices[smoothPreviewIdx] ?? 0]?.uri }}
                  style={styles.smoothPreviewImage}
                  resizeMode="contain"
                />
                <View style={styles.smoothPreviewOverlay}>
                  <Text style={styles.smoothPreviewLabel}>
                    Frame {smoothPreviewIdx + 1} / {smoothResult.frameIndices.length}
                    {"  ·  "}{smoothResult.fps} fps
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smoothPlayBtn}
                  onPress={() => setSmoothPreviewPlaying(p => !p)}
                >
                  <Text style={styles.smoothPlayBtnText}>
                    {smoothPreviewPlaying ? "⏸ Pause" : "▶ Preview"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Actions */}
            <View style={styles.smoothActions}>
              <TouchableOpacity style={styles.smoothDiscardBtn} onPress={discardSmoothResult}>
                <Text style={styles.smoothDiscardText}>✕ Keep Original</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smoothApplyBtn} onPress={applySmoothResult}>
                <Text style={styles.smoothApplyText}>✨ Save & Apply</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // List
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  listTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  newBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  newBtnText: { color: "#fff", fontWeight: "800" },
  projectCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 10, ...Shadow.sm },
  projectThumb: { width: 72, height: 56, borderRadius: Radius.md },
  projectThumbEmpty: { backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  projectTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  projectMeta: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 2 },
  projectArrow: { color: Colors.textMuted, fontSize: 18, paddingRight: 4 },
  shareBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  shareBtnText: { fontSize: 18 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  // Permission
  permBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: Spacing.xl, backgroundColor: Colors.bgLight },
  permTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  permSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  permBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  permBtnText: { color: "#fff", fontWeight: "800" },
  // Studio top bar
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#000" },
  topBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  topBtnText: { color: "#fff", fontWeight: "700" },
  topTitle: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  topActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  topActionBtn: { backgroundColor: "#2a2a4a", borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  topActionBtnSubmit: { backgroundColor: Colors.primary + "cc" },
  topActionBtnAI: { backgroundColor: "#6D28D9", borderWidth: 1, borderColor: "#A78BFA55" },
  topActionText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  // List badges
  approvedBadge: { backgroundColor: "#10B98120", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", marginTop: 2 },
  approvedBadgeText: { fontSize: 10, fontWeight: "700", color: "#10B981" },
  pendingBadge: { backgroundColor: "#F59E0B20", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", marginTop: 2 },
  pendingBadgeText: { fontSize: 10, fontWeight: "700", color: "#F59E0B" },
  titleInput: { color: "#fff", fontWeight: "800", fontSize: FontSize.base, borderBottomWidth: 1, borderBottomColor: Colors.primary, minWidth: 140, textAlign: "center" },
  cameraWrap: { flex: 1 },
  frameBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "#000a", borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 4 },
  frameBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  playOverlay: { position: "absolute", bottom: 10, left: 0, right: 0, alignItems: "center" },
  playFrameLabel: { color: "#fff", fontSize: 13, fontWeight: "700", backgroundColor: "#000a", paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  // Film strip
  filmStrip: { backgroundColor: "#111", paddingVertical: 4 },
  frameThumbnail: { width: FRAME_THUMB, height: FRAME_THUMB, borderRadius: 4, borderWidth: 2, borderColor: "transparent" },
  frameThumbnailSelected: { borderColor: Colors.primary },
  frameThumbnailLast: { borderColor: "#4ECDC4" },
  frameNum: { color: "#888", fontSize: 10, textAlign: "center", marginTop: 1 },
  deleteFrameBtn: { alignItems: "center", paddingVertical: 4 },
  deleteFrameBtnText: { color: "#ff6b6b", fontSize: 12, fontWeight: "700" },
  // Controls
  controls: { backgroundColor: "#111" },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 12, paddingHorizontal: 8 },
  controlBtn: { alignItems: "center", width: 56, height: 56, borderRadius: 28, backgroundColor: "#222", justifyContent: "center" },
  controlBtnActive: { backgroundColor: Colors.primary + "40", borderWidth: 1.5, borderColor: Colors.primary },
  controlBtnText: { fontSize: 22 },
  controlBtnLabel: { fontSize: 9, color: "#aaa", marginTop: 2 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#555" },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff", borderWidth: 2, borderColor: "#ddd" },

  // ── AI Smooth Modal ──────────────────────────────────────────────────────
  smoothOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "flex-end",
  },
  smoothCard: {
    backgroundColor: "#1A1033",
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, gap: 14,
    borderTopWidth: 1.5, borderColor: "#7C5CFF55",
  },
  smoothHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  smoothHeaderIcon: { fontSize: 36 },
  smoothTitle: { fontSize: FontSize.lg, fontWeight: "900", color: "#fff" },
  smoothStrategy: { fontSize: FontSize.sm, color: "#A78BFA", fontWeight: "700", marginTop: 2 },
  smoothExplainBox: {
    backgroundColor: "#2D1B69", borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: "#7C5CFF40",
  },
  smoothExplainText: { fontSize: FontSize.sm, color: "#E9D5FF", lineHeight: 20 },
  smoothStats: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16,
  },
  smoothStatCol: { alignItems: "center", gap: 4 },
  smoothStatColNew: {
    backgroundColor: "#2D1B69", borderRadius: Radius.lg,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: "#7C5CFF55",
  },
  smoothStatLabel: { fontSize: FontSize.sm, fontWeight: "800", color: "#9CA3AF" },
  smoothStatVal: { fontSize: FontSize.base, fontWeight: "700", color: "#D1D5DB" },
  smoothArrow: { fontSize: 24, color: "#7C5CFF" },
  smoothPreview: {
    height: 200, borderRadius: Radius.lg, overflow: "hidden",
    backgroundColor: "#000", position: "relative",
  },
  smoothPreviewImage: { width: "100%", height: "100%" },
  smoothPreviewOverlay: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "#000a", borderRadius: Radius.md,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  smoothPreviewLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
  smoothPlayBtn: {
    position: "absolute", bottom: 10, alignSelf: "center",
    backgroundColor: "#7C5CFFcc", borderRadius: Radius.full,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  smoothPlayBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  smoothActions: { flexDirection: "row", gap: 10, paddingBottom: 4 },
  smoothDiscardBtn: {
    flex: 1, padding: 14, borderRadius: Radius.lg,
    backgroundColor: "#2a2a4a", alignItems: "center",
    borderWidth: 1, borderColor: "#444",
  },
  smoothDiscardText: { color: "#9CA3AF", fontWeight: "700", fontSize: FontSize.base },
  smoothApplyBtn: {
    flex: 2, padding: 14, borderRadius: Radius.lg,
    backgroundColor: "#7C5CFF", alignItems: "center",
    ...Shadow.md,
  },
  smoothApplyText: { color: "#fff", fontWeight: "900", fontSize: FontSize.base },
});
