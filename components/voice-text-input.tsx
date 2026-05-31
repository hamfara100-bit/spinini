/**
 * VoiceTextInput — a TextInput wrapper with an integrated 🎙️ mic button.
 *
 * Drop-in replacement for TextInput in any form. The mic button lives inside
 * the input row on the right-hand side. Tapping starts listening; tapping again
 * stops and commits the transcript.
 *
 * Usage:
 *   <VoiceTextInput
 *     value={text}
 *     onChangeText={setText}
 *     placeholder="Type or speak…"
 *     style={styles.input}  // applied to the inner TextInput
 *   />
 *
 * All standard TextInput props are forwarded. Extra props:
 *   appendTranscript?: boolean   If true (default), appended to existing value
 *                                 rather than replacing it.
 *   containerStyle?              Style applied to the outer row View
 *   micColor?                    Tint color for the mic button (default primary)
 */
import React, { useRef } from "react";
import {
  View, TextInput, TouchableOpacity, Text, Animated,
  StyleSheet, TextInputProps, ViewStyle, StyleProp,
  Easing,
} from "react-native";
import { Colors, Radius } from "../lib/theme";
import { useVoiceInput } from "../hooks/use-voice-input";

export interface VoiceTextInputProps extends TextInputProps {
  appendTranscript?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  micColor?: string;
  micSize?: number;
}

export function VoiceTextInput({
  value,
  onChangeText,
  appendTranscript = true,
  containerStyle,
  micColor,
  micSize = 36,
  style,
  ...rest
}: VoiceTextInputProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const color = micColor ?? Colors.primary;

  const { state, partialText, start, stop } = useVoiceInput({
    onPartial: (partial) => {
      // Show partial transcript live in the input
      if (appendTranscript) {
        // don't update during partial — just display via partialText
      }
    },
    onResult: (text) => {
      if (!onChangeText) return;
      if (appendTranscript && value) {
        const trimmed = value.trimEnd();
        onChangeText(trimmed ? `${trimmed} ${text}` : text);
      } else {
        onChangeText(text);
      }
      stopPulse();
    },
    onError: () => stopPulse(),
  });

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.ease, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  }

  async function handleMicPress() {
    if (state === "listening" || state === "processing") {
      stop();
      stopPulse();
    } else if (state === "idle" || state === "error") {
      await start();
      startPulse();
    }
  }

  const isListening = state === "listening" || state === "processing";
  const displayValue = isListening && partialText
    ? (appendTranscript && value ? `${value.trimEnd()} ${partialText}` : partialText)
    : value;

  return (
    <View style={[vs.row, containerStyle]}>
      <TextInput
        {...rest}
        value={displayValue}
        onChangeText={onChangeText}
        style={[vs.input, style]}
        editable={!isListening}
        placeholderTextColor={Colors.textMuted}
      />
      <TouchableOpacity
        onPress={handleMicPress}
        activeOpacity={0.75}
        style={[vs.micBtn, { width: micSize, height: micSize, borderRadius: micSize / 2 }, isListening && { backgroundColor: color + "20" }]}
        accessibilityLabel={isListening ? "Stop listening" : "Tap to speak"}
        accessibilityRole="button"
      >
        <Animated.Text style={[vs.micIcon, { transform: [{ scale: pulseAnim }] }]}>
          {state === "processing" ? "⏳" : isListening ? "🔴" : "🎙️"}
        </Animated.Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Standalone mic button you can place next to any existing TextInput.
 * Calls onResult with the transcript.
 */
export function MicButton({
  onResult,
  onPartial,
  color,
  size = 40,
  appendTo,
  onAppend,
}: {
  onResult: (text: string) => void;
  onPartial?: (text: string) => void;
  color?: string;
  size?: number;
  /** If provided, appends transcript to this string */
  appendTo?: string;
  onAppend?: (full: string) => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const btnColor = color ?? Colors.primary;

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 550, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 550, easing: Easing.ease, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  }

  const { state, start, stop } = useVoiceInput({
    onResult: (text) => {
      stopPulse();
      if (onAppend && appendTo !== undefined) {
        const trimmed = appendTo.trimEnd();
        onAppend(trimmed ? `${trimmed} ${text}` : text);
      } else {
        onResult(text);
      }
    },
    onPartial,
    onError: () => stopPulse(),
  });

  const isActive = state === "listening" || state === "processing";

  async function press() {
    if (isActive) { stop(); stopPulse(); }
    else { await start(); startPulse(); }
  }

  return (
    <TouchableOpacity
      onPress={press}
      activeOpacity={0.75}
      style={[mb.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: isActive ? btnColor + "15" : btnColor + "12", borderColor: isActive ? btnColor : "transparent", borderWidth: 2 }]}
      accessibilityLabel={isActive ? "Stop recording" : "Tap to dictate"}
      accessibilityRole="button"
    >
      <Animated.Text style={{ fontSize: size * 0.48, transform: [{ scale: pulseAnim }] }}>
        {state === "processing" ? "⏳" : isActive ? "🔴" : "🎙️"}
      </Animated.Text>
    </TouchableOpacity>
  );
}

const vs = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: "#fff",
    paddingRight: 6,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 42,
  },
  micBtn: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  micIcon: { fontSize: 18 },
});

const mb = StyleSheet.create({
  btn: { alignItems: "center", justifyContent: "center" },
});
