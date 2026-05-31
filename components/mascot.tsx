import React, { useEffect, useRef } from "react";
import { Text, Animated } from "react-native";
import { MascotType } from "../lib/data/types";

const MASCOT_EMOJI: Record<MascotType, string> = {
  fox: "🦊",
  panda: "🐼",
  bunny: "🐰",
  dino: "🦕",
  owl: "🦉",
  cat: "🐱",
  bear: "🐻",
  frog: "🐸",
};

interface MascotProps {
  type: MascotType;
  size?: number;
  animate?: boolean;
}

export function Mascot({ type, size = 80, animate = true }: MascotProps) {
  const scale = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? 30 : 0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 10, stiffness: 120, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 12, stiffness: 100, useNativeDriver: true }),
    ]).start();

    let idleAnim: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      switch (type) {
        case "fox":
        case "cat":
          idleAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(scale, { toValue: 1.08, duration: 600, useNativeDriver: true }),
              Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
            ])
          );
          break;
        case "bunny":
        case "frog":
          idleAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(translateY, { toValue: -8, duration: 400, useNativeDriver: true }),
              Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
            ])
          );
          break;
        case "panda":
        case "bear":
          idleAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(rotate, { toValue: -8, duration: 500, useNativeDriver: true }),
              Animated.timing(rotate, { toValue: 8, duration: 500, useNativeDriver: true }),
              Animated.timing(rotate, { toValue: 0, duration: 300, useNativeDriver: true }),
            ])
          );
          break;
        case "owl":
          idleAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(rotate, { toValue: -15, duration: 700, useNativeDriver: true }),
              Animated.timing(rotate, { toValue: 15, duration: 700, useNativeDriver: true }),
              Animated.timing(rotate, { toValue: 0, duration: 400, useNativeDriver: true }),
            ])
          );
          break;
        case "dino":
          idleAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(translateY, { toValue: 4, duration: 300, useNativeDriver: true }),
              Animated.timing(translateY, { toValue: -4, duration: 300, useNativeDriver: true }),
              Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
            ])
          );
          break;
      }
      idleAnim?.start();
    }, 800);

    return () => {
      clearTimeout(timer);
      idleAnim?.stop();
    };
  }, [type, animate]);

  const rotateStr = rotate.interpolate({ inputRange: [-180, 180], outputRange: ["-180deg", "180deg"] });

  return (
    <Animated.View style={{ transform: [{ scale }, { translateY }, { rotate: rotateStr }] }}>
      <Text style={{ fontSize: size }}>{MASCOT_EMOJI[type]}</Text>
    </Animated.View>
  );
}
