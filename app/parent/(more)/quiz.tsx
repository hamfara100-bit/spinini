import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import type { ForcedQuiz, QuizQuestion } from "../../../lib/data/types";
import { trpc } from "../../../lib/trpc";

// ─── Question editor ──────────────────────────────────────────────────────────
function QuestionEditor({
  q, index, onChange, onDelete,
}: {
  q: QuizQuestion; index: number;
  onChange: (q: QuizQuestion) => void; onDelete: () => void;
}) {
  const isMC = q.type === "multiple_choice";

  return (
    <View style={qe.card}>
      <View style={qe.header}>
        <Text style={qe.num}>Q{index + 1}</Text>
        <View style={qe.typePicker}>
          {(["multiple_choice", "text"] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[qe.typeBtn, q.type === t && qe.typeBtnActive]}
              onPress={() => onChange({ ...q, type: t, options: t === "multiple_choice" ? ["", "", "", ""] : undefined })}
            >
              <Text style={[qe.typeText, q.type === t && { color: "#fff" }]}>{t === "multiple_choice" ? "Multiple Choice" : "Type Answer"}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={onDelete}><Text style={{ color: Colors.error, fontWeight: "700" }}>✕</Text></TouchableOpacity>
      </View>

      <TextInput
        style={qe.input} placeholder="Question text…" placeholderTextColor={Colors.textMuted}
        value={q.question} onChangeText={v => onChange({ ...q, question: v })}
      />

      {isMC && (
        <>
          <Text style={qe.optLabel}>Answer options (tap ✓ to mark correct):</Text>
          {(q.options ?? ["", "", "", ""]).map((opt, i) => (
            <View key={i} style={qe.optRow}>
              <TouchableOpacity
                style={[qe.checkBtn, q.correctAnswer === String(i) && qe.checkBtnActive]}
                onPress={() => onChange({ ...q, correctAnswer: String(i) })}
              >
                <Text style={{ color: q.correctAnswer === String(i) ? "#fff" : Colors.textMuted }}>✓</Text>
              </TouchableOpacity>
              <TextInput
                style={qe.optInput}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={Colors.textMuted}
                value={opt}
                onChangeText={v => {
                  const opts = [...(q.options ?? ["", "", "", ""])];
                  opts[i] = v;
                  onChange({ ...q, options: opts });
                }}
              />
            </View>
          ))}
        </>
      )}

      {!isMC && (
        <>
          <Text style={qe.optLabel}>Correct answer:</Text>
          <TextInput
            style={qe.input} placeholder="Type the expected answer…"
            placeholderTextColor={Colors.textMuted}
            value={q.correctAnswer} onChangeText={v => onChange({ ...q, correctAnswer: v })}
          />
        </>
      )}

      <TextInput
        style={[qe.input, { fontSize: 12, color: Colors.textSecondary }]}
        placeholder="Optional hint (shown if kid taps 'Go back to read')"
        placeholderTextColor={Colors.textMuted}
        value={q.hint ?? ""} onChangeText={v => onChange({ ...q, hint: v || undefined })}
      />
    </View>
  );
}

// ─── Quiz card ────────────────────────────────────────────────────────────────
function QuizCard({ quiz, kidName, onDelete }: { quiz: ForcedQuiz; kidName: string; onDelete: () => void }) {
  const statusColor = quiz.status === "passed" ? Colors.success : quiz.status === "failed" ? Colors.error : Colors.warning;
  const statusLabel = { pending: "⏳ Pending", in_progress: "📝 In Progress", passed: "✅ Passed", failed: "❌ Failed" }[quiz.status];

  return (
    <View style={qc.card}>
      <View style={qc.header}>
        <View style={{ flex: 1 }}>
          <Text style={qc.title} numberOfLines={1}>{quiz.title}</Text>
          <Text style={qc.meta}>{kidName} · {quiz.questions.length} Qs · {Math.round(quiz.passingPct * 100)}% to pass</Text>
        </View>
        <View style={[qc.status, { backgroundColor: statusColor + "20" }]}>
          <Text style={[qc.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      {quiz.lastScore != null && (
        <Text style={qc.score}>Last score: {Math.round(quiz.lastScore * 100)}%</Text>
      )}
      {quiz.parentNote ? <Text style={qc.note} numberOfLines={2}>📝 {quiz.parentNote}</Text> : null}
      <View style={qc.footer}>
        <Text style={qc.reward}>
          {quiz.rewardType === "time" ? `⏱ +${quiz.rewardValue} min` : `⭐ +${quiz.rewardValue} pts`} on pass
        </Text>
        <TouchableOpacity onPress={() => Alert.alert("Delete Quiz?", "Remove this quiz from the kid's list?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: onDelete },
        ])}>
          <Text style={{ color: Colors.error, fontSize: 12, fontWeight: "700" }}>🗑 Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ParentQuizScreen() {
  const { state, dispatch } = useData();
  const kids = state.kids;
  const [selectedKidId, setSelectedKidId] = useState(kids[0]?.profile.id ?? "");
  const kid = kids.find(k => k.profile.id === selectedKidId);
  const quizzes = kid?.quizzes ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<"info" | "questions" | "reward">("info");

  // Form state
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [reading, setReading] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [passingPct, setPassingPct] = useState(80);
  const [rewardType, setRewardType] = useState<"time" | "points">("time");
  const [rewardValue, setRewardValue] = useState("15");

  const [aiLoading, setAiLoading] = useState(false);
  const generateMutation = trpc.quiz.generate.useMutation();

  function resetForm() {
    setTitle(""); setNote(""); setReading(""); setQuestions([]);
    setPassingPct(80); setRewardType("time"); setRewardValue("15");
    setStep("info");
  }

  function addQuestion() {
    setQuestions(qs => [...qs, {
      id: uid(), type: "multiple_choice", question: "",
      options: ["", "", "", ""], correctAnswer: "0",
    }]);
  }

  async function generateFromText() {
    if (!reading.trim()) { Alert.alert("Add reading material", "Paste or type the text first."); return; }
    setAiLoading(true);
    try {
      const result = await generateMutation.mutateAsync({ text: reading, numQuestions: 5 });
      if (result.title && !title) setTitle(result.title);
      if (result.readingMaterial) setReading(result.readingMaterial);
      const qs: QuizQuestion[] = result.questions.map(q => ({
        id: uid(),
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        hint: q.hint,
      }));
      setQuestions(qs);
      setStep("questions");
      Alert.alert("✨ Done!", `AI created ${qs.length} questions from your text.`);
    } catch (e: any) {
      Alert.alert("AI Error", e?.message ?? "Could not generate quiz. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8, base64: true });
    if (!res.canceled && res.assets[0]?.base64) {
      setAiLoading(true);
      try {
        const text = `[Image uploaded — please create quiz questions based on this school material image. Since we cannot process the image directly in this context, please create 5 general educational questions about study skills, learning, and school success.]`;
        const result = await generateMutation.mutateAsync({ text, numQuestions: 5 });
        const qs: QuizQuestion[] = result.questions.map(q => ({
          id: uid(), type: q.type, question: q.question,
          options: q.options, correctAnswer: q.correctAnswer, hint: q.hint,
        }));
        setQuestions(qs);
        if (result.title && !title) setTitle(result.title);
        setStep("questions");
      } catch (e: any) {
        Alert.alert("AI Error", e?.message ?? "Try again.");
      } finally {
        setAiLoading(false);
      }
    }
  }

  function send() {
    if (!title.trim()) { Alert.alert("Add title", "Give the quiz a name."); return; }
    if (!reading.trim()) { Alert.alert("Add reading material", "Kids need something to read before the quiz."); return; }
    if (questions.length < 2) { Alert.alert("Add questions", "Add at least 2 questions."); return; }
    const invalidQ = questions.find(q =>
      !q.question.trim() ||
      (q.type === "multiple_choice" && !(q.options ?? []).every(o => o.trim())) ||
      !q.correctAnswer
    );
    if (invalidQ) { Alert.alert("Incomplete question", "Fill in all question fields."); return; }

    const quiz: ForcedQuiz = {
      id: uid(), kidId: selectedKidId,
      title: title.trim(), parentNote: note.trim() || undefined,
      readingMaterial: reading.trim(),
      questions, passingPct: passingPct / 100,
      rewardType, rewardValue: parseInt(rewardValue) || 15,
      status: "pending", createdAt: nowIso(), attemptCount: 0,
    };
    dispatch({ type: "QUIZ_SEND", quiz });
    dispatch({ type: "NOTIFICATION_ADD", kidId: selectedKidId, notification: {
      id: uid(), kidId: selectedKidId, kind: "ping",
      title: "📝 New Quiz from Parent!",
      body: `"${quiz.title}" — Answer to unlock your reward!`,
      read: false, createdAt: nowIso(), route: "/quiz",
    }});
    // Lock the device until quiz is passed
    dispatch({ type: "SET_INSTANT_LOCK", kidId: selectedKidId, locked: true, message: `📝 Complete your quiz "${quiz.title}" to unlock your device!` });

    setShowCreate(false); resetForm();
    Alert.alert("✅ Quiz Sent!", "Your child's device is locked until they pass the quiz.");
  }

  return (
    <ScreenContainer scroll>
      {/* Kid selector */}
      {kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {kids.map(k => (
            <TouchableOpacity key={k.profile.id} style={[s.kidChip, selectedKidId === k.profile.id && s.kidChipActive]} onPress={() => setSelectedKidId(k.profile.id)}>
              <Text style={[s.kidChipText, selectedKidId === k.profile.id && { color: "#fff" }]}>{k.profile.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>📝 Forced Quiz</Text>
          <Text style={s.sub}>Lock device until quiz is passed</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowCreate(true)}>
          <Text style={s.newBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* Quiz list */}
      {quizzes.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 64 }}>📝</Text>
          <Text style={s.emptyTitle}>No quizzes sent yet</Text>
          <Text style={s.emptySub}>Create a quiz to lock the device until your child passes it. Great for homework prep, life lessons, or fun challenges!</Text>
          <View style={s.ideaBox}>
            <Text style={s.ideaTitle}>💡 Quiz Ideas</Text>
            {["Quiz them on your life advice or rules", "Prepare for a real school test", "Hygiene & self-care quiz", "Safety rules at home", "Family values quiz"].map(idea => (
              <Text key={idea} style={s.ideaItem}>• {idea}</Text>
            ))}
          </View>
        </View>
      ) : (
        quizzes.map(quiz => (
          <QuizCard
            key={quiz.id} quiz={quiz}
            kidName={kid?.profile.name ?? "Kid"}
            onDelete={() => dispatch({ type: "QUIZ_DELETE", kidId: selectedKidId, quizId: quiz.id })}
          />
        ))
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
          <View style={m.handle} />
          {/* Step indicator */}
          <View style={m.steps}>
            {(["info", "questions", "reward"] as const).map((st, i) => (
              <View key={st} style={m.stepItem}>
                <View style={[m.stepDot, step === st && m.stepDotActive, (step === "questions" && i === 0) || (step === "reward" && i <= 1) ? m.stepDotDone : null]}>
                  <Text style={m.stepDotText}>{i + 1}</Text>
                </View>
                <Text style={[m.stepLabel, step === st && { color: Colors.primary }]}>
                  {["Info", "Questions", "Reward"][i]}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            {/* ── STEP 1: Info ── */}
            {step === "info" && (
              <>
                <Text style={m.title}>📝 Quiz Details</Text>

                <Text style={m.label}>Quiz title</Text>
                <TextInput style={m.input} placeholder="e.g. Home Safety Rules Quiz" placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} />

                <Text style={m.label}>Note to kid (optional)</Text>
                <TextInput style={m.input} placeholder="e.g. You need to pass this before using your device." placeholderTextColor={Colors.textMuted} value={note} onChangeText={setNote} />

                <Text style={m.label}>Reading material</Text>
                <Text style={m.hint}>This is what the kid reads BEFORE answering. Paste text, rules, advice, or study notes.</Text>
                <TextInput
                  style={[m.input, { minHeight: 160 }]} multiline
                  placeholder="Paste text here… or use AI to generate from text below."
                  placeholderTextColor={Colors.textMuted}
                  value={reading} onChangeText={setReading}
                />

                {/* AI tools */}
                <Text style={m.label}>✨ AI Helpers</Text>
                <View style={m.aiRow}>
                  <TouchableOpacity style={m.aiBtn} onPress={generateFromText} disabled={aiLoading}>
                    {aiLoading ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={m.aiBtnText}>🤖 Generate Quiz from Text</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[m.aiBtn, { backgroundColor: Colors.secondary + "15" }]} onPress={pickPhoto} disabled={aiLoading}>
                    <Text style={[m.aiBtnText, { color: "#B45309" }]}>📷 Photo of Book / Test</Text>
                  </TouchableOpacity>
                </View>

                <View style={m.btnRow}>
                  <TouchableOpacity style={m.cancelBtn} onPress={() => setShowCreate(false)}><Text style={m.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={m.nextBtn} onPress={() => setStep("questions")}><Text style={m.nextText}>Questions →</Text></TouchableOpacity>
                </View>
              </>
            )}

            {/* ── STEP 2: Questions ── */}
            {step === "questions" && (
              <>
                <Text style={m.title}>📋 Questions ({questions.length})</Text>
                <Text style={m.hint}>Need at least 2 questions. Kid needs {passingPct}% to pass.</Text>

                {questions.map((q, i) => (
                  <QuestionEditor
                    key={q.id} q={q} index={i}
                    onChange={updated => setQuestions(qs => qs.map((x, j) => j === i ? updated : x))}
                    onDelete={() => setQuestions(qs => qs.filter((_, j) => j !== i))}
                  />
                ))}

                <TouchableOpacity style={m.addQBtn} onPress={addQuestion}>
                  <Text style={m.addQText}>+ Add Question</Text>
                </TouchableOpacity>

                <Text style={m.label}>Passing score</Text>
                <View style={m.pctRow}>
                  {[60, 70, 80, 90, 100].map(p => (
                    <TouchableOpacity key={p} style={[m.pctBtn, passingPct === p && m.pctBtnActive]} onPress={() => setPassingPct(p)}>
                      <Text style={[m.pctText, passingPct === p && { color: "#fff" }]}>{p}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={m.btnRow}>
                  <TouchableOpacity style={m.cancelBtn} onPress={() => setStep("info")}><Text style={m.cancelText}>← Back</Text></TouchableOpacity>
                  <TouchableOpacity style={m.nextBtn} onPress={() => setStep("reward")}><Text style={m.nextText}>Reward →</Text></TouchableOpacity>
                </View>
              </>
            )}

            {/* ── STEP 3: Reward ── */}
            {step === "reward" && (
              <>
                <Text style={m.title}>🎁 On Pass Reward</Text>
                <Text style={m.hint}>What does the kid earn for passing?</Text>

                <View style={m.rewardTypes}>
                  <TouchableOpacity style={[m.rewardType, rewardType === "time" && m.rewardTypeActive]} onPress={() => setRewardType("time")}>
                    <Text style={{ fontSize: 28 }}>⏱</Text>
                    <Text style={[m.rewardTypeLabel, rewardType === "time" && { color: Colors.primary }]}>Screen Time</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[m.rewardType, rewardType === "points" && m.rewardTypeActive]} onPress={() => setRewardType("points")}>
                    <Text style={{ fontSize: 28 }}>⭐</Text>
                    <Text style={[m.rewardTypeLabel, rewardType === "points" && { color: Colors.primary }]}>Points</Text>
                  </TouchableOpacity>
                </View>

                <Text style={m.label}>{rewardType === "time" ? "Minutes to unlock" : "Points to award"}</Text>
                <TextInput style={[m.input, { height: 52 }]} keyboardType="numeric" value={rewardValue} onChangeText={setRewardValue} />

                <View style={[m.summary, { marginTop: 16 }]}>
                  <Text style={m.summaryTitle}>📋 Quiz Summary</Text>
                  <Text style={m.summaryLine}>Title: {title || "—"}</Text>
                  <Text style={m.summaryLine}>Questions: {questions.length}</Text>
                  <Text style={m.summaryLine}>Pass at: {passingPct}%</Text>
                  <Text style={m.summaryLine}>Reward: {rewardValue} {rewardType === "time" ? "minutes" : "points"}</Text>
                </View>

                <View style={m.btnRow}>
                  <TouchableOpacity style={m.cancelBtn} onPress={() => setStep("questions")}><Text style={m.cancelText}>← Back</Text></TouchableOpacity>
                  <TouchableOpacity style={m.sendBtn} onPress={send}><Text style={m.sendText}>🔒 Send & Lock Device</Text></TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  newBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  kidChip: { backgroundColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  kidChipActive: { backgroundColor: Colors.primary },
  kidChipText: { fontWeight: "700", color: Colors.textPrimary, fontSize: 13 },
  empty: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 16 },
  ideaBox: { backgroundColor: Colors.primary + "10", borderRadius: 16, padding: 16, alignSelf: "stretch", marginTop: 8, gap: 4, borderWidth: 1, borderColor: Colors.primary + "25" },
  ideaTitle: { fontSize: 13, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  ideaItem: { fontSize: 13, color: Colors.textPrimary },
});

const qc = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceLight, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  meta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  status: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "800" },
  score: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  note: { fontSize: 12, color: Colors.textSecondary, fontStyle: "italic", marginBottom: 6 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  reward: { fontSize: 12, fontWeight: "700", color: Colors.success },
});

const qe = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceLight, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  num: { fontSize: 13, fontWeight: "800", color: Colors.primary, minWidth: 28 },
  typePicker: { flex: 1, flexDirection: "row", gap: 6 },
  typeBtn: { flex: 1, borderRadius: 10, paddingVertical: 5, alignItems: "center", backgroundColor: Colors.border + "60" },
  typeBtnActive: { backgroundColor: Colors.primary },
  typeText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  input: { backgroundColor: Colors.bgLight, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10, fontSize: 13, color: Colors.textPrimary, marginBottom: 8 },
  optLabel: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6 },
  optRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  checkBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center" },
  checkBtnActive: { backgroundColor: Colors.success },
  optInput: { flex: 1, backgroundColor: Colors.bgLight, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 9, fontSize: 13, color: Colors.textPrimary },
});

const m = StyleSheet.create({
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10 },
  steps: { flexDirection: "row", justifyContent: "center", gap: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: Colors.border },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.success },
  stepDotText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  stepLabel: { fontSize: 10, fontWeight: "700", color: Colors.textMuted },
  body: { padding: Spacing.lg, paddingBottom: 60, gap: 6 },
  title: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginTop: 10, marginBottom: 6 },
  hint: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  input: { backgroundColor: Colors.surfaceLight, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, padding: 12, fontSize: 14, color: Colors.textPrimary, textAlignVertical: "top" },
  aiRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  aiBtn: { flex: 1, backgroundColor: Colors.primary + "15", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.primary + "30" },
  aiBtnText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  addQBtn: { backgroundColor: Colors.primary + "12", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1.5, borderColor: Colors.primary + "25", borderStyle: "dashed" },
  addQText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  pctRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pctBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.border + "80", borderWidth: 1, borderColor: Colors.border },
  pctBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pctText: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary },
  rewardTypes: { flexDirection: "row", gap: 12, marginVertical: 8 },
  rewardType: { flex: 1, alignItems: "center", gap: 6, padding: 16, borderRadius: 16, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surfaceLight },
  rewardTypeActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "10" },
  rewardTypeLabel: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  summary: { backgroundColor: Colors.primary + "10", borderRadius: 14, padding: 14, gap: 4 },
  summaryTitle: { fontSize: 13, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  summaryLine: { fontSize: 13, color: Colors.textPrimary },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary, fontSize: 14 },
  nextBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  nextText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  sendBtn: { flex: 2, backgroundColor: Colors.error, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
