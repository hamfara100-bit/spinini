import React, { Component, ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors, FontSize, Spacing, Radius } from "../lib/theme";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: Spacing.xl, backgroundColor: Colors.bgLight,
  },
  icon: { fontSize: 56, marginBottom: Spacing.md },
  title: {
    fontSize: FontSize.lg, fontWeight: "800",
    color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: "center", marginBottom: Spacing.lg,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
