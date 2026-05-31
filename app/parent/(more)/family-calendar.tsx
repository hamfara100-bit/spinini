import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, ScrollView, Share,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, today, nowIso } from "../../../lib/utils";
import type { CalendarEvent } from "../../../lib/data/types";

const EVENT_EMOJIS = ["📅","🎂","⚽","🏫","🏥","🎭","🎵","🏖️","✈️","🎉","🍕","🎓","💪","🎮","🏀","🎪","🌟","🚗","👨‍👩‍👧","🎁"];
const EVENT_COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16"];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toYMD(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatFull(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function FamilyCalendarScreen() {
  const { state, dispatch } = useData();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [emoji, setEmoji] = useState("📅");
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [kidIds, setKidIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"all" | "parents-only">("all");
  const [alarmKidIds, setAlarmKidIds] = useState<string[]>([]);
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);

  const allEvents = state.familyCalendar ?? [];
  const todayStr = today();

  // Events by date map
  const eventsByDate = new Map<string, CalendarEvent[]>();
  allEvents.forEach(e => {
    const list = eventsByDate.get(e.date) ?? [];
    list.push(e);
    eventsByDate.set(e.date, list);
  });

  // Day cells for current month view
  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);

  // Events for selected date
  const selectedEvents = (eventsByDate.get(selectedDate) ?? []).sort((a, b) =>
    (a.time ?? "").localeCompare(b.time ?? "")
  );

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  function goToday() {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth());
    setSelectedDate(today());
  }

  function openAdd(forDate?: string) {
    setTitle(""); setDate(forDate ?? selectedDate); setTime(""); setNote("");
    setEmoji("📅"); setColor(EVENT_COLORS[0]); setKidIds([]);
    setVisibility("all"); setAlarmKidIds([]);
    setEditEvent(null); setShowEmojiGrid(false); setShowForm(true);
  }

  function openEdit(e: CalendarEvent) {
    setTitle(e.title); setDate(e.date); setTime(e.time ?? "");
    setNote(e.note ?? ""); setEmoji(e.emoji ?? "📅");
    setColor(e.color ?? EVENT_COLORS[0]);
    setKidIds(e.kidIds ?? []);
    setVisibility(e.visibility ?? "all");
    setAlarmKidIds(e.alarmKidIds ?? []);
    setEditEvent(e); setShowEmojiGrid(false); setShowForm(true);
  }

  function save() {
    if (!title.trim()) { Alert.alert("Title required"); return; }
    const payload = {
      title: title.trim(), date, time: time || undefined, note: note || undefined,
      emoji, color, kidIds: kidIds.length ? kidIds : undefined,
      visibility, alarmKidIds: alarmKidIds.length ? alarmKidIds : undefined,
    };
    if (editEvent) {
      dispatch({ type: "CALENDAR_UPDATE", eventId: editEvent.id, payload });
    } else {
      dispatch({ type: "CALENDAR_ADD", event: { id: uid(), ...payload, createdBy: state.parent.id, createdAt: nowIso() } });
      // Fire alarm notifications for selected kids
      alarmKidIds.forEach(kidId => {
        dispatch({
          type: "NOTIFICATION_ADD", kidId,
          notification: {
            id: uid(), kidId, kind: "ping",
            title: `📅 Upcoming: ${title.trim()}`,
            body: `${date}${time ? " at " + time : ""}${note ? " — " + note : ""}`,
            emoji: emoji, read: false, createdAt: nowIso(),
            alarmMode: true, soundLevel: "normal", forceVibrate: false,
          },
        });
      });
    }
    setShowForm(false);
  }

  function remove(e: CalendarEvent) {
    const canDelete = e.createdBy === state.parent.id || e.createdBy === "parent";
    if (!canDelete) { Alert.alert("Only the creator can delete this event."); return; }
    Alert.alert("Delete event?", `"${e.title}"`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "CALENDAR_DELETE", eventId: e.id }) },
    ]);
  }

  async function shareEvent(e: CalendarEvent) {
    const text = `📅 ${e.emoji ?? ""} ${e.title}\n${formatFull(e.date)}${e.time ? " at " + e.time : ""}${e.note ? "\n" + e.note : ""}`;
    try { await Share.share({ message: text }); } catch { /* ignored */ }
  }

  function toggleKid(kidId: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(kidId) ? list.filter(k => k !== kidId) : [...list, kidId]);
  }

  // Build grid cells (null = padding, number = day)
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const CELL_SIZE = 42;

  return (
    <ScreenContainer scroll>
      {/* Month navigation */}
      <View style={s.monthNav}>
        <TouchableOpacity style={s.navBtn} onPress={prevMonth}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday} style={s.monthLabel}>
          <Text style={s.monthText}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
          {viewYear === now.getFullYear() && viewMonth === now.getMonth() && (
            <View style={s.todayDot} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.navBtn} onPress={nextMonth}>
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => openAdd()}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={s.dowRow}>
        {DAY_LABELS.map(d => (
          <View key={d} style={[s.dowCell, { width: CELL_SIZE }]}>
            <Text style={s.dowLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={s.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`pad-${i}`} style={[s.dayCell, { width: CELL_SIZE }]} />;
          const dateStr = toYMD(viewYear, viewMonth, day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dayEvents = eventsByDate.get(dateStr) ?? [];
          const isPast = dateStr < todayStr;
          return (
            <TouchableOpacity
              key={dateStr}
              style={[s.dayCell, { width: CELL_SIZE }, isSelected && s.dayCellSelected, isToday && !isSelected && s.dayCellToday]}
              onPress={() => setSelectedDate(dateStr)}
              activeOpacity={0.7}
            >
              <Text style={[s.dayNum, isSelected && s.dayNumSelected, isPast && !isToday && s.dayNumPast]}>
                {day}
              </Text>
              {dayEvents.length > 0 && (
                <View style={s.dotsRow}>
                  {dayEvents.slice(0, 3).map((e, di) => (
                    <View key={di} style={[s.eventDot, { backgroundColor: e.color ?? Colors.primary }]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected date events */}
      <View style={s.dayPanel}>
        <View style={s.dayPanelHeader}>
          <Text style={s.dayPanelTitle}>{formatFull(selectedDate)}</Text>
          <TouchableOpacity style={s.dayAddBtn} onPress={() => openAdd(selectedDate)}>
            <Text style={s.dayAddBtnText}>＋</Text>
          </TouchableOpacity>
        </View>

        {selectedEvents.length === 0 ? (
          <TouchableOpacity style={s.emptyDay} onPress={() => openAdd(selectedDate)}>
            <Text style={s.emptyDayText}>No events · tap to add one</Text>
          </TouchableOpacity>
        ) : (
          selectedEvents.map(e => {
            const canDelete = e.createdBy === state.parent.id || e.createdBy === "parent";
            const isPrivate = e.visibility === "parents-only";
            return (
              <TouchableOpacity key={e.id} style={[s.eventCard, { borderLeftColor: e.color ?? Colors.primary }]} onPress={() => openEdit(e)} activeOpacity={0.85}>
                <Text style={s.eventEmoji}>{e.emoji ?? "📅"}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={s.eventTitle}>{e.title}</Text>
                    {isPrivate && <Text style={s.privateBadge}>🔒 Parents</Text>}
                  </View>
                  {e.time && <Text style={s.eventTime}>{e.time}</Text>}
                  {e.note && <Text style={s.eventNote} numberOfLines={2}>{e.note}</Text>}
                  {e.alarmKidIds?.length ? (
                    <Text style={s.alarmBadge}>⏰ {state.kids.filter(k => e.alarmKidIds!.includes(k.profile.id)).map(k => k.profile.name).join(", ")}</Text>
                  ) : null}
                  <Text style={s.eventKids}>
                    {e.kidIds?.length
                      ? state.kids.filter(k => e.kidIds!.includes(k.profile.id)).map(k => k.profile.name).join(", ")
                      : isPrivate ? "Parents only" : "All kids"}
                  </Text>
                </View>
                <View style={s.cardActions}>
                  <TouchableOpacity onPress={() => shareEvent(e)} style={s.actionBtn}>
                    <Text style={s.actionBtnText}>📤</Text>
                  </TouchableOpacity>
                  {canDelete && (
                    <TouchableOpacity onPress={() => remove(e)} style={s.actionBtn}>
                      <Text style={[s.actionBtnText, { color: Colors.error }]}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>{editEvent ? "Edit Event" : "New Event"}</Text>

              {/* Emoji + color row */}
              <View style={s.emojiColorRow}>
                <TouchableOpacity style={s.emojiPicker} onPress={() => setShowEmojiGrid(v => !v)}>
                  <Text style={{ fontSize: 28 }}>{emoji}</Text>
                </TouchableOpacity>
                {EVENT_COLORS.map(c => (
                  <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotActive]} onPress={() => setColor(c)} />
                ))}
              </View>
              {showEmojiGrid && (
                <View style={s.emojiGrid}>
                  {EVENT_EMOJIS.map(e => (
                    <TouchableOpacity key={e} onPress={() => { setEmoji(e); setShowEmojiGrid(false); }} style={s.emojiOpt}>
                      <Text style={{ fontSize: 24 }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Event title" />
              <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="Date (YYYY-MM-DD)" />
              <TextInput style={s.input} value={time} onChangeText={setTime} placeholder="Time (HH:MM, optional)" />
              <TextInput style={[s.input, { minHeight: 60 }]} value={note} onChangeText={setNote} placeholder="Note (optional)" multiline />

              {/* Visibility */}
              <Text style={s.fieldLabel}>Visibility</Text>
              <View style={s.chipRow}>
                {(["all","parents-only"] as const).map(v => (
                  <TouchableOpacity key={v} style={[s.chip, visibility === v && s.chipActive]} onPress={() => setVisibility(v)}>
                    <Text style={[s.chipText, visibility === v && s.chipTextActive]}>
                      {v === "all" ? "Everyone" : "🔒 Parents only"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Visible to (kids) — only shown when "all" */}
              {visibility === "all" && (
                <>
                  <Text style={s.fieldLabel}>Visible to kids</Text>
                  <View style={s.chipRow}>
                    <TouchableOpacity style={[s.chip, !kidIds.length && s.chipActive]} onPress={() => setKidIds([])}>
                      <Text style={[s.chipText, !kidIds.length && s.chipTextActive]}>All kids</Text>
                    </TouchableOpacity>
                    {state.kids.map(k => (
                      <TouchableOpacity
                        key={k.profile.id}
                        style={[s.chip, kidIds.includes(k.profile.id) && s.chipActive]}
                        onPress={() => toggleKid(k.profile.id, kidIds, setKidIds)}
                      >
                        <Text style={[s.chipText, kidIds.includes(k.profile.id) && s.chipTextActive]}>{k.profile.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Alarm for kids */}
              {state.kids.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>⏰ Alarm ping for</Text>
                  <View style={s.chipRow}>
                    {state.kids.map(k => (
                      <TouchableOpacity
                        key={k.profile.id}
                        style={[s.chip, alarmKidIds.includes(k.profile.id) && s.chipAlarm]}
                        onPress={() => toggleKid(k.profile.id, alarmKidIds, setAlarmKidIds)}
                      >
                        <Text style={[s.chipText, alarmKidIds.includes(k.profile.id) && s.chipTextActive]}>{k.profile.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={save}>
                  <Text style={s.saveBtnText}>{editEvent ? "Save" : "Add"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  monthNav: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navArrow: { fontSize: 24, fontWeight: "300", color: Colors.primary },
  monthLabel: { flex: 1, alignItems: "center" },
  monthText: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 2 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },

  dowRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 4 },
  dowCell: { alignItems: "center" },
  dowLabel: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", marginBottom: Spacing.md },
  dayCell: { height: 48, alignItems: "center", justifyContent: "flex-start", paddingTop: 4, borderRadius: Radius.md, marginBottom: 2 },
  dayCellSelected: { backgroundColor: Colors.primary },
  dayCellToday: { backgroundColor: Colors.primary + "20" },
  dayNum: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  dayNumSelected: { color: "#fff", fontWeight: "800" },
  dayNumPast: { color: Colors.textMuted },
  dotsRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  eventDot: { width: 5, height: 5, borderRadius: 3 },

  dayPanel: { marginTop: 4 },
  dayPanelHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  dayPanelTitle: { flex: 1, fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase" },
  dayAddBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  dayAddBtnText: { color: "#fff", fontSize: 18, lineHeight: 22 },
  emptyDay: { paddingVertical: 16, alignItems: "center" },
  emptyDayText: { color: Colors.textMuted, fontSize: FontSize.sm },

  eventCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, ...Shadow.sm, borderLeftWidth: 4, gap: 10 },
  eventEmoji: { fontSize: 22, marginTop: 1 },
  eventTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  privateBadge: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },
  eventTime: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2, fontWeight: "600" },
  eventNote: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  alarmBadge: { fontSize: FontSize.xs, color: "#F59E0B", marginTop: 2, fontWeight: "600" },
  eventKids: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 4 },
  actionBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  actionBtnText: { fontSize: 15 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: "92%" },
  modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  emojiColorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  emojiPicker: { width: 48, height: 48, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: Colors.textPrimary },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  emojiOpt: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.background },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, marginBottom: 10 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, marginBottom: 6, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipAlarm: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  chipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
