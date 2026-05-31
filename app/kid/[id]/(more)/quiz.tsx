import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated, Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { ForcedQuiz, QuizQuestion } from "../../../../lib/data/types";

// ─── Quiz phases ──────────────────────────────────────────────────────────────
type Phase = "list" | "read" | "quiz" | "result" | "help";

// ─── Reading phase ────────────────────────────────────────────────────────────
function ReadingPhase({ quiz, onReady }: { quiz: ForcedQuiz; onReady: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={rp.header}>
        <Text style={rp.emoji}>📖</Text>
        <Text style={rp.title}>Read Carefully</Text>
        <Text style={rp.sub}>Read everything before you answer the quiz.</Text>
        {quiz.parentNote ? (
          <View style={rp.noteBubble}>
            <Text style={rp.noteLabel}>💬 Note from parent:</Text>
            <Text style={rp.noteText}>{quiz.parentNote}</Text>
          </View>
        ) : null}
      </View>
      <ScrollView style={rp.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={rp.material}>{quiz.readingMaterial}</Text>
      </ScrollView>
      <View style={rp.footer}>
        <TouchableOpacity style={rp.readyBtn} onPress={onReady}>
          <Text style={rp.readyText}>✅ I'm Ready to Answer!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Single question ──────────────────────────────────────────────────────────
function QuestionView({
  q, answer, onAnswer, onGoBack, index, total,
}: {
  q: QuizQuestion; answer: string | undefined;
  onAnswer: (a: string) => void; onGoBack: () => void;
  index: number; total: number;
}) {
  const isMC = q.type === "multiple_choice";
  const [typed, setTyped] = useState(answer ?? "");
  const progress = (index / total);

  return (
    <View style={{ flex: 1 }}>
      {/* Progress */}
      <View style={qv.progressBar}>
        <View style={[qv.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
      </View>
      <Text style={qv.counter}>Question {index + 1} of {total}</Text>

      <ScrollView contentContainerStyle={qv.body}>
        <View style={qv.qCard}>
          <Text style={qv.qText}>{q.question}</Text>
        </View>

        {isMC ? (
          <View style={qv.options}>
            {(q.options ?? []).map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[qv.optBtn, answer === String(i) && qv.optBtnSelected]}
                onPress={() => onAnswer(String(i))}
                activeOpacity={0.8}
              >
                <View style={[qv.optLetter, answer === String(i) && { backgroundColor: Colors.primary }]}>
                  <Text style={[qv.optLetterText, answer === String(i) && { color: "#fff" }]}>
                    {["A", "B", "C", "D"][i]}
                  </Text>
                </View>
                <Text style={[qv.optText, answer === String(i) && { color: Colors.primary, fontWeight: "800" }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={qv.textInputWrap}>
            <TextInput
              style={qv.textInput}
              placeholder="Type your answer here…"
              placeholderTextColor={Colors.textMuted}
              multiline
              value={typed}
              onChangeText={v => { setTyped(v); onAnswer(v); }}
            />
          </View>
        )}

        {q.hint ? (
          <TouchableOpacity style={qv.hintBtn} onPress={onGoBack}>
            <Text style={qv.hintText}>💡 Stuck? Go back to read (hint: {q.hint})</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={qv.goBackBtn} onPress={onGoBack}>
            <Text style={qv.goBackText}>📖 Go back to re-read</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Result ───────────────────────────────────────────────────────────────────
function ResultView({
  quiz, score, passed, onRetry, onDismiss,
}: {
  quiz: ForcedQuiz; score: number; passed: boolean;
  onRetry: () => void; onDismiss: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, damping: 10, stiffness: 180, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl }}>
      <Animated.View style={[rv.card, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={rv.emoji}>{passed ? "🎉" : "😔"}</Text>
        <Text style={rv.title}>{passed ? "You Passed!" : "Not Yet…"}</Text>
        <Text style={rv.score}>{Math.round(score * 100)}%</Text>
        <Text style={rv.scoreLabel}>your score</Text>
        <View style={rv.bar}>
          <View style={[rv.barFill, { width: `${Math.round(score * 100)}%` as any, backgroundColor: passed ? Colors.success : Colors.error }]} />
          <View style={[rv.barMark, { left: `${Math.round(quiz.passingPct * 100)}%` as any }]} />
        </View>
        <Text style={rv.need}>Need {Math.round(quiz.passingPct * 100)}% to pass</Text>
        {passed ? (
          <>
            <View style={rv.reward}>
              <Text style={rv.rewardText}>
                {quiz.rewardType === "time"
                  ? `⏱ +${quiz.rewardValue} minutes of screen time unlocked!`
                  : `⭐ +${quiz.rewardValue} points earned!`}
              </Text>
            </View>
            <TouchableOpacity style={[rv.btn, { backgroundColor: Colors.success }]} onPress={onDismiss}>
              <Text style={rv.btnText}>🎉 Awesome! Keep Going</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={rv.tryAgain}>Go back and read more carefully, then try again!</Text>
            <TouchableOpacity style={[rv.btn, { backgroundColor: Colors.primary }]} onPress={onRetry}>
              <Text style={rv.btnText}>📖 Read Again & Retry</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Help tab ─────────────────────────────────────────────────────────────────
function HelpView({ onClose }: { onClose: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40, gap: 14 }}>
      <Text style={hp.title}>❓ What is the Quiz?</Text>
      <Text style={hp.body}>
        Sometimes your parent sends you a quiz to complete before you can use your device. It might feel tough, but it's their way of teaching you something important!
      </Text>
      <Text style={hp.sectionTitle}>📖 How It Works</Text>
      {[
        ["1. Read first", "You'll get some reading material. Read it carefully — the answers are in there!"],
        ["2. Answer questions", "Multiple choice or type-in questions. Take your time."],
        ["3. Go back anytime", "If you're stuck, tap 'Go back to read' — your answers are saved."],
        ["4. Submit when ready", "Submit once you've answered everything."],
        ["5. Pass to unlock", "Get enough correct and your device unlocks with a bonus reward!"],
      ].map(([t, d]) => (
        <View key={t} style={hp.item}>
          <Text style={hp.itemTitle}>{t}</Text>
          <Text style={hp.itemDesc}>{d}</Text>
        </View>
      ))}
      <Text style={hp.sectionTitle}>💡 Great Quiz Ideas Parents Use</Text>
      {[
        "Family rules & values",
        "Their best life advice turned into questions",
        "School test practice from a textbook photo",
        "Hygiene & self-care quiz",
        "Home safety & emergency rules",
        "Money & saving quiz",
        "Kindness & friendship lessons",
      ].map(idea => <Text key={idea} style={hp.bullet}>• {idea}</Text>)}
      <TouchableOpacity style={{ backgroundColor: Colors.primary, borderRadius: 20, padding: 14, alignItems: "center", marginTop: 16 }} onPress={onClose}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Got it! 👍</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KidQuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);
  const { dispatch } = useData();

  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("list");
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [passed, setPassed] = useState(false);

  if (!kid) return null;
  const quizzes = kid.quizzes ?? [];
  const pendingQuizzes = quizzes.filter(q => q.status === "pending" || q.status === "in_progress");
  const doneQuizzes = quizzes.filter(q => q.status === "passed" || q.status === "failed");

  const activeQuiz = quizzes.find(q => q.id === activeQuizId);

  function openQuiz(quiz: ForcedQuiz) {
    setActiveQuizId(quiz.id);
    setAnswers(quiz.kidAnswers ?? {});
    setQuestionIdx(quiz.currentQuestionIndex ?? 0);
    setPhase("read");
    if (quiz.status === "pending") {
      dispatch({ type: "QUIZ_UPDATE", kidId: id, quizId: quiz.id, patch: { status: "in_progress" } });
    }
  }

  function saveProgress() {
    if (!activeQuiz) return;
    dispatch({ type: "QUIZ_UPDATE", kidId: id, quizId: activeQuiz.id, patch: { kidAnswers: answers, currentQuestionIndex: questionIdx } });
  }

  function goBackToRead() {
    saveProgress();
    setPhase("read");
  }

  function submitQuiz() {
    if (!activeQuiz) return;
    const questions = activeQuiz.questions;
    let correct = 0;
    for (const q of questions) {
      const given = answers[q.id] ?? "";
      if (q.type === "multiple_choice") {
        if (given === q.correctAnswer) correct++;
      } else {
        if (given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) correct++;
      }
    }
    const score = questions.length > 0 ? correct / questions.length : 0;
    const didPass = score >= activeQuiz.passingPct;
    setLastScore(score);
    setPassed(didPass);

    dispatch({ type: "QUIZ_UPDATE", kidId: id, quizId: activeQuiz.id, patch: {
      status: didPass ? "passed" : "failed",
      lastScore: score, completedAt: nowIso(),
      attemptCount: activeQuiz.attemptCount + 1,
      kidAnswers: answers,
    }});

    if (didPass) {
      // Grant reward + unlock device
      if (activeQuiz.rewardType === "time") {
        dispatch({ type: "BANK_DELTA", kidId: id, delta: activeQuiz.rewardValue, reason: `📝 Quiz passed: "${activeQuiz.title}"` });
      } else {
        dispatch({ type: "BEHAVIOR_ADD_EVENT", kidId: id, event: {
          id: uid(), points: activeQuiz.rewardValue, reason: `📝 Quiz passed: "${activeQuiz.title}"`, date: new Date().toISOString().slice(0, 10),
        }});
      }
      dispatch({ type: "SET_INSTANT_LOCK", kidId: id, locked: false });
    }

    setPhase("result");
  }

  // If viewing a quiz
  if (activeQuiz && phase !== "list") {
    if (phase === "read") return (
      <ScreenContainer bg="#F0F4FF">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <TouchableOpacity onPress={() => { saveProgress(); setPhase("list"); setActiveQuizId(null); }}>
            <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted }}>{activeQuiz.title}</Text>
        </View>
        <ReadingPhase quiz={activeQuiz} onReady={() => { setQuestionIdx(0); setPhase("quiz"); }} />
      </ScreenContainer>
    );

    if (phase === "quiz" && activeQuiz.questions[questionIdx]) {
      const q = activeQuiz.questions[questionIdx];
      const isLast = questionIdx === activeQuiz.questions.length - 1;
      return (
        <ScreenContainer bg="#F0F4FF">
          <QuestionView
            q={q}
            answer={answers[q.id]}
            index={questionIdx}
            total={activeQuiz.questions.length}
            onAnswer={a => setAnswers(prev => ({ ...prev, [q.id]: a }))}
            onGoBack={goBackToRead}
          />
          <View style={qv.navRow}>
            {questionIdx > 0 && (
              <TouchableOpacity style={qv.prevBtn} onPress={() => setQuestionIdx(i => i - 1)}>
                <Text style={qv.prevText}>← Prev</Text>
              </TouchableOpacity>
            )}
            {isLast ? (
              <TouchableOpacity style={qv.submitBtn} onPress={submitQuiz}>
                <Text style={qv.submitText}>Submit Quiz ✓</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={qv.nextBtn} onPress={() => setQuestionIdx(i => i + 1)}>
                <Text style={qv.nextText}>Next →</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScreenContainer>
      );
    }

    if (phase === "result") return (
      <ScreenContainer>
        <ResultView
          quiz={activeQuiz}
          score={lastScore ?? 0}
          passed={passed}
          onRetry={() => { setQuestionIdx(0); setAnswers({}); setPhase("read"); }}
          onDismiss={() => { setPhase("list"); setActiveQuizId(null); }}
        />
      </ScreenContainer>
    );
  }

  // Help phase
  if (phase === "help") return (
    <ScreenContainer scroll>
      <HelpView onClose={() => setPhase("list")} />
    </ScreenContainer>
  );

  // List
  return (
    <ScreenContainer scroll>
      <View style={ls.header}>
        <Text style={ls.title}>📝 My Quizzes</Text>
        <TouchableOpacity style={ls.helpBtn} onPress={() => setPhase("help")}>
          <Text style={ls.helpText}>❓ Help</Text>
        </TouchableOpacity>
      </View>

      {pendingQuizzes.length === 0 && doneQuizzes.length === 0 ? (
        <View style={ls.empty}>
          <Text style={{ fontSize: 64 }}>📝</Text>
          <Text style={ls.emptyTitle}>No quizzes right now</Text>
          <Text style={ls.emptySub}>When your parent sends a quiz, it will appear here.</Text>
        </View>
      ) : (
        <>
          {pendingQuizzes.length > 0 && (
            <>
              <Text style={ls.sectionLabel}>⏳ Waiting for You</Text>
              {pendingQuizzes.map(quiz => (
                <TouchableOpacity key={quiz.id} style={ls.quizCard} onPress={() => openQuiz(quiz)} activeOpacity={0.85}>
                  <View style={ls.quizLeft}>
                    <Text style={ls.quizEmoji}>📝</Text>
                    <View>
                      <Text style={ls.quizTitle}>{quiz.title}</Text>
                      <Text style={ls.quizMeta}>{quiz.questions.length} questions · Need {Math.round(quiz.passingPct * 100)}%</Text>
                      {quiz.parentNote ? <Text style={ls.quizNote} numberOfLines={1}>"{quiz.parentNote}"</Text> : null}
                    </View>
                  </View>
                  <View style={ls.quizReward}>
                    <Text style={ls.quizRewardText}>
                      {quiz.rewardType === "time" ? `+${quiz.rewardValue}m` : `+${quiz.rewardValue}⭐`}
                    </Text>
                    <Text style={{ fontSize: 18 }}>→</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {doneQuizzes.length > 0 && (
            <>
              <Text style={ls.sectionLabel}>✅ Completed</Text>
              {doneQuizzes.map(quiz => (
                <View key={quiz.id} style={[ls.quizCard, { opacity: 0.7 }]}>
                  <View style={ls.quizLeft}>
                    <Text style={ls.quizEmoji}>{quiz.status === "passed" ? "✅" : "❌"}</Text>
                    <View>
                      <Text style={ls.quizTitle}>{quiz.title}</Text>
                      <Text style={ls.quizMeta}>{quiz.status === "passed" ? "Passed" : "Failed"} · {Math.round((quiz.lastScore ?? 0) * 100)}%</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ls = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  helpBtn: { backgroundColor: Colors.primary + "15", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  helpText: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: Colors.textMuted, letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  quizCard: { backgroundColor: Colors.surfaceLight, borderRadius: 18, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...Shadow.sm, borderWidth: 1.5, borderColor: Colors.primary + "25" },
  quizLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  quizEmoji: { fontSize: 30 },
  quizTitle: { fontSize: 14, fontWeight: "800", color: Colors.textPrimary },
  quizMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  quizNote: { fontSize: 11, color: Colors.textMuted, fontStyle: "italic", marginTop: 2 },
  quizReward: { alignItems: "center", gap: 2 },
  quizRewardText: { fontSize: 14, fontWeight: "800", color: Colors.success },
});

const rp = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 8, paddingBottom: 16, gap: 4 },
  emoji: { fontSize: 40 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 13, color: Colors.textSecondary },
  noteBubble: { backgroundColor: Colors.primary + "12", borderRadius: 14, padding: 12, marginTop: 8, alignSelf: "stretch" },
  noteLabel: { fontSize: 11, fontWeight: "700", color: Colors.primary, marginBottom: 4 },
  noteText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  scroll: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: 16, marginHorizontal: 0 },
  material: { fontSize: 15, color: Colors.textPrimary, lineHeight: 26, padding: 16 },
  footer: { paddingTop: 16 },
  readyBtn: { backgroundColor: Colors.success, borderRadius: 50, paddingVertical: 16, alignItems: "center" },
  readyText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

const qv = StyleSheet.create({
  progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  counter: { fontSize: 12, fontWeight: "700", color: Colors.textMuted, textAlign: "center", marginBottom: 12 },
  body: { paddingBottom: 20 },
  qCard: { backgroundColor: Colors.primary + "12", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: Colors.primary + "25" },
  qText: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary, lineHeight: 24 },
  options: { gap: 10 },
  optBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: Colors.border, ...Shadow.sm },
  optBtnSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  optLetter: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center" },
  optLetterText: { fontSize: 13, fontWeight: "800", color: Colors.textPrimary },
  optText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  textInputWrap: { backgroundColor: Colors.surfaceLight, borderRadius: 16, borderWidth: 2, borderColor: Colors.border, padding: 14 },
  textInput: { fontSize: 15, color: Colors.textPrimary, minHeight: 80, textAlignVertical: "top" },
  hintBtn: { backgroundColor: Colors.warning + "15", borderRadius: 12, padding: 12, marginTop: 12 },
  hintText: { fontSize: 12, color: "#92400E", fontWeight: "600", lineHeight: 18 },
  goBackBtn: { backgroundColor: Colors.primary + "10", borderRadius: 12, padding: 12, marginTop: 12, alignItems: "center" },
  goBackText: { fontSize: 13, color: Colors.primary, fontWeight: "700" },
  navRow: { flexDirection: "row", gap: 10, paddingTop: 12 },
  prevBtn: { flex: 1, backgroundColor: Colors.border + "60", borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  prevText: { fontWeight: "700", color: Colors.textSecondary, fontSize: 14 },
  nextBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  nextText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  submitBtn: { flex: 2, backgroundColor: Colors.success, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

const rv = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceLight, borderRadius: 28, padding: 28, alignItems: "center", gap: 8, width: "100%", ...Shadow.md },
  emoji: { fontSize: 64, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "900", color: Colors.textPrimary },
  score: { fontSize: 56, fontWeight: "900", color: Colors.primary },
  scoreLabel: { fontSize: 13, color: Colors.textMuted, marginTop: -8 },
  bar: { width: "100%", height: 12, backgroundColor: Colors.border, borderRadius: 6, overflow: "visible", position: "relative", marginVertical: 10 },
  barFill: { height: 12, borderRadius: 6 },
  barMark: { position: "absolute", top: -4, width: 3, height: 20, backgroundColor: Colors.textPrimary, borderRadius: 2 },
  need: { fontSize: 12, color: Colors.textMuted, marginTop: -4 },
  reward: { backgroundColor: Colors.success + "18", borderRadius: 14, padding: 14, width: "100%", borderWidth: 1.5, borderColor: Colors.success + "40" },
  rewardText: { fontSize: 14, fontWeight: "700", color: Colors.success, textAlign: "center" },
  tryAgain: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 18 },
  btn: { borderRadius: 50, paddingVertical: 14, paddingHorizontal: 28, alignItems: "center", width: "100%", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

const hp = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", color: Colors.primary, marginBottom: 8 },
  body: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary, marginTop: 8 },
  item: { backgroundColor: Colors.surfaceLight, borderRadius: 14, padding: 14, gap: 4, ...Shadow.sm },
  itemTitle: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  itemDesc: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  bullet: { fontSize: 13, color: Colors.textPrimary },
});
