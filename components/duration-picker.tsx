/**
 * DurationPicker — bottom-sheet modal for picking how long to lock/unlock a kid.
 *
 * Usage:
 *   <DurationPicker
 *     visible={show}
 *     mode="lock"            // "lock" | "unlock"
 *     kidName="Emma"
 *     onPick={(mins) => { ... }}   // mins: >0 = duration, -1 = until tomorrow, 0 = indefinite
 *     onCancel={() => setShow(false)}
 *   />
 */
import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";

export type DurationMinutes =
  | 15 | 30 | 60 | 120
  | -1   // until tomorrow midnight
  | 0;   // indefinitely (lock = no auto-unlock, unlock = free mode)

interface Option {
  label: string;
  sub: string;
  value: DurationMinutes;
  emoji: string;
}

const OPTIONS: Option[] = [
  { label: "15 minutes",     sub: "Quick break",          value: 15,  emoji: "⏱️" },
  { label: "30 minutes",     sub: "Half hour",            value: 30,  emoji: "⏱️" },
  { label: "1 hour",         sub: "One hour",             value: 60,  emoji: "🕐" },
  { label: "2 hours",        sub: "Two hours",            value: 120, emoji: "🕑" },
  { label: "Until tomorrow", sub: "Resets at midnight",   value: -1,  emoji: "🌙" },
  { label: "Indefinitely",   sub: "Until you change it",  value: 0,   emoji: "♾️" },
];

interface Props {
  visible: boolean;
  mode: "lock" | "unlock";
  kidName: string;
  onPick: (mins: DurationMinutes) => void;
  onCancel: () => void;
}

export function DurationPicker({ visible, mode, kidName, onPick, onCancel }: Props) {
  const isLock = mode === "lock";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          {/* Header */}
          <View style={[s.header, { backgroundColor: isLock ? Colors.error : Colors.success }]}>
            <Text style={s.headerEmoji}>{isLock ? "🔒" : "🔓"}</Text>
            <View>
              <Text style={s.headerTitle}>
                {isLock ? `Lock ${kidName}` : `Unlock ${kidName}`}
              </Text>
              <Text style={s.headerSub}>
                {isLock ? "How long should the device stay locked?"
                        : "How long should the device stay unlocked?"}
              </Text>
            </View>
          </View>

          {/* Options */}
          {OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.value}
              style={[s.option, i < OPTIONS.length - 1 && s.optionBorder]}
              onPress={() => onPick(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={s.optEmoji}>{opt.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.optLabel}>{opt.label}</Text>
                <Text style={s.optSub}>{opt.sub}</Text>
              </View>
              <Text style={s.optArrow}>›</Text>
            </TouchableOpacity>
          ))}

          {/* Cancel */}
          <TouchableOpacity style={s.cancel} onPress={onCancel}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/** Returns ISO string for tomorrow midnight (00:00 local time) */
export function tomorrowMidnight(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Minutes remaining until local midnight */
export function minutesUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date();
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 60000));
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surfaceLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    ...Shadow.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: Spacing.md,
    paddingTop: Spacing.lg,
  },
  headerEmoji: { fontSize: 36 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceLight,
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optEmoji: { fontSize: 22, width: 28, textAlign: "center" },
  optLabel: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  optSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  optArrow: { fontSize: 20, color: Colors.textMuted, fontWeight: "700" },

  cancel: {
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: Colors.cardLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  cancelText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textSecondary },
});
