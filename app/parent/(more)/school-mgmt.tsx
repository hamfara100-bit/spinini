import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Modal, Alert, Image,
} from "react-native";
import * as Notifications from "expo-notifications";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import { PointsInput } from "../../../components/points-input";
import {
  GradeValue, GRADE_COLOR, GRADE_POINTS, ClassGrade, ReadingBook,
} from "../../../lib/data/types";

async function scheduleHomeworkNotification(title: string, subject: string, kidName: string, dueDateStr: string) {
  try {
    // Check permission before attempting to schedule
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      // Try to request if not yet determined
      if (status === "undetermined") {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== "granted") return;
      } else {
        return; // denied — skip silently
      }
    }

    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) return;
    // Notify at 8 AM the day before
    const notifyDate = new Date(dueDate);
    notifyDate.setDate(notifyDate.getDate() - 1);
    notifyDate.setHours(8, 0, 0, 0);
    if (notifyDate <= new Date()) return; // already past
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📝 Homework due tomorrow`,
        body: `${kidName}'s ${subject} assignment "${title}" is due tomorrow!`,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: notifyDate },
    });
  } catch {}
}

const GRADES: GradeValue[] = ["A+","A","A-","B+","B","B-","C+","C","C-","D","F"];
const GRADE_EMOJI: Record<GradeValue, string> = {
  "A+": "🌟", "A": "⭐", "A-": "✨",
  "B+": "👍", "B": "👌", "B-": "📘",
  "C+": "📙", "C": "📒", "C-": "📓",
  "D": "📉", "F": "❌",
};

const SUBJECTS = ["Math","Science","English","History","Art","PE","Music","Foreign Language","Technology","Other"];
const PERIODS  = ["Q1 2025","Q2 2025","Q3 2026","Q4 2026","Spring Semester","Fall Semester","Year 2026"];

// Reward bonus for top grades (Time Bank minutes)
const GRADE_REWARD: Partial<Record<GradeValue, { label: string; minutes: number }>> = {
  "A+": { label: "30 min bonus", minutes: 30 },
  "A":  { label: "20 min bonus", minutes: 20 },
  "A-": { label: "15 min bonus", minutes: 15 },
  "B+": { label: "10 min bonus", minutes: 10 },
  "B":  { label: "5 min bonus",  minutes: 5  },
};

function gradeGpa(g: GradeValue): number {
  const map: Record<GradeValue, number> = {
    "A+": 4.0,"A": 4.0,"A-": 3.7,"B+": 3.3,"B": 3.0,"B-": 2.7,
    "C+": 2.3,"C": 2.0,"C-": 1.7,"D": 1.0,"F": 0.0,
  };
  return map[g];
}

export default function SchoolMgmtScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<"assign" | "behavior" | "grades" | "books">("assign");
  const [kidId, setKidId] = useState(state.kids[0]?.profile.id ?? "");

  // ── Assignment form ──
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  // ── Behavior form ──
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState("5");

  // ── Grade modal ──
  const [gradeModalVisible, setGradeModalVisible] = useState(false);
  const [gSubject, setGSubject] = useState(SUBJECTS[0]);
  const [gPeriod, setGPeriod] = useState(PERIODS[0]);
  const [gGrade, setGGrade] = useState<GradeValue>("A");
  const [gPct, setGPct] = useState("");
  const [gTeacher, setGTeacher] = useState("");
  const [gNotes, setGNotes] = useState("");

  const kid = state.kids.find(k => k.profile.id === kidId);

  function addAssignment() {
    if (!title.trim() || !kidId) return;
    const finalDue = dueDate || nowIso().split("T")[0];
    dispatch({
      type: "ASSIGNMENT_ADD", kidId,
      assignment: {
        id: uid(), kidId,
        subject: subject || "General",
        title: title.trim(),
        dueDate: finalDue,
        status: "pending",
        proofUris: [],
        bonusPoints: 0,
        createdAt: nowIso(),
      },
    });
    // Schedule a reminder notification for the day before
    const kidName = kid?.profile.name ?? "Your child";
    scheduleHomeworkNotification(title.trim(), subject || "General", kidName, finalDue);
    setTitle(""); setSubject(""); setDueDate("");
  }

  function addBehavior(positive: boolean) {
    if (!reason.trim() || !kidId) return;
    const pts = (positive ? 1 : -1) * (parseInt(points) || 5);
    dispatch({ type: "BEHAVIOR_ADD_EVENT", kidId, event: { id: uid(), points: pts, reason: reason.trim(), date: nowIso().split("T")[0] } });
    setReason("");
  }

  function addGrade() {
    if (!kidId) return;
    const grade: ClassGrade = {
      id: uid(), kidId,
      subject: gSubject,
      period: gPeriod,
      grade: gGrade,
      percentage: gPct ? parseFloat(gPct) : undefined,
      teacher: gTeacher || undefined,
      notes: gNotes || undefined,
      addedBy: "parent",
      addedAt: nowIso(),
      rewardSent: false,
    };
    dispatch({ type: "GRADE_ADD", kidId, grade });
    setGradeModalVisible(false);
    setGSubject(SUBJECTS[0]); setGPeriod(PERIODS[0]); setGGrade("A");
    setGPct(""); setGTeacher(""); setGNotes("");

    const reward = GRADE_REWARD[gGrade];
    if (reward) {
      Alert.alert(
        `${GRADE_EMOJI[gGrade]} Great Grade!`,
        `${kid?.profile.name ?? "Kid"} got ${gGrade} in ${gSubject}!\nSend ${reward.label} reward?`,
        [
          { text: "Skip", style: "cancel" },
          {
            text: `Send ${reward.label} 🎁`,
            onPress: () => {
              dispatch({ type: "BANK_DELTA", kidId, delta: reward.minutes, reason: `Grade reward: ${gGrade} in ${gSubject}` });
              dispatch({ type: "GRADE_UPDATE", kidId, gradeId: grade.id, payload: { rewardSent: true } });
            },
          },
        ],
      );
    }
  }

  function sendReward(grade: ClassGrade) {
    const reward = GRADE_REWARD[grade.grade];
    if (!reward) return;
    Alert.alert(
      "Send Reward",
      `Send ${reward.label} for ${grade.grade} in ${grade.subject}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Send ${reward.label} 🎁`,
          onPress: () => {
            dispatch({ type: "BANK_DELTA", kidId: grade.kidId, delta: reward.minutes, reason: `Grade reward: ${grade.grade} in ${grade.subject}` });
            dispatch({ type: "GRADE_UPDATE", kidId: grade.kidId, gradeId: grade.id, payload: { rewardSent: true } });
          },
        },
      ],
    );
  }

  function removeGrade(grade: ClassGrade) {
    Alert.alert("Remove Grade", `Remove ${grade.grade} in ${grade.subject}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "GRADE_REMOVE", kidId: grade.kidId, gradeId: grade.id }) },
    ]);
  }

  const grades = kid?.grades ?? [];
  const avgGpa = grades.length ? grades.reduce((s, g) => s + gradeGpa(g.grade), 0) / grades.length : null;

  // Grade trend: group by period, compute average GPA per period
  const gradeTrend: { period: string; gpa: number }[] = [];
  const periodGroups: Record<string, GradeValue[]> = {};
  for (const g of grades) {
    if (!periodGroups[g.period]) periodGroups[g.period] = [];
    periodGroups[g.period].push(g.grade);
  }
  for (const [period, gs] of Object.entries(periodGroups)) {
    const avg = gs.reduce((s, g) => s + gradeGpa(g), 0) / gs.length;
    gradeTrend.push({ period, gpa: avg });
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📚 School Manager</Text>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        <View style={[styles.tabs, { marginBottom: 0 }]}>
          {(["assign","behavior","grades","books"] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "assign" ? "📝 Tasks" : t === "behavior" ? "⭐ Behavior" : t === "grades" ? "📊 Grades" : "📚 Books"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Kid selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        {state.kids.map(k => (
          <TouchableOpacity key={k.profile.id} style={[styles.kidTab, kidId === k.profile.id && styles.kidTabActive]} onPress={() => setKidId(k.profile.id)}>
            <Text style={[styles.kidTabText, kidId === k.profile.id && styles.kidTabTextActive]}>{k.profile.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Assignments tab ── */}
      {tab === "assign" && (
        <View style={styles.form}>
          <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject (Math, Science…)" />
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Assignment title…" />
          <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="Due date (YYYY-MM-DD)…" />
          <TouchableOpacity style={styles.addBtn} onPress={addAssignment} disabled={!title.trim()}>
            <Text style={styles.addBtnText}>Add Assignment 📝</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Behavior tab ── */}
      {tab === "behavior" && (
        <View style={styles.form}>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Reason for points…" />
          <PointsInput inputStyle={styles.input} value={points} onChangeText={setPoints} placeholder="Points (e.g. 5)" />
          <View style={styles.behaviorBtns}>
            <TouchableOpacity style={styles.positiveBtn} onPress={() => addBehavior(true)}>
              <Text style={styles.positiveBtnText}>+{points} Good Job ⭐</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.negativeBtn} onPress={() => addBehavior(false)}>
              <Text style={styles.negativeBtnText}>-{points} Needs Work</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Grades tab ── */}
      {tab === "grades" && (
        <View>
          {/* GPA summary card */}
          {grades.length > 0 && (
            <View style={styles.gpaCard}>
              <View style={styles.gpaLeft}>
                <Text style={styles.gpaNumber}>{avgGpa?.toFixed(2) ?? "—"}</Text>
                <Text style={styles.gpaLabel}>GPA</Text>
              </View>
              <View style={styles.gpaDivider} />
              <View style={styles.gpaRight}>
                <Text style={styles.gpaStat}>
                  {grades.filter(g => g.grade === "A+" || g.grade === "A").length} A's
                </Text>
                <Text style={styles.gpaStat}>
                  {grades.filter(g => g.grade.startsWith("B")).length} B's
                </Text>
                <Text style={styles.gpaStat}>
                  {grades.filter(g => g.grade.startsWith("C") || g.grade === "D" || g.grade === "F").length} Below
                </Text>
              </View>
              {(avgGpa ?? 0) >= 3.5 && (
                <View style={styles.honorBanner}>
                  <Text style={styles.honorText}>🏆 Honor Roll!</Text>
                </View>
              )}
            </View>
          )}

          {gradeTrend.length >= 2 && <GradeTrendChart trend={gradeTrend} />}

          <TouchableOpacity style={styles.addGradeBtn} onPress={() => setGradeModalVisible(true)}>
            <Text style={styles.addGradeBtnText}>+ Add Grade</Text>
          </TouchableOpacity>

          {grades.length === 0 ? (
            <Text style={styles.emptyText}>No grades yet — tap Add Grade above.</Text>
          ) : (
            grades.map(g => {
              const color = GRADE_COLOR[g.grade];
              const reward = GRADE_REWARD[g.grade];
              return (
                <View key={g.id} style={[styles.gradeCard, { borderLeftColor: color }]}>
                  <View style={[styles.gradeBadge, { backgroundColor: color }]}>
                    <Text style={styles.gradeBadgeText}>{g.grade}</Text>
                  </View>
                  <View style={styles.gradeInfo}>
                    <Text style={styles.gradeSubject}>{GRADE_EMOJI[g.grade]} {g.subject}</Text>
                    <Text style={styles.gradeMeta}>{g.period}{g.teacher ? ` • ${g.teacher}` : ""}</Text>
                    {g.percentage !== undefined && (
                      <Text style={styles.gradePct}>{g.percentage}%</Text>
                    )}
                    {g.notes ? <Text style={styles.gradeNotes}>{g.notes}</Text> : null}
                    <Text style={styles.gradeBy}>Added by {g.addedBy}</Text>
                  </View>
                  <View style={styles.gradeActions}>
                    {reward && !g.rewardSent && (
                      <TouchableOpacity style={styles.rewardBtn} onPress={() => sendReward(g)}>
                        <Text style={styles.rewardBtnText}>🎁 Reward</Text>
                      </TouchableOpacity>
                    )}
                    {g.rewardSent && (
                      <Text style={styles.rewardSentText}>✅ Rewarded</Text>
                    )}
                    <TouchableOpacity onPress={() => removeGrade(g)}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ── Add Grade Modal ── */}
      <Modal visible={gradeModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGradeModalVisible(false)}>
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={styles.modalTitle}>📊 Add Grade</Text>

          <Text style={styles.modalLabel}>Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {SUBJECTS.map(s => (
              <TouchableOpacity key={s} style={[styles.chip, gSubject === s && styles.chipActive]} onPress={() => setGSubject(s)}>
                <Text style={[styles.chipText, gSubject === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.modalLabel}>Period / Term</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {PERIODS.map(p => (
              <TouchableOpacity key={p} style={[styles.chip, gPeriod === p && styles.chipActive]} onPress={() => setGPeriod(p)}>
                <Text style={[styles.chipText, gPeriod === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.modalLabel}>Grade</Text>
          <View style={styles.gradeGrid}>
            {GRADES.map(g => {
              const color = GRADE_COLOR[g];
              const selected = gGrade === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.gradeGridItem, { backgroundColor: selected ? color : color + "30", borderColor: color }]}
                  onPress={() => setGGrade(g)}
                >
                  <Text style={[styles.gradeGridText, { color: selected ? "#fff" : color }]}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {GRADE_REWARD[gGrade] && (
            <View style={styles.rewardPreview}>
              <Text style={styles.rewardPreviewText}>🎁 Will offer {GRADE_REWARD[gGrade]!.label} reward for this grade</Text>
            </View>
          )}

          <Text style={styles.modalLabel}>Percentage (optional)</Text>
          <TextInput style={styles.input} value={gPct} onChangeText={setGPct} placeholder="e.g. 94.5" keyboardType="decimal-pad" />

          <Text style={styles.modalLabel}>Teacher (optional)</Text>
          <TextInput style={styles.input} value={gTeacher} onChangeText={setGTeacher} placeholder="Teacher name…" />

          <Text style={styles.modalLabel}>Notes (optional)</Text>
          <TextInput style={[styles.input, { height: 72 }]} value={gNotes} onChangeText={setGNotes} placeholder="Any notes…" multiline />

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setGradeModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={addGrade}>
              <Text style={styles.addBtnText}>Add Grade ✓</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* ── Books tab ── */}
      {tab === "books" && <BooksReviewPanel kidId={kidId} />}
    </ScreenContainer>
  );
}

// ─── Grade Trend Chart ─────────────────────────────────────────────────────────

function GradeTrendChart({ trend }: { trend: { period: string; gpa: number }[] }) {
  const BAR_H = 80;
  const maxGpa = 4.0;
  const improving = trend.length >= 2 && trend[trend.length - 1].gpa > trend[0].gpa;
  const stable    = trend.length >= 2 && Math.abs(trend[trend.length - 1].gpa - trend[0].gpa) < 0.1;

  return (
    <View style={trend_s.card}>
      <View style={trend_s.header}>
        <Text style={trend_s.title}>📈 Grade Trend</Text>
        <Text style={[trend_s.badge, { color: improving ? Colors.success : stable ? Colors.warning : Colors.error }]}>
          {improving ? "▲ Improving" : stable ? "→ Stable" : "▼ Declining"}
        </Text>
      </View>
      <View style={trend_s.chartRow}>
        {trend.map((t, i) => {
          const barHeight = Math.max(8, (t.gpa / maxGpa) * BAR_H);
          const color = t.gpa >= 3.5 ? Colors.success : t.gpa >= 3.0 ? Colors.primary : t.gpa >= 2.0 ? Colors.warning : Colors.error;
          return (
            <View key={i} style={trend_s.barCol}>
              <Text style={trend_s.gpaLabel}>{t.gpa.toFixed(1)}</Text>
              <View style={[trend_s.bar, { height: barHeight, backgroundColor: color }]} />
              <Text style={trend_s.periodLabel} numberOfLines={1}>{t.period.replace(/\s+\d{4}$/, "")}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const trend_s = StyleSheet.create({
  card:        { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.sm },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  title:       { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  badge:       { fontSize: FontSize.sm, fontWeight: "700" },
  chartRow:    { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 120, paddingTop: 20 },
  barCol:      { flex: 1, alignItems: "center", gap: 4 },
  bar:         { width: "80%", borderRadius: 4 },
  gpaLabel:    { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  periodLabel: { fontSize: 9, color: Colors.textSecondary, textAlign: "center" },
});

// ─── Books Review Panel ────────────────────────────────────────────────────────

function StarDisplay({ value }: { value: number }) {
  return (
    <Text style={{ fontSize: 14 }}>
      {[1,2,3,4,5].map(n => n <= value ? "⭐" : "☆").join("")}
    </Text>
  );
}

function BooksReviewPanel({ kidId }: { kidId: string }) {
  const { state, dispatch } = useData();
  const kid = state.kids.find(k => k.profile.id === kidId);
  const books = kid?.readingBooks ?? [];

  const [awardingId, setAwardingId] = useState<string | null>(null);
  const [pts, setPts] = useState("10");
  const [msg, setMsg] = useState("");

  function award(book: ReadingBook) {
    const points = parseInt(pts) || 0;
    if (points <= 0) { Alert.alert("Points", "Enter a number greater than 0"); return; }
    dispatch({
      type: "READING_BOOK_UPDATE",
      kidId,
      bookId: book.id,
      payload: { parentPoints: points, parentMessage: msg.trim() || undefined },
    });
    // Also give behavior points
    dispatch({
      type: "BEHAVIOR_ADD_EVENT",
      kidId,
      event: {
        id: uid(),
        points,
        reason: `📚 Read "${book.title}"`,
        date: nowIso().slice(0, 10),
      },
    });
    setAwardingId(null); setPts("10"); setMsg("");
    Alert.alert("Points awarded! 🎉", `${kid?.profile.name} earned ${points} points for reading "${book.title}"`);
  }

  if (books.length === 0) {
    return (
      <View style={bk.empty}>
        <Text style={{ fontSize: 56 }}>📚</Text>
        <Text style={bk.emptyTitle}>No books logged yet</Text>
        <Text style={bk.emptySub}>{kid?.profile.name} hasn't added any books to their reading list.</Text>
      </View>
    );
  }

  return (
    <View>
      {books.map(book => (
        <View key={book.id} style={bk.card}>
          {/* Cover */}
          {book.coverUri ? (
            <Image source={{ uri: book.coverUri }} style={bk.cover} />
          ) : (
            <View style={[bk.cover, bk.coverFallback]}>
              <Text style={{ fontSize: 28 }}>📖</Text>
            </View>
          )}

          <View style={{ flex: 1, gap: 4 }}>
            <Text style={bk.bookTitle} numberOfLines={1}>{book.title}</Text>
            {book.author ? <Text style={bk.bookMeta}>by {book.author}</Text> : null}
            <StarDisplay value={book.rating} />
            {book.review ? <Text style={bk.review} numberOfLines={2}>"{book.review}"</Text> : null}
            <Text style={bk.date}>Finished: {book.dateFinished}</Text>

            {book.parentPoints !== undefined ? (
              <View style={bk.awarded}>
                <Text style={bk.awardedText}>✅ You gave {book.parentPoints} pts</Text>
                {book.parentMessage ? <Text style={bk.awardedMsg}>"{book.parentMessage}"</Text> : null}
              </View>
            ) : awardingId === book.id ? (
              <View style={bk.awardForm}>
                <TextInput
                  style={bk.awardInput}
                  value={pts}
                  onChangeText={setPts}
                  keyboardType="number-pad"
                  placeholder="Points"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={[bk.awardInput, { flex: 1 }]}
                  value={msg}
                  onChangeText={setMsg}
                  placeholder="Message (optional)"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity style={bk.awardBtn} onPress={() => award(book)}>
                  <Text style={bk.awardBtnText}>Give ⭐</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAwardingId(null)}>
                  <Text style={{ color: Colors.textSecondary, fontWeight: "600", paddingLeft: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={bk.giveBtn} onPress={() => setAwardingId(book.id)}>
                <Text style={bk.giveBtnText}>⭐ Give Points</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const bk = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  card: {
    flexDirection: "row", gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm,
  },
  cover: { width: 60, height: 80, borderRadius: 8, resizeMode: "cover" },
  coverFallback: { backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center" },
  bookTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  bookMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  review: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic" },
  date: { fontSize: FontSize.xs, color: Colors.textMuted },
  awarded: { backgroundColor: Colors.success + "20", borderRadius: Radius.sm, padding: 6, gap: 2 },
  awardedText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success },
  awardedMsg: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: "italic" },
  awardForm: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 4 },
  awardInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: FontSize.sm,
    backgroundColor: Colors.surfaceLight, color: Colors.textPrimary,
    width: 60,
  },
  awardBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  awardBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  giveBtn: {
    backgroundColor: Colors.secondary + "30", borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", marginTop: 4,
  },
  giveBtnText: { fontWeight: "700", color: Colors.textPrimary, fontSize: FontSize.sm },
});

const styles = StyleSheet.create({
  title:              { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  tabs:               { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  tab:                { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  tabActive:          { backgroundColor: Colors.primary },
  tabText:            { fontWeight: "600", color: Colors.textSecondary, fontSize: FontSize.sm },
  tabTextActive:      { color: "#fff" },
  kidTab:             { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidTabActive:       { backgroundColor: Colors.primary },
  kidTabText:         { fontWeight: "600", color: Colors.textSecondary },
  kidTabTextActive:   { color: "#fff" },
  form:               { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, gap: 8 },
  input:              { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base },
  addBtn:             { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm, flex: 1 },
  addBtnText:         { color: "#fff", fontWeight: "700" },
  behaviorBtns:       { flexDirection: "row", gap: 8 },
  positiveBtn:        { flex: 1, backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm },
  positiveBtnText:    { color: "#fff", fontWeight: "700" },
  negativeBtn:        { flex: 1, backgroundColor: Colors.error + "20", borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm },
  negativeBtnText:    { color: Colors.error, fontWeight: "700" },

  // GPA card
  gpaCard:    { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm, overflow: "hidden" },
  gpaLeft:    { alignItems: "center", paddingRight: Spacing.md },
  gpaNumber:  { fontSize: 36, fontWeight: "900", color: Colors.primary },
  gpaLabel:   { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600" },
  gpaDivider: { width: 1, backgroundColor: Colors.border, height: 48, marginRight: Spacing.md },
  gpaRight:   { flex: 1, gap: 4 },
  gpaStat:    { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600" },
  honorBanner:{ position: "absolute", top: 0, right: 0, backgroundColor: "#F59E0B", paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: Radius.md },
  honorText:  { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  // Grade cards
  addGradeBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm, marginBottom: Spacing.sm },
  addGradeBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  emptyText:       { textAlign: "center", color: Colors.textSecondary, paddingVertical: Spacing.xl },
  gradeCard:       { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.sm, borderLeftWidth: 4 },
  gradeBadge:      { width: 48, height: 48, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm },
  gradeBadgeText:  { color: "#fff", fontWeight: "900", fontSize: FontSize.lg },
  gradeInfo:       { flex: 1 },
  gradeSubject:    { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  gradeMeta:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  gradePct:        { fontSize: FontSize.sm, color: Colors.textSecondary },
  gradeNotes:      { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic" },
  gradeBy:         { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  gradeActions:    { alignItems: "flex-end", gap: 8 },
  rewardBtn:       { backgroundColor: "#F59E0B20", borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  rewardBtnText:   { color: "#D97706", fontWeight: "700", fontSize: FontSize.sm },
  rewardSentText:  { fontSize: FontSize.sm, color: Colors.success, fontWeight: "600" },
  removeText:      { color: Colors.textSecondary, fontSize: FontSize.base, paddingHorizontal: 4 },

  // Modal
  modal:           { flex: 1, padding: Spacing.md, backgroundColor: Colors.background },
  modalTitle:      { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  modalLabel:      { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  chipRow:         { marginBottom: 4, flexGrow: 0 },
  chip:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8, borderWidth: 2, borderColor: "transparent" },
  chipActive:      { backgroundColor: Colors.primary + "20", borderColor: Colors.primary },
  chipText:        { fontWeight: "600", color: Colors.textSecondary },
  chipTextActive:  { color: Colors.primary },
  gradeGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.sm },
  gradeGridItem:   { width: 56, height: 44, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  gradeGridText:   { fontWeight: "800", fontSize: FontSize.base },
  rewardPreview:   { backgroundColor: "#F59E0B20", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  rewardPreviewText: { color: "#D97706", fontWeight: "600", fontSize: FontSize.sm },
  modalBtns:       { flexDirection: "row", gap: 12, marginTop: Spacing.lg },
  cancelBtn:       { flex: 1, backgroundColor: Colors.cardLight, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm },
  cancelBtnText:   { color: Colors.textSecondary, fontWeight: "700" },
});
