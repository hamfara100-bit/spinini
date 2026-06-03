import React, { useState, useRef, useEffect } from "react";
import {
  View, StyleSheet, TouchableOpacity, Text, ScrollView,
  PanResponder, Image, Modal, Dimensions, Alert, ActivityIndicator, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Path, Rect, Circle, Ellipse,
  Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode,
} from "react-native-svg";
import { SvgXml } from "react-native-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { Colors, Radius, Spacing, FontSize, Shadow } from "../lib/theme";
import { DrawingPath, DrawingSticker } from "../lib/data/types";
import { STICKER_CATEGORIES } from "../lib/stickers";
import { floodFillImage } from "../lib/flood-fill";
import { generateColoringSVG } from "../lib/ai";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN = Dimensions.get("window");

const REGULAR_COLORS = [
  "#000000", "#FFFFFF", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#78716C",
  "#60A5FA", "#A3E635", "#FB923C", "#F472B6", "#34D399",
  "#6366F1", "#14B8A6", "#F43F5E", "#84CC16", "#D946EF",
];

const NEON_COLORS = [
  "#FF00FF", "#00FFFF", "#00FF41", "#FFE600", "#FF6600",
  "#FF003C", "#7700FF", "#00BFFF", "#FF69B4", "#ADFF2F",
  "#FF4500", "#1BFFFF", "#FFD700", "#BF00FF", "#39FF14",
  "#FF1493", "#00FF7F", "#FF8C00", "#DA00FF", "#0FF0FC",
];

const HIGHLIGHT_COLORS = [
  "#FFFF00", "#FF69B4", "#00FF7F", "#00BFFF", "#FF4500",
  "#DA00FF", "#FFD700", "#FF1493", "#ADFF2F", "#FF6600",
];

// Paint colors for vehicles — bright kid-friendly palette
const VEHICLE_PAINT_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#3B82F6", "#8B5CF6", "#EC4899", "#FFFFFF",
  "#000000", "#6B7280", "#14B8A6", "#F59E0B",
  "#DC2626", "#7C3AED", "#059669", "#1D4ED8",
];

// Default fill colors for new vehicles (randomly picked)
const VEHICLE_DEFAULT_FILLS = [
  "#EF4444", "#3B82F6", "#22C55E", "#F97316",
  "#8B5CF6", "#EC4899", "#EAB308", "#14B8A6",
];

// Vehicle type → display emoji
const VEHICLE_EMOJIS: Record<string, string> = {
  car:        "🚗",
  racecar:    "🏎️",
  taxi:       "🚕",
  truck:      "🚛",
  bus:        "🚌",
  tank:       "🪖",
  airplane:   "✈️",
  helicopter: "🚁",
  rocket:     "🚀",
  ufo:        "🛸",
  boat:       "⛵",
  train:      "🚂",
  tractor:    "🚜",
};

const BRUSH_SIZES = [2, 5, 10, 18, 28];

type Tool = "pen" | "sketch" | "highlight" | "eraser" | "sticker" | "fill";

// Realistic pencil sketch = several thin, offset, grainy (dashed) passes layered
// at low opacity so the line looks hand-drawn / hatched rather than solid.
const SKETCH_LAYERS: { dx: number; dy: number; wf: number; op: number; dash: string }[] = [
  { dx: 0,    dy: 0,    wf: 0.55, op: 0.36, dash: "0.5,2.5" },
  { dx: 1.3,  dy: -0.9, wf: 0.45, op: 0.30, dash: "1,3" },
  { dx: -1.1, dy: 1.0,  wf: 0.40, op: 0.26, dash: "0.5,3" },
  { dx: 0.7,  dy: 1.5,  wf: 0.34, op: 0.22, dash: "1,3.5" },
  { dx: -1.5, dy: -0.6, wf: 0.30, op: 0.18, dash: "0.5,3.5" },
];

function renderSketch(d: string, color: string, width: number, keyPrefix: string) {
  return (
    <React.Fragment key={keyPrefix}>
      {SKETCH_LAYERS.map((L, k) => (
        <Path key={`${keyPrefix}-${k}`} d={d} stroke={color}
          strokeWidth={Math.max(0.6, width * L.wf)} strokeOpacity={L.op}
          fill="none" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={L.dash} transform={`translate(${L.dx},${L.dy})`} />
      ))}
    </React.Fragment>
  );
}

type Sticker = DrawingSticker;
interface CanvasState { paths: DrawingPath[]; stickers: Sticker[]; bg?: string }

export interface DrawingCanvasProps {
  onSave?: (paths: DrawingPath[], stickers: Sticker[], imageUri: string) => void;
  /** Called automatically ~4 seconds after each drawing change for draft backup */
  onAutoSave?: (paths: DrawingPath[], stickers: Sticker[]) => void;
  initialPaths?: DrawingPath[];
  initialStickers?: Sticker[];
  backgroundSvg?: string;
  backgroundImage?: string;
  glowMode?: boolean;
  fullScreen?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DrawingCanvas({
  onSave,
  onAutoSave,
  initialPaths = [],
  initialStickers = [],
  backgroundSvg,
  backgroundImage: initialBgImage,
  glowMode: initialGlowMode = false,
}: DrawingCanvasProps) {
  const insets = useSafeAreaInsets();

  const detectedGlow = initialGlowMode || initialPaths.some(p => p.glow);
  const lastColor = initialPaths.length > 0 ? initialPaths[initialPaths.length - 1].color : null;
  const startColor = lastColor ?? (detectedGlow ? NEON_COLORS[0] : REGULAR_COLORS[0]);

  const [paths, setPaths] = useState<DrawingPath[]>(initialPaths);
  const [stickers, setStickers] = useState<Sticker[]>(initialStickers);
  const [undoStack, setUndoStack] = useState<CanvasState[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [color, setColor] = useState(startColor);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<Tool>("pen");
  const [glowMode, setGlowMode] = useState(detectedGlow);
  const [bgImage, setBgImage] = useState<string | undefined>(initialBgImage);
  const [fillBusy, setFillBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [panMode, setPanMode] = useState(false);
  const panModeRef = useRef(false);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [aiSvg, setAiSvg] = useState<string | undefined>(undefined);
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const bgImageRef = useRef<string | undefined>(initialBgImage);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 1, h: 1 });
  const [selectedSticker, setSelectedSticker] = useState("😂");
  const [stickerSize, setStickerSize] = useState(52);
  const [stickerCategory, setStickerCategory] = useState("😂 Funny Faces");
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [photoGlow, setPhotoGlow] = useState(false);
  const [showVehiclePaint, setShowVehiclePaint] = useState(false);

  const viewShotRef = useRef<any>(null);
  const colorRef = useRef(color);
  const brushRef = useRef(brushSize);
  const toolRef = useRef(tool);
  const currentPathRef = useRef("");
  const glowRef = useRef(glowMode);
  const selectedStickerRef = useRef(selectedSticker);
  const stickerSizeRef = useRef(stickerSize);
  const stickersRef = useRef<Sticker[]>(initialStickers);
  const pathsRef = useRef<DrawingPath[]>(initialPaths);
  const dragStickerIdRef = useRef<string | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartSizeRef = useRef<number>(0);
  // Multi-touch drawing: one in-progress path per finger (keyed by touch id).
  const drawTouchesRef = useRef<Map<number, string>>(new Map());
  const [liveStrokes, setLiveStrokes] = useState<string[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  colorRef.current = color;
  brushRef.current = brushSize;
  toolRef.current = tool;
  glowRef.current = glowMode;
  selectedStickerRef.current = selectedSticker;
  stickerSizeRef.current = stickerSize;
  bgImageRef.current = bgImage;
  panModeRef.current = panMode;
  panXRef.current = panX;
  panYRef.current = panY;

  useEffect(() => { stickersRef.current = stickers; }, [stickers]);
  useEffect(() => { pathsRef.current = paths; }, [paths]);

  // ─── Auto-save: 4-second debounce after each change ───────────────────────
  useEffect(() => {
    if (!onAutoSave) return;
    if (paths.length === 0 && stickers.length === 0) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      onAutoSave(pathsRef.current, stickersRef.current);
    }, 4000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [paths, stickers, onAutoSave]);

  const activeColors = tool === "highlight"
    ? HIGHLIGHT_COLORS
    : (glowMode ? NEON_COLORS : REGULAR_COLORS);

  function pushUndo(p = pathsRef.current, s = stickersRef.current) {
    setUndoStack(st => [...st.slice(-20), { paths: [...p], stickers: [...s], bg: bgImageRef.current }]);
  }

  // Capture the canvas at 1x (reset zoom/pan first) so saves/fills get the FULL
  // drawing, not the zoomed-in crop.
  async function captureFull(opts: any): Promise<string> {
    if (zoom !== 1 || panX !== 0 || panY !== 0) {
      setZoom(1); setPanX(0); setPanY(0);
      panXRef.current = 0; panYRef.current = 0;
      await new Promise(r => setTimeout(r, 60));
    }
    return await captureRef(viewShotRef, opts);
  }

  function resetZoom() { setZoom(1); setPanX(0); setPanY(0); panXRef.current = 0; panYRef.current = 0; setPanMode(false); panModeRef.current = false; }

  // Paint-bucket: snapshot the canvas, flood-fill under the tap, and show the
  // result as the new background (flattening current strokes/stickers into it).
  async function fillAt(x: number, y: number) {
    if (fillBusy || !viewShotRef.current) return;
    setFillBusy(true);
    try {
      const uri = await captureFull({ format: "png", quality: 1, result: "tmpfile" });
      const { w, h } = canvasSizeRef.current;
      const filled = await floodFillImage(uri, x / Math.max(1, w), y / Math.max(1, h), colorRef.current);
      if (filled) {
        pushUndo(pathsRef.current, stickersRef.current);
        setBgImage(filled);
        bgImageRef.current = filled;
        setPaths([]); pathsRef.current = [];
        setStickers([]); stickersRef.current = [];
      }
    } catch {}
    finally { setFillBusy(false); }
  }

  // AI "improve": generate a neat line-art version of what the child describes,
  // shown as a layer behind their strokes so they can trace / colour over it.
  async function aiImprove() {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const raw = await generateColoringSVG(aiPrompt.trim(), { detail: "detailed" });
      const m = raw.match(/<svg[\s\S]*<\/svg>/i);
      if (m) { setAiSvg(m[0]); setShowAi(false); setAiPrompt(""); }
      else Alert.alert("Hmm 🤔", "The AI couldn't draw that. Try describing it differently!");
    } catch {
      Alert.alert("Oops", "Couldn't reach the AI. Check your internet and try again.");
    } finally { setAiBusy(false); }
  }

  // Commit one finished stroke (used for single- AND multi-touch drawing).
  function commitStroke(snap: string) {
    if (!snap || !snap.includes("L")) return; // need at least a line segment
    const isEraser    = toolRef.current === "eraser";
    const isHighlight = toolRef.current === "highlight";
    const isSketch    = toolRef.current === "sketch";
    const newPath: DrawingPath = {
      points: snap,
      color: isEraser ? (glowRef.current ? "#090920" : "#FFFFFF") : colorRef.current,
      width: isEraser ? brushRef.current * 2.5 : isHighlight ? brushRef.current * 3 : brushRef.current,
      glow: glowRef.current && !isEraser && !isHighlight,
      highlight: isHighlight,
      sketch: isSketch && !isEraser,
    };
    setPaths(p => {
      pushUndo(p, stickersRef.current);
      const next = [...p, newPath];
      pathsRef.current = next;
      return next;
    });
  }

  function undo() {
    setUndoStack(s => {
      if (!s.length) return s;
      const prev = s[s.length - 1];
      setPaths(prev.paths);
      setStickers(prev.stickers);
      setBgImage(prev.bg);
      bgImageRef.current = prev.bg;
      stickersRef.current = prev.stickers;
      pathsRef.current = prev.paths;
      return s.slice(0, -1);
    });
  }

  // ─── Pan Responder ──────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (e) => {
        // Pan mode: drag moves the zoomed canvas instead of drawing.
        if (panModeRef.current) {
          panStartRef.current = { x: panXRef.current, y: panYRef.current };
          return;
        }

        const { locationX: x, locationY: y } = e.nativeEvent;

        // Paint-bucket: tap to flood-fill the enclosed area under the finger.
        if (toolRef.current === "fill") {
          void fillAt(x, y);
          return;
        }

        // Hit-test existing stickers (reversed = top-most first)
        const hit = [...stickersRef.current].reverse().find(s => {
          const half = (s.size / 2) + 14;
          return Math.abs(s.x - x) < half && Math.abs(s.y - y) < half;
        });

        if (hit) {
          dragStickerIdRef.current = hit.id;
          setSelectedStickerId(hit.id);
          setShowVehiclePaint(!!hit.vehicleType);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return;
        }

        // Tapped empty space — deselect
        setSelectedStickerId(null);
        setShowVehiclePaint(false);
        dragStickerIdRef.current = null;

        if (toolRef.current === "sticker") {
          // Place new sticker
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const emoji = selectedStickerRef.current;
          const isVehicle = emoji.startsWith("__v__");
          const vType = isVehicle ? emoji.slice(5) : undefined;
          const randFill = VEHICLE_DEFAULT_FILLS[Math.floor(Math.random() * VEHICLE_DEFAULT_FILLS.length)];

          const newSticker: Sticker = {
            id: Math.random().toString(36).slice(2),
            emoji,
            x, y,
            size: stickerSizeRef.current,
            ...(isVehicle ? { vehicleType: vType, fillColor: randFill, accentColor: "#C8E6FF" } : {}),
          };
          pushUndo(pathsRef.current, stickersRef.current);
          setStickers(s => {
            const next = [...s, newSticker];
            stickersRef.current = next;
            return next;
          });
          // Grab the freshly placed sticker so the user can immediately DRAG it
          // or spread TWO fingers to pinch it bigger as they place it.
          dragStickerIdRef.current = newSticker.id;
          setSelectedStickerId(newSticker.id);
          return;
        }

        // Start drawing this finger (extra fingers are picked up in move).
        const tid = (e.nativeEvent as any).identifier ?? 0;
        drawTouchesRef.current.set(tid, `M${x.toFixed(1)},${y.toFixed(1)}`);
        setLiveStrokes(Array.from(drawTouchesRef.current.values()));
      },

      onPanResponderMove: (e, gestureState) => {
        // Pan mode: translate the canvas by the drag distance.
        if (panModeRef.current) {
          setPanX(panStartRef.current.x + gestureState.dx);
          setPanY(panStartRef.current.y + gestureState.dy);
          return;
        }

        const { locationX: x, locationY: y } = e.nativeEvent;
        const touches = e.nativeEvent.touches;

        // ── Two-finger pinch resizes the grabbed sticker ──
        if (touches && touches.length >= 2 && dragStickerIdRef.current) {
          const t1 = touches[0], t2 = touches[1];
          const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          const activeId = dragStickerIdRef.current;
          if (pinchStartDistRef.current == null) {
            pinchStartDistRef.current = dist;
            pinchStartSizeRef.current = stickersRef.current.find(s => s.id === activeId)?.size ?? stickerSizeRef.current;
          } else if (pinchStartDistRef.current > 0) {
            const newSize = Math.max(24, Math.min(260, pinchStartSizeRef.current * (dist / pinchStartDistRef.current)));
            setStickers(s => {
              const next = s.map(st => st.id === activeId ? { ...st, size: newSize } : st);
              stickersRef.current = next;
              return next;
            });
          }
          return; // don't also drag while pinching
        }
        pinchStartDistRef.current = null; // back to ≤1 finger

        if (dragStickerIdRef.current) {
          setStickers(s => {
            const next = s.map(st =>
              st.id === dragStickerIdRef.current ? { ...st, x, y } : st
            );
            stickersRef.current = next;
            return next;
          });
          return;
        }

        if (toolRef.current === "sticker" || toolRef.current === "fill") return;

        // ── Multi-touch drawing: one stroke per finger ──
        const allTouches = e.nativeEvent.touches ?? [];
        const liveIds = new Set(allTouches.map((t: any) => t.identifier));
        // A finger that lifted → commit its stroke.
        drawTouchesRef.current.forEach((p, tid) => {
          if (!liveIds.has(tid)) { commitStroke(p); drawTouchesRef.current.delete(tid); }
        });
        // Extend (or start) each active finger's stroke.
        for (const t of allTouches as any[]) {
          const tx = t.locationX, ty = t.locationY;
          const prev = drawTouchesRef.current.get(t.identifier);
          drawTouchesRef.current.set(
            t.identifier,
            prev ? `${prev} L${tx.toFixed(1)},${ty.toFixed(1)}` : `M${tx.toFixed(1)},${ty.toFixed(1)}`,
          );
        }
        setLiveStrokes(Array.from(drawTouchesRef.current.values()));
      },

      onPanResponderRelease: () => {
        pinchStartDistRef.current = null;
        if (dragStickerIdRef.current) {
          dragStickerIdRef.current = null;
          return;
        }
        if (toolRef.current === "sticker" || toolRef.current === "fill") return;

        // Commit any in-progress strokes still down (last finger up).
        drawTouchesRef.current.forEach(p => commitStroke(p));
        drawTouchesRef.current.clear();
        setLiveStrokes([]);
      },

      onPanResponderTerminate: () => {
        // Gesture interrupted — save what we have and reset.
        pinchStartDistRef.current = null;
        dragStickerIdRef.current = null;
        drawTouchesRef.current.forEach(p => commitStroke(p));
        drawTouchesRef.current.clear();
        setLiveStrokes([]);
      },
    })
  ).current;

  // ─── Actions ────────────────────────────────────────────────────────────────

  // Shrink a picked photo so it fits the drawing screen (and uses less memory).
  async function shrinkToFit(uri: string): Promise<string> {
    try {
      const r = await manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.8, format: SaveFormat.JPEG });
      return r.uri;
    } catch { return uri; }
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setBgImage(await shrinkToFit(result.assets[0].uri));
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) setBgImage(await shrinkToFit(result.assets[0].uri));
  }

  function deleteSelectedSticker() {
    if (!selectedStickerId) return;
    pushUndo(pathsRef.current, stickersRef.current);
    setStickers(s => {
      const next = s.filter(st => st.id !== selectedStickerId);
      stickersRef.current = next;
      return next;
    });
    setSelectedStickerId(null);
    setShowVehiclePaint(false);
  }

  function resizeSelectedSticker(delta: number) {
    setStickers(s => {
      const next = s.map(st =>
        st.id === selectedStickerId
          ? { ...st, size: Math.max(24, Math.min(200, st.size + delta)) }
          : st
      );
      stickersRef.current = next;
      return next;
    });
  }

  function paintVehicle(id: string, fillColor: string) {
    setStickers(s => {
      const next = s.map(st => st.id === id ? { ...st, fillColor } : st);
      stickersRef.current = next;
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function clearAll() {
    Alert.alert("Clear Canvas?", "This will erase everything.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: "destructive",
        onPress: () => {
          pushUndo();
          setPaths([]); setStickers([]); setCurrentPath("");
          pathsRef.current = []; stickersRef.current = [];
          setSelectedStickerId(null);
          setShowVehiclePaint(false);
        },
      },
    ]);
  }

  async function handleSave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let imageUri = "";
    try {
      if (viewShotRef.current)
        imageUri = await captureFull({ format: "png", quality: 0.92, result: "tmpfile" });
    } catch {}
    onSave?.(paths, stickers, imageUri);
  }

  async function saveToDevice() {
    try {
      if (!viewShotRef.current) { Alert.alert("Couldn't capture canvas"); return; }
      const uri = await captureFull({ format: "png", quality: 1, result: "tmpfile" });
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow access to your photos to save drawings.");
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Saved!", "Your drawing was saved to Camera Roll.");
    } catch {
      Alert.alert("Oops!", "Could not save. Try again.");
    }
  }

  function toggleGlow() {
    const next = !glowMode;
    setGlowMode(next);
    setColor(next ? NEON_COLORS[0] : REGULAR_COLORS[0]);
    glowRef.current = next;
  }

  const canvasBg = glowMode ? "#090920" : (bgImage ? "transparent" : "#FFFFFF");

  // ─── Path Renderer ──────────────────────────────────────────────────────────
  function renderPath(p: DrawingPath, i: number) {
    if (p.highlight) return (
      <Path key={i} d={p.points} stroke={p.color} strokeWidth={p.width}
        strokeOpacity={0.35} fill="none" strokeLinecap="square" strokeLinejoin="round" />
    );
    if (p.sketch) return renderSketch(p.points, p.color, p.width, `s${i}`);
    if (p.glow) return (
      <React.Fragment key={i}>
        <Path d={p.points} stroke={p.color} strokeWidth={p.width + 10} strokeOpacity={0.25}
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={p.points} stroke={p.color} strokeWidth={p.width + 4} strokeOpacity={0.5}
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={p.points} stroke={p.color} strokeWidth={p.width}
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </React.Fragment>
    );
    return (
      <Path key={i} d={p.points} stroke={p.color} strokeWidth={p.width}
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  const selObj = stickers.find(s => s.id === selectedStickerId);

  return (
    <View style={styles.wrapper}>

      {/* ── Canvas ── */}
      <ViewShot ref={viewShotRef} style={[styles.canvas, { backgroundColor: canvasBg }]} options={{ format: "png", quality: 0.92 }}
        onLayout={e => { const { width, height } = e.nativeEvent.layout; canvasSizeRef.current = { w: width, h: height }; }}>
        <View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: panX }, { translateY: panY }, { scale: zoom }] }]}
          {...panResponder.panHandlers}
        >

          {/* Background image */}
          {bgImage && (
            <View style={StyleSheet.absoluteFill}>
              <Image source={{ uri: bgImage }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              {photoGlow && <View style={[StyleSheet.absoluteFill, styles.photoGlowOverlay]} />}
            </View>
          )}

          {/* AI coloring outline */}
          {backgroundSvg && <SvgXml xml={backgroundSvg} style={StyleSheet.absoluteFill} />}
          {aiSvg && <SvgXml xml={aiSvg} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={StyleSheet.absoluteFill} />}

          {/* Drawing SVG layer */}
          <Svg style={StyleSheet.absoluteFill}>
            {glowMode && (
              <Defs>
                <Filter id="glow">
                  <FeGaussianBlur stdDeviation="3" result="blur" />
                  <FeMerge><FeMergeNode in="blur" /><FeMergeNode in="SourceGraphic" /></FeMerge>
                </Filter>
              </Defs>
            )}
            {paths.map((p, i) => renderPath(p, i))}

            {/* Live strokes (one per active finger) */}
            {liveStrokes.map((cp, i) => (
              tool === "eraser" ? (
                <Path key={`l${i}`} d={cp} stroke={glowMode ? "#090920" : "#FFFFFF"}
                  strokeWidth={brushSize * 2.5} fill="none" strokeLinecap="round" />
              ) : tool === "highlight" ? (
                <Path key={`l${i}`} d={cp} stroke={color} strokeWidth={brushSize * 3}
                  strokeOpacity={0.35} fill="none" strokeLinecap="square" strokeLinejoin="round" />
              ) : tool === "sketch" ? (
                renderSketch(cp, color, brushSize, `l${i}`)
              ) : glowMode ? (
                <React.Fragment key={`l${i}`}>
                  <Path d={cp} stroke={color} strokeWidth={brushSize + 10} strokeOpacity={0.25} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d={cp} stroke={color} strokeWidth={brushSize + 4} strokeOpacity={0.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d={cp} stroke={color} strokeWidth={brushSize} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </React.Fragment>
              ) : (
                <Path key={`l${i}`} d={cp} stroke={color} strokeWidth={brushSize} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              )
            ))}
          </Svg>

          {/* ── Sticker / Vehicle layer ── */}
          {stickers.map(s => {
            const isVehicle = !!s.vehicleType;
            const isSelected = s.id === selectedStickerId;
            return (
              <View
                key={s.id}
                pointerEvents="none"
                style={[
                  styles.stickerOnCanvas,
                  { left: s.x - s.size / 2, top: s.y - s.size / 2, width: s.size, height: s.size },
                  isSelected && styles.stickerSelected,
                ]}
              >
                {isVehicle ? (
                  <VehicleSvg
                    type={s.vehicleType!}
                    fill={s.fillColor ?? "#4A90D9"}
                    accent={s.accentColor ?? "#C8E6FF"}
                    size={s.size}
                  />
                ) : (
                  <Text style={[styles.stickerEmoji, { fontSize: s.size * 0.82 }]}>{s.emoji}</Text>
                )}
              </View>
            );
          })}

          {/* ── Selected sticker controls ── */}
          {selObj && (
            <View style={[styles.stickerControlsWrapper, {
              // Anchor to the sticker CENTRE with a fixed offset (size-independent)
              // so the +/- buttons don't jump/hide each time you resize.
              left: Math.max(4, selObj.x - 90),
              top: Math.max(4, selObj.y - 130),
            }]}>
              {/* Action row */}
              <View style={styles.stickerControls}>
                <TouchableOpacity style={styles.ctrlBtn} onPress={() => resizeSelectedSticker(-14)}>
                  <Text style={styles.ctrlTxt}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: Colors.error }]} onPress={deleteSelectedSticker}>
                  <Text style={styles.ctrlTxt}>🗑</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctrlBtn} onPress={() => resizeSelectedSticker(14)}>
                  <Text style={styles.ctrlTxt}>+</Text>
                </TouchableOpacity>
                {selObj.vehicleType && (
                  <TouchableOpacity
                    style={[styles.ctrlBtn, showVehiclePaint && { backgroundColor: "#F59E0B" }]}
                    onPress={() => setShowVehiclePaint(v => !v)}
                  >
                    <Text style={styles.ctrlTxt}>🎨</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: "#22C55E" }]}
                  onPress={() => { setSelectedStickerId(null); setShowVehiclePaint(false); }}>
                  <Text style={styles.ctrlTxt}>✓</Text>
                </TouchableOpacity>
              </View>

              {/* Vehicle paint palette */}
              {selObj.vehicleType && showVehiclePaint && (
                <View style={styles.paintRow}>
                  <Text style={styles.paintLabel}>🎨</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    {VEHICLE_PAINT_COLORS.map(c => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => paintVehicle(selObj.id, c)}
                        style={[
                          styles.paintDot,
                          { backgroundColor: c, borderColor: c === "#FFFFFF" ? "#aaa" : "transparent" },
                          selObj.fillColor === c && styles.paintDotActive,
                        ]}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Mode badges */}
          <View style={styles.badgeRow}>
            {glowMode && <View style={[styles.badge, { backgroundColor: "#7700FF" }]}><Text style={styles.badgeText}>✨ GLOW</Text></View>}
            {tool === "highlight" && <View style={[styles.badge, { backgroundColor: "#F59E0B" }]}><Text style={styles.badgeText}>🖊 MARKER</Text></View>}
            {tool === "sketch" && <View style={[styles.badge, { backgroundColor: "#78716C" }]}><Text style={styles.badgeText}>🖍 SKETCH</Text></View>}
            {photoGlow && bgImage && <View style={[styles.badge, { backgroundColor: "#7C3AED" }]}><Text style={styles.badgeText}>💜 GLOW PHOTO</Text></View>}
          </View>

          {/* Sticker placement hint */}
          {tool === "sticker" && !selectedStickerId && (
            <View style={styles.stickerHint}>
              <Text style={{ fontSize: 20 }}>
                {selectedSticker.startsWith("__v__")
                  ? (VEHICLE_EMOJIS[selectedSticker.slice(5)] ?? "🚗")
                  : selectedSticker}
              </Text>
              <Text style={styles.stickerHintText}>Tap canvas • Drag to move</Text>
            </View>
          )}
        </View>
      </ViewShot>

      {/* Zoom controls (overlay — not captured) */}
      <View style={styles.zoomControls} pointerEvents="box-none">
        <TouchableOpacity style={styles.zoomBtn} onPress={() => { const z = Math.max(1, Math.round((zoom - 0.5) * 10) / 10); setZoom(z); if (z === 1) { setPanX(0); setPanY(0); } }}>
          <Text style={styles.zoomBtnText}>－</Text>
        </TouchableOpacity>
        <View style={styles.zoomLevel}><Text style={styles.zoomLevelText}>{Math.round(zoom * 100)}%</Text></View>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom(z => Math.min(4, Math.round((z + 0.5) * 10) / 10))}>
          <Text style={styles.zoomBtnText}>＋</Text>
        </TouchableOpacity>
        {zoom > 1 && (
          <TouchableOpacity style={[styles.zoomBtn, panMode && { backgroundColor: Colors.primary }]} onPress={() => setPanMode(p => !p)}>
            <Text style={[styles.zoomBtnText, panMode && { color: "#fff" }]}>✋</Text>
          </TouchableOpacity>
        )}
        {(zoom !== 1 || panMode) && (
          <TouchableOpacity style={styles.zoomBtn} onPress={resetZoom}>
            <Text style={styles.zoomBtnText}>⟲</Text>
          </TouchableOpacity>
        )}
      </View>

      {fillBusy && (
        <View style={styles.fillBusy} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.fillBusyText}>🪣 Filling…</Text>
        </View>
      )}

      {/* ── Toolbar ── */}
      <View style={[styles.toolbar, glowMode && styles.toolbarDark, { paddingBottom: Math.max(Spacing.sm, insets.bottom) }]}>

        {/* Row 1: tools */}
        <View style={styles.toolRow}>
          <ToolBtn icon="✏️" label="Pen"    active={tool === "pen"}       onPress={() => setTool("pen")}       glow={glowMode} />
          <ToolBtn icon="🖍️" label="Sketch" active={tool === "sketch"}    onPress={() => setTool("sketch")}    glow={glowMode} />
          <ToolBtn icon="🖊️" label="Marker" active={tool === "highlight"} onPress={() => { setTool("highlight"); if (!HIGHLIGHT_COLORS.includes(color)) setColor(HIGHLIGHT_COLORS[0]); }} glow={glowMode} />
          <ToolBtn icon="🧽"  label="Erase"  active={tool === "eraser"}    onPress={() => setTool("eraser")}    glow={glowMode} />
          <ToolBtn icon="🪣"  label="Fill"   active={tool === "fill"}      onPress={() => { setTool("fill"); setSelectedStickerId(null); }} glow={glowMode} />
          <ToolBtn
            icon={selectedSticker.startsWith("__v__") ? (VEHICLE_EMOJIS[selectedSticker.slice(5)] ?? "🚗") : selectedSticker}
            label="Sticker"
            active={tool === "sticker"}
            onPress={() => { setTool("sticker"); setStickerPickerOpen(true); }}
            glow={glowMode}
          />
          <ToolBtn icon={glowMode ? "💡" : "🌙"} label={glowMode ? "Bright" : "Glow"} active={glowMode} onPress={toggleGlow} glow={glowMode} />
          <ToolBtn icon="🖼️" label="Gallery" active={false} onPress={pickFromGallery} glow={glowMode} />
          <ToolBtn icon="📷" label="Camera"  active={false} onPress={takePhoto}       glow={glowMode} />
          {bgImage && <ToolBtn icon={photoGlow ? "💜" : "✨"} label="Glow" active={photoGlow} onPress={() => setPhotoGlow(g => !g)} glow={glowMode} />}
        </View>

        {/* Row 2: color palette */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
          {activeColors.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => { setColor(c); colorRef.current = c; if (tool === "eraser") setTool("pen"); }}
              style={[
                styles.colorDot,
                { backgroundColor: c, borderColor: c === "#FFFFFF" ? "#ccc" : "transparent" },
                c === color && styles.colorDotActive,
                glowMode && { shadowColor: c, shadowRadius: 8, shadowOpacity: 0.9, elevation: 8 },
              ]}
            />
          ))}
        </ScrollView>

        {/* Row 3: brush sizes + actions */}
        <View style={styles.bottomRow}>
          <View style={styles.sizeRow}>
            {BRUSH_SIZES.map(s => (
              <TouchableOpacity key={s} onPress={() => { setBrushSize(s); brushRef.current = s; }}
                style={[styles.sizeBtn, brushSize === s && styles.sizeBtnActive]}>
                <View style={[styles.sizeDot, {
                  width: Math.min(s, 24), height: Math.min(s, 24),
                  borderRadius: s, backgroundColor: color,
                  ...(glowMode && { shadowColor: color, shadowRadius: 4, shadowOpacity: 0.9 }),
                }]} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.actionRow}>
            <ActionBtn icon="↩️" onPress={undo} disabled={!undoStack.length} glow={glowMode} />
            <ActionBtn icon="🗑️" onPress={clearAll} glow={glowMode} />
            <ActionBtn icon="✨" onPress={() => setShowAi(true)} glow={glowMode} />
            {aiSvg && <ActionBtn icon="🚫" onPress={() => setAiSvg(undefined)} glow={glowMode} />}
            {bgImage && <ActionBtn icon="❌" onPress={() => { setBgImage(undefined); setPhotoGlow(false); }} glow={glowMode} />}
            <TouchableOpacity onPress={saveToDevice} style={[styles.saveBtn, styles.saveBtnGallery]}>
              <Text style={styles.saveBtnText}>📱 Save</Text>
            </TouchableOpacity>
            {onSave && (
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>💾 Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── AI Improve Modal ── */}
      <Modal visible={showAi} animationType="slide" transparent onRequestClose={() => !aiBusy && setShowAi(false)}>
        <View style={aiM.overlay}>
          <View style={aiM.card}>
            <Text style={aiM.title}>✨ AI Improve</Text>
            <Text style={aiM.sub}>Tell the AI what you drew — it'll sketch a neat version behind your art so you can trace or colour it!</Text>
            <TextInput
              style={aiM.input}
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder="e.g. a friendly dragon, a race car, a castle…"
              placeholderTextColor={Colors.textMuted}
              editable={!aiBusy}
              multiline
            />
            <View style={aiM.btnRow}>
              <TouchableOpacity style={aiM.cancelBtn} onPress={() => !aiBusy && setShowAi(false)} disabled={aiBusy}>
                <Text style={aiM.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[aiM.goBtn, (aiBusy || !aiPrompt.trim()) && { opacity: 0.6 }]} onPress={aiImprove} disabled={aiBusy || !aiPrompt.trim()}>
                {aiBusy ? <ActivityIndicator color="#fff" /> : <Text style={aiM.goTxt}>✨ Draw it</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sticker Picker Modal ── */}
      <Modal visible={stickerPickerOpen} animationType="slide" transparent onRequestClose={() => setStickerPickerOpen(false)}>
        <View style={modal.overlay}>
          <View style={modal.card}>
            <View style={modal.header}>
              <Text style={modal.title}>🎨 Pick a Sticker</Text>
              <TouchableOpacity onPress={() => setStickerPickerOpen(false)} style={modal.doneBtn}>
                <Text style={modal.doneBtnText}>Done ✓</Text>
              </TouchableOpacity>
            </View>

            {/* Size picker */}
            <View style={modal.sizeRow}>
              <Text style={modal.sizeLabel}>Size:</Text>
              {[32, 48, 64, 80, 100].map(sz => (
                <TouchableOpacity key={sz} onPress={() => { setStickerSize(sz); stickerSizeRef.current = sz; }}
                  style={[modal.sizeBtn, stickerSize === sz && modal.sizeBtnActive]}>
                  <Text style={{ fontSize: sz * 0.42 }}>😀</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modal.catScroll}
              contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, gap: 6 }}>
              {Object.keys(STICKER_CATEGORIES).map(cat => (
                <TouchableOpacity key={cat} onPress={() => setStickerCategory(cat)}
                  style={[modal.catTab, stickerCategory === cat && modal.catTabActive]}>
                  <Text style={[modal.catTabText, stickerCategory === cat && modal.catTabTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Vehicle category info banner */}
            {stickerCategory === "🚗 Paint Vehicles" && (
              <View style={modal.vehicleNote}>
                <Text style={modal.vehicleNoteText}>
                  🎨 Place a vehicle, tap it, then press 🎨 to change its paint color!
                </Text>
              </View>
            )}

            {/* Sticker grid */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={modal.grid}>
              {STICKER_CATEGORIES[stickerCategory].map((emoji, i) => {
                const isVehicle = emoji.startsWith("__v__");
                const vType = isVehicle ? emoji.slice(5) : null;
                const vEmoji = vType ? (VEHICLE_EMOJIS[vType] ?? "🚗") : null;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setSelectedSticker(emoji);
                      selectedStickerRef.current = emoji;
                      setTool("sticker");
                      setStickerPickerOpen(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[modal.item, isVehicle && modal.vehicleItem, selectedSticker === emoji && modal.itemSelected]}
                  >
                    {isVehicle ? (
                      <View style={{ alignItems: "center", gap: 2 }}>
                        <Text style={{ fontSize: 28 }}>{vEmoji}</Text>
                        <Text style={modal.vehicleLabel}>{vType}</Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 30 }}>{emoji}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Vehicle SVG Renderer ─────────────────────────────────────────────────────

function VehicleSvg({ type, fill, accent, size }: {
  type: string; fill: string; accent: string; size: number;
}) {
  const body = fill || "#4A90D9";
  const win  = accent || "#C8E6FF";
  const wh   = "#2D3436";
  const hub  = "#95A5A6";

  switch (type) {
    case "car":
    case "taxi":
      return (
        <Svg width={size} height={size} viewBox="0 0 100 70" preserveAspectRatio="xMidYMid meet">
          <Rect x={4} y={30} width={92} height={22} rx={7} fill={body} />
          <Path d="M20,30 L32,14 Q50,9 68,14 L80,30 Z" fill={body} />
          <Path d="M27,29 L37,15 Q50,11 63,15 L73,29 Z" fill={win} opacity={0.75} />
          <Rect x={8} y={31} width={13} height={9} rx={2.5} fill={win} opacity={0.55} />
          {type === "taxi" && <Rect x={38} y={9} width={24} height={7} rx={3} fill="#FFE169" />}
          <Circle cx={25} cy={53} r={11} fill={wh} /><Circle cx={25} cy={53} r={5} fill={hub} />
          <Circle cx={75} cy={53} r={11} fill={wh} /><Circle cx={75} cy={53} r={5} fill={hub} />
          <Rect x={4} y={35} width={7} height={5} rx={1.5} fill="#FFE169" />
          <Rect x={89} y={35} width={7} height={5} rx={1.5} fill="#FF4757" />
          <Path d="M48,30 L48,51" stroke="#ffffff44" strokeWidth={1.5} />
        </Svg>
      );

    case "racecar":
      return (
        <Svg width={size} height={size} viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
          <Path d="M2,35 L16,20 L32,15 Q50,11 68,15 L84,20 L98,35 L98,44 Q98,48 93,48 L7,48 Q2,48 2,44 Z" fill={body} />
          <Ellipse cx={50} cy={22} rx={15} ry={7} fill={win} opacity={0.8} />
          <Rect x={78} y={12} width={20} height={4} rx={2} fill={body} />
          <Rect x={83} y={12} width={3} height={10} fill={body} />
          <Rect x={91} y={12} width={3} height={10} fill={body} />
          <Ellipse cx={23} cy={48} rx={13} ry={10} fill={wh} /><Ellipse cx={23} cy={48} rx={5} ry={4} fill={hub} />
          <Ellipse cx={77} cy={48} rx={13} ry={10} fill={wh} /><Ellipse cx={77} cy={48} rx={5} ry={4} fill={hub} />
          <Rect x={2} y={32} width={96} height={5} rx={2} fill="#ffffff22" />
        </Svg>
      );

    case "truck":
      return (
        <Svg width={size} height={size} viewBox="0 0 120 70" preserveAspectRatio="xMidYMid meet">
          <Rect x={3} y={24} width={65} height={28} rx={4} fill={body} opacity={0.8} />
          <Rect x={66} y={20} width={48} height={32} rx={5} fill={body} />
          <Rect x={68} y={14} width={44} height={10} rx={4} fill={body} />
          <Rect x={74} y={22} width={22} height={14} rx={3} fill={win} opacity={0.8} />
          {[18, 36, 84, 100].map(cx => (
            <React.Fragment key={cx}>
              <Circle cx={cx} cy={55} r={10} fill={wh} /><Circle cx={cx} cy={55} r={4} fill={hub} />
            </React.Fragment>
          ))}
          <Rect x={72} y={6} width={5} height={14} rx={2} fill="#444" />
          <Rect x={110} y={30} width={6} height={5} rx={1} fill="#FFE169" />
        </Svg>
      );

    case "bus":
      return (
        <Svg width={size} height={size} viewBox="0 0 130 65" preserveAspectRatio="xMidYMid meet">
          <Rect x={3} y={14} width={124} height={34} rx={6} fill={body} />
          <Rect x={5} y={10} width={120} height={8} rx={4} fill={body} />
          {[12, 30, 48, 66, 84, 102].map(x => (
            <Rect key={x} x={x} y={17} width={15} height={11} rx={2.5} fill={win} opacity={0.75} />
          ))}
          <Rect x={5} y={24} width={9} height={20} rx={2} fill={win} opacity={0.5} />
          <Circle cx={28} cy={51} r={10} fill={wh} /><Circle cx={28} cy={51} r={4} fill={hub} />
          <Circle cx={100} cy={51} r={10} fill={wh} /><Circle cx={100} cy={51} r={4} fill={hub} />
          <Rect x={3} y={24} width={5} height={7} rx={1} fill="#FFE169" />
          <Rect x={122} y={24} width={5} height={7} rx={1} fill="#FF4757" />
          <Rect x={10} y={11} width={44} height={5} rx={2} fill="#FFE169" opacity={0.7} />
        </Svg>
      );

    case "tank":
      return (
        <Svg width={size} height={size} viewBox="0 0 110 70" preserveAspectRatio="xMidYMid meet">
          <Rect x={2} y={46} width={106} height={18} rx={9} fill="#3D3D3D" />
          {[8, 20, 32, 44, 56, 68, 80, 92].map(x => (
            <Rect key={x} x={x} y={48} width={8} height={14} rx={2} fill="#2D2D2D" />
          ))}
          {[12, 30, 55, 80, 98].map(cx => (
            <Circle key={cx} cx={cx} cy={55} r={5} fill="#555" />
          ))}
          <Rect x={8} y={32} width={94} height={20} rx={5} fill={body} />
          <Ellipse cx={50} cy={32} rx={24} ry={11} fill={body} />
          <Ellipse cx={48} cy={24} rx={17} ry={10} fill={body} />
          <Rect x={48} y={20} width={55} height={7} rx={3.5} fill="#2D2D2D" />
          <Circle cx={103} cy={23} r={3} fill="#1A1A1A" />
          <Circle cx={43} cy={22} r={6} fill={body} stroke="#ffffff44" strokeWidth={1.5} />
          <Path d="M58,22 L64,8" stroke="#444" strokeWidth={1.5} />
        </Svg>
      );

    case "airplane":
      return (
        <Svg width={size} height={size} viewBox="0 0 110 90" preserveAspectRatio="xMidYMid meet">
          <Ellipse cx={55} cy={45} rx={42} ry={11} fill={body} />
          <Path d="M95,39 Q110,45 95,51 Z" fill={body} />
          <Path d="M58,46 L42,16 L72,43 Z" fill={body} />
          <Path d="M58,44 L42,74 L72,47 Z" fill={body} />
          <Path d="M16,45 L12,22 L20,42 Z" fill={body} />
          <Path d="M20,45 L10,32 L26,43 Z" fill={body} opacity={0.85} />
          <Path d="M20,45 L10,58 L26,47 Z" fill={body} opacity={0.85} />
          {[50, 60, 70, 80].map(cx => (
            <Circle key={cx} cx={cx} cy={42} r={3.5} fill={win} opacity={0.85} />
          ))}
          <Ellipse cx={58} cy={50} rx={7} ry={3} fill="#555" />
          <Ellipse cx={58} cy={40} rx={7} ry={3} fill="#555" />
        </Svg>
      );

    case "helicopter":
      return (
        <Svg width={size} height={size} viewBox="0 0 110 75" preserveAspectRatio="xMidYMid meet">
          <Rect x={8} y={12} width={94} height={5} rx={2.5} fill="#444" />
          <Circle cx={55} cy={14} r={5} fill="#333" />
          <Path d="M20,26 Q20,18 32,18 L72,18 Q88,18 88,26 L88,48 Q88,56 80,56 L36,56 Q20,56 20,48 Z" fill={body} />
          <Path d="M65,19 L85,26 L85,40 Q85,50 75,51 L65,51 Q62,51 62,48 L62,21 Z" fill={win} opacity={0.75} />
          <Path d="M20,40 L2,46 Q-2,48 2,51 L20,51 Z" fill={body} opacity={0.85} />
          <Rect x={2} y={36} width={3} height={20} rx={1.5} fill="#444" />
          <Rect x={26} y={56} width={52} height={4} rx={2} fill="#555" />
          <Rect x={24} y={50} width={4} height={10} rx={2} fill="#555" />
          <Rect x={76} y={50} width={4} height={10} rx={2} fill="#555" />
          <Rect x={28} y={26} width={24} height={18} rx={4} fill={win} opacity={0.6} />
        </Svg>
      );

    case "rocket":
      return (
        <Svg width={size} height={size} viewBox="0 0 60 110" preserveAspectRatio="xMidYMid meet">
          <Path d="M22,96 Q25,114 30,100 Q35,114 38,96" fill="#FF6B35" opacity={0.9} />
          <Path d="M25,96 Q28,108 30,98 Q32,108 35,96" fill="#FFE169" />
          <Rect x={18} y={38} width={24} height={58} rx={6} fill={body} />
          <Path d="M18,38 Q30,6 42,38 Z" fill={body} />
          <Circle cx={30} cy={46} r={9} fill={win} opacity={0.85} />
          <Circle cx={30} cy={46} r={4.5} fill={win} opacity={0.5} />
          <Path d="M18,82 L7,100 L18,96 Z" fill={body} />
          <Path d="M42,82 L53,100 L42,96 Z" fill={body} />
          <Rect x={18} y={60} width={24} height={5} rx={2} fill="#ffffff33" />
          <Rect x={18} y={72} width={24} height={3} rx={1.5} fill="#ffffff22" />
        </Svg>
      );

    case "ufo":
      return (
        <Svg width={size} height={size} viewBox="0 0 110 75" preserveAspectRatio="xMidYMid meet">
          <Path d="M38,55 L26,72 L84,72 L72,55 Z" fill="#FFE16925" />
          <Ellipse cx={55} cy={44} rx={52} ry={16} fill={body} />
          <Path d="M33,44 Q33,16 55,13 Q77,16 77,44 Z" fill={win} opacity={0.75} />
          {[12, 28, 44, 66, 82, 98].map((cx, idx) => (
            <Circle key={cx} cx={cx} cy={44} r={5}
              fill={["#FF4757","#2ED573","#FFE169","#FF4757","#2ED573","#FFE169"][idx]} />
          ))}
          <Path d="M55,13 L55,5" stroke="#666" strokeWidth={2.5} />
          <Circle cx={55} cy={4} r={4} fill="#FF4757" />
        </Svg>
      );

    case "boat":
      return (
        <Svg width={size} height={size} viewBox="0 0 110 80" preserveAspectRatio="xMidYMid meet">
          <Path d="M5,46 L10,58 Q14,64 20,64 L90,64 Q96,64 100,58 L105,46 L95,40 L15,40 Z" fill={body} />
          <Rect x={30} y={24} width={50} height={20} rx={4} fill={body} opacity={0.88} />
          {[36, 50, 64].map(x => (
            <Rect key={x} x={x} y={28} width={12} height={9} rx={2} fill={win} opacity={0.8} />
          ))}
          <Rect x={53} y={6} width={3} height={22} rx={1.5} fill="#555" />
          <Path d="M56,8 L72,14 L56,20 Z" fill="#FF4757" />
          <Path d="M5,66 Q30,70 55,66 Q80,62 105,66" stroke="#4ECDC4" strokeWidth={2} fill="none" opacity={0.6} />
          <Rect x={10} y={40} width={90} height={2} rx={1} fill="#ffffff55" />
        </Svg>
      );

    case "train":
      return (
        <Svg width={size} height={size} viewBox="0 0 130 70" preserveAspectRatio="xMidYMid meet">
          <Rect x={2} y={58} width={126} height={3} rx={1.5} fill="#888" />
          <Rect x={2} y={62} width={126} height={2} rx={1} fill="#666" />
          <Rect x={4} y={22} width={38} height={28} rx={3} fill={body} opacity={0.8} />
          <Rect x={8} y={26} width={11} height={9} rx={2} fill={win} opacity={0.7} />
          <Rect x={22} y={26} width={11} height={9} rx={2} fill={win} opacity={0.7} />
          <Rect x={44} y={22} width={38} height={28} rx={3} fill={body} opacity={0.87} />
          <Rect x={48} y={26} width={11} height={9} rx={2} fill={win} opacity={0.7} />
          <Rect x={62} y={26} width={11} height={9} rx={2} fill={win} opacity={0.7} />
          <Rect x={82} y={18} width={44} height={32} rx={5} fill={body} />
          <Rect x={84} y={12} width={40} height={10} rx={4} fill={body} />
          <Rect x={86} y={22} width={20} height={14} rx={3} fill={win} opacity={0.8} />
          <Rect x={89} y={4} width={7} height={16} rx={3} fill="#333" />
          <Ellipse cx={92} cy={5} rx={6} ry={4} fill="#222" />
          <Rect x={120} y={28} width={6} height={6} rx={1.5} fill="#FFE169" />
          {[16, 34, 54, 72, 92, 108, 122].map(cx => (
            <React.Fragment key={cx}>
              <Circle cx={cx} cy={52} r={8} fill={wh} /><Circle cx={cx} cy={52} r={3.5} fill={hub} />
            </React.Fragment>
          ))}
          {[40, 80].map(x => <Rect key={x} x={x} y={34} width={6} height={5} rx={1.5} fill="#555" />)}
        </Svg>
      );

    case "tractor":
      return (
        <Svg width={size} height={size} viewBox="0 0 100 75" preserveAspectRatio="xMidYMid meet">
          <Circle cx={30} cy={50} r={20} fill={wh} />
          <Circle cx={30} cy={50} r={10} fill={hub} />
          {[0, 60, 120, 180, 240, 300].map(angle => {
            const rad = (angle * Math.PI) / 180;
            return (
              <Path key={angle}
                d={`M30,50 L${(30 + 17 * Math.cos(rad)).toFixed(1)},${(50 + 17 * Math.sin(rad)).toFixed(1)}`}
                stroke="#777" strokeWidth={2} />
            );
          })}
          <Rect x={22} y={28} width={60} height={26} rx={4} fill={body} />
          <Rect x={70} y={32} width={24} height={18} rx={3} fill={body} opacity={0.85} />
          <Rect x={34} y={14} width={28} height={20} rx={4} fill={body} />
          <Rect x={37} y={17} width={22} height={13} rx={3} fill={win} opacity={0.75} />
          <Circle cx={84} cy={52} r={12} fill={wh} /><Circle cx={84} cy={52} r={5} fill={hub} />
          <Rect x={76} y={16} width={5} height={18} rx={2} fill="#333" />
          <Rect x={89} y={36} width={5} height={5} rx={1} fill="#FFE169" />
        </Svg>
      );

    default:
      return <Text style={{ fontSize: 40 }}>{VEHICLE_EMOJIS[type] ?? "🚗"}</Text>;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToolBtn({ icon, label, active, onPress, glow }: {
  icon: string; label: string; active: boolean; onPress: () => void; glow: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.toolBtn, active && (glow ? styles.toolBtnActiveGlow : styles.toolBtnActive)]}>
      <Text style={styles.toolBtnIcon}>{icon}</Text>
      <Text style={[styles.toolBtnLabel, active && { color: glow ? "#00FFFF" : Colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionBtn({ icon, onPress, disabled, glow }: {
  icon: string; onPress: () => void; disabled?: boolean; glow: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      style={[styles.actionBtn, glow && styles.actionBtnDark, disabled && { opacity: 0.3 }]}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  canvas: { flex: 1, overflow: "hidden" },

  photoGlowOverlay: {
    backgroundColor: "transparent",
    shadowColor: "#7C5CFF", shadowRadius: 40, shadowOpacity: 1,
    borderWidth: 6, borderColor: "#9B72F880",
  },

  stickerOnCanvas: { position: "absolute", alignItems: "center", justifyContent: "center" },
  stickerEmoji: { textAlign: "center" },
  stickerSelected: {
    borderWidth: 2, borderColor: Colors.primary,
    borderRadius: 12, borderStyle: "dashed",
    backgroundColor: Colors.primary + "15",
  },

  stickerControlsWrapper: { position: "absolute", zIndex: 999, gap: 4 },
  stickerControls: { flexDirection: "row", gap: 4 },
  ctrlBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowRadius: 4, shadowOpacity: 0.3, elevation: 4,
  },
  ctrlTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },

  paintRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#000000CC", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6, gap: 6,
    maxWidth: 240,
  },
  paintLabel: { color: "#fff", fontSize: 14 },
  paintDot: {
    width: 26, height: 26, borderRadius: 13,
    marginRight: 4, borderWidth: 2, borderColor: "transparent",
  },
  paintDotActive: { borderColor: "#fff", transform: [{ scale: 1.22 }] },

  badgeRow: { position: "absolute", top: 10, right: 10, gap: 4 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  fillBusy: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", gap: 10 },
  fillBusyText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  zoomControls: { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 22, padding: 4 },
  zoomBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  zoomBtnText: { fontSize: 18, fontWeight: "900", color: "#222" },
  zoomLevel: { minWidth: 46, alignItems: "center" },
  zoomLevelText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.8 },

  stickerHint: {
    position: "absolute", bottom: 12,
    backgroundColor: "#00000088", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 6,
    left: SCREEN.width / 2 - 100, width: 200,
  },
  stickerHintText: { color: "#fff", fontSize: 12, fontWeight: "600", flex: 1 },

  toolbar: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm,
    gap: 5, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  toolbarDark: { backgroundColor: "#0E0E2A", borderTopColor: "#2D2870" },

  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  toolBtn: {
    alignItems: "center", paddingVertical: 5, paddingHorizontal: 4,
    borderRadius: Radius.md, backgroundColor: Colors.cardLight,
    minWidth: 44, flex: 1,
  },
  toolBtnActive: { backgroundColor: Colors.primary + "22", borderWidth: 1.5, borderColor: Colors.primary },
  toolBtnActiveGlow: { backgroundColor: "#7700FF44", borderWidth: 1.5, borderColor: "#00FFFF" },
  toolBtnIcon: { fontSize: 15 },
  toolBtnLabel: { fontSize: 8, fontWeight: "600", color: Colors.textSecondary, marginTop: 1 },

  colorScroll: { flexGrow: 0 },
  colorDot: { width: 30, height: 30, borderRadius: 15, marginRight: 5, borderWidth: 2, borderColor: "transparent" },
  colorDotActive: { borderColor: Colors.primary, transform: [{ scale: 1.2 }] },

  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sizeRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  sizeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardLight },
  sizeBtnActive: { backgroundColor: Colors.primary + "22", borderWidth: 2, borderColor: Colors.primary },
  sizeDot: {},

  actionRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardLight },
  actionBtnDark: { backgroundColor: "#1A1A3E" },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 7 },
  saveBtnGallery: { backgroundColor: "#16A34A" },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
});

const aiM = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: Spacing.lg },
  card: { backgroundColor: Colors.bgLight, borderRadius: Radius.xl, padding: Spacing.lg, gap: 10, ...Shadow.md },
  title: { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary, textAlign: "center" },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 19 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceLight, minHeight: 70, textAlignVertical: "top" },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelTxt: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.base },
  goBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  goTxt: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  card: {
    backgroundColor: Colors.surfaceLight, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 32, height: "78%",
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 6 },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  sizeRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sizeLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  sizeBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardLight },
  sizeBtnActive: { backgroundColor: Colors.primary + "22", borderWidth: 2, borderColor: Colors.primary },
  catScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  catTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.lg, backgroundColor: Colors.cardLight },
  catTabActive: { backgroundColor: Colors.primary },
  catTabText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  catTabTextActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: Spacing.sm },
  item: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardLight },
  vehicleItem: { width: 70, height: 66 },
  itemSelected: { backgroundColor: Colors.primary + "22", borderWidth: 2, borderColor: Colors.primary },
  vehicleLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: "700" },
  vehicleNote: {
    margin: Spacing.sm, padding: Spacing.sm,
    backgroundColor: Colors.primary + "15", borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.primary + "44",
  },
  vehicleNoteText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", textAlign: "center" },
});
