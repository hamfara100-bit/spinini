import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Alert, Modal, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
const notif = () => import("expo-notifications");
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import {
  WorkoutPlan, WorkoutExercise, WorkoutLog, MealPlan, PlannedMeal, MealType,
} from "../../../../lib/data/types";

// ─── Constants ───────────────────────────────────────────────────────────────

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

const MEAL_TYPES: { id: MealType; emoji: string; label: string; time: string }[] = [
  { id: "breakfast", emoji: "🌅", label: "Breakfast", time: "Morning"  },
  { id: "lunch",     emoji: "☀️", label: "Lunch",     time: "Midday"   },
  { id: "dinner",    emoji: "🌙", label: "Dinner",    time: "Evening"  },
  { id: "snack",     emoji: "🍎", label: "Snack",     time: "Anytime"  },
];

function todayDateStr() { return new Date().toISOString().slice(0, 10); }
function todayDow() { return new Date().getDay(); }

function describeExercise(ex: WorkoutExercise) {
  if (ex.durationMinutes) return `${ex.durationMinutes} min`;
  if (ex.sets && ex.reps) return `${ex.sets} sets × ${ex.reps} reps`;
  if (ex.reps) return `${ex.reps} reps`;
  return "";
}

async function scheduleWorkoutReminder(plan: WorkoutPlan) {
  if (!plan.reminderEnabled || !plan.scheduledTime) return;
  const N = await notif();
  const [h, m] = plan.scheduledTime.split(":").map(Number);
  for (const day of plan.scheduledDays) {
    await N.scheduleNotificationAsync({
      identifier: `workout-${plan.id}-day${day}`,
      content: { title: `💪 Workout Time!`, body: `Time for "${plan.title}" — let's go!` },
      trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour: h, minute: m },
    });
  }
}

async function cancelWorkoutReminders(plan: WorkoutPlan) {
  const N = await notif();
  for (const day of plan.scheduledDays) {
    await N.cancelScheduledNotificationAsync(`workout-${plan.id}-day${day}`).catch(() => {});
  }
}

// ─── Workout Plan Editor Modal (create + edit) ──────────────────────────────

function WorkoutPlanEditor({ plan, kidId, onSave, onDelete, onClose }: {
  plan: WorkoutPlan;
  kidId: string;
  onSave: (p: WorkoutPlan) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle]     = useState(plan.title);
  const [exercises, setExercises] = useState<WorkoutExercise[]>(plan.exercises);
  const [days, setDays]       = useState<number[]>(plan.scheduledDays);
  const [time, setTime]       = useState(plan.scheduledTime ?? "07:00");
  const [reminder, setReminder] = useState(plan.reminderEnabled ?? false);
  const [color, setColor]     = useState(plan.color ?? PLAN_COLORS[0]);
  const [dirty, setDirty]     = useState(false);

  function toggleExercise(preset: Omit<WorkoutExercise, "id">) {
    const existing = exercises.find(e => e.name === preset.name);
    setExercises(existing
      ? exercises.filter(e => e.name !== preset.name)
      : [...exercises, { ...preset, id: uid() }]
    );
    setDirty(true);
  }

  function toggleDay(d: number) {
    setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d]);
    setDirty(true);
  }

  function save() {
    const updated: WorkoutPlan = { ...plan, title: title.trim() || plan.title, exercises, scheduledDays: days, scheduledTime: time, reminderEnabled: reminder, color };
    scheduleWorkoutReminder(updated);
    onSave(updated);
    setDirty(false);
  }

  function handleClose() {
    if (dirty) {
      Alert.alert("Save changes?", undefined, [
        { text: "Discard", style: "destructive", onPress: onClose },
        { text: "Save & Close", onPress: () => { save(); onClose(); } },
      ]);
    } else {
      onClose();
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={add.container}>
        <View style={add.topBar}>
          <TouchableOpacity onPress={handleClose}><Text style={add.cancel}>‹ Plans</Text></TouchableOpacity>
          <Text style={add.heading}>💪 Workout Plan</Text>
          <TouchableOpacity onPress={save} disabled={!dirty} style={[add.savePill, !dirty && { backgroundColor: Colors.border }]}>
            <Text style={add.savePillText}>{dirty ? "💾 Save" : "✓ Saved"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={add.scroll} keyboardShouldPersistTaps="handled">
          <Text style={add.label}>Plan Name</Text>
          <TextInput style={add.input} value={title} onChangeText={t => { setTitle(t); setDirty(true); }} placeholder="e.g. Morning Power Routine" />

          <Text style={add.label}>Color</Text>
          <View style={add.colorRow}>
            {PLAN_COLORS.map(c => (
              <TouchableOpacity key={c} style={[add.colorDot, { backgroundColor: c }, color === c && add.colorDotActive]}
                onPress={() => { setColor(c); setDirty(true); }} />
            ))}
          </View>

          <Text style={add.label}>Pick Exercises</Text>
          <View style={add.presetGrid}>
            {PRESET_EXERCISES.map(ex => {
              const selected = exercises.some(e => e.name === ex.name);
              return (
                <TouchableOpacity
                  key={ex.name}
                  style={[add.presetBtn, selected && { borderColor: color, backgroundColor: color + "18" }]}
                  onPress={() => toggleExercise(ex)}
                >
                  <Text style={{ fontSize: 22 }}>{ex.emoji}</Text>
                  <Text style={[add.presetName, selected && { color }]}>{ex.name}</Text>
                  <Text style={add.presetDetail}>{describeExercise({ ...ex, id: "" })}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={add.label}>Schedule Days</Text>
          <View style={add.dayRow}>
            {DAY_NAMES.map((d, i) => (
              <TouchableOpacity key={i} style={[add.dayBtn, days.includes(i) && { backgroundColor: color }]} onPress={() => toggleDay(i)}>
                <Text style={[add.dayText, days.includes(i) && { color: "#fff" }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={add.label}>Reminder Time</Text>
          <View style={add.row}>
            <TextInput style={[add.input, { flex: 1 }]} value={time} onChangeText={t => { setTime(t); setDirty(true); }} placeholder="07:00" keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={[add.toggleBtn, reminder && { backgroundColor: color }]} onPress={() => { setReminder(!reminder); setDirty(true); }}>
              <Text style={[add.toggleText, reminder && { color: "#fff" }]}>{reminder ? "🔔 On" : "🔕 Off"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={add.deleteBtn}
            onPress={() => Alert.alert("Delete plan?", `"${plan.title}" will be gone forever.`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => { cancelWorkoutReminders(plan); onDelete(); onClose(); } },
            ])}
          >
            <Text style={add.deleteBtnText}>🗑 Delete This Plan</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Meal Plan Editor Modal (create + edit) ──────────────────────────────────

function MealPlanEditor({ plan, onSave, onDelete, onClose }: {
  plan: MealPlan;
  onSave: (p: MealPlan) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle]     = useState(plan.title);
  const [meals, setMeals]     = useState<PlannedMeal[]>(plan.meals);
  const [addType, setAddType] = useState<MealType>("breakfast");
  const [mealName, setMealName] = useState("");
  const [mealEmoji, setMealEmoji] = useState("🍽");
  const [mealDesc, setMealDesc] = useState("");
  const [dirty, setDirty]     = useState(false);

  function addMeal() {
    if (!mealName.trim()) { Alert.alert("Name this meal!"); return; }
    setMeals(prev => [...prev, { id: uid(), type: addType, name: mealName.trim(), description: mealDesc.trim() || undefined, emoji: mealEmoji }]);
    setMealName(""); setMealDesc(""); setMealEmoji("🍽");
    setDirty(true);
  }

  function save() {
    const updated: MealPlan = { ...plan, title: title.trim() || plan.title, meals };
    onSave(updated);
    setDirty(false);
  }

  function handleClose() {
    if (dirty) {
      Alert.alert("Save changes?", undefined, [
        { text: "Discard", style: "destructive", onPress: onClose },
        { text: "Save & Close", onPress: () => { save(); onClose(); } },
      ]);
    } else {
      onClose();
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={add.container}>
        <View style={add.topBar}>
          <TouchableOpacity onPress={handleClose}><Text style={add.cancel}>‹ Plans</Text></TouchableOpacity>
          <Text style={add.heading}>🥗 Meal Plan</Text>
          <TouchableOpacity onPress={save} disabled={!dirty} style={[add.savePill, !dirty && { backgroundColor: Colors.border }]}>
            <Text style={add.savePillText}>{dirty ? "💾 Save" : "✓ Saved"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={add.scroll} keyboardShouldPersistTaps="handled">
          <Text style={add.label}>Plan Title</Text>
          <TextInput style={add.input} value={title} onChangeText={t => { setTitle(t); setDirty(true); }} placeholder="e.g. Healthy Week Plan" />

          <Text style={add.label}>Add Meals</Text>
          <View style={add.mealTypeRow}>
            {MEAL_TYPES.map(t => (
              <TouchableOpacity key={t.id} style={[add.mealTypeBtn, addType === t.id && add.mealTypeBtnActive]} onPress={() => setAddType(t.id)}>
                <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                <Text style={[add.mealTypeTxt, addType === t.id && add.mealTypeTxtActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={add.mealInputRow}>
            <TextInput style={[add.input, { width: 44 }]} value={mealEmoji} onChangeText={setMealEmoji} />
            <TextInput style={[add.input, { flex: 1 }]} value={mealName} onChangeText={setMealName} placeholder="Meal name (e.g. Oatmeal)" />
          </View>
          <TextInput style={add.input} value={mealDesc} onChangeText={setMealDesc} placeholder="Description (optional)" />
          <TouchableOpacity style={add.addMealBtn} onPress={addMeal}>
            <Text style={add.addMealBtnText}>＋ Add Meal</Text>
          </TouchableOpacity>

          {meals.length > 0 && (
            <View style={add.mealList}>
              {meals.map((m, i) => (
                <View key={m.id} style={add.mealRow}>
                  <Text style={{ fontSize: 18 }}>{m.emoji ?? MEAL_TYPES.find(t => t.id === m.type)?.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={add.mealRowName}>{m.name}</Text>
                    <Text style={add.mealRowType}>{MEAL_TYPES.find(t => t.id === m.type)?.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setMeals(meals.filter((_, j) => j !== i)); setDirty(true); }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={add.deleteBtn}
            onPress={() => Alert.alert("Delete meal plan?", `"${plan.title}" will be gone forever.`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => { onDelete(); onClose(); } },
            ])}
          >
            <Text style={add.deleteBtnText}>🗑 Delete This Plan</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FitnessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const [tab, setTab] = useState<"workout" | "meals">("workout");

  // Workout plan creation + editing
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);

  // Meal plan creation + editing
  const [creatingMealPlan, setCreatingMealPlan] = useState(false);
  const [newMealPlanTitle, setNewMealPlanTitle] = useState("");
  const [editingMealPlan, setEditingMealPlan] = useState<MealPlan | null>(null);

  // Workout log state
  const [loggingPlan, setLoggingPlan] = useState<WorkoutPlan | null>(null);
  const [checkedExercises, setCheckedExercises] = useState<Set<string>>(new Set());
  const [logNote, setLogNote] = useState("");
  const [logPhoto, setLogPhoto] = useState<string | null>(null);

  // Meal log state
  const [loggingMeal, setLoggingMeal] = useState<MealType | null>(null);
  const [mealLogName, setMealLogName] = useState("");
  const [mealLogNote, setMealLogNote] = useState("");
  const [mealLogPhoto, setMealLogPhoto] = useState<string | null>(null);

  function handleCreatePlan() {
    if (!newPlanTitle.trim()) return;
    const plan: WorkoutPlan = {
      id: uid(), kidId: id,
      title: newPlanTitle.trim(),
      exercises: [],
      scheduledDays: [],
      scheduledTime: "07:00",
      reminderEnabled: false,
      createdBy: "kid",
      color: PLAN_COLORS[0],
      createdAt: nowIso(),
    };
    dispatch({ type: "WORKOUT_PLAN_ADD", kidId: id, plan });
    setNewPlanTitle(""); setCreatingPlan(false);
    setEditingPlan(plan);
  }

  function handleCreateMealPlan() {
    if (!newMealPlanTitle.trim()) return;
    const plan: MealPlan = {
      id: uid(), kidId: id,
      title: newMealPlanTitle.trim(),
      meals: [],
      createdBy: "kid",
      active: true,
      createdAt: nowIso(),
    };
    dispatch({ type: "MEAL_PLAN_ADD", kidId: id, plan });
    setNewMealPlanTitle(""); setCreatingMealPlan(false);
    setEditingMealPlan(plan);
  }

  const plans = kid?.workoutPlans ?? [];
  const logs = kid?.workoutLogs ?? [];
  const mealPlans = kid?.mealPlans ?? [];
  const mealLogs = kid?.mealLogs ?? [];
  const activeMealPlan = mealPlans.find(p => p.active);

  const today = todayDateStr();
  const dow = todayDow();
  const todayPlans = plans.filter(p => p.scheduledDays.includes(dow));
  const todayLogs = logs.filter(l => l.date === today);
  const todayMealLogs = mealLogs.filter(l => l.loggedAt.startsWith(today));

  async function pickLogPhoto() {
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setLogPhoto(r.assets[0].uri);
  }

  function submitLog() {
    if (!loggingPlan) return;
    const log: WorkoutLog = {
      id: uid(), kidId: id,
      planId: loggingPlan.id, planTitle: loggingPlan.title,
      date: today, note: logNote.trim() || undefined,
      photoUri: logPhoto ?? undefined,
      submittedAt: nowIso(),
    };
    dispatch({ type: "WORKOUT_LOG_SUBMIT", kidId: id, log });
    dispatch({
      type: "NOTIFICATION_ADD", kidId: id,
      notification: {
        id: uid(), kidId: id, kind: "ping",
        title: `💪 Workout done! "${loggingPlan.title}"`,
        body: logNote.trim() || "Tap to review and award points.",
        read: false, createdAt: nowIso(),
      },
    });
    setLoggingPlan(null); setCheckedExercises(new Set()); setLogNote(""); setLogPhoto(null);
    Alert.alert("🎉 Great job!", "Your workout has been submitted — waiting for your parent to give you points!");
  }

  async function pickMealPhoto() {
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setMealLogPhoto(r.assets[0].uri);
  }

  function submitMealLog() {
    if (!loggingMeal || !mealLogName.trim()) { Alert.alert("Tell me what you ate!"); return; }
    dispatch({
      type: "MEAL_LOG_ADD", kidId: id,
      log: { id: uid(), kidId: id, mealType: loggingMeal, mealName: mealLogName.trim(), note: mealLogNote.trim() || undefined, photoUri: mealLogPhoto ?? undefined, loggedAt: nowIso() },
    });
    setLoggingMeal(null); setMealLogName(""); setMealLogNote(""); setMealLogPhoto(null);
  }

  const pendingLogs = logs.filter(l => l.parentApproved == null);
  const approvedToday = logs.filter(l => l.date === today && l.parentApproved);

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🏋️ Fitness & Meals</Text>

      {/* Points banner */}
      {approvedToday.length > 0 && (
        <View style={s.pointsBanner}>
          <Text style={s.pointsBannerText}>⭐ {approvedToday.reduce((a, l) => a + (l.pointsAwarded ?? 0), 0)} pts earned today from workouts!</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === "workout" && s.tabActive]} onPress={() => setTab("workout")}>
          <Text style={[s.tabText, tab === "workout" && s.tabTextActive]}>💪 Workout</Text>
          {pendingLogs.length > 0 && <View style={s.tabDot} />}
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "meals" && s.tabActive]} onPress={() => setTab("meals")}>
          <Text style={[s.tabText, tab === "meals" && s.tabTextActive]}>🥗 Meal Plan</Text>
        </TouchableOpacity>
      </View>

      {/* ── WORKOUT TAB ── */}
      {tab === "workout" && (
        <>
          {/* Today's workouts */}
          {todayPlans.length > 0 && (
            <>
              <Text style={s.sectionTitle}>📅 Today's Workouts</Text>
              {todayPlans.map(plan => {
                const alreadyLogged = todayLogs.some(l => l.planId === plan.id);
                return (
                  <View key={plan.id} style={[s.planCard, { borderLeftColor: plan.color }]}>
                    <View style={s.planCardTop}>
                      <View style={[s.planColorDot, { backgroundColor: plan.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.planTitle}>{plan.title}</Text>
                        <Text style={s.planMeta}>{plan.exercises.length} exercises · {plan.createdBy === "parent" ? "👪 From parent" : "👤 My plan"}</Text>
                      </View>
                      {alreadyLogged
                        ? <View style={s.doneBadge}><Text style={s.doneBadgeText}>✅ Done!</Text></View>
                        : <TouchableOpacity style={[s.startBtn, { backgroundColor: plan.color }]} onPress={() => { setLoggingPlan(plan); setCheckedExercises(new Set()); }}>
                            <Text style={s.startBtnText}>Start →</Text>
                          </TouchableOpacity>
                      }
                    </View>
                    <View style={s.exerciseList}>
                      {plan.exercises.map(ex => (
                        <View key={ex.id} style={s.exerciseRow}>
                          <Text style={{ fontSize: 18 }}>{ex.emoji}</Text>
                          <Text style={s.exerciseName}>{ex.name}</Text>
                          <Text style={s.exerciseDetail}>{describeExercise(ex)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* Pending approval */}
          {pendingLogs.length > 0 && (
            <>
              <Text style={s.sectionTitle}>⏳ Waiting for Parent Approval</Text>
              {pendingLogs.map(l => (
                <View key={l.id} style={s.logCard}>
                  <Text style={s.logCardTitle}>💪 {l.planTitle}</Text>
                  <Text style={s.logCardDate}>{new Date(l.submittedAt).toLocaleDateString()}</Text>
                  <View style={s.pendingBadge}><Text style={s.pendingBadgeText}>⏳ Waiting for points…</Text></View>
                </View>
              ))}
            </>
          )}

          {/* All plans */}
          <Text style={s.sectionTitle}>📋 My Workout Plans</Text>
          {plans.length === 0 && !creatingPlan && (
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🏋️</Text>
              <Text style={s.emptyTitle}>No workout plans yet!</Text>
              <Text style={s.emptySub}>Create your own or ask your parent to add one for you.</Text>
            </View>
          )}

          {/* Quick-create card */}
          {creatingPlan && (
            <View style={s.createCard}>
              <Text style={s.createLabel}>💪 Plan name</Text>
              <TextInput
                style={s.createInput}
                value={newPlanTitle}
                onChangeText={setNewPlanTitle}
                placeholder="e.g. Morning Power Routine"
                placeholderTextColor={Colors.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreatePlan}
              />
              <TouchableOpacity
                style={[s.createBtn, !newPlanTitle.trim() && { opacity: 0.4 }]}
                onPress={handleCreatePlan}
                disabled={!newPlanTitle.trim()}
              >
                <Text style={s.createBtnText}>Create &amp; Edit ✏️</Text>
              </TouchableOpacity>
            </View>
          )}

          {plans.filter(p => !todayPlans.includes(p)).map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={[s.planCard, { borderLeftColor: plan.color }]}
              onPress={() => setEditingPlan(plan)}
              activeOpacity={0.8}
            >
              <View style={s.planCardTop}>
                <View style={[s.planColorDot, { backgroundColor: plan.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.planTitle}>{plan.title}</Text>
                  <Text style={s.planMeta}>
                    {plan.scheduledDays.map(d => DAY_NAMES[d]).join(", ") || "No days set"} · {plan.exercises.length} exercises
                  </Text>
                </View>
                <Text style={s.editHint}>✏️ Edit</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[s.addBtn, creatingPlan && s.addBtnCancel]}
            onPress={() => { setCreatingPlan(v => !v); setNewPlanTitle(""); }}
          >
            <Text style={s.addBtnText}>{creatingPlan ? "✕ Cancel" : "＋ Create My Own Plan"}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── MEALS TAB ── */}
      {tab === "meals" && (
        <>
          <Text style={s.sectionTitle}>📅 Today's Meals</Text>
          {MEAL_TYPES.map(mt => {
            const planned = activeMealPlan?.meals.filter(m => m.type === mt.id && (m.day == null || m.day === dow)) ?? [];
            const logged = todayMealLogs.filter(l => l.mealType === mt.id);
            return (
              <View key={mt.id} style={s.mealSection}>
                <View style={s.mealSectionHeader}>
                  <Text style={s.mealSectionEmoji}>{mt.emoji}</Text>
                  <Text style={s.mealSectionLabel}>{mt.label}</Text>
                  <Text style={s.mealSectionTime}>{mt.time}</Text>
                </View>
                {planned.map(pm => (
                  <View key={pm.id} style={s.plannedMealRow}>
                    <Text style={{ fontSize: 18 }}>{pm.emoji ?? "🍽"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.plannedMealName}>{pm.name}</Text>
                      {pm.description ? <Text style={s.plannedMealDesc}>{pm.description}</Text> : null}
                    </View>
                    <View style={s.planBadge}><Text style={s.planBadgeText}>📋 Planned</Text></View>
                  </View>
                ))}
                {logged.map(l => (
                  <View key={l.id} style={s.loggedMealRow}>
                    <Text style={{ fontSize: 18 }}>✅</Text>
                    <Text style={s.loggedMealName}>{l.mealName}</Text>
                  </View>
                ))}
                <TouchableOpacity style={s.logMealBtn} onPress={() => { setLoggingMeal(mt.id); setMealLogName(planned[0]?.name ?? ""); }}>
                  <Text style={s.logMealBtnText}>+ Log {mt.label}</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Meal plans */}
          <Text style={s.sectionTitle}>📋 Meal Plans</Text>
          {mealPlans.length === 0 && !creatingMealPlan && (
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🥗</Text>
              <Text style={s.emptyTitle}>No meal plans yet!</Text>
              <Text style={s.emptySub}>Create a healthy eating plan or ask your parent to set one up.</Text>
            </View>
          )}

          {/* Quick-create meal plan card */}
          {creatingMealPlan && (
            <View style={[s.createCard, { borderColor: Colors.success + "30" }]}>
              <Text style={s.createLabel}>🥗 Plan name</Text>
              <TextInput
                style={[s.createInput, { borderColor: Colors.success + "50" }]}
                value={newMealPlanTitle}
                onChangeText={setNewMealPlanTitle}
                placeholder="e.g. Healthy Week Plan"
                placeholderTextColor={Colors.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateMealPlan}
              />
              <TouchableOpacity
                style={[s.createBtn, { backgroundColor: Colors.success }, !newMealPlanTitle.trim() && { opacity: 0.4 }]}
                onPress={handleCreateMealPlan}
                disabled={!newMealPlanTitle.trim()}
              >
                <Text style={s.createBtnText}>Create &amp; Edit ✏️</Text>
              </TouchableOpacity>
            </View>
          )}

          {mealPlans.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={[s.planCard, { borderLeftColor: Colors.success }, plan.active && s.planCardActive]}
              onPress={() => setEditingMealPlan(plan)}
              activeOpacity={0.8}
            >
              <View style={s.planCardTop}>
                <Text style={s.planTitle}>{plan.title}</Text>
                {plan.active && <View style={s.activeBadge}><Text style={s.activeBadgeText}>✅ Active</Text></View>}
                <Text style={s.editHint}>✏️</Text>
              </View>
              <Text style={s.planMeta}>{plan.meals.length} meals · {plan.createdBy === "parent" ? "👪 From parent" : "👤 Mine"}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[s.addBtn, { borderColor: Colors.success }, creatingMealPlan && { borderColor: Colors.error }]}
            onPress={() => { setCreatingMealPlan(v => !v); setNewMealPlanTitle(""); }}
          >
            <Text style={[s.addBtnText, { color: creatingMealPlan ? Colors.error : Colors.success }]}>
              {creatingMealPlan ? "✕ Cancel" : "＋ Create Meal Plan"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Workout Log Modal ── */}
      <Modal visible={!!loggingPlan} animationType="slide" onRequestClose={() => setLoggingPlan(null)}>
        <SafeAreaView style={log.container}>
          <ScrollView contentContainerStyle={log.scroll} keyboardShouldPersistTaps="handled">
            <View style={log.topBar}>
              <TouchableOpacity onPress={() => setLoggingPlan(null)}><Text style={log.cancel}>Cancel</Text></TouchableOpacity>
              <Text style={log.heading}>💪 {loggingPlan?.title}</Text>
            </View>
            <Text style={log.sub}>Check off each exercise as you complete it!</Text>

            {loggingPlan?.exercises.map(ex => {
              const done = checkedExercises.has(ex.id);
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={[log.exerciseBtn, done && log.exerciseBtnDone]}
                  onPress={() => {
                    const next = new Set(checkedExercises);
                    done ? next.delete(ex.id) : next.add(ex.id);
                    setCheckedExercises(next);
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{ex.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[log.exerciseName, done && log.exerciseNameDone]}>{ex.name}</Text>
                    <Text style={log.exerciseDetail}>{describeExercise(ex)}</Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>{done ? "✅" : "⬜"}</Text>
                </TouchableOpacity>
              );
            })}

            <Text style={log.label}>How did it go? (optional)</Text>
            <TextInput
              style={log.input}
              value={logNote}
              onChangeText={setLogNote}
              placeholder="e.g. It was hard but I did it! 💪"
              multiline
            />

            <TouchableOpacity style={log.photoBtn} onPress={pickLogPhoto}>
              {logPhoto
                ? <Image source={{ uri: logPhoto }} style={log.photoPreview} resizeMode="cover" />
                : <><Text style={{ fontSize: 28 }}>📸</Text><Text style={log.photoBtnText}>Add a proof photo (optional)</Text></>
              }
            </TouchableOpacity>

            <View style={log.progressRow}>
              <Text style={log.progressText}>{checkedExercises.size} / {loggingPlan?.exercises.length ?? 0} done</Text>
              <View style={log.progressBar}>
                <View style={[log.progressFill, {
                  width: `${Math.round((checkedExercises.size / Math.max(loggingPlan?.exercises.length ?? 1, 1)) * 100)}%` as any,
                }]} />
              </View>
            </View>

            <TouchableOpacity style={log.submitBtn} onPress={submitLog}>
              <Text style={log.submitBtnText}>🏆 Submit Workout!</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Meal Log Modal ── */}
      <Modal visible={!!loggingMeal} animationType="slide" transparent onRequestClose={() => setLoggingMeal(null)}>
        <View style={log.overlay}>
          <View style={log.mealModal}>
            <Text style={log.mealModalTitle}>{MEAL_TYPES.find(t => t.id === loggingMeal)?.emoji} Log {MEAL_TYPES.find(t => t.id === loggingMeal)?.label}</Text>
            <TextInput style={log.input} value={mealLogName} onChangeText={setMealLogName} placeholder="What did you eat?" autoFocus />
            <TextInput style={[log.input, { minHeight: 60, textAlignVertical: "top" }]} value={mealLogNote} onChangeText={setMealLogNote} placeholder="Anything to add? (optional)" multiline />
            <TouchableOpacity style={log.photoBtn} onPress={pickMealPhoto}>
              {mealLogPhoto
                ? <Image source={{ uri: mealLogPhoto }} style={log.photoPreview} resizeMode="cover" />
                : <><Text style={{ fontSize: 24 }}>📸</Text><Text style={log.photoBtnText}>Add photo (optional)</Text></>
              }
            </TouchableOpacity>
            <View style={log.mealModalBtns}>
              <TouchableOpacity style={log.cancelBtn} onPress={() => setLoggingMeal(null)}><Text style={log.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={log.mealSaveBtn} onPress={submitMealLog}><Text style={log.mealSaveBtnText}>✅ Log It!</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Workout Plan Editor */}
      {editingPlan && (
        <WorkoutPlanEditor
          plan={editingPlan}
          kidId={id}
          onSave={updated => {
            dispatch({ type: "WORKOUT_PLAN_REMOVE", kidId: id, planId: updated.id });
            dispatch({ type: "WORKOUT_PLAN_ADD", kidId: id, plan: updated });
          }}
          onDelete={() => dispatch({ type: "WORKOUT_PLAN_REMOVE", kidId: id, planId: editingPlan.id })}
          onClose={() => setEditingPlan(null)}
        />
      )}

      {/* Meal Plan Editor */}
      {editingMealPlan && (
        <MealPlanEditor
          plan={editingMealPlan}
          onSave={updated => {
            dispatch({ type: "MEAL_PLAN_REMOVE", kidId: id, planId: updated.id });
            dispatch({ type: "MEAL_PLAN_ADD", kidId: id, plan: updated });
          }}
          onDelete={() => dispatch({ type: "MEAL_PLAN_REMOVE", kidId: id, planId: editingMealPlan.id })}
          onClose={() => setEditingMealPlan(null)}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  pointsBanner: { backgroundColor: Colors.warning + "20", borderRadius: Radius.lg, padding: 10, marginBottom: Spacing.sm, alignItems: "center" },
  pointsBannerText: { fontWeight: "800", color: Colors.warning, fontSize: FontSize.base },
  tabs: { flexDirection: "row", backgroundColor: Colors.cardLight, borderRadius: Radius.full, padding: 4, marginBottom: Spacing.md, gap: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.full, flexDirection: "row", justifyContent: "center", gap: 6 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  tabDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  planCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 10, padding: Spacing.md, borderLeftWidth: 4, ...Shadow.sm },
  planCardActive: { borderWidth: 2, borderColor: Colors.success },
  planCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  planColorDot: { width: 14, height: 14, borderRadius: 7 },
  planTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, flex: 1 },
  planMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  exerciseList: { gap: 6, marginTop: 4 },
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  exerciseName: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "600" },
  exerciseDetail: { fontSize: FontSize.xs, color: Colors.textSecondary },
  doneBadge: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  doneBadgeText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.success },
  startBtn: { borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  startBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  activeBadge: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.success },
  logCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  logCardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  logCardDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, marginBottom: 6 },
  pendingBadge: { backgroundColor: Colors.warning + "20", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  pendingBadgeText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.warning },
  empty: { alignItems: "center", paddingVertical: Spacing.lg, gap: 10 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  addBtn: { borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, marginTop: 4, marginBottom: Spacing.sm },
  addBtnCancel: { borderColor: Colors.error },
  addBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  editHint: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
  createCard: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary + "30" },
  createLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8 },
  createInput: { borderWidth: 2, borderColor: Colors.primary + "50", borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 12 },
  createBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  mealSection: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 10, overflow: "hidden", ...Shadow.sm },
  mealSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.cardLight, padding: 10 },
  mealSectionEmoji: { fontSize: 22 },
  mealSectionLabel: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary, flex: 1 },
  mealSectionTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  plannedMealRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  plannedMealName: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  plannedMealDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  planBadge: { backgroundColor: Colors.primary + "15", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  planBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.primary },
  loggedMealRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  loggedMealName: { fontSize: FontSize.sm, color: Colors.success, fontWeight: "600" },
  logMealBtn: { margin: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 8 },
  logMealBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
});

const add = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { padding: Spacing.md, gap: 6 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border },
  cancel: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  heading: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  saveBtn: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base },
  savePill: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  savePillText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  deleteBtn: { marginTop: Spacing.md, borderWidth: 2, borderColor: Colors.error + "50", borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  deleteBtnText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight },
  colorRow: { flexDirection: "row", gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: Colors.textPrimary },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetBtn: { width: "30%", borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 8, alignItems: "center", gap: 4, backgroundColor: Colors.surfaceLight },
  presetName: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, textAlign: "center" },
  presetDetail: { fontSize: 9, color: Colors.textMuted, textAlign: "center" },
  dayRow: { flexDirection: "row", gap: 6 },
  dayBtn: { flex: 1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: "center", paddingVertical: 8, backgroundColor: Colors.cardLight },
  dayText: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  toggleBtn: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 12 },
  toggleText: { fontWeight: "700", color: Colors.textSecondary },
  submitBtn: { borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginTop: Spacing.md, ...Shadow.md },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  mealTypeRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  mealTypeBtn: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.cardLight },
  mealTypeBtnActive: { backgroundColor: Colors.success + "15", borderColor: Colors.success },
  mealTypeTxt: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  mealTypeTxtActive: { color: Colors.success },
  mealInputRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  addMealBtn: { borderWidth: 2, borderColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  addMealBtnText: { color: Colors.success, fontWeight: "700" },
  mealList: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, overflow: "hidden" },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  mealRowName: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  mealRowType: { fontSize: FontSize.xs, color: Colors.textSecondary },
});

const log = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { padding: Spacing.md },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  cancel: { color: Colors.textSecondary, fontWeight: "700" },
  heading: { flex: 1, fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  exerciseBtn: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, borderWidth: 2, borderColor: Colors.border, ...Shadow.sm },
  exerciseBtnDone: { borderColor: Colors.success, backgroundColor: Colors.success + "10" },
  exerciseName: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  exerciseNameDone: { color: Colors.success },
  exerciseDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: 8 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight, marginBottom: 10 },
  photoBtn: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", gap: 6, flexDirection: "row", justifyContent: "center", backgroundColor: Colors.cardLight, marginBottom: Spacing.md },
  photoPreview: { width: "100%", height: 180, borderRadius: Radius.lg },
  photoBtnText: { color: Colors.primary, fontWeight: "600" },
  progressRow: { gap: 8, marginBottom: Spacing.md },
  progressText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  progressBar: { height: 10, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: "hidden" },
  progressFill: { height: 10, backgroundColor: Colors.success, borderRadius: Radius.full },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 16, ...Shadow.md },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  // Meal log modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  mealModal: { backgroundColor: Colors.surfaceLight, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: 10 },
  mealModalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  mealModalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  mealSaveBtn: { flex: 2, backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, ...Shadow.sm },
  mealSaveBtnText: { color: "#fff", fontWeight: "800" },
});
