import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import * as Network from "expo-network";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function check() {
      try {
        const state = await Network.getNetworkStateAsync();
        const offline = !state.isConnected || !state.isInternetReachable;
        setIsOffline(prev => {
          if (prev !== offline) {
            Animated.spring(slideAnim, {
              toValue: offline ? 0 : -48,
              useNativeDriver: true,
              tension: 80,
              friction: 10,
            }).start();
          }
          return offline;
        });
      } catch {}
    }

    check();
    interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.text}>No internet connection — some features may be unavailable</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  icon: { fontSize: 16 },
  text: { color: "#F8FAFC", fontSize: 13, fontWeight: "500", flex: 1 },
});
