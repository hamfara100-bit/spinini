import React from "react";
import { View, TextInput, Text, TextInputProps, StyleSheet } from "react-native";
import { POINT_VALUE } from "../lib/utils";
import { Colors, FontSize } from "../lib/theme";

interface Props extends Omit<TextInputProps, "onChangeText" | "value" | "keyboardType" | "style"> {
  value: string;
  onChangeText: (v: string) => void;
  inputStyle?: any;
  style?: any;
}

export function PointsInput({ value, onChangeText, inputStyle, style, ...rest }: Props) {
  const pts = parseInt(value) || 0;
  return (
    <View style={style}>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={v => onChangeText(v.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        returnKeyType="done"
        {...rest}
      />
      {pts > 0 && (
        <Text style={styles.hint}>Exchange value: ${(pts * POINT_VALUE).toFixed(2)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: "600",
    marginTop: 3,
    marginLeft: 2,
  },
});
