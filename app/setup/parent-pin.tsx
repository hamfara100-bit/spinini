import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../lib/data/store";
import { hashPin } from "../../lib/utils";
import { PinPad } from "../../components/pin-pad";
import { ScreenContainer } from "../../components/screen-container";
import { Colors, FontSize, Spacing } from "../../lib/theme";

export default function ParentPin() {
  const { dispatch } = useData();
  const router = useRouter();
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");

  async function handlePin(pin: string) {
    if (step === "create") {
      setFirst(pin);
      setStep("confirm");
    } else {
      if (pin === first) {
        const hashed = await hashPin(pin);
        dispatch({ type: "SET_PARENT_SETTINGS", payload: { pin: hashed } });
        router.replace("/setup/add-kid");
      } else {
        setError("PINs don't match. Try again.");
        setStep("create");
        setFirst("");
      }
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.emoji}>🔐</Text>
        <PinPad
          key={step}
          title={step === "create" ? "Create Parent PIN" : "Confirm PIN"}
          subtitle={step === "create" ? "This PIN keeps kids out of parent settings." : "Re-enter your PIN to confirm."}
          onComplete={handlePin}
          onClearError={() => setError("")}
          error={error}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 56 },
});
