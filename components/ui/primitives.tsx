import React from "react";
import {
  TouchableOpacity, View, Text, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle, StyleProp,
} from "react-native";
import { Colors, Radius, FontSize, Spacing, Shadow } from "../../lib/theme";

// ─── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = "primary", size = "md", disabled, loading, icon, fullWidth = false, style }: ButtonProps) {
  const bg = {
    primary: Colors.primary,
    secondary: Colors.secondary,
    outline: "transparent",
    ghost: "transparent",
    danger: Colors.error,
  }[variant];

  const textColor = variant === "outline" ? Colors.primary : variant === "ghost" ? Colors.textPrimary : "#fff";
  const borderColor = variant === "outline" ? Colors.primary : "transparent";

  const heights = { sm: 36, md: 48, lg: 56 };
  const fontSizes = { sm: FontSize.sm, md: FontSize.base, lg: FontSize.md };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        { backgroundColor: bg, height: heights[size], borderColor, borderWidth: variant === "outline" ? 2 : 0, opacity: disabled ? 0.5 : 1 },
        fullWidth ? { alignSelf: "stretch" } : { alignSelf: "flex-start" },
        Shadow.sm,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
          <Text style={[styles.btnText, { color: textColor, fontSize: fontSizes[size] }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  color?: string;
}

export function Card({ children, style, onPress, color }: CardProps) {
  const content = (
    <View style={[styles.card, color ? { backgroundColor: color } : {}, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{content}</TouchableOpacity>;
  }
  return content;
}

// ─── Pill / Badge ─────────────────────────────────────────────────────────────
interface PillProps {
  label: string;
  color?: string;
  textColor?: string;
  size?: "sm" | "md";
}

export function Pill({ label, color = Colors.primary, textColor = "#fff", size = "md" }: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: color, paddingHorizontal: size === "sm" ? 8 : 12, paddingVertical: size === "sm" ? 2 : 4 }]}>
      <Text style={[styles.pillText, { color: textColor, fontSize: size === "sm" ? FontSize.xs : FontSize.sm }]}>{label}</Text>
    </View>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────
interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0–1
  color?: string;
  bg?: string;
  children?: React.ReactNode;
}

export function ProgressRing({ size = 120, strokeWidth = 10, progress, color = Colors.primary, bg = "#E5E7EB", children }: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: strokeWidth, borderColor: bg }]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: strokeWidth, borderColor: color, opacity: Math.min(1, Math.max(0, progress)) }]} />
      {children}
    </View>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
  emoji?: string;
}

export function Avatar({ name, size = 48, color = Colors.primary, emoji }: AvatarProps) {
  const initial = emoji || name.charAt(0).toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={{ fontSize: size * 0.4, color: "#fff", fontWeight: "700" }}>{initial}</Text>
    </View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
export function Divider({ color = Colors.border }: { color?: string }) {
  return <View style={{ height: 1, backgroundColor: color, marginVertical: Spacing.sm }} />;
}

// ─── Empty State ──────────────────────────────────────────────────────────────
interface EmptyProps {
  emoji: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ emoji, title, subtitle }: EmptyProps) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySub}>{subtitle}</Text>}
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────
interface RowProps {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  right?: React.ReactNode;
}

export function Row({ label, value, icon, onPress, right }: RowProps) {
  const inner = (
    <View style={styles.row}>
      {icon && <View style={styles.rowIcon}>{icon}</View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
      </View>
      {right}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
  return inner;
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
  },
  btnText: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  pill: {
    borderRadius: Radius.full,
    alignSelf: "flex-start",
  },
  pillText: {
    fontWeight: "600",
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  emptySub: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    marginBottom: 4,
  },
  rowIcon: {
    marginRight: Spacing.sm,
  },
  rowLabel: {
    fontSize: FontSize.base,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  rowValue: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
