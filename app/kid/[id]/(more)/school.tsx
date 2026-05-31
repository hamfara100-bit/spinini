import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Modal, Alert, Platform, Image,
} from "react-native";
const notif = () => import("expo-notifications");
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { GradeValue, GRADE_COLOR, ClassGrade, ScheduleEvent, Assignment } from "../../../../lib/data/types";
import { uid, nowIso } from "../../../../lib/utils";

// ─── Config ───────────────────────────────────────────────────────────────────

const ALL_GRADES: GradeValue[] = ["A+","A","A-","B+","B","B-","C+","C","C-","D","F"];
const GRADE_EMOJI: Record<GradeValue,string> = {
  "A+":"🏆","A":"⭐","A-":"🌟","B+":"😊","B":"👍","B-":"✅",
  "C+":"📖","C":"📝","C-":"💪","D":"📚","F":"🔄",
};
const SUBJECTS = ["Math","English","Science","History","Art","Music","PE","Spanish","French","Other"];
const PERIODS  = ["Q1","Q2","Q3","Q4","Semester 1","Semester 2","Full Year","Term 1","Term 2","Term 3"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CATS: { id: ScheduleEvent["category"]; emoji: string; label: string; color: string }[] = [
  { id: "school",   emoji: "🏫", label: "Class",    color: Colors.primary },
  { id: "activity", emoji: "⚽", label: "Activity", color: "#F59E0B" },
  { id: "family",   emoji: "👨‍👩‍👧", label: "Family",   color: "#34D399" },
];

function gradeGPA(g: GradeValue) {
  const m: Record<GradeValue,number> = { "A+":4.3,"A":4.0,"A-":3.7,"B+":3.3,"B":3.0,"B-":2.7,"C+":2.3,"C":2.0,"C-":1.7,"D":1.0,"F":0.0 };
  return m[g];
}

function fmt12(h: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:00 ${ampm}`;
}

// ─── Schedule reminder helper ─────────────────────────────────────────────────

async function scheduleReminder(event: ScheduleEvent) {
  try {
    const N = await notif();
    const { status } = await N.requestPermissionsAsync();
    if (status !== "granted") return;
    await N.cancelScheduledNotificationAsync(event.id).catch(() => {});
    const [hStr] = event.startTime.split(":");
    const hour = parseInt(hStr);
    const dayIndex = DAY_FULL.findIndex(d => event.date.includes(d));
    const weekday = dayIndex >= 0 ? dayIndex + 1 : 2;
    await N.scheduleNotificationAsync({
      identifier: event.id,
      content: { title: `⏰ ${event.title}`, body: `Starting at ${fmt12(hour)} — don't forget!` },
      trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute: 0 },
    });
  } catch {}
}

async function cancelReminder(eventId: string) {
  try { const N = await notif(); await N.cancelScheduledNotificationAsync(eventId); } catch {}
}

async function scheduleAssignmentReminder(assignment: Assignment) {
  if (!assignment.dueDate) return;
  try {
    const N = await notif();
    const { status } = await N.requestPermissionsAsync();
    if (status !== "granted") return;
    await N.cancelScheduledNotificationAsync(assignment.id).catch(() => {});
    const due = new Date(assignment.dueDate);
    due.setHours(8, 0, 0, 0);
    if (due <= new Date()) return;
    await N.scheduleNotificationAsync({
      identifier: assignment.id,
      content: { title: `📝 Assignment Due Today!`, body: `${assignment.subject}: ${assignment.title} — due today!` },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: due },
    });
  } catch {}
}

// ─── Add Assignment Modal ─────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function AddAssignmentModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (a: Omit<Assignment,"id"|"kidId"|"createdAt"|"proofUris"|"bonusPoints">) => void;
}) {
  const now = new Date();
  const [subject, setSubject] = useState("Math");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [hasDueDate, setHasDueDate] = useState(false);
  const [month, setMonth] = useState(now.getMonth());
  const [day, setDay] = useState(now.getDate());
  const [year, setYear] = useState(now.getFullYear());
  const [reminder, setReminder] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const years = [now.getFullYear(), now.getFullYear() + 1];

  function reset() {
    setTitle(""); setDesc(""); setSubject("Math");
    setHasDueDate(false); setMonth(now.getMonth()); setDay(now.getDate());
    setReminder(true); setPhotoUri(undefined);
  }

  async function pickPhoto() {
    Alert.alert("Add Photo", "Choose a source", [
      {
        text: "Camera", onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") return;
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: "Photo Library", onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") return;
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function save() {
    if (!title.trim()) { Alert.alert("Title needed", "Please enter a task name."); return; }
    const dueDate = hasDueDate
      ? `${year}-${String(month + 1).padStart(2,"0")}-${String(Math.min(day, daysInMonth)).padStart(2,"0")}`
      : "";
    onSave({ subject, title: title.trim(), description: desc.trim() || undefined, photoUri, dueDate, status: "pending" });
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <ScrollView style={ms.sheet} keyboardShouldPersistTaps="handled">
          <Text style={ms.sheetTitle}>📝 Add Assignment</Text>

          <Text style={ms.label}>Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.chipRow}>
            {SUBJECTS.map(s => (
              <TouchableOpacity key={s} style={[ms.chip, subject===s && ms.chipActive]} onPress={() => setSubject(s)}>
                <Text style={[ms.chipText, subject===s && ms.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={ms.label}>Task Name</Text>
          <TextInput style={ms.input} value={title} onChangeText={setTitle} placeholder="e.g. Chapter 5 Reading, Science Project…" autoFocus />

          <Text style={ms.label}>Notes (optional)</Text>
          <TextInput style={[ms.input, { height: 60 }]} value={desc} onChangeText={setDesc} placeholder="Any extra details…" multiline />

          {/* Photo picker */}
          <Text style={ms.label}>Photo (optional)</Text>
          {photoUri ? (
            <View style={{ marginBottom: 8 }}>
              <Image source={{ uri: photoUri }} style={ms.photoPreview} resizeMode="cover" />
              <TouchableOpacity onPress={() => setPhotoUri(undefined)} style={ms.removePhotoBtn}>
                <Text style={ms.removePhotoText}>✕ Remove photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={ms.photoPickerBtn} onPress={pickPhoto}>
              <Text style={ms.photoPickerText}>📷 Add a photo of the assignment</Text>
            </TouchableOpacity>
          )}

          {/* Due date toggle */}
          <TouchableOpacity
            style={[ms.reminderRow, hasDueDate && ms.reminderActive]}
            onPress={() => setHasDueDate(v => !v)}
          >
            <Text style={ms.reminderEmoji}>📅</Text>
            <Text style={[ms.reminderText, hasDueDate && { color: Colors.primary }]}>
              {hasDueDate ? "Due date set — tap to remove" : "Add a due date (optional)"}
            </Text>
          </TouchableOpacity>

          {hasDueDate && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[ms.timeScroll, { marginTop: 10 }]} contentContainerStyle={{ gap: 6 }}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={[ms.timeBtn, month===i && ms.timeBtnActive]} onPress={() => setMonth(i)}>
                    <Text style={[ms.timeText, month===i && ms.timeTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[ms.timeScroll, { flex: 3 }]} contentContainerStyle={{ gap: 6 }}>
                  {days.map(d => (
                    <TouchableOpacity key={d} style={[ms.timeBtn, day===d && ms.timeBtnActive]} onPress={() => setDay(d)}>
                      <Text style={[ms.timeText, day===d && ms.timeTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[ms.timeBtn, year===y && ms.timeBtnActive]} onPress={() => setYear(y)}>
                      <Text style={[ms.timeText, year===y && ms.timeTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={[ms.reminderRow, reminder && ms.reminderActive]} onPress={() => setReminder(r => !r)}>
                <Text style={ms.reminderEmoji}>🔔</Text>
                <Text style={[ms.reminderText, reminder && { color: Colors.primary }]}>
                  {reminder ? "Remind me on due date at 8 AM" : "No reminder"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.saveBtn} onPress={save}>
              <Text style={ms.saveText}>Add Assignment</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Add Schedule Modal ───────────────────────────────────────────────────────

function AddScheduleModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (e: Omit<ScheduleEvent,"id"|"kidId">) => void;
}) {
  const [title, setTitle] = useState("");
  const [hour, setHour] = useState(8);
  const [endHour, setEndHour] = useState(9);
  const [days, setDays] = useState<number[]>([1]); // Mon default
  const [cat, setCat] = useState<ScheduleEvent["category"]>("school");
  const [reminder, setReminder] = useState(true);

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function save() {
    if (!title.trim()) { Alert.alert("Name needed", "Please enter an event name."); return; }
    if (days.length === 0) { Alert.alert("Pick a day", "Select at least one day."); return; }
    // Create one event per selected day (using day name as "date" field for recurring)
    days.forEach(d => {
      onSave({
        title: title.trim(),
        startTime: `${String(hour).padStart(2,"0")}:00`,
        endTime: `${String(endHour).padStart(2,"0")}:00`,
        date: DAY_FULL[d],
        category: cat,
        reminder,
      });
    });
    setTitle(""); setHour(8); setEndHour(9); setDays([1]); setCat("school"); setReminder(true);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <ScrollView style={ms.sheet} keyboardShouldPersistTaps="handled">
          <Text style={ms.sheetTitle}>📅 Add to Schedule</Text>

          <Text style={ms.label}>Event Name</Text>
          <TextInput style={ms.input} value={title} onChangeText={setTitle} placeholder="e.g. Math Class, Football Practice…" autoFocus />

          <Text style={ms.label}>Category</Text>
          <View style={ms.catRow}>
            {CATS.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[ms.catBtn, { borderColor: c.color }, cat === c.id && { backgroundColor: c.color }]}
                onPress={() => setCat(c.id)}
              >
                <Text style={ms.catEmoji}>{c.emoji}</Text>
                <Text style={[ms.catLabel, cat === c.id && { color: "#fff" }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={ms.label}>Days</Text>
          <View style={ms.dayRow}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={d}
                style={[ms.dayBtn, days.includes(i) && ms.dayBtnActive]}
                onPress={() => toggleDay(i)}
              >
                <Text style={[ms.dayText, days.includes(i) && ms.dayTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={ms.label}>Start Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.timeScroll} contentContainerStyle={{ gap: 6 }}>
            {HOURS.map(h => (
              <TouchableOpacity key={h} style={[ms.timeBtn, hour === h && ms.timeBtnActive]} onPress={() => { setHour(h); if (endHour <= h) setEndHour(h + 1); }}>
                <Text style={[ms.timeText, hour === h && ms.timeTextActive]}>{fmt12(h)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={ms.label}>End Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.timeScroll} contentContainerStyle={{ gap: 6 }}>
            {HOURS.filter(h => h > hour).map(h => (
              <TouchableOpacity key={h} style={[ms.timeBtn, endHour === h && ms.timeBtnActive]} onPress={() => setEndHour(h)}>
                <Text style={[ms.timeText, endHour === h && ms.timeTextActive]}>{fmt12(h)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={[ms.reminderRow, reminder && ms.reminderActive]} onPress={() => setReminder(r => !r)}>
            <Text style={ms.reminderEmoji}>🔔</Text>
            <Text style={[ms.reminderText, reminder && { color: Colors.primary }]}>
              {reminder ? "Reminder ON — I'll get notified!" : "No reminder"}
            </Text>
          </TouchableOpacity>

          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.saveBtn} onPress={save}>
              <Text style={ms.saveText}>Add to Schedule</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Add Grade Modal ──────────────────────────────────────────────────────────

function AddGradeModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (g: Omit<ClassGrade,"id"|"kidId"|"addedAt"|"addedBy">) => void;
}) {
  const [subject, setSubject] = useState("Math");
  const [period, setPeriod]   = useState("Q1");
  const [grade, setGrade]     = useState<GradeValue>("B");
  const [pct, setPct]         = useState("");
  const [teacher, setTeacher] = useState("");
  const [notes, setNotes]     = useState("");

  function save() {
    onSave({ subject, period, grade, percentage: pct ? parseFloat(pct) : undefined, teacher: teacher||undefined, notes: notes||undefined });
    setSubject("Math"); setPeriod("Q1"); setGrade("B"); setPct(""); setTeacher(""); setNotes("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <ScrollView style={ms.sheet} keyboardShouldPersistTaps="handled">
          <Text style={ms.sheetTitle}>📊 Add Grade</Text>

          <Text style={ms.label}>Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.chipRow}>
            {SUBJECTS.map(s => (
              <TouchableOpacity key={s} style={[ms.chip, subject===s && ms.chipActive]} onPress={() => setSubject(s)}>
                <Text style={[ms.chipText, subject===s && ms.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={ms.label}>Period / Term</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.chipRow}>
            {PERIODS.map(p => (
              <TouchableOpacity key={p} style={[ms.chip, period===p && ms.chipActive]} onPress={() => setPeriod(p)}>
                <Text style={[ms.chipText, period===p && ms.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={ms.label}>Grade</Text>
          <View style={ms.gradeGrid}>
            {ALL_GRADES.map(g => (
              <TouchableOpacity
                key={g}
                style={[ms.gradePill, { borderColor: GRADE_COLOR[g] }, grade===g && { backgroundColor: GRADE_COLOR[g] }]}
                onPress={() => setGrade(g)}
              >
                <Text style={[ms.gradePillText, { color: grade===g ? "#fff" : GRADE_COLOR[g] }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput style={ms.input} value={pct} onChangeText={setPct} placeholder="Score % (optional, e.g. 94)" keyboardType="numeric" />
          <TextInput style={ms.input} value={teacher} onChangeText={setTeacher} placeholder="Teacher name (optional)" />
          <TextInput style={[ms.input, { height: 60 }]} value={notes} onChangeText={setNotes} placeholder="Notes (optional)" multiline />

          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.saveBtn} onPress={save}>
              <Text style={ms.saveText}>Save Grade</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── GPA Card ─────────────────────────────────────────────────────────────────

function GPACard({ grades }: { grades: ClassGrade[] }) {
  if (!grades.length) return null;
  const avg = grades.reduce((s, g) => s + gradeGPA(g.grade), 0) / grades.length;
  const color = avg >= 3.5 ? Colors.success : avg >= 3.0 ? Colors.primary : avg >= 2.0 ? Colors.warning : Colors.error;
  return (
    <View style={s.gpaCard}>
      <View style={s.gpaLeft}>
        <Text style={[s.gpaNumber, { color }]}>{avg.toFixed(2)}</Text>
        <Text style={s.gpaLabel}>GPA</Text>
      </View>
      <View style={s.gpaDivider} />
      <View style={s.gpaStats}>
        <Text style={s.gpaStat}>🏆 {grades.filter(g => g.grade.startsWith("A")).length} A's</Text>
        <Text style={s.gpaStat}>👍 {grades.filter(g => g.grade.startsWith("B")).length} B's</Text>
        <Text style={s.gpaStat}>📚 {grades.length} classes</Text>
      </View>
    </View>
  );
}

// ─── Schedule Week View ───────────────────────────────────────────────────────

function WeekSchedule({ events, onDelete }: { events: ScheduleEvent[]; onDelete: (e: ScheduleEvent) => void }) {
  const today = DAY_FULL[new Date().getDay()];
  const ordered = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  // Group by day name
  const byDay: Record<string, ScheduleEvent[]> = {};
  for (const e of events) {
    const day = DAY_FULL.find(d => e.date.includes(d)) ?? e.date;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  }

  const daysWithEvents = ordered.filter(d => byDay[d]?.length);

  if (daysWithEvents.length === 0) return null;

  return (
    <>
      {daysWithEvents.map(day => (
        <View key={day} style={s.daySection}>
          <View style={[s.dayHeader, day === today && s.dayHeaderToday]}>
            <Text style={[s.dayHeaderText, day === today && s.dayHeaderTextToday]}>
              {day === today ? "📍 Today — " : ""}{day}
            </Text>
          </View>
          {(byDay[day] ?? []).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(e => {
            const catDef = CATS.find(c => c.id === e.category) ?? CATS[0];
            return (
              <View key={e.id} style={[s.eventCard, { borderLeftColor: catDef.color }]}>
                <View style={[s.eventDot, { backgroundColor: catDef.color }]}>
                  <Text style={{ fontSize: 14 }}>{catDef.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.eventTitle}>{e.title}</Text>
                  <Text style={s.eventTime}>
                    {fmt12(parseInt(e.startTime))}
                    {e.endTime ? ` – ${fmt12(parseInt(e.endTime))}` : ""}
                    {e.reminder ? "  🔔" : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => onDelete(e)} style={s.deleteBtn}>
                  <Text style={s.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SchoolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [tab, setTab] = useState<"grades"|"assignments"|"behavior"|"schedule">("grades");
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);

  if (!kid) return null;

  function addGrade(data: Omit<ClassGrade,"id"|"kidId"|"addedAt"|"addedBy">) {
    dispatch({ type: "GRADE_ADD", kidId: id, grade: { id: uid(), kidId: id, addedBy: "kid", addedAt: nowIso(), ...data } });
  }

  async function addAssignment(data: Omit<Assignment,"id"|"kidId"|"createdAt"|"proofUris"|"bonusPoints">) {
    const assignment: Assignment = { id: uid(), kidId: id, createdAt: nowIso(), proofUris: [], bonusPoints: 0, ...data };
    dispatch({ type: "ASSIGNMENT_ADD", kidId: id, assignment });
    await scheduleAssignmentReminder(assignment);
  }

  function toggleAssignment(assignmentId: string, current: string) {
    const next = current === "done" ? "pending" : "done";
    dispatch({ type: "ASSIGNMENT_UPDATE", kidId: id, assignmentId, payload: { status: next as any } });
  }

  function deleteAssignment(a: Assignment) {
    Alert.alert("Remove task?", `"${a.title}"`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        dispatch({ type: "ASSIGNMENT_REMOVE", kidId: id, assignmentId: a.id });
        cancelReminder(a.id);
      }},
    ]);
  }

  async function addScheduleEvent(data: Omit<ScheduleEvent,"id"|"kidId">) {
    const event: ScheduleEvent = { id: uid(), kidId: id, ...data };
    dispatch({ type: "SCHEDULE_ADD", kidId: id, event });
    if (data.reminder) await scheduleReminder(event);
  }

  function deleteScheduleEvent(event: ScheduleEvent) {
    Alert.alert("Remove event", `Remove "${event.title}" from schedule?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        dispatch({ type: "SCHEDULE_REMOVE", kidId: id, eventId: event.id });
        await cancelReminder(event.id);
      }},
    ]);
  }

  const TABS = [
    { id: "grades"      as const, label: "Grades"   },
    { id: "assignments" as const, label: "Tasks"     },
    { id: "behavior"    as const, label: "Points"    },
    { id: "schedule"    as const, label: "Schedule"  },
  ];

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>📚 School Hub</Text>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[s.tab, tab===t.id && s.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[s.tabText, tab===t.id && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Grades ── */}
      {tab === "grades" && (
        <>
          <GPACard grades={kid.grades} />
          {kid.grades.filter(g => g.grade === "A+" || g.grade === "A").length > 0 && (
            <View style={s.honorBanner}>
              <Text style={s.honorText}>🏆 Honor Roll material! Keep it up!</Text>
            </View>
          )}
          {kid.grades.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 52 }}>📊</Text>
              <Text style={s.emptyTitle}>No grades yet</Text>
              <Text style={s.emptySub}>Add your first grade below</Text>
            </View>
          ) : (
            kid.grades.map(g => (
              <View key={g.id} style={[s.gradeCard, { borderLeftColor: GRADE_COLOR[g.grade] }]}>
                <View style={[s.gradeCircle, { backgroundColor: GRADE_COLOR[g.grade] }]}>
                  <Text style={s.gradeCircleText}>{g.grade}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.gradeSubject}>{g.subject}</Text>
                  <Text style={s.gradeMeta}>{g.period}{g.teacher ? ` · ${g.teacher}` : ""}</Text>
                  {g.percentage !== undefined && (
                    <Text style={[s.gradePct, { color: GRADE_COLOR[g.grade] }]}>{g.percentage}%</Text>
                  )}
                  {g.notes ? <Text style={s.gradeNotes}>{g.notes}</Text> : null}
                </View>
                <Text style={{ fontSize: 26 }}>{GRADE_EMOJI[g.grade]}</Text>
              </View>
            ))
          )}
          {/* Compact centered add button */}
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddGrade(true)}>
            <Text style={s.addBtnText}>+ Add Grade</Text>
          </TouchableOpacity>
          <AddGradeModal visible={showAddGrade} onClose={() => setShowAddGrade(false)} onSave={addGrade} />
        </>
      )}

      {/* ── Assignments ── */}
      {tab === "assignments" && (
        <>
          {kid.assignments.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 52 }}>📝</Text>
              <Text style={s.emptyTitle}>No tasks yet!</Text>
              <Text style={s.emptySub}>Add your homework and assignments below — you can get a reminder when they're due!</Text>
            </View>
          ) : (
            <>
              {/* Pending first, then done */}
              {[...kid.assignments]
                .sort((a, b) => {
                  if (a.status === "done" && b.status !== "done") return 1;
                  if (a.status !== "done" && b.status === "done") return -1;
                  // No due date sorts last
                  if (!a.dueDate && !b.dueDate) return 0;
                  if (!a.dueDate) return 1;
                  if (!b.dueDate) return -1;
                  return a.dueDate.localeCompare(b.dueDate);
                })
                .map(a => {
                  const isDone = a.status === "done";
                  const color = { pending: Colors.warning, done: Colors.success, missing: Colors.error, late: Colors.error }[a.status] ?? Colors.warning;
                  const dueDisplay = (() => {
                    if (!a.dueDate) return "No due date";
                    const d = new Date(a.dueDate + "T00:00:00");
                    const today = new Date(); today.setHours(0,0,0,0);
                    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
                    if (diff === 0) return "Due TODAY ⚡";
                    if (diff === 1) return "Due tomorrow";
                    if (diff < 0) return `${Math.abs(diff)}d overdue`;
                    return `Due in ${diff} days — ${d.toLocaleDateString("en-US",{ month:"short", day:"numeric" })}`;
                  })();
                  const isOverdue = a.dueDate && a.dueDate < new Date().toISOString().slice(0,10) && !isDone;
                  return (
                    <View key={a.id} style={[s.card, { borderLeftColor: color, borderLeftWidth: 4, opacity: isDone ? 0.6 : 1 }]}>
                      <TouchableOpacity onPress={() => toggleAssignment(a.id, a.status)} style={s.checkBtn}>
                        <Text style={{ fontSize: 24 }}>{isDone ? "✅" : "⬜"}</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.cardTitle, isDone && { textDecorationLine: "line-through", color: Colors.textMuted }]}>
                          {a.subject}: {a.title}
                        </Text>
                        <Text style={[s.cardSub, { color: isOverdue ? Colors.error : Colors.textSecondary }]}>
                          {dueDisplay}
                        </Text>
                        {a.description ? <Text style={s.cardNote}>{a.description}</Text> : null}
                        {a.photoUri ? (
                          <Image source={{ uri: a.photoUri }} style={s.assignmentThumb} resizeMode="cover" />
                        ) : null}
                      </View>
                      <TouchableOpacity onPress={() => deleteAssignment(a)} style={s.deleteBtn}>
                        <Text style={s.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
            </>
          )}
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddAssignment(true)}>
            <Text style={s.addBtnText}>+ Add Assignment</Text>
          </TouchableOpacity>
          <AddAssignmentModal visible={showAddAssignment} onClose={() => setShowAddAssignment(false)} onSave={addAssignment} />
        </>
      )}

      {/* ── Behavior ── */}
      {tab === "behavior" && (
        <>
          {/* Explanation banner */}
          <View style={s.behaviorInfo}>
            <Text style={s.behaviorInfoTitle}>⭐ How Points Work</Text>
            <Text style={s.behaviorInfoText}>
              Your parent awards you points for great behavior — like being kind, helping out, or doing your best at school. Points can be taken away for rule-breaking. Collect points to earn rewards!
            </Text>
          </View>

          <View style={s.behaviorCard}>
            <Text style={s.behaviorScore}>{kid.behavior.totalPoints}</Text>
            <Text style={s.behaviorLabel}>Your Behavior Points ⭐</Text>

            {kid.behavior.totalPoints >= 100 && (
              <View style={[s.honorBanner, { marginTop: 12 }]}>
                <Text style={s.honorText}>🏆 Amazing! You're a star!</Text>
              </View>
            )}
            {kid.behavior.totalPoints >= 50 && kid.behavior.totalPoints < 100 && (
              <View style={[s.honorBanner, { marginTop: 12 }]}>
                <Text style={s.honorText}>😊 Great job — keep it up!</Text>
              </View>
            )}

            {kid.behavior.events.length === 0 ? (
              <Text style={[s.emptySub, { textAlign: "center", marginTop: 20 }]}>
                No points yet — be awesome and earn your first star! ⭐
              </Text>
            ) : (
              <>
                <Text style={[s.behaviorLabel, { marginTop: 16, marginBottom: 4, fontSize: FontSize.xs, textAlign: "left" }]}>HISTORY</Text>
                {[...kid.behavior.events].reverse().slice(0, 20).map(e => (
                  <View key={e.id} style={s.behaviorRow}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>{e.points > 0 ? "⭐" : "💔"}</Text>
                    <Text style={s.behaviorReason} numberOfLines={2}>{e.reason}</Text>
                    <Text style={[s.behaviorDelta, { color: e.points > 0 ? Colors.success : Colors.error }]}>
                      {e.points > 0 ? "+" : ""}{e.points}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </>
      )}

      {/* ── Schedule ── */}
      {tab === "schedule" && (
        <>
          {/* Today's at-a-glance */}
          {(() => {
            const today = DAY_FULL[new Date().getDay()];
            const todayEvents = kid.schedule
              .filter(e => e.date.includes(today))
              .sort((a,b) => a.startTime.localeCompare(b.startTime));
            if (todayEvents.length === 0) return null;
            return (
              <View style={s.todayBanner}>
                <Text style={s.todayBannerTitle}>📍 Today's Schedule</Text>
                {todayEvents.map(e => {
                  const catDef = CATS.find(c => c.id === e.category) ?? CATS[0];
                  return (
                    <Text key={e.id} style={s.todayItem}>
                      {catDef.emoji} {fmt12(parseInt(e.startTime))} — {e.title}
                    </Text>
                  );
                })}
              </View>
            );
          })()}

          <WeekSchedule events={kid.schedule} onDelete={deleteScheduleEvent} />

          {kid.schedule.length === 0 && (
            <View style={s.empty}>
              <Text style={{ fontSize: 52 }}>📅</Text>
              <Text style={s.emptyTitle}>No schedule yet</Text>
              <Text style={s.emptySub}>Add your classes, activities, and events below</Text>
            </View>
          )}

          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddSchedule(true)}>
            <Text style={s.addBtnText}>+ Add to Schedule</Text>
          </TouchableOpacity>

          <AddScheduleModal visible={showAddSchedule} onClose={() => setShowAddSchedule(false)} onSave={addScheduleEvent} />
        </>
      )}

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  tab: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary, lineHeight: 16 },
  tabTextActive: { color: "#fff" },
  // GPA
  gpaCard: { flexDirection: "row", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md, alignItems: "center" },
  gpaLeft: { alignItems: "center", paddingRight: Spacing.md },
  gpaNumber: { fontSize: 40, fontWeight: "800" },
  gpaLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  gpaDivider: { width: 1, height: 60, backgroundColor: Colors.border },
  gpaStats: { flex: 1, paddingLeft: Spacing.md, gap: 6 },
  gpaStat: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "600" },
  honorBanner: { backgroundColor: "#FEF3C7", borderRadius: Radius.lg, padding: 12, marginBottom: Spacing.sm, borderLeftWidth: 4, borderLeftColor: Colors.warning },
  honorText: { color: "#92400E", fontWeight: "700", fontSize: FontSize.sm },
  // Grade cards
  gradeCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, borderLeftWidth: 5, ...Shadow.sm },
  gradeCircle: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  gradeCircleText: { color: "#fff", fontSize: FontSize.md, fontWeight: "800" },
  gradeSubject: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  gradeMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  gradePct: { fontSize: FontSize.sm, fontWeight: "700", marginTop: 2 },
  gradeNotes: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, fontStyle: "italic" },
  // Add button — compact, centered, not stretched
  addBtn: { alignSelf: "center", backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 28, paddingVertical: 12, marginTop: Spacing.md, ...Shadow.sm },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  // Shared card
  card: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, fontStyle: "italic" },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  // Assignment check
  checkBtn: { marginRight: 10, padding: 2 },
  assignmentThumb: { width: "100%", height: 100, borderRadius: Radius.md, marginTop: 8 },
  // Behavior
  behaviorInfo: { backgroundColor: Colors.primary + "12", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  behaviorInfoTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  behaviorInfoText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  behaviorCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.lg, ...Shadow.md },
  behaviorScore: { fontSize: 60, fontWeight: "800", color: Colors.primary, textAlign: "center" },
  behaviorLabel: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.sm },
  behaviorRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  behaviorReason: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1, marginRight: 8 },
  behaviorDelta: { fontSize: FontSize.sm, fontWeight: "800" },
  // Schedule
  todayBanner: { backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  todayBannerTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, marginBottom: 6 },
  todayItem: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 24 },
  daySection: { marginBottom: Spacing.md },
  dayHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  dayHeaderToday: {},
  dayHeaderText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  dayHeaderTextToday: { color: Colors.primary },
  eventCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 6, borderLeftWidth: 4, ...Shadow.sm },
  eventDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginRight: 10 },
  eventTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  eventTime: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: Colors.textMuted, fontSize: 16 },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.surfaceLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: "92%" },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm, textAlign: "center" },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  // Category
  catRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  catBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 2 },
  catEmoji: { fontSize: 22 },
  catLabel: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, marginTop: 4 },
  // Days
  dayRow: { flexDirection: "row", gap: 6 },
  dayBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  dayBtnActive: { backgroundColor: Colors.primary },
  dayText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  dayTextActive: { color: "#fff" },
  // Time
  timeScroll: { maxHeight: 42 },
  timeBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  timeBtnActive: { backgroundColor: Colors.primary },
  timeText: { fontSize: 11, fontWeight: "600", color: Colors.textSecondary },
  timeTextActive: { color: "#fff" },
  // Reminder
  reminderRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: Radius.lg, backgroundColor: Colors.cardLight, marginTop: 14 },
  reminderActive: { backgroundColor: Colors.primary + "15" },
  reminderEmoji: { fontSize: 22 },
  reminderText: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textSecondary },
  // Grade
  chipRow: { maxHeight: 40, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },
  gradeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  gradePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 2 },
  gradePillText: { fontWeight: "800", fontSize: FontSize.sm },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: FontSize.base, marginBottom: 8, backgroundColor: Colors.surfaceLight },
  photoPreview: { width: "100%", height: 160, borderRadius: Radius.md, marginBottom: 6 },
  removePhotoBtn: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 10, marginBottom: 8 },
  removePhotoText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: "600" },
  photoPickerBtn: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, borderStyle: "dashed", padding: 16, alignItems: "center", marginBottom: 8 },
  photoPickerText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600" },
  btnRow: { flexDirection: "row", gap: 10, marginTop: Spacing.md },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  saveText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
