import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Radius } from "../lib/theme";

export interface FeatureDef {
  id: string;
  emoji: string;
  label: string;
  bg: string;
  shadow: string;
  pulse?: boolean;
}

interface Props {
  feature: FeatureDef;
  onPress: () => void;
  size?: "sm" | "md" | "lg";
  index?: number;
  /** Override the fixed size with an exact pixel width (height auto-scales at 1.09 ratio) */
  width?: number;
  /** Optional count badge shown at the top-right corner (e.g. pending alerts). Hidden when 0/undefined. */
  badge?: number;
}

export function AnimatedFeatureCard({ feature, onPress, size = "md", index = 0, width, badge }: Props) {
  const scale      = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;

  // Fixed sizes for named variants
  const FIXED = {
    sm: { w: 76,  h: 82,  icon: 38, emoji: 20, label: 9  },
    md: { w: 92,  h: 100, icon: 48, emoji: 26, label: 10 },
    lg: { w: 112, h: 122, icon: 60, emoji: 32, label: 11 },
  }[size];

  // When `width` prop is provided, derive all dimensions proportionally.
  // Cap cardW so cards never balloon beyond 150 px on wide screens — extra
  // space should produce more columns, not bigger cards.
  const cardW    = width ? Math.min(width, 150) : FIXED.w;
  const iconBox  = width ? Math.round(cardW * 0.48)              : FIXED.icon;
  const emojiSz  = width ? Math.round(cardW * 0.26)              : FIXED.emoji;
  const labelSz  = width ? Math.max(9, Math.round(cardW * 0.105)): FIXED.label;
  const labelLnH = Math.round(labelSz * 1.35);
  // Explicit card height guarantees 2-line labels always fit.
  // Without this, `overflow:"hidden"` clips text on tablets where Android's
  // text-layout doesn't auto-expand the parent for the 2nd label line.
  const PADDING_V = 22; // paddingTop(10) + paddingBottom(12)
  const cardH = width
    ? PADDING_V + iconBox + 6 + labelLnH * 2    // 6 = gap between icon and label
    : FIXED.h;

  useEffect(() => {
    setTimeout(() => {
      Animated.spring(scale, {
        toValue: 1, damping: 13, stiffness: 160, useNativeDriver: true,
      }).start();
    }, index * 40);

    if (feature.pulse) {
      const delay = index * 40 + 900;
      const t = setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, { toValue: -5, duration: 1200, useNativeDriver: true }),
            Animated.timing(floatAnim, { toValue: 0,  duration: 1200, useNativeDriver: true }),
          ])
        ).start();
      }, delay);
      return () => clearTimeout(t);
    }
  }, []);

  function handlePress() {
    Animated.sequence([
      Animated.spring(pressScale, { toValue: 0.87, damping: 6,  stiffness: 500, useNativeDriver: true }),
      Animated.spring(pressScale, { toValue: 1.06, damping: 5,  stiffness: 300, useNativeDriver: true }),
      Animated.spring(pressScale, { toValue: 1,    damping: 10, stiffness: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  }

  const combinedScale = Animated.multiply(scale, pressScale);
  const iconBg = feature.bg + "55";

  return (
    <Animated.View style={{
      width: cardW,
      height: cardH,
      transform: [{ scale: combinedScale }, { translateY: floatAnim }],
    }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        accessibilityLabel={feature.label}
        accessibilityRole="button"
        style={[
          styles.card,
          {
            width: cardW,
            height: cardH,
            backgroundColor: feature.bg,
            shadowColor: feature.shadow,
          },
        ]}
      >
        {/* Top-left shine */}
        <View style={[styles.shineTop, { width: cardW * 0.7, height: iconBox + 16 }]} pointerEvents="none" />
        {/* Bottom-right depth */}
        <View style={[styles.shadowInner, { width: cardW * 0.6, height: iconBox * 0.8 }]} pointerEvents="none" />

        {/* Icon circle */}
        <View style={[styles.iconCircle, { width: iconBox, height: iconBox, borderRadius: iconBox / 2, backgroundColor: iconBg }]}>
          <View style={[styles.iconRing, { width: iconBox - 4, height: iconBox - 4, borderRadius: (iconBox - 4) / 2 }]} />
          <Text style={{ fontSize: emojiSz, lineHeight: emojiSz + 4 }}>{feature.emoji}</Text>
        </View>

        {/* Label */}
        <Text
          style={[styles.label, { fontSize: labelSz, lineHeight: labelLnH }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {feature.label}
        </Text>

        {feature.pulse && !badge && <View style={styles.pulseDot} />}
        {!!badge && badge > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 6,
    gap: 6,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    borderTopColor: "rgba(255,255,255,0.75)",
  },
  shineTop: {
    position: "absolute", top: 0, left: 0,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderBottomRightRadius: 60,
  },
  shadowInner: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderTopLeftRadius: 60,
  },
  iconCircle: {
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  iconRing: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  label: {
    fontWeight: "800",
    color: "rgba(20,10,40,0.82)",
    textAlign: "center",
    letterSpacing: 0.1,
    paddingHorizontal: 2,
  },
  pulseDot: {
    position: "absolute", top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#fff",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  countBadge: {
    position: "absolute", top: 5, right: 5,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: "#fff",
  },
  countBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
});
