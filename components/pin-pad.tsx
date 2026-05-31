import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors, FontSize, Radius, Spacing } from "../lib/theme";

interface PinPadProps {
  length?: number;
  onComplete: (pin: string) => void;
  onClearError?: () => void;
  title?: string;
  subtitle?: string;
  error?: string;
}

export function PinPad({
  length = 4,
  onComplete,
  onClearError,
  title = "Enter PIN",
  subtitle,
  error,
}: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);

  function handleDigit(d: string) {
    if (digits.length >= length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Clear error as soon as the user starts typing again
    if (error) onClearError?.();
    const next = [...digits, d];
    setDigits(next);
    if (next.length === length) {
      setTimeout(() => {
        onComplete(next.join(""));
        setDigits([]);
      }, 120);
    }
  }

  function handleDelete() {
    if (digits.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDigits(digits.slice(0, -1));
  }

  function handleClear() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDigits([]);
    onClearError?.();
  }

  const keys = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]];
  const hasError = !!error && digits.length === 0;

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* PIN dots */}
      <View style={styles.dots}>
        {Array.from({ length }).map((_, i) => {
          const filled = digits.length > i;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                filled && styles.dotFilled,
                hasError && styles.dotError,
                filled && hasError && styles.dotFilledError,
              ]}
            />
          );
        })}
      </View>

      {/* Error message + retry prompt */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <Text style={styles.retryHint}>Tap any number to try again</Text>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} accessibilityLabel="Clear PIN and start over" accessibilityRole="button">
            <Text style={styles.clearBtnText}>↺ Start Over</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Keypad */}
      <View style={styles.grid}>
        {keys.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((k, ki) => (
              <TouchableOpacity
                key={ki}
                style={[styles.key, k === "" && styles.keyEmpty]}
                onPress={() => k === "⌫" ? handleDelete() : k !== "" ? handleDigit(k) : null}
                disabled={k === ""}
                activeOpacity={0.7}
                accessibilityLabel={k === "⌫" ? "Delete last digit" : k === "" ? undefined : `Digit ${k}`}
                accessibilityRole={k !== "" ? "button" : undefined}
                accessibilityHint={k === "⌫" ? undefined : k !== "" ? `Enter ${k}` : undefined}
              >
                <Text style={styles.keyText}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: "center" },

  // Dots
  dots: { flexDirection: "row", gap: 16, marginBottom: Spacing.md },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.primary,
    backgroundColor: "transparent",
  },
  dotFilled: { backgroundColor: Colors.primary },
  // Error state: red border only for empty dots (filled look ok as primary until cleared)
  dotError: { borderColor: Colors.error },
  dotFilledError: { backgroundColor: Colors.error, borderColor: Colors.error },

  // Error box
  errorBox: { alignItems: "center", gap: 4, marginBottom: Spacing.sm },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: "700" },
  retryHint: { color: Colors.textSecondary, fontSize: 12 },
  clearBtn: {
    marginTop: 6, backgroundColor: Colors.error + "18",
    borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 1.5, borderColor: Colors.error + "40",
  },
  clearBtnText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },

  // Grid
  grid: { marginTop: Spacing.lg },
  row: { flexDirection: "row", marginBottom: 12 },
  key: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.cardLight,
    alignItems: "center", justifyContent: "center",
    marginHorizontal: 8,
  },
  keyEmpty: { backgroundColor: "transparent" },
  keyText: { fontSize: FontSize.xl, fontWeight: "600", color: Colors.textPrimary },
});
