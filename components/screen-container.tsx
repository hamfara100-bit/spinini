import React from "react";
import {
  View, ScrollView, StyleSheet, ViewStyle, StyleProp,
  useColorScheme, TouchableOpacity, Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { useRouter } from "expo-router";
import { Colors } from "../lib/theme";

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  bg?: string;
  edges?: ("top" | "bottom" | "left" | "right")[];
  /** Pass false to suppress the auto back button (e.g. root screens that have their own header row) */
  showBack?: boolean;
}

export function ScreenContainer({
  children,
  scroll = false,
  style,
  contentStyle,
  bg,
  edges,
  showBack,
}: ScreenContainerProps) {
  const scheme = useColorScheme();
  const background = bg ?? (scheme === "dark" ? Colors.bgDark : Colors.bgLight);
  const navigation = useNavigation();
  const router = useRouter();

  // Show back button automatically whenever the navigator has a previous screen,
  // unless the caller explicitly passes showBack={false}.
  const canGoBack = navigation.canGoBack();
  const renderBack = showBack !== false && canGoBack;

  // Pushed (non-root) screens must include the bottom edge so content clears
  // the Android system navigation bar (back/home/recents) and iOS home indicator.
  // Tab-root screens (canGoBack = false) already have the tab bar providing
  // the correct bottom inset, so we skip it there to avoid double-padding.
  const defaultEdges: ("top" | "bottom" | "left" | "right")[] =
    canGoBack
      ? ["top", "left", "right", "bottom"]
      : ["top", "left", "right"];

  const inner = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }, style]} edges={edges ?? defaultEdges}>
      {renderBack && (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
      )}
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: {
    marginLeft: 12,
    marginTop: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 26,
    fontWeight: "300",
    color: Colors.primary,
    lineHeight: 30,
    marginTop: -1,
  },
});
