import { useColorScheme } from "react-native";
import { Colors } from "../lib/theme";

export function useColors() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  return {
    ...Colors,
    bg: dark ? Colors.bgDark : Colors.bgLight,
    surface: dark ? Colors.surfaceDark : Colors.surfaceLight,
    card: dark ? Colors.cardDark : Colors.cardLight,
    text: dark ? Colors.textLight : Colors.textPrimary,
    textSub: dark ? "#A78BFA" : Colors.textSecondary,
    border: dark ? Colors.borderDark : Colors.border,
    isDark: dark,
  };
}
