import { useState, useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export type VoiceInputState = "idle" | "requesting" | "listening" | "processing" | "error";

export interface UseVoiceInputOptions {
  /** Called with each interim partial transcript (live feedback) */
  onPartial?: (text: string) => void;
  /** Called when a final result is ready — append or replace behaviour controlled by caller */
  onResult: (text: string) => void;
  /** Called on error */
  onError?: (msg: string) => void;
  /** Language locale e.g. "en-US". Defaults to device locale. */
  lang?: string;
  /** If true, interim results will fire onPartial. Default true. */
  interim?: boolean;
}

export function useVoiceInput(opts: UseVoiceInputOptions) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [partialText, setPartialText] = useState("");
  const stateRef = useRef<VoiceInputState>("idle");

  function setS(s: VoiceInputState) { stateRef.current = s; setState(s); }

  // ── Event listeners ────────────────────────────────────────────────────────
  useSpeechRecognitionEvent("result", (event) => {
    const top = event.results?.[0];
    if (!top) return;
    if (event.isFinal) {
      const text = top.transcript ?? "";
      setPartialText("");
      setS("idle");
      if (text.trim()) opts.onResult(text.trim());
    } else if (opts.interim !== false) {
      const partial = top.transcript ?? "";
      setPartialText(partial);
      opts.onPartial?.(partial);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    // "no-speech" is not really an error — just silence
    if (event.error === "no-speech" || event.error === "aborted") {
      setS("idle");
      setPartialText("");
      return;
    }
    setS("error");
    setPartialText("");
    const msg = event.message || event.error || "Speech recognition error";
    opts.onError?.(msg);
    // Auto-reset after 2s
    setTimeout(() => setS("idle"), 2000);
  });

  useSpeechRecognitionEvent("end", () => {
    // If still in listening state after 'end' fire, go idle
    if (stateRef.current === "listening") {
      setS("idle");
      setPartialText("");
    }
  });

  // ── Start / stop ───────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (stateRef.current !== "idle" && stateRef.current !== "error") return;
    setS("requesting");
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        opts.onError?.("Microphone and speech recognition permission required.");
        setS("error");
        setTimeout(() => setS("idle"), 2000);
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: opts.lang ?? "en-US",
        interimResults: opts.interim !== false,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
      setS("listening");
    } catch (e: any) {
      opts.onError?.(e?.message ?? "Could not start speech recognition.");
      setS("error");
      setTimeout(() => setS("idle"), 2000);
    }
  }, [opts.lang]);

  const stop = useCallback(() => {
    if (stateRef.current !== "listening") return;
    ExpoSpeechRecognitionModule.stop();
    setS("processing");
  }, []);

  const abort = useCallback(() => {
    if (stateRef.current === "idle") return;
    ExpoSpeechRecognitionModule.abort();
    setS("idle");
    setPartialText("");
  }, []);

  return { state, partialText, start, stop, abort };
}
