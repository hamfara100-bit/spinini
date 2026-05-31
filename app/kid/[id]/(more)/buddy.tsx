import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MicButton } from "../../../../components/voice-text-input";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Mascot } from "../../../../components/mascot";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid } from "../../../../lib/utils";
import { buddyChat, callAI } from "../../../../lib/ai";
import { AgentMessage, AIResult } from "../../../../lib/data/types";
import { downloadResult, buildResultSystemPrompt, detectFormat, isContentRequest, FORMAT_META } from "../../../../lib/ai-export";

interface PendingResult { title: string; content: string; format: ReturnType<typeof detectFormat> }

const EXAMPLE_GROUPS = [
  {
    label: "📋 My Day",
    color: "#3B82F6", bg: "#EFF6FF",
    examples: ["What are my chores?", "How many points do I have?", "What's my screen time today?", "What's on my to-do list?"],
  },
  {
    label: "🎓 Homework Help",
    color: "#8B5CF6", bg: "#F5F3FF",
    examples: ["Help me with math homework", "Explain fractions to me", "What is photosynthesis?", "Help me write a story"],
  },
  {
    label: "📊 Create Something",
    color: "#10B981", bg: "#ECFDF5",
    examples: [
      "Make me a study plan for this week as CSV",
      "Create a chore tracker spreadsheet",
      "Make a reading list PDF",
      "Create a homework checklist form",
    ],
  },
  {
    label: "🎮 Fun & Games",
    color: "#EF4444", bg: "#FFF1F2",
    examples: ["Tell me a joke 😄", "Tell me a fun fact! 🌟", "Let's play 20 questions", "Make up a riddle"],
  },
  {
    label: "💬 Just Chat",
    color: "#F59E0B", bg: "#FFFBEB",
    examples: ["I'm bored, what should I do?", "I'm feeling sad today", "Tell me a bedtime story", "What's the coolest animal?"],
  },
];

const CONCERN_PATTERNS = [
  { pattern: /hurt\s*(my)?self|self.?harm|cut\s*(my)?self|want\s*to\s*die|kill\s*my?self|suicid/i, level: "high", label: "self-harm concern" },
  { pattern: /nobody\s*likes?\s*me|no\s*friends|everyone\s*hates?\s*me|i\s*(am|feel)\s*(so\s*)?(lonely|alone|worthless|ugly|stupid|dumb)/i, level: "medium", label: "low self-esteem" },
  { pattern: /bully|being\s*(bullied|picked\s*on|teased|hurt)|someone\s*(hit|hurt|punched|kicks?)\s*me/i, level: "medium", label: "bullying" },
  { pattern: /scared\s*(of|to)\s*(go\s*home|my\s*(dad|mom|parent)|someone)/i, level: "high", label: "safety concern" },
  { pattern: /ran\s*away|running\s*away|leave\s*home|run\s*from/i, level: "medium", label: "running away" },
];

export default function BuddyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const router = useRouter();
  const kid = useKid(id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null);
  const listRef = useRef<FlatList>(null);

  const messages: AgentMessage[] = kid?.buddyMessages ?? [];
  const resultCount = (kid?.aiResults ?? []).length;

  function checkSafety(text: string) {
    for (const c of CONCERN_PATTERNS) {
      if (c.pattern.test(text)) {
        dispatch({
          type: "NOTIFICATION_ADD", kidId: id,
          notification: { id: uid(), kidId: id, kind: "ping", title: c.level === "high" ? "🚨 Wellbeing Alert" : "💛 Check In With Your Child", body: `${kid?.profile.name ?? "Your child"} mentioned something that may need attention: ${c.label}.`, read: false, createdAt: new Date().toISOString() },
        });
        break;
      }
    }
  }

  function buildKidContext(): string {
    if (!kid) return "";
    const openChores = kid.chores.filter(c => c.status === "open").map(c => `"${c.title}" (${c.points} pts)`).join(", ") || "none";
    const submittedChores = kid.chores.filter(c => c.status === "submitted").length;
    const pendingAssignments = (kid.assignments ?? []).filter((a: any) => a.status === "pending").length;
    return [
      `Name: ${kid.profile.name}, Age: ${kid.profile.age}`,
      `Behavior points: ${kid.behavior.totalPoints}`,
      `Streak: ${kid.streak.currentDays} days`,
      `Screen time limit: ${kid.rules.dailyLimitMinutes} min/day`,
      `Open chores: ${openChores}`,
      submittedChores > 0 ? `Chores awaiting approval: ${submittedChores}` : "",
      pendingAssignments > 0 ? `Pending assignments: ${pendingAssignments}` : "",
    ].filter(Boolean).join("\n");
  }

  async function generateContent(text: string) {
    const format = detectFormat(text);
    const systemPrompt = buildResultSystemPrompt(format, buildKidContext());
    const content = await callAI([{ role: "user", content: text }], systemPrompt, 1500);
    const title = text.slice(0, 55).replace(/\b\w/g, l => l.toUpperCase());
    setPendingResult({ title, content, format });
    return content;
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setPendingResult(null);
    setLoading(true);

    checkSafety(text);

    const userMsg: AgentMessage = { id: uid(), role: "user", content: text, timestamp: new Date().toISOString() };
    dispatch({ type: "BUDDY_MESSAGE_ADD", kidId: id, message: userMsg });

    try {
      let replyContent: string;
      if (isContentRequest(text)) {
        const content = await generateContent(text);
        const format = detectFormat(text);
        const meta = FORMAT_META[format];
        replyContent = `${meta.emoji} Done! I made your ${meta.label}. Tap **Save** to keep it or **Download** to get the file! 🎉`;
      } else {
        const allMsgs = [...messages, userMsg];
        const history = allMsgs.slice(-20).map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
        replyContent = await buddyChat(history, kid?.profile.age ?? 8, buildKidContext());
      }
      dispatch({ type: "BUDDY_MESSAGE_ADD", kidId: id, message: { id: uid(), role: "assistant", content: replyContent, timestamp: new Date().toISOString() } });
    } catch (e: any) {
      const noKey = e?.message?.includes("No AI key");
      dispatch({ type: "BUDDY_MESSAGE_ADD", kidId: id, message: { id: uid(), role: "assistant", content: noKey ? "I can't connect right now 🔌 — ask a parent to check the app settings!" : "Hmm, I couldn't think of a reply. Check your internet and try again! 🤔", timestamp: new Date().toISOString() } });
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function saveResult() {
    if (!pendingResult) return;
    const result: AIResult = {
      id: uid(),
      title: pendingResult.title,
      format: pendingResult.format,
      content: pendingResult.content,
      createdAt: new Date().toISOString(),
      createdBy: "kid",
      kidId: id,
      prompt: messages[messages.length - 2]?.content,
    };
    dispatch({ type: "KID_AI_RESULT_ADD", kidId: id, result });
    setPendingResult(null);
    dispatch({ type: "BUDDY_MESSAGE_ADD", kidId: id, message: { id: uid(), role: "assistant", content: "✅ Saved to your AI Results! Tap 📁 any time to view it.", timestamp: new Date().toISOString() } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      <ScreenContainer bg={Colors.bgLight}>
        {/* Header */}
        <View style={styles.header}>
          <Mascot type={kid?.profile.mascot ?? "fox"} size={48} animate />
          <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
            <Text style={styles.title}>AI Buddy</Text>
            <Text style={styles.sub}>Your friendly helper 🤝</Text>
          </View>
          {/* Results button */}
          <TouchableOpacity style={styles.resultsBtn} onPress={() => router.push(`/kid/${id}/(more)/ai-results` as any)}>
            <Text style={styles.resultsBtnText}>📁</Text>
            {resultCount > 0 && <View style={styles.resultsBadge}><Text style={styles.resultsBadgeText}>{resultCount > 9 ? "9+" : resultCount}</Text></View>}
          </TouchableOpacity>
          {messages.length > 0 && (
            <TouchableOpacity onPress={() => { dispatch({ type: "BUDDY_MESSAGES_CLEAR", kidId: id }); setPendingResult(null); }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Empty state */}
        {messages.length === 0 ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.xl }} showsVerticalScrollIndicator={false}>
            <Text style={styles.greeting}>Hi {kid?.profile.name}! What would you like to do? 😊</Text>
            {EXAMPLE_GROUPS.map(group => (
              <View key={group.label} style={[styles.exGroup, { backgroundColor: group.bg }]}>
                <Text style={[styles.exGroupLabel, { color: group.color }]}>{group.label}</Text>
                <View style={styles.exChips}>
                  {group.examples.map(ex => (
                    <TouchableOpacity key={ex} style={[styles.exChip, { borderColor: group.color + "40" }]} onPress={() => send(ex)}>
                      <Text style={[styles.exChipText, { color: group.color }]}>{ex}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingVertical: Spacing.sm }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleBot]}>
                {item.role === "assistant" && <Text style={{ fontSize: 18, marginBottom: 4 }}>🤖</Text>}
                <Text style={[styles.bubbleText, item.role === "user" ? styles.bubbleTextUser : styles.bubbleTextBot]}>
                  {item.content}
                </Text>
              </View>
            )}
          />
        )}

        {/* Pending result actions */}
        {pendingResult && (
          <View style={styles.resultActions}>
            <Text style={styles.resultActionsTitle} numberOfLines={1}>
              {FORMAT_META[pendingResult.format].emoji} {pendingResult.title}
            </Text>
            <View style={styles.resultActionsRow}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveResult}>
                <Text style={styles.saveBtnText}>💾 Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dlBtn} onPress={() => downloadResult(pendingResult.title, pendingResult.content, pendingResult.format)}>
                <Text style={styles.dlBtnText}>⬇️ Download</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dismissBtn} onPress={() => setPendingResult(null)}>
                <Text style={styles.dismissBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.typingText}>Thinking…</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type or tap 🎙️ to speak…"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <MicButton appendTo={input} onAppend={setInput} onResult={txt => { setInput(txt); setTimeout(() => send(txt), 300); }} size={36} />
          <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]} onPress={() => send()} disabled={loading || !input.trim()}>
            <Text style={{ fontSize: 22 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md, gap: 4 },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultsBtn: { position: "relative", width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  resultsBtnText: { fontSize: 20 },
  resultsBadge: { position: "absolute", top: -4, right: -4, backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  resultsBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  clearBtnText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  greeting: { fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary, marginBottom: Spacing.md },
  exGroup: { borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  exGroupLabel: { fontSize: FontSize.sm, fontWeight: "800", marginBottom: 8 },
  exChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exChip: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff" },
  exChipText: { fontSize: FontSize.sm, fontWeight: "600" },
  bubble: { maxWidth: "82%", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8 },
  bubbleUser: { backgroundColor: Colors.primary, alignSelf: "flex-end" },
  bubbleBot: { backgroundColor: Colors.surfaceLight, alignSelf: "flex-start", ...Shadow.sm },
  bubbleText: { fontSize: FontSize.base, lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  bubbleTextBot: { color: Colors.textPrimary },
  resultActions: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8, borderWidth: 1, borderColor: Colors.primary + "30", gap: 8 },
  resultActionsTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  resultActionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 9 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  dlBtn: { flex: 1, backgroundColor: Colors.cardLight, borderRadius: Radius.full, alignItems: "center", padding: 9 },
  dlBtnText: { color: Colors.textPrimary, fontWeight: "700", fontSize: FontSize.sm },
  dismissBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  dismissBtnText: { color: Colors.textSecondary, fontWeight: "700" },
  typing: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, gap: 8 },
  typingText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: Spacing.sm },
  input: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.sm, fontSize: FontSize.base, maxHeight: 100, backgroundColor: Colors.surfaceLight },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
});
