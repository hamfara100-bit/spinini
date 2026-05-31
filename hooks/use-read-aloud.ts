import { useState, useCallback, useEffect } from "react";
import * as Speech from "expo-speech";

interface ReadAloudOptions {
  rate?: number;
  pitch?: number;
  language?: string;
}

export function useReadAloud(options: ReadAloudOptions = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  const speak = useCallback((text: string) => {
    Speech.stop();
    setSpeaking(true);
    setPaused(false);
    Speech.speak(text, {
      rate: options.rate ?? 0.9,
      pitch: options.pitch ?? 1.0,
      language: options.language ?? "en-US",
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, [options.rate, options.pitch, options.language]);

  const stop = useCallback(() => {
    Speech.stop();
    setSpeaking(false);
    setPaused(false);
  }, []);

  const pause = useCallback(() => {
    Speech.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    Speech.resume();
    setPaused(false);
  }, []);

  const toggle = useCallback((text: string) => {
    if (speaking && !paused) {
      pause();
    } else if (paused) {
      resume();
    } else {
      speak(text);
    }
  }, [speaking, paused, speak, pause, resume]);

  return { speak, stop, pause, resume, toggle, speaking, paused };
}
