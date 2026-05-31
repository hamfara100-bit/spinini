import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { today } from "../../../../lib/utils";

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

export default function KidFamilyCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useData();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today());
  const todayStr = today();

  const allEvents = (state.familyCalendar ?? []).filter(e =>
    e.visibility !== "parents-only" &&
    (!e.kidIds?.length || e.kidIds.includes(id))
  );

  const eventsByDate = new Map<string, typeof allEvents>();
  allEvents.forEach(e => {
    const list = eventsByDate.get(e.date) ?? [];
    list.push(e);
    eventsByDate.set(e.date, list);
  });

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);

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

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = (eventsByDate.get(selectedDate) ?? []).sort((a, b) =>
    (a.time ?? "").localeCompare(b.time ?? "")
  );

  const CELL_SIZE = 42;

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>📅 Family Calendar</Text>

      {/* Month nav */}
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
      </View>

      {/* Day labels */}
      <View style={s.dowRow}>
        {DAY_LABELS.map(d => (
          <View key={d} style={[s.dowCell, { width: CELL_SIZE }]}>
            <Text style={s.dowLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
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

      {/* Selected day events */}
      <View style={s.dayPanel}>
        <Text style={s.dayPanelTitle}>{formatFull(selectedDate)}</Text>

        {selectedEvents.length === 0 ? (
          <View style={s.emptyDay}>
            <Text style={s.emptyDayText}>No events this day 🌤️</Text>
          </View>
        ) : (
          selectedEvents.map(e => (
            <View key={e.id} style={[s.card, { borderLeftColor: e.color ?? Colors.primary }]}>
              <Text style={s.cardEmoji}>{e.emoji ?? "📅"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{e.title}</Text>
                {e.time && <Text style={s.cardTime}>{e.time}</Text>}
                {e.note && <Text style={s.cardNote}>{e.note}</Text>}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  monthNav: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navArrow: { fontSize: 24, fontWeight: "300", color: Colors.primary },
  monthLabel: { flex: 1, alignItems: "center" },
  monthText: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 2 },

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
  dayPanelTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", marginBottom: 8 },
  emptyDay: { paddingVertical: 20, alignItems: "center" },
  emptyDayText: { color: Colors.textMuted, fontSize: FontSize.sm },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 14, marginBottom: 8, ...Shadow.sm, borderLeftWidth: 4 },
  cardEmoji: { fontSize: 26, marginRight: 12 },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardTime: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2, fontWeight: "600" },
  cardNote: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
