import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { MicButton } from "../../components/voice-text-input";
import { useData } from "../../lib/data/store";
import { ScreenContainer } from "../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../lib/theme";
import { uid, nowIso } from "../../lib/utils";
import { parentAgentQuery, callAI } from "../../lib/ai";
import { AgentMessage, AIResult } from "../../lib/data/types";
import { getTodayUsage, formatMinutes } from "../../lib/data/logic";
import { downloadResult, buildResultSystemPrompt, detectFormat, isContentRequest, FORMAT_META } from "../../lib/ai-export";

type AIAction =
  | { type: "PING_KID";      kidId: string; message: string }
  | { type: "ALARM_KID";     kidId: string; message: string }
  | { type: "LOCK_DEVICE";   kidId: string }
  | { type: "UNLOCK_DEVICE"; kidId: string }
  | { type: "FREE_MODE";     kidId: string; enabled: boolean }
  | { type: "ADD_CHORE";     kidId: string; title: string; points: number }
  | { type: "AWARD_POINTS";  kidId: string; points: number; reason: string }
  | { type: "DEDUCT_POINTS"; kidId: string; points: number; reason: string }
  | { type: "SET_SCREEN_TIME"; kidId: string; minutes: number }
  | { type: "NAVIGATE";      path: string; label: string }
  | { type: "NONE" };

interface AIResponse { message: string; actions: AIAction[] }

// ─── Pending generated result (shown in chat before saving) ──────────────────
interface PendingResult { title: string; content: string; format: ReturnType<typeof detectFormat> }

function buildExampleGroups(kids: { profile: { name: string } }[]) {
  const k1 = kids[0]?.profile.name ?? "your kid";
  const k2 = kids[1]?.profile.name ?? (kids[0]?.profile.name ?? "them");
  return [
    {
      label: "⏰ Wake-Up & Bedtime",
      color: "#F59E0B", bg: "#FFFBEB",
      examples: [`Wake up ${k1}`, `Wake up ${k2} with a message from Mom`, `Send ${k1} to bed`, "Set bedtime mode for all kids"],
    },
    {
      label: "📵 Device Control",
      color: "#EF4444", bg: "#FFF1F2",
      examples: [`Lock ${k1}'s device`, `Unlock ${k2}'s phone`, `Give ${k1} 30 more minutes of screen time`, "Lock all kids' devices"],
    },
    {
      label: "📢 Messages & Pings",
      color: "#8B5CF6", bg: "#F5F3FF",
      examples: [`Tell ${k1} dinner is ready`, `Ping ${k2} to come downstairs`, `Tell ${k1} I love you`, `Send ${k1} a come home now message`],
    },
    {
      label: "⭐ Points & Rewards",
      color: "#10B981", bg: "#ECFDF5",
      examples: [`Give ${k1} 5 points for good behavior`, `Take away 3 points from ${k2}`, `Award ${k1} 10 points for cleaning their room`],
    },
    {
      label: "📋 Chores",
      color: "#3B82F6", bg: "#EFF6FF",
      examples: [`Add a chore for ${k1}: clean their room, 5 points`, `Give ${k2} a homework chore worth 3 points`],
    },
    {
      label: "📊 Reports & Files",
      color: "#6366F1", bg: "#EEF2FF",
      examples: [
        "Create a usage report for all kids this month as CSV",
        `Make a PDF behavior summary for ${k1}`,
        "Generate a chores tracker spreadsheet",
        `Create a weekly schedule form for ${k2}`,
      ],
    },
    {
      label: "📊 Family Info",
      color: "#64748B", bg: "#F8FAFC",
      examples: ["How are the kids doing today?", "Which kid has the most points?", "Give me a family summary", "What chores are pending?"],
    },
  ];
}

export default function AgentScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingNav, setPendingNav] = useState<{ path: string; label: string } | null>(null);
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null);
  const listRef = useRef<FlatList>(null);

  const messages: AgentMessage[] = state.agentMessages;
  const parentName = state.parentSettings.name || "Parent";
  const resultCount = (state.aiResults ?? []).length;
  const EXAMPLE_GROUPS = buildExampleGroups(state.kids);

  function buildContext(): string {
    const kidLines = state.kids.map(k => {
      const usage = getTodayUsage(k);
      const limit = k.rules.dailyLimitMinutes;
      const openChores = k.chores.filter(c => c.status === "open").length;
      const pendingReqs = (k.kidRequests ?? []).filter(r => r.status === "pending").length;
      const recentMood = (k.moodEntries ?? [])[0];
      const locked = (k.rules.lockedFeatures ?? []).length > 0;
      const recentBehavior = k.behavior.events.slice(0, 5).map(e => `${e.points > 0 ? "+" : ""}${e.points} (${e.reason})`).join(", ");
      return [
        `- ${k.profile.name} (id="${k.profile.id}", age=${k.profile.age})`,
        `  screen_time_today=${formatMinutes(usage)}/${formatMinutes(limit)}, locked=${locked}, free_mode=${k.rules.freeMode ?? false}`,
        `  behavior_points=${k.behavior.totalPoints}, open_chores=${openChores}, streak=${k.streak.currentDays} days`,
        `  recent_mood=${recentMood ? `${recentMood.mood}/5` : "unknown"}, pending_kid_requests=${pendingReqs}`,
        `  recent_behavior: ${recentBehavior || "none"}`,
      ].join("\n");
    }).join("\n");
    return `Parent: ${parentName}\nDate: ${new Date().toLocaleDateString()}\nKids:\n${kidLines}`;
  }

  function buildSystemPrompt(): string {
    const kidList = state.kids.map(k => `  - name="${k.profile.name}" id="${k.profile.id}" age=${k.profile.age}`).join("\n");
    return `You are Spinini AI, an intelligent family assistant. You can answer questions AND execute real app actions.

## Kids in this family
${kidList}

## Response format — ONLY valid JSON, no markdown fences:
{ "message": "friendly reply (under 60 words)", "actions": [...] }

## Available actions

Wake up/alarm:   { "type": "ALARM_KID", "kidId": "<id>", "message": "Wake up! Love, ${parentName} 🌅" }
Lock device:     { "type": "LOCK_DEVICE", "kidId": "<id>" }
Unlock device:   { "type": "UNLOCK_DEVICE", "kidId": "<id>" }
More screen time:{ "type": "SET_SCREEN_TIME", "kidId": "<id>", "minutes": 90 }
Free mode:       { "type": "FREE_MODE", "kidId": "<id>", "enabled": true }
Message/ping:    { "type": "PING_KID", "kidId": "<id>", "message": "Dinner is ready!" }
Award points:    { "type": "AWARD_POINTS", "kidId": "<id>", "points": 5, "reason": "Good behavior" }
Deduct points:   { "type": "DEDUCT_POINTS", "kidId": "<id>", "points": 3, "reason": "Misbehaving" }
Add chore:       { "type": "ADD_CHORE", "kidId": "<id>", "title": "Clean room", "points": 5 }
Navigate:        { "type": "NAVIGATE", "path": "/parent/(more)/location", "label": "📍 Open Location" }
No action:       { "type": "NONE" }

## Rules
- Match kid names case-insensitively.
- "lock all" = one LOCK_DEVICE per kid.
- Keep message warm and concise.
- Always respond in JSON only.`;
  }

  function executeActions(actions: AIAction[]): string[] {
    const confirmations: string[] = [];
    for (const action of actions) {
      if (action.type === "ALARM_KID") {
        dispatch({ type: "NOTIFICATION_ADD", kidId: action.kidId, notification: { id: uid(), kidId: action.kidId, kind: "ping", title: "⏰ Wake Up!", body: action.message, read: false, createdAt: nowIso(), alarmMode: true, soundLevel: "high", forceVibrate: true } });
        confirmations.push(`⏰ Alarm → ${state.kids.find(k => k.profile.id === action.kidId)?.profile.name}`);
      } else if (action.type === "PING_KID") {
        dispatch({ type: "NOTIFICATION_ADD", kidId: action.kidId, notification: { id: uid(), kidId: action.kidId, kind: "ping", title: `💬 From ${parentName}`, body: action.message, read: false, createdAt: nowIso() } });
        confirmations.push(`💬 Message → ${state.kids.find(k => k.profile.id === action.kidId)?.profile.name}`);
      } else if (action.type === "LOCK_DEVICE") {
        dispatch({ type: "LOCK_ALL_FEATURES", kidId: action.kidId });
        confirmations.push(`🔒 Locked: ${state.kids.find(k => k.profile.id === action.kidId)?.profile.name}`);
      } else if (action.type === "UNLOCK_DEVICE") {
        dispatch({ type: "UNLOCK_ALL_FEATURES", kidId: action.kidId });
        confirmations.push(`🔓 Unlocked: ${state.kids.find(k => k.profile.id === action.kidId)?.profile.name}`);
      } else if (action.type === "FREE_MODE") {
        dispatch({ type: "SET_FREE_MODE", kidId: action.kidId, enabled: action.enabled });
        confirmations.push(`🎉 Free mode ${action.enabled ? "ON" : "OFF"}: ${state.kids.find(k => k.profile.id === action.kidId)?.profile.name}`);
      } else if (action.type === "ADD_CHORE") {
        dispatch({ type: "ADD_CHORE", chore: { id: uid(), title: action.title, assignedKids: [action.kidId], points: action.points, status: "open", proofs: [], approvals: [], createdAt: nowIso(), createdBy: parentName } });
        confirmations.push(`📋 Chore added: "${action.title}"`);
      } else if (action.type === "AWARD_POINTS") {
        dispatch({ type: "BEHAVIOR_ADD_EVENT", kidId: action.kidId, event: { id: uid(), points: action.points, reason: action.reason, date: nowIso() } });
        confirmations.push(`⭐ +${action.points} pts → ${state.kids.find(k => k.profile.id === action.kidId)?.profile.name}`);
      } else if (action.type === "DEDUCT_POINTS") {
        dispatch({ type: "BEHAVIOR_ADD_EVENT", kidId: action.kidId, event: { id: uid(), points: -action.points, reason: action.reason, date: nowIso() } });
        confirmations.push(`⬇️ -${action.points} pts → ${state.kids.find(k => k.profile.id === action.kidId)?.profile.name}`);
      } else if (action.type === "SET_SCREEN_TIME") {
        dispatch({ type: "UPDATE_RULES", kidId: action.kidId, payload: { dailyLimitMinutes: action.minutes } });
        confirmations.push(`⏱️ Screen time → ${action.minutes}m for ${state.kids.find(k => k.profile.id === action.kidId)?.profile.name}`);
      } else if (action.type === "NAVIGATE") {
        setPendingNav({ path: action.path, label: action.label });
      }
    }
    return confirmations;
  }

  async function generateContent(text: string) {
    const format = detectFormat(text);
    const systemPrompt = buildResultSystemPrompt(format, buildContext());
    const content = await callAI([{ role: "user", content: text }], systemPrompt, 2048);
    const title = text.slice(0, 60).replace(/\b\w/g, l => l.toUpperCase());
    setPendingResult({ title, content, format });
    return content;
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setPendingNav(null);
    setPendingResult(null);
    setLoading(true);

    const userMsg: AgentMessage = { id: uid(), role: "user", content: text, timestamp: nowIso() };
    dispatch({ type: "AGENT_MESSAGE_ADD", message: userMsg });

    try {
      let replyContent: string;

      if (isContentRequest(text)) {
        // Generate file content + store as pending result
        const content = await generateContent(text);
        const format = detectFormat(text);
        const meta = FORMAT_META[format];
        replyContent = `${meta.emoji} I've created your ${meta.label}! Tap **Save to Results** to keep it or **Download** to get the file. ✅`;
      } else {
        const raw = await parentAgentQuery(text, `${buildSystemPrompt()}\n\n${buildContext()}`);
        let parsed: AIResponse = { message: raw, actions: [] };
        try {
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]) as AIResponse;
        } catch {}
        const confirmations = executeActions(parsed.actions ?? []);
        replyContent = parsed.message;
        if (confirmations.length) replyContent += "\n\n✅ Done:\n" + confirmations.map(c => `• ${c}`).join("\n");
      }

      dispatch({ type: "AGENT_MESSAGE_ADD", message: { id: uid(), role: "assistant", content: replyContent, timestamp: nowIso() } });
    } catch {
      dispatch({ type: "AGENT_MESSAGE_ADD", message: { id: uid(), role: "assistant", content: "Sorry, I couldn't connect. Check your internet and API key in Settings.", timestamp: nowIso() } });
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
      createdAt: nowIso(),
      createdBy: "parent",
      prompt: messages[messages.length - 2]?.content,
    };
    dispatch({ type: "AI_RESULT_ADD", result });
    setPendingResult(null);
    dispatch({ type: "AGENT_MESSAGE_ADD", message: { id: uid(), role: "assistant", content: "✅ Saved to your AI Results! Tap the 📁 button to view it.", timestamp: nowIso() } });
  }

  function getInsights(): string[] {
    const out: string[] = [];
    state.kids.forEach(k => {
      const openChores = k.chores.filter(c => c.status === "open").length;
      if (openChores > 3) out.push(`📋 ${k.profile.name} has ${openChores} uncompleted chores`);
      if (k.streak.currentDays === 0 && k.streak.longestDays > 3) out.push(`🔥 ${k.profile.name}'s streak broke`);
      const pendingBorrow = (k.borrowRequests ?? []).filter(r => r.status === "pending").length;
      if (pendingBorrow > 0) out.push(`⏱️ ${k.profile.name} has a borrow time request`);
      const pendingReqs = (k.kidRequests ?? []).filter(r => r.status === "pending").length;
      if (pendingReqs > 0) out.push(`📩 ${k.profile.name} sent ${pendingReqs} request${pendingReqs > 1 ? "s" : ""}`);
      const mood = (k.moodEntries ?? [])[0];
      if (mood && mood.mood <= 2) out.push(`😢 ${k.profile.name} logged a low mood`);
    });
    return out.slice(0, 4);
  }

  const insights = getInsights();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      <ScreenContainer bg={Colors.bgLight}>
        {/* Header */}
        <View style={s.header}>
          <Text style={{ fontSize: 34 }}>🤖</Text>
          <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
            <Text style={s.title}>AI Family Assistant</Text>
            <Text style={s.sub}>Voice or type — I'll do it for you</Text>
          </View>
          {/* Results button */}
          <TouchableOpacity style={s.resultsBtn} onPress={() => router.push("/parent/(more)/ai-results" as any)}>
            <Text style={s.resultsBtnText}>📁</Text>
            {resultCount > 0 && <View style={s.resultsBadge}><Text style={s.resultsBadgeText}>{resultCount > 9 ? "9+" : resultCount}</Text></View>}
          </TouchableOpacity>
          {messages.length > 0 && (
            <TouchableOpacity onPress={() => { dispatch({ type: "AGENT_MESSAGES_CLEAR" }); setPendingResult(null); }} style={s.clearBtn}>
              <Text style={s.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Empty state */}
        {messages.length === 0 ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.xl }} showsVerticalScrollIndicator={false}>
            {insights.length > 0 && (
              <View style={s.insightsCard}>
                <Text style={s.insightsTitle}>🧠 Right Now</Text>
                {insights.map((insight, i) => (
                  <TouchableOpacity key={i} style={s.insightRow} onPress={() => send(`Tell me more about: ${insight}`)}>
                    <Text style={s.insightText}>{insight}</Text>
                    <Text style={s.insightArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={s.exTitle}>Try saying or typing…</Text>
            {EXAMPLE_GROUPS.map(group => (
              <View key={group.label} style={[s.exGroup, { backgroundColor: group.bg }]}>
                <Text style={[s.exGroupLabel, { color: group.color }]}>{group.label}</Text>
                <View style={s.exChips}>
                  {group.examples.map(ex => (
                    <TouchableOpacity key={ex} style={[s.exChip, { borderColor: group.color + "40" }]} onPress={() => send(ex)}>
                      <Text style={[s.exChipText, { color: group.color }]}>{ex}</Text>
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
              <View style={[s.bubble, item.role === "user" ? s.bubbleUser : s.bubbleBot]}>
                {item.role === "assistant" && <Text style={{ fontSize: 18, marginBottom: 4 }}>🤖</Text>}
                <Text style={[s.bubbleText, item.role === "user" ? s.bubbleTextUser : s.bubbleTextBot]}>
                  {item.content}
                </Text>
              </View>
            )}
          />
        )}

        {/* Pending result actions */}
        {pendingResult && (
          <View style={s.resultActions}>
            <View style={s.resultActionsRow}>
              <Text style={s.resultActionsTitle} numberOfLines={1}>
                {FORMAT_META[pendingResult.format].emoji} {pendingResult.title}
              </Text>
            </View>
            <View style={s.resultActionsRow}>
              <TouchableOpacity style={s.saveBtn} onPress={saveResult}>
                <Text style={s.saveBtnText}>💾 Save to Results</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dlBtn} onPress={() => downloadResult(pendingResult.title, pendingResult.content, pendingResult.format)}>
                <Text style={s.dlBtnText}>⬇️ Download</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dismissBtn} onPress={() => setPendingResult(null)}>
                <Text style={s.dismissBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Navigate button */}
        {pendingNav && (
          <TouchableOpacity style={s.navBtn} onPress={() => { router.push(pendingNav.path as any); setPendingNav(null); }}>
            <Text style={s.navBtnText}>{pendingNav.label} →</Text>
          </TouchableOpacity>
        )}

        {loading && (
          <View style={s.typing}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={s.typingText}>Working on it…</Text>
          </View>
        )}

        {/* Input */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Say or type a command…"
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline
            maxLength={300}
          />
          <MicButton appendTo={input} onAppend={setInput} onResult={txt => { setInput(txt); setTimeout(() => send(txt), 300); }} size={36} />
          <TouchableOpacity style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]} onPress={() => send()} disabled={loading || !input.trim()}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md, gap: 4 },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultsBtn: { position: "relative", width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  resultsBtnText: { fontSize: 20 },
  resultsBadge: { position: "absolute", top: -4, right: -4, backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  resultsBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  clearBtnText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },

  insightsCard: { backgroundColor: "#F0F9FF", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: "#BAE6FD" },
  insightsTitle: { fontSize: FontSize.sm, fontWeight: "700", color: "#0369A1", marginBottom: 8 },
  insightRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#E0F2FE" },
  insightText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  insightArrow: { color: Colors.primary, fontWeight: "700", marginLeft: 8 },

  exTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: Spacing.sm },
  exGroup: { borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  exGroupLabel: { fontSize: FontSize.sm, fontWeight: "800", marginBottom: 8 },
  exChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exChip: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff" },
  exChipText: { fontSize: FontSize.sm, fontWeight: "600" },

  bubble: { maxWidth: "88%", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8 },
  bubbleUser: { backgroundColor: Colors.primary, alignSelf: "flex-end" },
  bubbleBot: { backgroundColor: Colors.surfaceLight, alignSelf: "flex-start", ...Shadow.sm },
  bubbleText: { fontSize: FontSize.base, lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  bubbleTextBot: { color: Colors.textPrimary },

  resultActions: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8, borderWidth: 1, borderColor: Colors.primary + "30", gap: 8 },
  resultActionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultActionsTitle: { flex: 1, fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 9 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  dlBtn: { flex: 1, backgroundColor: Colors.cardLight, borderRadius: Radius.full, alignItems: "center", padding: 9 },
  dlBtnText: { color: Colors.textPrimary, fontWeight: "700", fontSize: FontSize.sm },
  dismissBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  dismissBtnText: { color: Colors.textSecondary, fontWeight: "700" },

  navBtn: { backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8, borderWidth: 1, borderColor: Colors.primary + "40", alignItems: "center" },
  navBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },

  typing: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, gap: 8 },
  typingText: { color: Colors.textSecondary, fontSize: FontSize.sm },

  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: Spacing.sm },
  input: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.sm, fontSize: FontSize.base, maxHeight: 100, backgroundColor: Colors.surfaceLight },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
});
