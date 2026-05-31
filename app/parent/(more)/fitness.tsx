import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, Image,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import { PointsInput } from "../../../components/points-input";
import {
  WorkoutPlan, WorkoutExercise, WorkoutLog, MealPlan, PlannedMeal, MealType,
} from "../../../lib/data/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRESET_EXERCISES: Omit<WorkoutExercise, "id">[] = [
  { name: "Running",        emoji: "🏃", durationMinutes: 15 },
  { name: "Push-ups",       emoji: "💪", sets: 3, reps: 10 },
  { name: "Squats",         emoji: "🦵", sets: 3, reps: 15 },
  { name: "Jumping Jacks",  emoji: "⭐", reps: 30 },
  { name: "Sit-ups",        emoji: "🏋️", sets: 3, reps: 15 },
  { name: "Cycling",        emoji: "🚴", durationMinutes: 20 },
  { name: "Swimming",       emoji: "🏊", durationMinutes: 20 },
  { name: "Stretching",     emoji: "🧘", durationMinutes: 10 },
  { name: "Walking",        emoji: "🚶", durationMinutes: 30 },
  { name: "Jump Rope",      emoji: "🪢", durationMinutes: 5 },
  { name: "Burpees",        emoji: "🔥", sets: 3, reps: 8 },
  { name: "Plank",          emoji: "🧱", durationMinutes: 1 },
];

const PLAN_COLORS = ["#EF4444","#F97316","#F59E0B","#10B981","#3B82F6","#8B5CF6","#EC4899"];

const MEAL_TYPES: { id: MealType; emoji: string; label: string }[] = [
  { id: "breakfast", emoji: "🌅", label: "Breakfast" },
  { id: "lunch",     emoji: "☀️", label: "Lunch"     },
  { id: "dinner",    emoji: "🌙", label: "Dinner"    },
  { id: "snack",     emoji: "🍎", label: "Snack"     },
];

function describeExercise(ex: WorkoutExercise) {
  if (ex.durationMinutes) return `${ex.durationMinutes} min`;
  if (ex.sets && ex.reps) return `${ex.sets}×${ex.reps}`;
  if (ex.reps) return `${ex.reps} reps`;
  return "";
}

// ─── Award Points Modal ───────────────────────────────────────────────────────

function AwardModal({ log, kidName, onAward, onClose }: {
  log: WorkoutLog; kidName: string; onAward: (points: number, comment: string) => void; onClose: () => void;
}) {
  const [points, setPoints] = useState("20");
  const [comment, setComment] = useState("");

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={a.overlay}>
        <View style={a.card}>
          <Text style={a.title}>⭐ Award Points</Text>
          <Text style={a.sub}>{kidName} completed "{log.planTitle}"</Text>
          {log.note ? <Text style={a.note}>💬 "{log.note}"</Text> : null}
          {log.photoUri ? <Image source={{ uri: log.photoUri }} style={a.photo} resizeMode="cover" /> : null}

          <Text style={a.label}>Points to award</Text>
          <View style={a.pointsRow}>
            {[10, 20, 30, 50, 100].map(p => (
              <TouchableOpacity key={p} style={[a.chip, points === String(p) && a.chipActive]} onPress={() => setPoints(String(p))}>
                <Text style={[a.chipText, points === String(p) && a.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <PointsInput inputStyle={a.input} value={points} onChangeText={setPoints} placeholder="Custom" />

          <Text style={a.label}>Message (optional)</Text>
          <TextInput style={[a.input, { minHeight: 60, textAlignVertical: "top" }]} value={comment} onChangeText={setComment} placeholder={`"Amazing job, keep it up! 💪"`} multiline />

          <View style={a.btns}>
            <TouchableOpacity style={a.cancelBtn} onPress={onClose}><Text style={a.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={a.awardBtn} onPress={() => { const p = parseInt(points) || 0; if (p < 1) { Alert.alert("Enter at least 1 point!"); return; } onAward(p, comment.trim()); }}>
              <Text style={a.awardText}>⭐ Award {points} pts!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Create Workout Plan Modal ────────────────────────────────────────────────

function CreatePlanModal({ kids, onSave, onClose }: {
  kids: { id: string; name: string }[];
  onSave: (kidId: string, plan: WorkoutPlan) => void;
  onClose: () => void;
}) {
  const [kidId, setKidId] = useState(kids[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState("07:00");
  const [reminder, setReminder] = useState(true);
  const [color, setColor] = useState(PLAN_COLORS[2]);

  function toggleEx(preset: Omit<WorkoutExercise, "id">) {
    const exists = exercises.find(e => e.name === preset.name);
    if (exists) setExercises(exercises.filter(e => e.name !== preset.name));
    else setExercises([...exercises, { ...preset, id: uid() }]);
  }

  function save() {
    if (!kidId) { Alert.alert("Select a kid."); return; }
    if (!title.trim()) { Alert.alert("Give the plan a name!"); return; }
    if (exercises.length === 0) { Alert.alert("Add at least one exercise!"); return; }
    onSave(kidId, {
      id: uid(), kidId, title: title.trim(), exercises,
      scheduledDays: days, scheduledTime: time, reminderEnabled: reminder,
      createdBy: "parent", color, createdAt: nowIso(),
    });
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={create.container}>
        <ScrollView contentContainerStyle={create.scroll} keyboardShouldPersistTaps="handled">
          <View style={create.topBar}>
            <TouchableOpacity onPress={onClose}><Text style={create.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={create.heading}>💪 Create Workout Plan</Text>
            <TouchableOpacity onPress={save}><Text style={create.saveBtn}>Save</Text></TouchableOpacity>
          </View>

          <Text style={create.label}>For which kid?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {kids.map(k => (
              <TouchableOpacity key={k.id} style={[create.kidChip, kidId === k.id && create.kidChipActive]} onPress={() => setKidId(k.id)}>
                <Text style={[create.kidChipText, kidId === k.id && create.kidChipTextActive]}>{k.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={create.label}>Plan Name</Text>
          <TextInput style={create.input} value={title} onChangeText={setTitle} placeholder="e.g. After-School Power Workout" />

          <Text style={create.label}>Color</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {PLAN_COLORS.map(c => (
              <TouchableOpacity key={c} style={[create.colorDot, { backgroundColor: c }, color === c && { borderWidth: 3, borderColor: "#000" }]} onPress={() => setColor(c)} />
            ))}
          </View>

          <Text style={create.label}>Exercises</Text>
          <View style={create.exGrid}>
            {PRESET_EXERCISES.map(ex => {
              const sel = exercises.some(e => e.name === ex.name);
              return (
                <TouchableOpacity key={ex.name} style={[create.exBtn, sel && { borderColor: color, backgroundColor: color + "18" }]} onPress={() => toggleEx(ex)}>
                  <Text style={{ fontSize: 20 }}>{ex.emoji}</Text>
                  <Text style={[create.exName, sel && { color }]}>{ex.name}</Text>
                  <Text style={create.exDetail}>{describeExercise({ ...ex, id: "" })}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={create.label}>Schedule</Text>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            {DAY_NAMES.map((d, i) => (
              <TouchableOpacity key={i} style={[create.dayBtn, days.includes(i) && { backgroundColor: color }]} onPress={() => setDays(days.includes(i) ? days.filter(x => x !== i) : [...days, i])}>
                <Text style={[create.dayText, days.includes(i) && { color: "#fff" }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput style={[create.input, { flex: 1 }]} value={time} onChangeText={setTime} placeholder="07:00" keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={[create.toggleBtn, reminder && { backgroundColor: color }]} onPress={() => setReminder(!reminder)}>
              <Text style={{ color: reminder ? "#fff" : Colors.textSecondary, fontWeight: "700" }}>{reminder ? "🔔 Alert On" : "🔕 Alert Off"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[create.submitBtn, { backgroundColor: color }]} onPress={save}>
            <Text style={create.submitBtnText}>💪 Create Plan</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Create Meal Plan Modal ───────────────────────────────────────────────────

function CreateMealPlanModal({ kids, onSave, onClose }: {
  kids: { id: string; name: string }[];
  onSave: (kidId: string, plan: MealPlan) => void;
  onClose: () => void;
}) {
  const [kidId, setKidId] = useState(kids[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [mealName, setMealName] = useState("");
  const [mealEmoji, setMealEmoji] = useState("🍽");
  const [mealDesc, setMealDesc] = useState("");

  function addMeal() {
    if (!mealName.trim()) { Alert.alert("Name this meal!"); return; }
    setMeals([...meals, { id: uid(), type: mealType, name: mealName.trim(), emoji: mealEmoji, description: mealDesc.trim() || undefined }]);
    setMealName(""); setMealDesc(""); setMealEmoji("🍽");
  }

  function save() {
    if (!kidId) { Alert.alert("Select a kid."); return; }
    if (!title.trim()) { Alert.alert("Give the plan a title!"); return; }
    if (meals.length === 0) { Alert.alert("Add at least one meal!"); return; }
    onSave(kidId, { id: uid(), kidId, title: title.trim(), meals, createdBy: "parent", active: true, createdAt: nowIso() });
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={create.container}>
        <ScrollView contentContainerStyle={create.scroll} keyboardShouldPersistTaps="handled">
          <View style={create.topBar}>
            <TouchableOpacity onPress={onClose}><Text style={create.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={create.heading}>🥗 Create Meal Plan</Text>
            <TouchableOpacity onPress={save}><Text style={create.saveBtn}>Save</Text></TouchableOpacity>
          </View>

          <Text style={create.label}>For which kid?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {kids.map(k => (
              <TouchableOpacity key={k.id} style={[create.kidChip, kidId === k.id && create.kidChipActive]} onPress={() => setKidId(k.id)}>
                <Text style={[create.kidChipText, kidId === k.id && create.kidChipTextActive]}>{k.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={create.label}>Plan Title</Text>
          <TextInput style={create.input} value={title} onChangeText={setTitle} placeholder="e.g. Healthy School Week" />

          <Text style={create.label}>Add Meals</Text>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            {MEAL_TYPES.map(t => (
              <TouchableOpacity key={t.id} style={[create.mealTypeBtn, mealType === t.id && create.mealTypeBtnActive]} onPress={() => setMealType(t.id)}>
                <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
                <Text style={[create.mealTypeTxt, mealType === t.id && { color: Colors.success }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
            <TextInput style={[create.input, { width: 44 }]} value={mealEmoji} onChangeText={setMealEmoji} />
            <TextInput style={[create.input, { flex: 1 }]} value={mealName} onChangeText={setMealName} placeholder="Meal name" />
          </View>
          <TextInput style={[create.input, { marginBottom: 6 }]} value={mealDesc} onChangeText={setMealDesc} placeholder="Description (optional)" />
          <TouchableOpacity style={create.addMealBtn} onPress={addMeal}><Text style={create.addMealText}>+ Add Meal</Text></TouchableOpacity>

          {meals.length > 0 && (
            <View style={{ backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, overflow: "hidden", marginTop: 8 }}>
              {meals.map((m, i) => (
                <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                  <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", fontSize: FontSize.sm, color: Colors.textPrimary }}>{m.name}</Text>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>{MEAL_TYPES.find(t => t.id === m.type)?.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setMeals(meals.filter((_, j) => j !== i))}><Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text></TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={[create.submitBtn, { backgroundColor: Colors.success }]} onPress={save}>
            <Text style={create.submitBtnText}>🥗 Create Meal Plan</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ParentFitnessScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<"approve" | "plans" | "meals">("approve");
  const [awardTarget, setAwardTarget] = useState<{ log: WorkoutLog; kidId: string; kidName: string } | null>(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateMeal, setShowCreateMeal] = useState(false);

  const kids = state.kids.map(k => ({ id: k.profile.id, name: k.profile.name }));

  // Collect all pending workout logs across all kids
  const pendingLogs: { log: WorkoutLog; kidId: string; kidName: string }[] = [];
  const approvedLogs: { log: WorkoutLog; kidId: string; kidName: string }[] = [];
  for (const kid of state.kids) {
    for (const log of (kid.workoutLogs ?? [])) {
      const entry = { log, kidId: kid.profile.id, kidName: kid.profile.name };
      if (log.parentApproved == null) pendingLogs.push(entry);
      else if (log.parentApproved) approvedLogs.push(entry);
    }
  }
  pendingLogs.sort((a, b) => new Date(b.log.submittedAt).getTime() - new Date(a.log.submittedAt).getTime());
  approvedLogs.sort((a, b) => new Date(b.log.approvedAt ?? "").getTime() - new Date(a.log.approvedAt ?? "").getTime());

  function award(points: number, comment: string) {
    if (!awardTarget) return;
    dispatch({ type: "WORKOUT_LOG_APPROVE", kidId: awardTarget.kidId, logId: awardTarget.log.id, points, comment: comment || undefined });
    dispatch({
      type: "NOTIFICATION_ADD", kidId: awardTarget.kidId,
      notification: {
        id: uid(), kidId: awardTarget.kidId, kind: "workout_approved",
        title: `⭐ You earned ${points} points for your workout!`,
        body: comment || `Great job on "${awardTarget.log.planTitle}"! 💪`,
        read: false, createdAt: nowIso(),
      },
    });
    setAwardTarget(null);
  }

  return (
    <ScreenContainer scroll>
      <Text style={p.title}>🏋️ Kids' Fitness</Text>

      <View style={p.tabs}>
        {[
          { id: "approve", label: `✅ Approve${pendingLogs.length > 0 ? ` (${pendingLogs.length})` : ""}` },
          { id: "plans",   label: "💪 Workout Plans" },
          { id: "meals",   label: "🥗 Meal Plans" },
        ].map(t => (
          <TouchableOpacity key={t.id} style={[p.tab, tab === t.id && p.tabActive]} onPress={() => setTab(t.id as any)}>
            <Text style={[p.tabText, tab === t.id && p.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Approve tab ── */}
      {tab === "approve" && (
        <>
          {pendingLogs.length === 0 && approvedLogs.length === 0 && (
            <View style={p.empty}>
              <Text style={{ fontSize: 48 }}>🏅</Text>
              <Text style={p.emptyTitle}>No workout logs yet</Text>
              <Text style={p.emptySub}>When your kids complete a workout, they'll submit it here for you to review and award points.</Text>
            </View>
          )}
          {pendingLogs.length > 0 && <Text style={p.sectionTitle}>⏳ Pending Approval</Text>}
          {pendingLogs.map(({ log, kidId, kidName }) => (
            <View key={log.id} style={p.logCard}>
              <View style={p.logCardTop}>
                <Text style={p.logKidName}>{kidName}</Text>
                <Text style={p.logDate}>{new Date(log.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
              </View>
              <Text style={p.logPlanTitle}>💪 {log.planTitle}</Text>
              {log.note ? <Text style={p.logNote}>"{log.note}"</Text> : null}
              {log.photoUri ? <Image source={{ uri: log.photoUri }} style={p.logPhoto} resizeMode="cover" /> : null}
              <TouchableOpacity style={p.awardBtn} onPress={() => setAwardTarget({ log, kidId, kidName })}>
                <Text style={p.awardBtnText}>⭐ Review & Award Points</Text>
              </TouchableOpacity>
            </View>
          ))}
          {approvedLogs.length > 0 && (
            <>
              <Text style={p.sectionTitle}>✅ Recently Approved</Text>
              {approvedLogs.slice(0, 10).map(({ log, kidName }) => (
                <View key={log.id} style={[p.logCard, { opacity: 0.75 }]}>
                  <View style={p.logCardTop}>
                    <Text style={p.logKidName}>{kidName}</Text>
                    <Text style={[p.logDate, { color: Colors.success }]}>+{log.pointsAwarded} pts ✅</Text>
                  </View>
                  <Text style={p.logPlanTitle}>{log.planTitle}</Text>
                  {log.parentComment ? <Text style={p.logNote}>You said: "{log.parentComment}"</Text> : null}
                </View>
              ))}
            </>
          )}
        </>
      )}

      {/* ── Workout Plans tab ── */}
      {tab === "plans" && (
        <>
          <TouchableOpacity style={p.createBtn} onPress={() => setShowCreatePlan(true)}>
            <Text style={p.createBtnText}>+ Create Workout Plan for a Kid</Text>
          </TouchableOpacity>
          {state.kids.map(kid => {
            const plans = kid.workoutPlans ?? [];
            if (plans.length === 0) return null;
            return (
              <View key={kid.profile.id}>
                <Text style={p.kidHeader}>{kid.profile.name}'s Plans</Text>
                {plans.map(plan => (
                  <View key={plan.id} style={[p.planCard, { borderLeftColor: plan.color }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[p.planDot, { backgroundColor: plan.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={p.planTitle}>{plan.title}</Text>
                        <Text style={p.planMeta}>{plan.scheduledDays.map(d => DAY_NAMES[d]).join(", ") || "No days"} · {plan.exercises.length} exercises · {plan.createdBy === "parent" ? "👪 You" : "👤 Kid"}</Text>
                      </View>
                      <TouchableOpacity onPress={() => Alert.alert("Remove plan?", "", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "WORKOUT_PLAN_REMOVE", kidId: kid.profile.id, planId: plan.id }) },
                      ])}>
                        <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ gap: 4, marginTop: 8 }}>
                      {plan.exercises.map(ex => (
                        <View key={ex.id} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                          <Text style={{ fontSize: 16 }}>{ex.emoji}</Text>
                          <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>{ex.name} — {describeExercise(ex)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
          {state.kids.every(k => (k.workoutPlans ?? []).length === 0) && (
            <View style={p.empty}>
              <Text style={{ fontSize: 48 }}>💪</Text>
              <Text style={p.emptyTitle}>No workout plans yet</Text>
              <Text style={p.emptySub}>Create a workout plan for your kids — they'll see it on their fitness page every scheduled day!</Text>
            </View>
          )}
        </>
      )}

      {/* ── Meal Plans tab ── */}
      {tab === "meals" && (
        <>
          <TouchableOpacity style={[p.createBtn, { borderColor: Colors.success }]} onPress={() => setShowCreateMeal(true)}>
            <Text style={[p.createBtnText, { color: Colors.success }]}>+ Create Meal Plan for a Kid</Text>
          </TouchableOpacity>
          {state.kids.map(kid => {
            const plans = kid.mealPlans ?? [];
            if (plans.length === 0) return null;
            return (
              <View key={kid.profile.id}>
                <Text style={p.kidHeader}>{kid.profile.name}'s Meal Plans</Text>
                {plans.map(plan => (
                  <View key={plan.id} style={[p.planCard, { borderLeftColor: Colors.success }, plan.active && { borderWidth: 2, borderColor: Colors.success }]}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={p.planTitle}>{plan.title}</Text>
                        <Text style={p.planMeta}>{plan.meals.length} meals · {plan.createdBy === "parent" ? "👪 You" : "👤 Kid"}</Text>
                      </View>
                      {plan.active && <View style={p.activeBadge}><Text style={p.activeBadgeText}>✅ Active</Text></View>}
                      <TouchableOpacity style={{ marginLeft: 8 }} onPress={() => Alert.alert("Remove meal plan?", "", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "MEAL_PLAN_REMOVE", kidId: kid.profile.id, planId: plan.id }) },
                      ])}>
                        <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ gap: 4, marginTop: 8 }}>
                      {plan.meals.map(m => (
                        <View key={m.id} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                          <Text style={{ fontSize: 16 }}>{m.emoji ?? "🍽"}</Text>
                          <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>{m.name} ({m.type})</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
          {state.kids.every(k => (k.mealPlans ?? []).length === 0) && (
            <View style={p.empty}>
              <Text style={{ fontSize: 48 }}>🥗</Text>
              <Text style={p.emptyTitle}>No meal plans yet</Text>
              <Text style={p.emptySub}>Create healthy meal plans for your kids to follow throughout the week.</Text>
            </View>
          )}
        </>
      )}

      {/* Modals */}
      {awardTarget && <AwardModal log={awardTarget.log} kidName={awardTarget.kidName} onAward={award} onClose={() => setAwardTarget(null)} />}
      {showCreatePlan && (
        <CreatePlanModal
          kids={kids}
          onSave={(kidId, plan) => { dispatch({ type: "WORKOUT_PLAN_ADD", kidId, plan }); setShowCreatePlan(false); }}
          onClose={() => setShowCreatePlan(false)}
        />
      )}
      {showCreateMeal && (
        <CreateMealPlanModal
          kids={kids}
          onSave={(kidId, plan) => { dispatch({ type: "MEAL_PLAN_ADD", kidId, plan }); setShowCreateMeal(false); }}
          onClose={() => setShowCreateMeal(false)}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const p = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  tabs: { gap: 6, marginBottom: Spacing.md },
  tab: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: 8 },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 10 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  logCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  logCardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  logKidName: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.primary, textTransform: "uppercase" },
  logDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  logPlanTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  logNote: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic", marginBottom: 8 },
  logPhoto: { width: "100%", height: 140, borderRadius: Radius.lg, marginBottom: 10 },
  awardBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, ...Shadow.sm },
  awardBtnText: { color: "#fff", fontWeight: "800" },
  createBtn: { borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, marginBottom: Spacing.md },
  createBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  kidHeader: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  planCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 10, borderLeftWidth: 4, ...Shadow.sm },
  planDot: { width: 12, height: 12, borderRadius: 6 },
  planTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  planMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  activeBadge: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.success },
});

const a = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Spacing.lg },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.lg, gap: 10 },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  note: { fontSize: FontSize.sm, color: Colors.primary, fontStyle: "italic" },
  photo: { width: "100%", height: 140, borderRadius: Radius.lg },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  pointsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontWeight: "700", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, backgroundColor: Colors.cardLight },
  btns: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary },
  awardBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, ...Shadow.sm },
  awardText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});

const create = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { padding: Spacing.md, gap: 6 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  cancel: { color: Colors.textSecondary, fontWeight: "700", fontSize: FontSize.base },
  heading: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  saveBtn: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight },
  kidChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: Colors.border },
  kidChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  kidChipText: { fontWeight: "700", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  exGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exBtn: { width: "30%", borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 8, alignItems: "center", gap: 3, backgroundColor: Colors.surfaceLight },
  exName: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, textAlign: "center" },
  exDetail: { fontSize: 9, color: Colors.textMuted, textAlign: "center" },
  dayBtn: { flex: 1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: "center", paddingVertical: 8, backgroundColor: Colors.cardLight },
  dayText: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  toggleBtn: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 12, alignSelf: "center" },
  submitBtn: { borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginTop: Spacing.md, ...Shadow.md, marginHorizontal: Spacing.xs },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  mealTypeBtn: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.cardLight },
  mealTypeBtnActive: { backgroundColor: Colors.success + "15", borderColor: Colors.success },
  mealTypeTxt: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  addMealBtn: { borderWidth: 2, borderColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10, marginHorizontal: Spacing.xs },
  addMealText: { color: Colors.success, fontWeight: "700" },
});
