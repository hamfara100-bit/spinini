import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import { streamCallAI } from "../../../../lib/ai";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are a friendly homework helper for kids. Your job is to GUIDE students to find answers themselves, NOT to give them the answer directly.

Rules:
- Never just give the answer. Instead, ask questions that help the kid think it through.
- Break big problems into smaller steps.
- Celebrate when they get it right.
- If they're really stuck after 3 tries, give a small hint but still make them do the final step.
- Keep language simple and encouraging.
- Use examples and analogies appropriate for school-age kids.
- If the question is not school-related, gently redirect to homework topics.`;

const SUGGESTIONS = [
  "Help me with math homework",
  "I don't understand this word problem",
  "Can you explain fractions?",
  "How do I write a good essay?",
  "I need help studying for a test",
];

export default function HomeworkHelperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Message = { id: uid(), role: "user", content };
    const history = [...messages, userMsg];
    setMessages(history);

    setLoading(true);
    try {
      const aiHistory = history.map(m => ({ role: m.role, content: m.content }));
      setStreamingText("");
      const reply = await streamCallAI(aiHistory, SYSTEM_PROMPT, setStreamingText, 512);
      setStreamingText(null);
      setMessages(prev => [...prev, { id: uid(), role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: uid(), role: "assistant", content: "Sorry, I couldn't connect. Please try again!" }]);
    } finally {
      setLoading(false);
      setStreamingText(null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenContainer>
        <Text style={styles.title}>📚 Homework Helper</Text>
        <Text style={styles.sub}>I'll help you figure it out — not just give you the answer!</Text>

        {messages.length === 0 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestLabel}>Try asking:</Text>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.suggestion} onPress={() => send(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(m => (
            <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAI]}>
              {m.role === "assistant" && <Text style={styles.aiBadge}>📚 Helper</Text>}
              <Text style={[styles.bubbleText, m.role === "user" && styles.bubbleTextUser]}>{m.content}</Text>
            </View>
          ))}
          {streamingText !== null && (
            <View style={styles.bubbleAI}>
              <Text style={styles.aiBadge}>📚 Helper</Text>
              <Text style={styles.bubbleText}>{streamingText || "…"}</Text>
            </View>
          )}
          {loading && !streamingText && (
            <View style={styles.bubbleAI}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your homework…"
            multiline
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]} onPress={() => send()} disabled={!input.trim() || loading}>
            <Text style={styles.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>

        {messages.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setMessages([])}>
            <Text style={styles.clearBtnText}>Clear chat</Text>
          </TouchableOpacity>
        )}
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  suggestions: { marginBottom: Spacing.md },
  suggestLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", marginBottom: 8 },
  suggestion: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  suggestionText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  bubble: { borderRadius: Radius.xl, padding: 12, marginBottom: 8, maxWidth: "85%" },
  bubbleUser: { backgroundColor: Colors.primary, alignSelf: "flex-end" },
  bubbleAI: { backgroundColor: Colors.surfaceLight, alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.border },
  aiBadge: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "700", marginBottom: 4 },
  bubbleText: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTextUser: { color: "#fff" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: Spacing.sm },
  input: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.xl, padding: 12, fontSize: FontSize.base, maxHeight: 120 },
  sendBtn: { backgroundColor: Colors.primary, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
  sendBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  clearBtn: { alignItems: "center", paddingVertical: 8 },
  clearBtnText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
});
