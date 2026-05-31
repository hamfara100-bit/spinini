import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, Switch, Platform,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso, today, formatTime, confirmDestructive, alertMessage } from "../../../lib/utils";
import type {
  MedicationEntry, DoseLog, MedHandoff, MedFriend,
  MedForm, DoseUnit, DoseScheduleEntry, DoseStatus,
} from "../../../lib/data/types";

// ─── Static data ──────────────────────────────────────────────────────────────

const TABS = ["Meds", "Today", "Handoff", "Team"] as const;
type Tab = typeof TABS[number];

const MED_FORMS: { form: MedForm; emoji: string; label: string }[] = [
  { form: "pill",      emoji: "💊", label: "Pill" },
  { form: "liquid",    emoji: "🧪", label: "Liquid" },
  { form: "injection", emoji: "💉", label: "Injection" },
  { form: "patch",     emoji: "🩹", label: "Patch" },
  { form: "inhaler",   emoji: "🫁", label: "Inhaler" },
  { form: "drops",     emoji: "💧", label: "Drops" },
  { form: "cream",     emoji: "🧴", label: "Cream" },
  { form: "other",     emoji: "🔬", label: "Other" },
];

const DOSE_UNITS: DoseUnit[] = ["mg", "ml", "tablet", "capsule", "drop", "puff", "unit"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Common interaction pairs (lowercased names)
const KNOWN_INTERACTIONS: [string, string][] = [
  ["warfarin", "aspirin"],
  ["warfarin", "ibuprofen"],
  ["warfarin", "naproxen"],
  ["ibuprofen", "aspirin"],
  ["adderall", "maoi"],
  ["ritalin", "maoi"],
  ["methylphenidate", "maoi"],
  ["prozac", "maoi"],
  ["zoloft", "maoi"],
  ["lexapro", "maoi"],
  ["melatonin", "clonazepam"],
  ["melatonin", "lorazepam"],
  ["melatonin", "diazepam"],
  ["amoxicillin", "methotrexate"],
  ["tramadol", "prozac"],
  ["tramadol", "zoloft"],
  ["tramadol", "lexapro"],
];

function checkInteractions(newName: string, existing: MedicationEntry[]): string[] {
  const n = newName.toLowerCase().trim();
  const warnings: string[] = [];
  for (const med of existing) {
    if (!med.active) continue;
    const e = med.name.toLowerCase().trim();
    for (const [a, b] of KNOWN_INTERACTIONS) {
      if ((n.includes(a) && e.includes(b)) || (n.includes(b) && e.includes(a))) {
        warnings.push(med.name);
        break;
      }
    }
  }
  return warnings;
}

function formEmoji(form: MedForm): string {
  return MED_FORMS.find(f => f.form === form)?.emoji ?? "💊";
}

function refillStatus(med: MedicationEntry): "ok" | "low" | "critical" | null {
  if (med.currentCount == null || med.refillAt == null) return null;
  if (med.currentCount <= 0) return "critical";
  if (med.currentCount <= med.refillAt) return "low";
  return "ok";
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MedicationsScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<Tab>("Meds");
  const kids = state.kids;
  const meds = state.medications ?? [];
  const doseLogs = state.doseLogs ?? [];
  const handoffs = state.medHandoffs ?? [];
  const friends = state.medFriends ?? [];

  return (
    <ScreenContainer showBack>
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "Meds"    && <MedsTab meds={meds} kids={kids} dispatch={dispatch} />}
      {tab === "Today"   && <TodayTab meds={meds} doseLogs={doseLogs} kids={kids} dispatch={dispatch} />}
      {tab === "Handoff" && <HandoffTab meds={meds} handoffs={handoffs} kids={kids} dispatch={dispatch} parentName={state.parent.name} />}
      {tab === "Team"    && <TeamTab friends={friends} kids={kids} dispatch={dispatch} />}
    </ScreenContainer>
  );
}

// ─── Meds Tab ─────────────────────────────────────────────────────────────────

function MedsTab({ meds, kids, dispatch }: any) {
  const [kidFilter, setKidFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // form state
  const blank = () => ({
    kidId: kids[0]?.profile.id ?? "",
    name: "", form: "pill" as MedForm, dosageAmount: "", unit: "mg" as DoseUnit,
    prescribingDoctor: "", pharmacy: "", pharmacyPhone: "", rxNumber: "",
    startDate: "", endDate: "", currentCount: "", refillAt: "", nextRefillDate: "",
    notes: "", active: true, interactions: [] as string[], schedules: [] as DoseScheduleEntry[],
  });
  const [form, setForm] = useState(blank());
  const [intWarnings, setIntWarnings] = useState<string[]>([]);

  // schedule editor
  const [schedTime, setSchedTime] = useState("08:00");
  const [schedDays, setSchedDays] = useState<number[]>([]);
  const [schedAlertKid, setSchedAlertKid] = useState(true);
  const [schedAlertParents, setSchedAlertParents] = useState(true);

  const filtered = kidFilter === "all" ? meds : meds.filter((m: MedicationEntry) => m.kidId === kidFilter);

  function openAdd() {
    setForm(blank());
    setIntWarnings([]);
    setSchedTime("08:00");
    setSchedDays([]);
    setEditId(null);
    setModalOpen(true);
  }

  function openEdit(med: MedicationEntry) {
    setForm({
      kidId: med.kidId, name: med.name, form: med.form, dosageAmount: med.dosageAmount,
      unit: med.unit, prescribingDoctor: med.prescribingDoctor, pharmacy: med.pharmacy,
      pharmacyPhone: med.pharmacyPhone ?? "", rxNumber: med.rxNumber ?? "",
      startDate: med.startDate ?? "", endDate: med.endDate ?? "",
      currentCount: med.currentCount != null ? String(med.currentCount) : "",
      refillAt: med.refillAt != null ? String(med.refillAt) : "",
      nextRefillDate: med.nextRefillDate ?? "", notes: med.notes ?? "",
      active: med.active, interactions: med.interactions, schedules: med.schedules,
    });
    setIntWarnings([]);
    setSchedTime("08:00");
    setSchedDays([]);
    setEditId(med.id);
    setModalOpen(true);
  }

  function onNameBlur() {
    const others = meds.filter((m: MedicationEntry) => m.kidId === form.kidId && m.id !== editId);
    setIntWarnings(checkInteractions(form.name, others));
  }

  function addSchedule() {
    if (!schedTime) return;
    const entry: DoseScheduleEntry = {
      id: uid(), time: schedTime, days: schedDays,
      alertKid: schedAlertKid, alertAllParents: schedAlertParents, enabled: true,
    };
    setForm(f => ({ ...f, schedules: [...f.schedules, entry] }));
    setSchedDays([]);
  }

  function removeSchedule(id: string) {
    setForm(f => ({ ...f, schedules: f.schedules.filter((s: DoseScheduleEntry) => s.id !== id) }));
  }

  function save() {
    if (!form.name.trim()) { alertMessage("Medication name is required."); return; }
    if (!form.kidId) { alertMessage("Please select a child."); return; }
    const med: MedicationEntry = {
      id: editId ?? uid(),
      kidId: form.kidId, name: form.name.trim(), form: form.form,
      dosageAmount: form.dosageAmount.trim(), unit: form.unit,
      prescribingDoctor: form.prescribingDoctor.trim(), pharmacy: form.pharmacy.trim(),
      pharmacyPhone: form.pharmacyPhone.trim() || undefined,
      rxNumber: form.rxNumber.trim() || undefined,
      startDate: form.startDate.trim() || undefined, endDate: form.endDate.trim() || undefined,
      currentCount: form.currentCount !== "" ? Number(form.currentCount) : undefined,
      refillAt: form.refillAt !== "" ? Number(form.refillAt) : undefined,
      nextRefillDate: form.nextRefillDate.trim() || undefined,
      notes: form.notes.trim() || undefined, active: form.active,
      interactions: form.interactions, schedules: form.schedules,
      createdAt: editId ? (meds.find((m: MedicationEntry) => m.id === editId)?.createdAt ?? nowIso()) : nowIso(),
    };
    if (editId) {
      dispatch({ type: "MED_UPDATE", medId: editId, payload: med });
    } else {
      dispatch({ type: "MED_ADD", med });
    }
    setModalOpen(false);
  }

  function remove(id: string) {
    confirmDestructive("Delete medication?", "All dose logs for this medication will remain.", () => {
      dispatch({ type: "MED_DELETE", medId: id });
    });
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Kid filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: Spacing.sm }}
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: Spacing.md }}>
        <TouchableOpacity
          style={[s.kidChip, kidFilter === "all" && s.kidChipActive]}
          onPress={() => setKidFilter("all")}>
          <Text style={[s.kidChipText, kidFilter === "all" && s.kidChipTextActive]}>All</Text>
        </TouchableOpacity>
        {kids.map((k: any) => (
          <TouchableOpacity key={k.profile.id}
            style={[s.kidChip, kidFilter === k.profile.id && s.kidChipActive]}
            onPress={() => setKidFilter(k.profile.id)}>
            <Text style={[s.kidChipText, kidFilter === k.profile.id && s.kidChipTextActive]}>{k.profile.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
        {filtered.length === 0 && (
          <Text style={s.empty}>No medications added yet.</Text>
        )}
        {filtered.map((med: MedicationEntry) => {
          const kid = kids.find((k: any) => k.profile.id === med.kidId);
          const rs = refillStatus(med);
          // interaction warnings
          const otherMeds = meds.filter((m: MedicationEntry) => m.kidId === med.kidId && m.id !== med.id && m.active);
          const iWarns = checkInteractions(med.name, otherMeds);
          return (
            <View key={med.id} style={[s.card, !med.active && { opacity: 0.5 }]}>
              <View style={s.cardRow}>
                <Text style={s.medEmoji}>{formEmoji(med.form)}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <Text style={s.medName}>{med.name}</Text>
                    {!med.active && <View style={s.badge}><Text style={s.badgeText}>Inactive</Text></View>}
                    {iWarns.length > 0 && <View style={[s.badge, { backgroundColor: "#FEF3C7" }]}><Text style={[s.badgeText, { color: "#92400E" }]}>⚠️ Interaction</Text></View>}
                    {rs === "critical" && <View style={[s.badge, { backgroundColor: "#FEE2E2" }]}><Text style={[s.badgeText, { color: "#991B1B" }]}>🔴 Out of stock</Text></View>}
                    {rs === "low"      && <View style={[s.badge, { backgroundColor: "#FEF3C7" }]}><Text style={[s.badgeText, { color: "#92400E" }]}>🟡 Refill soon</Text></View>}
                  </View>
                  <Text style={s.medSub}>
                    {med.dosageAmount}{med.unit} · {MED_FORMS.find(f => f.form === med.form)?.label ?? med.form}
                    {kid ? ` · ${kid.profile.name}` : ""}
                  </Text>
                  {med.prescribingDoctor ? <Text style={s.medDetail}>Dr. {med.prescribingDoctor}</Text> : null}
                  {med.pharmacy ? <Text style={s.medDetail}>Rx: {med.pharmacy}{med.rxNumber ? ` #${med.rxNumber}` : ""}</Text> : null}
                  {med.currentCount != null && <Text style={s.medDetail}>{med.currentCount} remaining{med.refillAt != null ? ` (refill at ${med.refillAt})` : ""}</Text>}
                  {iWarns.length > 0 && (
                    <Text style={[s.medDetail, { color: "#B45309" }]}>
                      ⚠️ Interacts with: {iWarns.join(", ")}
                    </Text>
                  )}
                  {med.schedules.length > 0 && (
                    <Text style={s.medDetail}>
                      ⏰ {med.schedules.filter(sc => sc.enabled).map(sc => formatTime(sc.time)).join(", ")}
                    </Text>
                  )}
                </View>
              </View>
              <View style={s.cardActions}>
                <Switch
                  value={med.active}
                  onValueChange={v => dispatch({ type: "MED_UPDATE", medId: med.id, payload: { active: v } })}
                  trackColor={{ true: Colors.primary }}
                  thumbColor="#fff"
                />
                <Text style={s.switchLabel}>{med.active ? "Active" : "Inactive"}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(med)}>
                  <Text style={s.actionBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => remove(med.id)}>
                  <Text style={[s.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={openAdd}>
        <Text style={s.fabText}>+ Add Medication</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalWrap}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{editId ? "Edit Medication" : "Add Medication"}</Text>
            <TouchableOpacity onPress={save}>
              <Text style={s.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
            {/* Child selector */}
            <Text style={s.sectionLabel}>Child</Text>
            {kids.length === 0 ? (
              <View style={s.noKidsBanner}>
                <Text style={s.noKidsText}>👶 No children set up yet.</Text>
                <Text style={s.noKidsSub}>Add a child profile first: go to Family → + Add Child, then come back here.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, marginBottom: Spacing.md }}
                contentContainerStyle={{ alignItems: "center" }}>
                {kids.map((k: any) => (
                  <TouchableOpacity key={k.profile.id}
                    style={[s.kidChip, form.kidId === k.profile.id && s.kidChipActive]}
                    onPress={() => setForm(f => ({ ...f, kidId: k.profile.id }))}>
                    <Text style={[s.kidChipText, form.kidId === k.profile.id && s.kidChipTextActive]}>{k.profile.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={s.sectionLabel}>Medication Name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Amoxicillin, Melatonin"
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              onBlur={onNameBlur}
            />
            {intWarnings.length > 0 && (
              <View style={s.interactionBanner}>
                <Text style={s.interactionText}>
                  ⚠️ Possible interaction with: {intWarnings.join(", ")}. Consult your doctor.
                </Text>
              </View>
            )}

            <Text style={s.sectionLabel}>Form</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginBottom: Spacing.md }}
              contentContainerStyle={{ alignItems: "center" }}>
              {MED_FORMS.map(f => (
                <TouchableOpacity key={f.form}
                  style={[s.formChip, form.form === f.form && s.formChipActive]}
                  onPress={() => setForm(ff => ({ ...ff, form: f.form }))}>
                  <Text style={s.formChipEmoji}>{f.emoji}</Text>
                  <Text style={[s.formChipLabel, form.form === f.form && { color: Colors.primary }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Dosage Amount</Text>
                <TextInput style={s.input} placeholder="e.g. 250" keyboardType="decimal-pad"
                  value={form.dosageAmount} onChangeText={v => setForm(f => ({ ...f, dosageAmount: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
                  {DOSE_UNITS.map(u => (
                    <TouchableOpacity key={u} style={[s.unitChip, form.unit === u && s.unitChipActive]}
                      onPress={() => setForm(f => ({ ...f, unit: u }))}>
                      <Text style={[s.unitChipText, form.unit === u && { color: Colors.primary }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Text style={s.sectionLabel}>Prescribing Doctor</Text>
            <TextInput style={s.input} placeholder="Dr. Smith"
              value={form.prescribingDoctor} onChangeText={v => setForm(f => ({ ...f, prescribingDoctor: v }))} />

            <Text style={s.sectionLabel}>Pharmacy</Text>
            <TextInput style={s.input} placeholder="CVS, Walgreens…"
              value={form.pharmacy} onChangeText={v => setForm(f => ({ ...f, pharmacy: v }))} />

            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Pharmacy Phone</Text>
                <TextInput style={s.input} placeholder="(555) 123-4567" keyboardType="phone-pad"
                  value={form.pharmacyPhone} onChangeText={v => setForm(f => ({ ...f, pharmacyPhone: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Rx Number</Text>
                <TextInput style={s.input} placeholder="Optional"
                  value={form.rxNumber} onChangeText={v => setForm(f => ({ ...f, rxNumber: v }))} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Start Date</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD"
                  value={form.startDate} onChangeText={v => setForm(f => ({ ...f, startDate: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>End Date</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD (optional)"
                  value={form.endDate} onChangeText={v => setForm(f => ({ ...f, endDate: v }))} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Current Count</Text>
                <TextInput style={s.input} placeholder="e.g. 30" keyboardType="number-pad"
                  value={form.currentCount} onChangeText={v => setForm(f => ({ ...f, currentCount: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Refill Alert At</Text>
                <TextInput style={s.input} placeholder="e.g. 7" keyboardType="number-pad"
                  value={form.refillAt} onChangeText={v => setForm(f => ({ ...f, refillAt: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Next Refill</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD"
                  value={form.nextRefillDate} onChangeText={v => setForm(f => ({ ...f, nextRefillDate: v }))} />
              </View>
            </View>

            <Text style={s.sectionLabel}>Notes / Instructions</Text>
            <TextInput style={[s.input, { minHeight: 64 }]} placeholder="Take with food, avoid dairy…"
              value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))}
              multiline textAlignVertical="top" />

            {/* Dose Schedule */}
            <Text style={[s.sectionLabel, { marginTop: Spacing.lg }]}>Dose Schedule</Text>
            <View style={s.scheduleBuilder}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="HH:MM"
                  value={schedTime} onChangeText={setSchedTime} />
                <TouchableOpacity style={s.addSchedBtn} onPress={addSchedule}>
                  <Text style={s.addSchedBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing.sm }}>
                {DAY_LABELS.map((label, i) => (
                  <TouchableOpacity key={i}
                    style={[s.dayChip, schedDays.includes(i) && s.dayChipActive]}
                    onPress={() => setSchedDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i])}>
                    <Text style={[s.dayChipText, schedDays.includes(i) && { color: Colors.primary }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
                <Text style={{ fontSize: 11, color: Colors.textLight, alignSelf: "center" }}>
                  {schedDays.length === 0 ? "(every day)" : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Switch value={schedAlertKid} onValueChange={setSchedAlertKid}
                    trackColor={{ true: Colors.primary }} thumbColor="#fff" />
                  <Text style={s.switchLabel}>Alert kid</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Switch value={schedAlertParents} onValueChange={setSchedAlertParents}
                    trackColor={{ true: Colors.primary }} thumbColor="#fff" />
                  <Text style={s.switchLabel}>Alert parents</Text>
                </View>
              </View>
            </View>

            {form.schedules.length > 0 && (
              <View style={{ marginTop: Spacing.sm }}>
                {form.schedules.map((sc: DoseScheduleEntry) => (
                  <View key={sc.id} style={s.scheduleRow}>
                    <Text style={s.scheduleTime}>{formatTime(sc.time)}</Text>
                    <Text style={s.scheduleDays}>
                      {sc.days.length === 0 ? "Daily" : sc.days.map(d => DAY_LABELS[d]).join(", ")}
                    </Text>
                    {sc.alertKid && <Text style={s.scheduleTag}>Kid alert</Text>}
                    {sc.alertAllParents && <Text style={s.scheduleTag}>Parent alert</Text>}
                    <TouchableOpacity onPress={() => removeSchedule(sc.id)} style={{ marginLeft: "auto" }}>
                      <Text style={{ color: "#EF4444", fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Today Tab ────────────────────────────────────────────────────────────────

function TodayTab({ meds, doseLogs, kids, dispatch }: any) {
  const todayStr = today();
  const [logModal, setLogModal] = useState(false);
  const [logTarget, setLogTarget] = useState<{ med: MedicationEntry; time: string } | null>(null);
  const [logMeasure, setLogMeasure] = useState("");
  const [logNote, setLogNote] = useState("");

  // Build expected doses for today
  const todayDow = new Date().getDay();
  const expectedDoses = useMemo(() => {
    const doses: { med: MedicationEntry; sched: DoseScheduleEntry }[] = [];
    for (const med of meds) {
      if (!med.active) continue;
      for (const sc of med.schedules) {
        if (!sc.enabled) continue;
        if (sc.days.length > 0 && !sc.days.includes(todayDow)) continue;
        doses.push({ med, sched: sc });
      }
    }
    doses.sort((a, b) => a.sched.time.localeCompare(b.sched.time));
    return doses;
  }, [meds, todayDow]);

  function getLog(medId: string, time: string): DoseLog | undefined {
    return doseLogs.find((l: DoseLog) => l.medId === medId && l.scheduledDate === todayStr && l.scheduledTime === time);
  }

  function openLogModal(med: MedicationEntry, time: string) {
    setLogTarget({ med, time });
    setLogMeasure("");
    setLogNote("");
    setLogModal(true);
  }

  function markTaken() {
    if (!logTarget) return;
    const existing = getLog(logTarget.med.id, logTarget.time);
    const logEntry: DoseLog = {
      id: existing?.id ?? uid(),
      medId: logTarget.med.id, kidId: logTarget.med.kidId,
      scheduledTime: logTarget.time, scheduledDate: todayStr,
      takenAt: nowIso(), takenBy: "parent", status: "taken",
      note: logNote.trim() || undefined,
      measuredAmount: logMeasure.trim() || undefined,
    };
    if (existing) {
      dispatch({ type: "DOSE_LOG_UPDATE", logId: existing.id, payload: logEntry });
    } else {
      dispatch({ type: "DOSE_LOG_ADD", log: logEntry });
    }
    setLogModal(false);
  }

  function markSkipped(med: MedicationEntry, time: string) {
    const existing = getLog(med.id, time);
    const logEntry: DoseLog = {
      id: existing?.id ?? uid(),
      medId: med.id, kidId: med.kidId,
      scheduledTime: time, scheduledDate: todayStr,
      takenBy: "parent", status: "skipped",
    };
    if (existing) {
      dispatch({ type: "DOSE_LOG_UPDATE", logId: existing.id, payload: logEntry });
    } else {
      dispatch({ type: "DOSE_LOG_ADD", log: logEntry });
    }
  }

  const statusColor = (s: DoseStatus | undefined) => {
    if (s === "taken") return "#10B981";
    if (s === "skipped") return "#F59E0B";
    if (s === "missed") return "#EF4444";
    return Colors.textLight;
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
      <Text style={s.sectionHeading}>Today's Schedule — {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</Text>

      {expectedDoses.length === 0 && (
        <Text style={s.empty}>No doses scheduled for today. Add schedules in the Meds tab.</Text>
      )}

      {expectedDoses.map(({ med, sched }) => {
        const log = getLog(med.id, sched.time);
        const kid = kids.find((k: any) => k.profile.id === med.kidId);
        return (
          <View key={`${med.id}-${sched.id}`} style={[s.card, { borderLeftWidth: 4, borderLeftColor: statusColor(log?.status) }]}>
            <View style={s.cardRow}>
              <Text style={s.medEmoji}>{formEmoji(med.form)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.medName}>{med.name}</Text>
                <Text style={s.medSub}>
                  {med.dosageAmount}{med.unit} · {formatTime(sched.time)}
                  {kid ? ` · ${kid.profile.name}` : ""}
                </Text>
                {log?.measuredAmount && <Text style={s.medDetail}>Measured: {log.measuredAmount}</Text>}
                {log?.note && <Text style={s.medDetail}>Note: {log.note}</Text>}
                {log?.takenAt && <Text style={s.medDetail}>✅ Taken at {new Date(log.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>}
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={[s.statusBadge, { backgroundColor: statusColor(log?.status) + "22" }]}>
                  <Text style={[s.statusBadgeText, { color: statusColor(log?.status) }]}>
                    {log?.status ?? "pending"}
                  </Text>
                </View>
              </View>
            </View>
            {(!log || log.status === "pending") && (
              <View style={[s.cardActions, { marginTop: 6 }]}>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#DCFCE7" }]} onPress={() => openLogModal(med, sched.time)}>
                  <Text style={[s.actionBtnText, { color: "#15803D" }]}>✓ Mark Taken</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#FEF9C3" }]} onPress={() => markSkipped(med, sched.time)}>
                  <Text style={[s.actionBtnText, { color: "#854D0E" }]}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
            {log && log.status !== "pending" && (
              <TouchableOpacity style={[s.actionBtn, { marginTop: 6, alignSelf: "flex-start" }]}
                onPress={() => dispatch({ type: "DOSE_LOG_UPDATE", logId: log.id, payload: { status: "pending", takenAt: undefined } })}>
                <Text style={s.actionBtnText}>Undo</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Recent log */}
      {doseLogs.filter((l: DoseLog) => l.scheduledDate === todayStr).length > 0 && (
        <>
          <Text style={[s.sectionHeading, { marginTop: Spacing.lg }]}>Today's Log</Text>
          {doseLogs
            .filter((l: DoseLog) => l.scheduledDate === todayStr)
            .map((l: DoseLog) => {
              const med = meds.find((m: MedicationEntry) => m.id === l.medId);
              return (
                <View key={l.id} style={[s.card, { paddingVertical: 8 }]}>
                  <Text style={s.medName}>{med?.name ?? "Unknown"} — {formatTime(l.scheduledTime)}</Text>
                  <Text style={[s.medSub, { color: statusColor(l.status) }]}>
                    {l.status} · by {l.takenBy}
                    {l.measuredAmount ? ` · ${l.measuredAmount}` : ""}
                  </Text>
                </View>
              );
            })}
        </>
      )}
      <View style={{ height: 40 }} />

      {/* Log modal */}
      <Modal visible={logModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.inlineModal}>
            <Text style={s.modalTitle}>Mark Dose Taken</Text>
            {logTarget && <Text style={s.medSub}>{logTarget.med.name} · {formatTime(logTarget.time)}</Text>}
            {logTarget?.med.form === "liquid" && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 12 }]}>Measured Amount (optional)</Text>
                <TextInput style={s.input} placeholder={`e.g. 5 ml`}
                  value={logMeasure} onChangeText={setLogMeasure} keyboardType="decimal-pad" />
              </>
            )}
            <Text style={[s.sectionLabel, { marginTop: 12 }]}>Note (optional)</Text>
            <TextInput style={s.input} placeholder="Any notes…"
              value={logNote} onChangeText={setLogNote} />
            <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
              <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} onPress={() => setLogModal(false)}>
                <Text style={s.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: Colors.primary }]} onPress={markTaken}>
                <Text style={[s.actionBtnText, { color: "#fff" }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Handoff Tab ──────────────────────────────────────────────────────────────

function HandoffTab({ meds, handoffs, kids, dispatch, parentName }: any) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hKidId, setHKidId] = useState(kids[0]?.profile.id ?? "");
  const [hMedId, setHMedId] = useState("");
  const [hDoseTime, setHDoseTime] = useState("");
  const [hMessage, setHMessage] = useState("");
  const [respondId, setRespondId] = useState<string | null>(null);
  const [respondNote, setRespondNote] = useState("");

  const kidMeds = meds.filter((m: MedicationEntry) => m.kidId === hKidId && m.active);

  function sendHandoff() {
    if (!hMedId) { alertMessage("Please select a medication."); return; }
    if (!hMessage.trim()) { alertMessage("Please add a message for the other parent."); return; }
    const med = meds.find((m: MedicationEntry) => m.id === hMedId);
    const h: MedHandoff = {
      id: uid(), medId: hMedId, medName: med?.name ?? hMedId,
      kidId: hKidId, fromParentName: parentName,
      message: hMessage.trim(), doseTime: hDoseTime.trim() || undefined,
      status: "pending", createdAt: nowIso(),
    };
    dispatch({ type: "MED_HANDOFF_ADD", handoff: h });
    setModalOpen(false);
    setHMessage("");
    setHDoseTime("");
    setHMedId("");
  }

  function respond(id: string, accepted: boolean) {
    dispatch({
      type: "MED_HANDOFF_UPDATE", handoffId: id,
      payload: {
        status: accepted ? "accepted" : "declined",
        responseNote: respondNote.trim() || undefined,
        respondedAt: nowIso(),
      },
    });
    setRespondId(null);
    setRespondNote("");
  }

  function remove(id: string) {
    confirmDestructive("Delete handoff request?", "", () => dispatch({ type: "MED_HANDOFF_DELETE", handoffId: id }));
  }

  const statusColor = (s: string) => s === "accepted" ? "#10B981" : s === "declined" ? "#EF4444" : "#F59E0B";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
        <Text style={s.helpText}>
          Can't give a dose? Send a handoff request so your co-parent or caregiver knows which medication to give and when.
        </Text>

        {handoffs.length === 0 && <Text style={s.empty}>No handoff requests yet.</Text>}

        {handoffs.map((h: MedHandoff) => {
          const kid = kids.find((k: any) => k.profile.id === h.kidId);
          return (
            <View key={h.id} style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.medName}>💊 {h.medName}</Text>
                  <Text style={s.medSub}>
                    {kid?.profile.name ?? "Unknown child"} · From: {h.fromParentName}
                  </Text>
                  {h.doseTime && <Text style={s.medDetail}>Dose time: {formatTime(h.doseTime)}</Text>}
                  <Text style={s.medDetail}>{h.message}</Text>
                  {h.responseNote && <Text style={s.medDetail}>Response: {h.responseNote}</Text>}
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusColor(h.status) + "22" }]}>
                  <Text style={[s.statusBadgeText, { color: statusColor(h.status) }]}>{h.status}</Text>
                </View>
              </View>
              {h.status === "pending" && (
                <View style={s.cardActions}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#DCFCE7" }]}
                    onPress={() => { setRespondId(h.id); setRespondNote(""); }}>
                    <Text style={[s.actionBtnText, { color: "#15803D" }]}>Respond</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => remove(h.id)}>
                    <Text style={[s.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
              {h.status !== "pending" && (
                <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger, { marginTop: 6, alignSelf: "flex-start" }]}
                  onPress={() => remove(h.id)}>
                  <Text style={[s.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
                </TouchableOpacity>
              )}

              {respondId === h.id && (
                <View style={{ marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm }}>
                  <TextInput style={s.input} placeholder="Optional note…" value={respondNote} onChangeText={setRespondNote} />
                  <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: 6 }}>
                    <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: "#DCFCE7" }]} onPress={() => respond(h.id, true)}>
                      <Text style={[s.actionBtnText, { color: "#15803D" }]}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: "#FEE2E2" }]} onPress={() => respond(h.id, false)}>
                      <Text style={[s.actionBtnText, { color: "#991B1B" }]}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} onPress={() => setRespondId(null)}>
                      <Text style={s.actionBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={() => { setHKidId(kids[0]?.profile.id ?? ""); setModalOpen(true); }}>
        <Text style={s.fabText}>+ New Handoff Request</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalWrap}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Handoff Request</Text>
            <TouchableOpacity onPress={sendHandoff}>
              <Text style={s.modalSave}>Send</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={s.sectionLabel}>Child</Text>
            {kids.length === 0 ? (
              <View style={s.noKidsBanner}>
                <Text style={s.noKidsText}>👶 No children set up yet.</Text>
                <Text style={s.noKidsSub}>Add a child profile first: go to Family → + Add Child.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, marginBottom: Spacing.md }}
                contentContainerStyle={{ alignItems: "center" }}>
                {kids.map((k: any) => (
                  <TouchableOpacity key={k.profile.id}
                    style={[s.kidChip, hKidId === k.profile.id && s.kidChipActive]}
                    onPress={() => { setHKidId(k.profile.id); setHMedId(""); }}>
                    <Text style={[s.kidChipText, hKidId === k.profile.id && s.kidChipTextActive]}>{k.profile.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={s.sectionLabel}>Medication</Text>
            {kidMeds.length === 0
              ? <Text style={s.empty}>No active medications for this child.</Text>
              : kidMeds.map((m: MedicationEntry) => (
                <TouchableOpacity key={m.id}
                  style={[s.selectRow, hMedId === m.id && s.selectRowActive]}
                  onPress={() => setHMedId(m.id)}>
                  <Text style={s.medEmoji}>{formEmoji(m.form)}</Text>
                  <Text style={{ flex: 1 }}>{m.name} — {m.dosageAmount}{m.unit}</Text>
                  {hMedId === m.id && <Text style={{ color: Colors.primary }}>✓</Text>}
                </TouchableOpacity>
              ))
            }

            <Text style={s.sectionLabel}>Dose Time (optional)</Text>
            <TextInput style={s.input} placeholder="HH:MM"
              value={hDoseTime} onChangeText={setHDoseTime} />

            <Text style={s.sectionLabel}>Message to Co-Parent</Text>
            <TextInput style={[s.input, { minHeight: 80 }]}
              placeholder="I can't make it tonight. Please give the evening dose…"
              value={hMessage} onChangeText={setHMessage}
              multiline textAlignVertical="top" />
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Team (MedFriends) Tab ────────────────────────────────────────────────────

function TeamTab({ friends, kids, dispatch }: any) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const blank = () => ({
    name: "", relation: "", phone: "", email: "",
    canViewSchedule: true, canLogDoses: false, alertOnMissed: true,
    linkedKidIds: [] as string[],
  });
  const [form, setForm] = useState(blank());

  function openAdd() { setForm(blank()); setEditId(null); setModalOpen(true); }
  function openEdit(f: MedFriend) {
    setForm({
      name: f.name, relation: f.relation, phone: f.phone ?? "",
      email: f.email ?? "", canViewSchedule: f.canViewSchedule,
      canLogDoses: f.canLogDoses, alertOnMissed: f.alertOnMissed,
      linkedKidIds: f.linkedKidIds,
    });
    setEditId(f.id);
    setModalOpen(true);
  }

  function save() {
    if (!form.name.trim()) { alertMessage("Name is required."); return; }
    const fr: MedFriend = {
      id: editId ?? uid(), name: form.name.trim(), relation: form.relation.trim(),
      phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
      canViewSchedule: form.canViewSchedule, canLogDoses: form.canLogDoses,
      alertOnMissed: form.alertOnMissed, linkedKidIds: form.linkedKidIds,
      createdAt: editId ? (friends.find((f: MedFriend) => f.id === editId)?.createdAt ?? nowIso()) : nowIso(),
    };
    if (editId) {
      dispatch({ type: "MED_FRIEND_UPDATE", friendId: editId, payload: fr });
    } else {
      dispatch({ type: "MED_FRIEND_ADD", friend: fr });
    }
    setModalOpen(false);
  }

  function remove(id: string) {
    confirmDestructive("Remove MedFriend?", "", () => dispatch({ type: "MED_FRIEND_DELETE", friendId: id }));
  }

  function toggleKid(kidId: string) {
    setForm(f => ({
      ...f,
      linkedKidIds: f.linkedKidIds.includes(kidId)
        ? f.linkedKidIds.filter((id: string) => id !== kidId)
        : [...f.linkedKidIds, kidId],
    }));
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
        <Text style={s.helpText}>
          MedFriends are family members or caregivers who can monitor medication schedules and be alerted when a dose is missed.
        </Text>

        {friends.length === 0 && <Text style={s.empty}>No MedFriends added yet.</Text>}

        {friends.map((f: MedFriend) => {
          const linkedNames = f.linkedKidIds
            .map((id: string) => kids.find((k: any) => k.profile.id === id)?.profile.name)
            .filter(Boolean).join(", ");
          return (
            <View key={f.id} style={s.card}>
              <View style={s.cardRow}>
                <View style={s.avatarCircle}>
                  <Text style={s.avatarText}>{f.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.medName}>{f.name}</Text>
                  <Text style={s.medSub}>{f.relation}</Text>
                  {f.phone && <Text style={s.medDetail}>📞 {f.phone}</Text>}
                  {f.email && <Text style={s.medDetail}>✉️ {f.email}</Text>}
                  {linkedNames && <Text style={s.medDetail}>👶 {linkedNames}</Text>}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {f.canViewSchedule && <View style={s.permBadge}><Text style={s.permBadgeText}>View schedule</Text></View>}
                    {f.canLogDoses    && <View style={s.permBadge}><Text style={s.permBadgeText}>Log doses</Text></View>}
                    {f.alertOnMissed  && <View style={[s.permBadge, { backgroundColor: "#FEF3C7" }]}><Text style={[s.permBadgeText, { color: "#92400E" }]}>Missed dose alert</Text></View>}
                  </View>
                </View>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(f)}>
                  <Text style={s.actionBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => remove(f.id)}>
                  <Text style={[s.actionBtnText, { color: "#EF4444" }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={openAdd}>
        <Text style={s.fabText}>+ Add MedFriend</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalWrap}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{editId ? "Edit MedFriend" : "Add MedFriend"}</Text>
            <TouchableOpacity onPress={save}>
              <Text style={s.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={s.sectionLabel}>Name</Text>
            <TextInput style={s.input} placeholder="Grandma, Aunt Sue, Caregiver…"
              value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />

            <Text style={s.sectionLabel}>Relationship</Text>
            <TextInput style={s.input} placeholder="Grandparent, Aunt/Uncle, Nanny…"
              value={form.relation} onChangeText={v => setForm(f => ({ ...f, relation: v }))} />

            <Text style={s.sectionLabel}>Phone (optional)</Text>
            <TextInput style={s.input} placeholder="(555) 123-4567" keyboardType="phone-pad"
              value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} />

            <Text style={s.sectionLabel}>Email (optional)</Text>
            <TextInput style={s.input} placeholder="email@example.com" keyboardType="email-address"
              value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} />

            <Text style={s.sectionLabel}>Children they monitor</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md }}>
              {kids.map((k: any) => (
                <TouchableOpacity key={k.profile.id}
                  style={[s.kidChip, form.linkedKidIds.includes(k.profile.id) && s.kidChipActive]}
                  onPress={() => toggleKid(k.profile.id)}>
                  <Text style={[s.kidChipText, form.linkedKidIds.includes(k.profile.id) && s.kidChipTextActive]}>{k.profile.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionLabel}>Permissions</Text>
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Can view schedule</Text>
                <Text style={s.toggleSub}>See medication times</Text>
              </View>
              <Switch value={form.canViewSchedule}
                onValueChange={v => setForm(f => ({ ...f, canViewSchedule: v }))}
                trackColor={{ true: Colors.primary }} thumbColor="#fff" />
            </View>
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Can log doses</Text>
                <Text style={s.toggleSub}>Mark doses as given</Text>
              </View>
              <Switch value={form.canLogDoses}
                onValueChange={v => setForm(f => ({ ...f, canLogDoses: v }))}
                trackColor={{ true: Colors.primary }} thumbColor="#fff" />
            </View>
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Alert on missed dose</Text>
                <Text style={s.toggleSub}>Notify when a scheduled dose is missed</Text>
              </View>
              <Switch value={form.alertOnMissed}
                onValueChange={v => setForm(f => ({ ...f, alertOnMissed: v }))}
                trackColor={{ true: Colors.primary }} thumbColor="#fff" />
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  tabBar: {
    flexDirection: "row", paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm,
  },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: "transparent",
    alignSelf: "flex-start",
  },
  tabBtnActive: {
    backgroundColor: Colors.primary + "18", borderColor: Colors.primary,
  },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textLight, fontWeight: "500" },
  tabLabelActive: { color: Colors.primary, fontWeight: "700" },

  card: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  cardActions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: 8 },

  medEmoji: { fontSize: 28, marginTop: 2 },
  medName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  medSub: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 2 },
  medDetail: { fontSize: 12, color: Colors.textLight, marginTop: 2 },

  badge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full,
    backgroundColor: Colors.cardLight, alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "600", color: Colors.textLight },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, alignSelf: "flex-start" },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },

  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md,
    backgroundColor: Colors.cardLight, borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "500" },
  actionBtnDanger: { borderColor: "#FECACA" },

  switchLabel: { fontSize: FontSize.sm, color: Colors.textLight },

  fab: {
    position: "absolute", bottom: 20, left: Spacing.md, right: Spacing.md,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 14, alignItems: "center", ...Shadow.md,
  },
  fabText: { color: "#fff", fontSize: FontSize.md, fontWeight: "700" },

  empty: { color: Colors.textLight, fontSize: FontSize.sm, textAlign: "center", marginVertical: Spacing.lg },
  helpText: {
    fontSize: FontSize.sm, color: Colors.textLight, marginBottom: Spacing.md,
    backgroundColor: Colors.cardLight, padding: Spacing.sm, borderRadius: Radius.md,
  },
  sectionHeading: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textLight, marginBottom: Spacing.sm },

  kidChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.cardLight, marginRight: 8, borderWidth: 1.5, borderColor: "transparent",
    alignSelf: "flex-start",
  },
  kidChipActive: { backgroundColor: Colors.primary + "18", borderColor: Colors.primary },
  kidChipText: { fontSize: FontSize.sm, color: Colors.textLight, fontWeight: "500" },
  kidChipTextActive: { color: Colors.primary, fontWeight: "700" },

  formChip: {
    alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md,
    backgroundColor: Colors.cardLight, marginRight: 8, borderWidth: 1.5, borderColor: "transparent",
    alignSelf: "flex-start",
  },
  formChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  formChipEmoji: { fontSize: 20, marginBottom: 2 },
  formChipLabel: { fontSize: 11, color: Colors.textLight, fontWeight: "500" },

  unitChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, marginRight: 6,
    backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: "transparent", alignSelf: "flex-start",
  },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  unitChipText: { fontSize: 12, color: Colors.textLight, fontWeight: "500" },

  dayChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
    backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: "transparent",
  },
  dayChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  dayChipText: { fontSize: 12, color: Colors.textLight, fontWeight: "600" },

  scheduleBuilder: {
    backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.sm,
  },
  addSchedBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  addSchedBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  scheduleRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md,
    padding: 8, marginTop: 6,
  },
  scheduleTime: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  scheduleDays: { fontSize: 12, color: Colors.textLight },
  scheduleTag: {
    fontSize: 11, color: Colors.primary, backgroundColor: Colors.primary + "18",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, fontWeight: "600",
  },

  interactionBanner: {
    backgroundColor: "#FEF3C7", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  interactionText: { fontSize: FontSize.sm, color: "#92400E", fontWeight: "600" },

  selectRow: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    padding: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.cardLight, marginBottom: 6, borderWidth: 1.5, borderColor: "transparent",
  },
  selectRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },

  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary + "22", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: Colors.primary },

  permBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
    backgroundColor: Colors.primary + "18",
  },
  permBadgeText: { fontSize: 11, color: Colors.primary, fontWeight: "600" },

  toggleRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  toggleSub: { fontSize: 12, color: Colors.textLight, marginTop: 2 },

  // Modal
  modalWrap: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingTop: Platform.OS === "ios" ? 56 : Spacing.md,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  modalCancel: { fontSize: FontSize.md, color: Colors.textLight },
  modalSave: { fontSize: FontSize.md, color: Colors.primary, fontWeight: "700" },
  modalScroll: { padding: Spacing.md },

  sectionLabel: {
    fontSize: FontSize.sm, fontWeight: "700", color: Colors.textLight,
    marginBottom: 6, marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.cardLight, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },

  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center", padding: Spacing.lg,
  },
  inlineModal: {
    backgroundColor: Colors.background, borderRadius: Radius.xl, padding: Spacing.lg,
    width: "100%", ...Shadow.md,
  },

  noKidsBanner: {
    backgroundColor: "#FEF3C7", borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  noKidsText: { fontSize: FontSize.md, fontWeight: "700", color: "#92400E", marginBottom: 4 },
  noKidsSub: { fontSize: FontSize.sm, color: "#78350F" },
});
