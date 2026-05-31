import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Modal, ScrollView, Switch,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, confirmDestructive, alertMessage } from "../../../lib/utils";
import type {
  EmergencyContact, InsuranceDocument, InsuranceType,
  IdentityDocument, IdentityDocType, VaccinationRecord,
  Prescription, OtherDocument, OtherDocType,
} from "../../../lib/data/types";

// ─── Types & constants ────────────────────────────────────────────────────────
const TABS = ["Emergency", "Insurance", "Identity", "Medical", "Other"] as const;
type Tab = typeof TABS[number];

const INSURANCE_TYPES: { type: InsuranceType; label: string; emoji: string }[] = [
  { type: "life",          label: "Life Insurance",       emoji: "💛" },
  { type: "health",        label: "Health Insurance",     emoji: "💊" },
  { type: "dental",        label: "Dental Insurance",     emoji: "🦷" },
  { type: "vision",        label: "Vision Insurance",     emoji: "👁️" },
  { type: "car",           label: "Car Insurance",        emoji: "🚗" },
  { type: "home_renters",  label: "Home/Renters",         emoji: "🏠" },
  { type: "disability",    label: "Disability Insurance", emoji: "🛡️" },
];

const IDENTITY_TYPES: { type: IdentityDocType; label: string; emoji: string; hasExpiry: boolean }[] = [
  { type: "passport",           label: "Passport",             emoji: "📕", hasExpiry: true  },
  { type: "drivers_license",    label: "Driver's License / ID", emoji: "🪪", hasExpiry: true  },
  { type: "birth_certificate",  label: "Birth Certificate",    emoji: "📜", hasExpiry: false },
  { type: "social_security",    label: "Social Security Card", emoji: "🔒", hasExpiry: false },
  { type: "green_card_visa",    label: "Green Card / Visa",    emoji: "🌐", hasExpiry: true  },
];

const OTHER_TYPES: { type: OtherDocType; label: string; emoji: string }[] = [
  { type: "vehicle_title",  label: "Vehicle Title",    emoji: "🚘" },
  { type: "property_deed",  label: "Property Deed",    emoji: "🏡" },
  { type: "will_trust",     label: "Will / Trust",     emoji: "⚖️" },
];

const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Unknown"];

function daysUntilExpiry(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ date }: { date: string }) {
  const days = daysUntilExpiry(date);
  // Guard malformed dates (unparseable YYYY-MM-DD → NaN) so we don't render "NaNd".
  if (isNaN(days) || days > 60) return null;
  const color = days <= 0 ? Colors.error : days <= 14 ? "#EF4444" : Colors.secondary;
  const label = days <= 0 ? "Expired!" : `Expires in ${days}d`;
  return (
    <View style={[styles.expiryBadge, { backgroundColor: color + "22", borderColor: color }]}>
      <Text style={[styles.expiryBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function FieldInput({ label, value, onChangeText, onBlur, placeholder, multiline, keyboard }: {
  label: string; value: string; onChangeText: (v: string) => void; onBlur?: () => void;
  placeholder?: string; multiline?: boolean; keyboard?: "default" | "phone-pad" | "decimal-pad";
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
        value={value} onChangeText={onChangeText} onBlur={onBlur} placeholder={placeholder}
        multiline={multiline} keyboardType={keyboard ?? "default"}
      />
    </View>
  );
}

// Like FieldInput, but keeps a LOCAL draft and only commits onBlur. Use this for
// fields bound to GLOBAL state — committing on every keystroke re-renders the whole
// screen and can drop characters / lag (esp. with IME) on fast typing.
function DraftInput({ label, value, onCommit, style, placeholder, multiline, keyboard }: {
  label?: string; value: string; onCommit: (v: string) => void; style?: any;
  placeholder?: string; multiline?: boolean; keyboard?: "default" | "phone-pad" | "decimal-pad";
}) {
  const [draft, setDraft] = useState(value);
  // Re-sync if the committed value changes from elsewhere (e.g. hydration).
  useEffect(() => { setDraft(value); }, [value]);
  const field = (
    <TextInput
      style={style ?? [styles.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
      value={draft} onChangeText={setDraft} onBlur={() => onCommit(draft)}
      placeholder={placeholder} multiline={multiline} keyboardType={keyboard ?? "default"}
    />
  );
  if (!label) return field;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {field}
    </View>
  );
}

// ─── Tab: Emergency ───────────────────────────────────────────────────────────
function EmergencyTab() {
  const { state, dispatch } = useData();
  const info = state.importantInfo;
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [cName, setCName] = useState(""); const [cPhone, setCPhone] = useState(""); const [cRel, setCRel] = useState("");

  function updateField(payload: Partial<typeof info>) {
    dispatch({ type: "IMPORTANT_INFO_UPDATE", payload });
  }

  function flashSaved() {
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  function addContact() {
    if (!cName.trim() || !cPhone.trim()) { alertMessage("Name and phone required."); return; }
    const c: EmergencyContact = { id: uid(), name: cName.trim(), phone: cPhone.trim(), relation: cRel.trim() || "Family" };
    dispatch({ type: "IMPORTANT_INFO_UPDATE", payload: { emergencyContacts: [...(info.emergencyContacts ?? []), c] } });
    flashSaved();
    setCName(""); setCPhone(""); setCRel(""); setShowForm(false);
  }

  function removeContact(id: string) {
    confirmDestructive("Remove contact?", "", () => {
      dispatch({ type: "IMPORTANT_INFO_UPDATE", payload: { emergencyContacts: (info.emergencyContacts ?? []).filter(c => c.id !== id) } });
      flashSaved();
    }, "Remove");
  }

  return (
    <>
      {saved && <View style={styles.savedBanner}><Text style={styles.savedBannerText}>✅ Saved</Text></View>}

      <View style={styles.emergencyBanner}>
        <Text style={styles.emergencyBannerText}>🚨 This info is visible to your kids in their Important Info screen.</Text>
      </View>

      <SectionHeader emoji="📞" title="Emergency Contacts" />
      {(info.emergencyContacts ?? []).map(c => (
        <View key={c.id} style={[styles.docCard, { flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.docTitle}>{c.name} · {c.relation}</Text>
            <Text style={styles.docMeta}>{c.phone}</Text>
          </View>
          <TouchableOpacity onPress={() => removeContact(c.id)} style={styles.deleteCardBtn}>
            <Text style={styles.deleteCardText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.dashedAddBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.dashedAddBtnText}>+ Add Emergency Contact</Text>
      </TouchableOpacity>

      <SectionHeader emoji="📋" title="What to Do in Emergency" />
      <DraftInput style={[styles.input, { minHeight: 80, textAlignVertical: "top", marginBottom: 12 }]}
        value={info.emergencyPlan} onCommit={v => { updateField({ emergencyPlan: v }); flashSaved(); }}
        placeholder="e.g. Stay calm. Call 911 first. Then call Mom/Dad…" multiline />

      <SectionHeader emoji="📍" title="Where to Go" />
      <DraftInput style={[styles.input, { marginBottom: 12 }]}
        value={info.emergencyLocation} onCommit={v => { updateField({ emergencyLocation: v }); flashSaved(); }}
        placeholder="e.g. Grandma's house at 123 Main St" />

      <SectionHeader emoji="🏥" title="Our Doctor" />
      <DraftInput label="Doctor's Name" value={info.doctorName} onCommit={v => { updateField({ doctorName: v }); flashSaved(); }} placeholder="Dr. Smith" />
      <DraftInput label="Doctor's Phone" value={info.doctorPhone} onCommit={v => { updateField({ doctorPhone: v }); flashSaved(); }} placeholder="Phone number" keyboard="phone-pad" />

      <SectionHeader emoji="📝" title="Additional Notes" />
      <DraftInput style={[styles.input, { minHeight: 100, textAlignVertical: "top", marginBottom: 12 }]}
        value={info.additionalNotes} onCommit={v => { updateField({ additionalNotes: v }); flashSaved(); }}
        placeholder="Any other important info your kids should know…" multiline />

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📞 Add Emergency Contact</Text>
            <TextInput style={styles.input} value={cName} onChangeText={setCName} placeholder="Full name" autoFocus />
            <TextInput style={styles.input} value={cPhone} onChangeText={setCPhone} placeholder="Phone number" keyboardType="phone-pad" />
            <TextInput style={styles.input} value={cRel} onChangeText={setCRel} placeholder="Relation (e.g. Grandma, Uncle Bob)" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setCName(""); setCPhone(""); setCRel(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={addContact}>
                <Text style={styles.saveModalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Tab: Insurance ───────────────────────────────────────────────────────────
function InsuranceTab() {
  const { state, dispatch } = useData();
  const docs = state.documentVault?.insurance ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [insType, setInsType] = useState<InsuranceType>("health");
  const [provider, setProvider] = useState("");
  const [policyNum, setPolicyNum] = useState("");
  const [details, setDetails] = useState("");
  const [expiry, setExpiry] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [shared, setShared] = useState(true);

  function reset() {
    setInsType("health"); setProvider(""); setPolicyNum(""); setDetails("");
    setExpiry(""); setPinLocked(false); setShared(true); setEditId(null);
  }

  function openEdit(d: InsuranceDocument) {
    setInsType(d.type); setProvider(d.provider); setPolicyNum(d.policyNumber);
    setDetails(d.details); setExpiry(d.expiryDate ?? ""); setPinLocked(d.pinLocked);
    setShared(d.sharedWithCoParent); setEditId(d.id); setShowForm(true);
  }

  function save() {
    if (!provider.trim()) { alertMessage("Provider is required."); return; }
    if (editId) {
      dispatch({ type: "VAULT_INSURANCE_UPDATE", docId: editId, payload: {
        type: insType, provider: provider.trim(), policyNumber: policyNum.trim(),
        details: details.trim(), expiryDate: expiry.trim() || undefined,
        pinLocked, sharedWithCoParent: shared,
      }});
    } else {
      const doc: InsuranceDocument = {
        id: uid(), type: insType, provider: provider.trim(), policyNumber: policyNum.trim(),
        details: details.trim(), expiryDate: expiry.trim() || undefined,
        photos: [], pinLocked, sharedWithCoParent: shared,
      };
      dispatch({ type: "VAULT_INSURANCE_ADD", doc });
    }
    setShowForm(false); reset();
  }

  function remove(id: string) {
    confirmDestructive("Delete document?", "", () => dispatch({ type: "VAULT_INSURANCE_DELETE", docId: id }));
  }

  return (
    <>
      <TouchableOpacity style={styles.addBtn} onPress={() => { reset(); setShowForm(true); }}>
        <Text style={styles.addBtnText}>+ Add Insurance Document</Text>
      </TouchableOpacity>

      {docs.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🛡️</Text>
          <Text style={styles.emptyText}>No insurance docs yet.</Text>
          <Text style={styles.emptySub}>Add life, health, dental, vision, car, home, or disability insurance details.</Text>
        </View>
      )}

      {docs.map(d => {
        const info = INSURANCE_TYPES.find(t => t.type === d.type);
        return (
          <View key={d.id} style={styles.docCard}>
            <View style={styles.docCardHeader}>
              <Text style={styles.docEmoji}>{info?.emoji ?? "📄"}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.docTitle}>{info?.label ?? d.type}</Text>
                  {d.pinLocked && <Text style={styles.pinIcon}>🔐</Text>}
                  {d.sharedWithCoParent && <Text style={styles.sharedIcon}>🤝</Text>}
                </View>
                <Text style={styles.docMeta}>{d.provider}{d.policyNumber ? ` · ${d.policyNumber}` : ""}</Text>
              </View>
              {d.expiryDate && <ExpiryBadge date={d.expiryDate} />}
            </View>
            {d.details ? <Text style={styles.docDetails}>{d.details}</Text> : null}
            {d.expiryDate ? <Text style={styles.docExpiry}>Expires: {d.expiryDate}</Text> : null}
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editCardBtn} onPress={() => openEdit(d)}>
                <Text style={styles.editCardText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteCardBtn} onPress={() => remove(d.id)}>
                <Text style={styles.deleteCardText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => { setShowForm(false); reset(); }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalCard} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{editId ? "✏️ Edit Insurance" : "🛡️ Add Insurance"}</Text>

            <Text style={styles.fieldLabel}>Insurance Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
              {INSURANCE_TYPES.map(t => (
                <TouchableOpacity key={t.type}
                  style={[styles.typeChip, insType === t.type && styles.typeChipActive]}
                  onPress={() => setInsType(t.type)}>
                  <Text style={insType === t.type ? { color: "#fff" } : {}}>{t.emoji} {t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FieldInput label="Provider / Company" value={provider} onChangeText={setProvider} placeholder="e.g. Blue Cross Blue Shield" />
            <FieldInput label="Policy Number" value={policyNum} onChangeText={setPolicyNum} placeholder="e.g. BC123456789" />
            <FieldInput label="Key Details (group #, notes…)" value={details} onChangeText={setDetails} placeholder="Group #, member ID, phone…" multiline />
            <FieldInput label="Expiry Date (YYYY-MM-DD)" value={expiry} onChangeText={setExpiry} placeholder="2027-01-01" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🔐 PIN lock this document</Text>
              <Switch value={pinLocked} onValueChange={setPinLocked} trackColor={{ true: Colors.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🤝 Shared with co-parent</Text>
              <Switch value={shared} onValueChange={setShared} trackColor={{ true: Colors.primary }} />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); reset(); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={save}>
                <Text style={styles.saveModalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Tab: Identity ────────────────────────────────────────────────────────────
function IdentityTab() {
  const { state, dispatch } = useData();
  const docs = state.documentVault?.identity ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [docType, setDocType] = useState<IdentityDocType>("passport");
  const [holder, setHolder] = useState("");
  const [docNum, setDocNum] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiry, setExpiry] = useState("");
  const [country, setCountry] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [notes, setNotes] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [shared, setShared] = useState(true);

  function reset() {
    setDocType("passport"); setHolder(""); setDocNum(""); setIssueDate("");
    setExpiry(""); setCountry(""); setStateVal(""); setNotes("");
    setPinLocked(false); setShared(true); setEditId(null);
  }

  function openEdit(d: IdentityDocument) {
    setDocType(d.type); setHolder(d.holderName); setDocNum(d.documentNumber ?? "");
    setIssueDate(d.issueDate ?? ""); setExpiry(d.expiryDate ?? "");
    setCountry(d.issuingCountry ?? ""); setStateVal(d.state ?? "");
    setNotes(d.notes ?? ""); setPinLocked(d.pinLocked); setShared(d.sharedWithCoParent);
    setEditId(d.id); setShowForm(true);
  }

  function save() {
    if (!holder.trim()) { alertMessage("Holder name is required."); return; }
    const isSsn = docType === "social_security";
    if (isSsn && docNum.length > 4) { alertMessage("For security, only store the last 4 digits of Social Security numbers."); return; }
    if (editId) {
      dispatch({ type: "VAULT_IDENTITY_UPDATE", docId: editId, payload: {
        type: docType, holderName: holder.trim(), documentNumber: docNum.trim() || undefined,
        issueDate: issueDate.trim() || undefined, expiryDate: expiry.trim() || undefined,
        issuingCountry: country.trim() || undefined, state: stateVal.trim() || undefined,
        notes: notes.trim() || undefined, pinLocked, sharedWithCoParent: shared,
      }});
    } else {
      const doc: IdentityDocument = {
        id: uid(), type: docType, holderName: holder.trim(),
        documentNumber: docNum.trim() || undefined, issueDate: issueDate.trim() || undefined,
        expiryDate: expiry.trim() || undefined, issuingCountry: country.trim() || undefined,
        state: stateVal.trim() || undefined, notes: notes.trim() || undefined,
        photos: [], pinLocked, sharedWithCoParent: shared,
      };
      dispatch({ type: "VAULT_IDENTITY_ADD", doc });
    }
    setShowForm(false); reset();
  }

  function remove(id: string) {
    confirmDestructive("Delete document?", "", () => dispatch({ type: "VAULT_IDENTITY_DELETE", docId: id }));
  }

  const typeInfo = IDENTITY_TYPES.find(t => t.type === docType);

  return (
    <>
      <View style={styles.securityNote}>
        <Text style={styles.securityNoteText}>🔒 Identity documents are sensitive. Use PIN lock for extra protection. Store only the last 4 digits of SSNs.</Text>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => { reset(); setShowForm(true); }}>
        <Text style={styles.addBtnText}>+ Add Identity Document</Text>
      </TouchableOpacity>

      {docs.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🪪</Text>
          <Text style={styles.emptyText}>No identity docs yet.</Text>
          <Text style={styles.emptySub}>Store passports, driver's licenses, birth certificates, and more.</Text>
        </View>
      )}

      {docs.map(d => {
        const info = IDENTITY_TYPES.find(t => t.type === d.type);
        return (
          <View key={d.id} style={styles.docCard}>
            <View style={styles.docCardHeader}>
              <Text style={styles.docEmoji}>{info?.emoji ?? "📄"}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.docTitle}>{info?.label ?? d.type}</Text>
                  {d.pinLocked && <Text style={styles.pinIcon}>🔐</Text>}
                  {d.sharedWithCoParent && <Text style={styles.sharedIcon}>🤝</Text>}
                </View>
                <Text style={styles.docMeta}>{d.holderName}{d.documentNumber ? (d.type === "social_security" ? ` · ****${d.documentNumber}` : ` · ${d.documentNumber}`) : ""}</Text>
              </View>
              {d.expiryDate && <ExpiryBadge date={d.expiryDate} />}
            </View>
            {d.issueDate && <Text style={styles.docExpiry}>Issued: {d.issueDate}{d.expiryDate ? ` · Expires: ${d.expiryDate}` : ""}</Text>}
            {(d.issuingCountry || d.state) && <Text style={styles.docDetails}>{[d.issuingCountry, d.state].filter(Boolean).join(", ")}</Text>}
            {d.notes ? <Text style={styles.docDetails}>{d.notes}</Text> : null}
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editCardBtn} onPress={() => openEdit(d)}>
                <Text style={styles.editCardText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteCardBtn} onPress={() => remove(d.id)}>
                <Text style={styles.deleteCardText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => { setShowForm(false); reset(); }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalCard} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{editId ? "✏️ Edit Document" : "🪪 Add Identity Document"}</Text>

            <Text style={styles.fieldLabel}>Document Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
              {IDENTITY_TYPES.map(t => (
                <TouchableOpacity key={t.type}
                  style={[styles.typeChip, docType === t.type && styles.typeChipActive]}
                  onPress={() => setDocType(t.type)}>
                  <Text style={docType === t.type ? { color: "#fff" } : {}}>{t.emoji} {t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FieldInput label="Name on Document" value={holder} onChangeText={setHolder} placeholder="Full legal name" />

            {docType === "social_security" ? (
              <FieldInput label="Last 4 Digits Only" value={docNum} onChangeText={v => setDocNum(v.slice(0, 4))}
                placeholder="1234" keyboard="decimal-pad" />
            ) : (
              <FieldInput label="Document Number" value={docNum} onChangeText={setDocNum} placeholder="e.g. A1234567" />
            )}

            {typeInfo?.hasExpiry && (
              <>
                <FieldInput label="Issue Date (YYYY-MM-DD)" value={issueDate} onChangeText={setIssueDate} placeholder="2020-01-15" />
                <FieldInput label="Expiry Date (YYYY-MM-DD)" value={expiry} onChangeText={setExpiry} placeholder="2030-01-15" />
              </>
            )}

            {(docType === "passport" || docType === "green_card_visa") && (
              <FieldInput label="Issuing Country" value={country} onChangeText={setCountry} placeholder="e.g. United States" />
            )}
            {docType === "drivers_license" && (
              <FieldInput label="State / Province" value={stateVal} onChangeText={setStateVal} placeholder="e.g. California" />
            )}

            <FieldInput label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Any notes…" multiline />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🔐 PIN lock this document</Text>
              <Switch value={pinLocked} onValueChange={setPinLocked} trackColor={{ true: Colors.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🤝 Shared with co-parent</Text>
              <Switch value={shared} onValueChange={setShared} trackColor={{ true: Colors.primary }} />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); reset(); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={save}>
                <Text style={styles.saveModalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Tab: Medical ─────────────────────────────────────────────────────────────
function MedicalTab() {
  const { state, dispatch } = useData();
  const medical = state.documentVault?.medical ?? { vaccinations: [], prescriptions: [], allergies: "", conditions: "", preferredHospital: "" };
  const [saved, setSaved] = useState(false);

  const [showVaxForm, setShowVaxForm] = useState(false);
  const [vaxName, setVaxName] = useState(""); const [vaxDate, setVaxDate] = useState(""); const [vaxDue, setVaxDue] = useState(""); const [vaxProvider, setVaxProvider] = useState("");

  const [showRxForm, setShowRxForm] = useState(false);
  const [rxMed, setRxMed] = useState(""); const [rxDose, setRxDose] = useState(""); const [rxDoc, setRxDoc] = useState(""); const [rxPharm, setRxPharm] = useState(""); const [rxRefill, setRxRefill] = useState("");
  const [editRxId, setEditRxId] = useState<string | null>(null);

  function updateMedical(payload: Partial<typeof medical>) {
    dispatch({ type: "VAULT_MEDICAL_UPDATE", payload });
  }

  function flashSaved() {
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  function addVax() {
    if (!vaxName.trim() || !vaxDate.trim()) { alertMessage("Vaccine name and date required."); return; }
    const r: VaccinationRecord = { id: uid(), vaccine: vaxName.trim(), date: vaxDate.trim(), nextDueDate: vaxDue.trim() || undefined, provider: vaxProvider.trim() || undefined };
    dispatch({ type: "VAULT_VACCINATION_ADD", record: r });
    flashSaved();
    setVaxName(""); setVaxDate(""); setVaxDue(""); setVaxProvider(""); setShowVaxForm(false);
  }

  function removeVax(id: string) {
    confirmDestructive("Remove vaccination record?", "", () => { dispatch({ type: "VAULT_VACCINATION_DELETE", recordId: id }); flashSaved(); }, "Remove");
  }

  function openRxEdit(rx: Prescription) {
    setRxMed(rx.medication); setRxDose(rx.dosage); setRxDoc(rx.doctor);
    setRxPharm(rx.pharmacy); setRxRefill(rx.refillDate ?? ""); setEditRxId(rx.id); setShowRxForm(true);
  }

  function saveRx() {
    if (!rxMed.trim()) { alertMessage("Medication name required."); return; }
    if (editRxId) {
      dispatch({ type: "VAULT_PRESCRIPTION_UPDATE", rxId: editRxId, payload: {
        medication: rxMed.trim(), dosage: rxDose.trim(), doctor: rxDoc.trim(),
        pharmacy: rxPharm.trim(), refillDate: rxRefill.trim() || undefined,
      }});
    } else {
      const rx: Prescription = { id: uid(), medication: rxMed.trim(), dosage: rxDose.trim(), doctor: rxDoc.trim(), pharmacy: rxPharm.trim(), refillDate: rxRefill.trim() || undefined };
      dispatch({ type: "VAULT_PRESCRIPTION_ADD", rx });
    }
    flashSaved();
    setRxMed(""); setRxDose(""); setRxDoc(""); setRxPharm(""); setRxRefill(""); setEditRxId(null); setShowRxForm(false);
  }

  function removeRx(id: string) {
    confirmDestructive("Remove prescription?", "", () => { dispatch({ type: "VAULT_PRESCRIPTION_DELETE", rxId: id }); flashSaved(); }, "Remove");
  }

  return (
    <>
      {saved && <View style={styles.savedBanner}><Text style={styles.savedBannerText}>✅ Saved</Text></View>}

      <SectionHeader emoji="🩸" title="Emergency Medical Info" />
      <Text style={styles.fieldLabel}>Blood Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        {BLOOD_TYPES.map(bt => (
          <TouchableOpacity key={bt}
            style={[styles.typeChip, medical.bloodType === bt && styles.typeChipActive]}
            onPress={() => { updateMedical({ bloodType: bt }); flashSaved(); }}>
            <Text style={medical.bloodType === bt ? { color: "#fff", fontWeight: "700" } : {}}>{bt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <DraftInput label="Allergies" value={medical.allergies ?? ""} onCommit={v => { updateMedical({ allergies: v }); flashSaved(); }} placeholder="e.g. Penicillin, Peanuts, Latex" multiline />
      <DraftInput label="Medical Conditions" value={medical.conditions ?? ""} onCommit={v => { updateMedical({ conditions: v }); flashSaved(); }} placeholder="e.g. Asthma, Type 1 Diabetes" multiline />
      <DraftInput label="Preferred Hospital / ER" value={medical.preferredHospital ?? ""} onCommit={v => { updateMedical({ preferredHospital: v }); flashSaved(); }} placeholder="e.g. Children's National Hospital" />

      <SectionHeader emoji="💉" title="Vaccination Records" />
      {(medical.vaccinations ?? []).map(v => (
        <View key={v.id} style={[styles.docCard, { flexDirection: "row", alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.docTitle}>{v.vaccine}</Text>
            <Text style={styles.docMeta}>Given: {v.date}{v.nextDueDate ? ` · Next due: ${v.nextDueDate}` : ""}</Text>
            {v.provider && <Text style={styles.docDetails}>{v.provider}</Text>}
          </View>
          <TouchableOpacity style={styles.deleteCardBtn} onPress={() => removeVax(v.id)}>
            <Text style={styles.deleteCardText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.dashedAddBtn} onPress={() => setShowVaxForm(true)}>
        <Text style={styles.dashedAddBtnText}>+ Add Vaccination</Text>
      </TouchableOpacity>

      <SectionHeader emoji="💊" title="Prescriptions" />
      {(medical.prescriptions ?? []).map(rx => (
        <View key={rx.id} style={[styles.docCard, { flexDirection: "row", alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.docTitle}>{rx.medication}{rx.dosage ? ` — ${rx.dosage}` : ""}</Text>
            <Text style={styles.docMeta}>Dr. {rx.doctor} · {rx.pharmacy}</Text>
            {rx.refillDate && <Text style={styles.docDetails}>Refill: {rx.refillDate}</Text>}
          </View>
          <View style={{ gap: 6 }}>
            <TouchableOpacity style={styles.editCardBtn} onPress={() => openRxEdit(rx)}>
              <Text style={styles.editCardText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteCardBtn} onPress={() => removeRx(rx.id)}>
              <Text style={styles.deleteCardText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.dashedAddBtn} onPress={() => setShowRxForm(true)}>
        <Text style={styles.dashedAddBtnText}>+ Add Prescription</Text>
      </TouchableOpacity>

      {/* Vaccination Modal */}
      <Modal visible={showVaxForm} animationType="slide" transparent onRequestClose={() => { setShowVaxForm(false); setVaxName(""); setVaxDate(""); setVaxDue(""); setVaxProvider(""); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>💉 Add Vaccination</Text>
            <FieldInput label="Vaccine Name" value={vaxName} onChangeText={setVaxName} placeholder="e.g. MMR, COVID-19, Flu" />
            <FieldInput label="Date Given (YYYY-MM-DD)" value={vaxDate} onChangeText={setVaxDate} placeholder="2025-09-01" />
            <FieldInput label="Next Due Date (optional)" value={vaxDue} onChangeText={setVaxDue} placeholder="2026-09-01" />
            <FieldInput label="Provider (optional)" value={vaxProvider} onChangeText={setVaxProvider} placeholder="e.g. Pediatrician, CVS" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowVaxForm(false); setVaxName(""); setVaxDate(""); setVaxDue(""); setVaxProvider(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={addVax}>
                <Text style={styles.saveModalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Prescription Modal */}
      <Modal visible={showRxForm} animationType="slide" transparent onRequestClose={() => { setShowRxForm(false); setRxMed(""); setRxDose(""); setRxDoc(""); setRxPharm(""); setRxRefill(""); setEditRxId(null); }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalCard} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{editRxId ? "✏️ Edit Prescription" : "💊 Add Prescription"}</Text>
            <FieldInput label="Medication" value={rxMed} onChangeText={setRxMed} placeholder="e.g. Amoxicillin" />
            <FieldInput label="Dosage" value={rxDose} onChangeText={setRxDose} placeholder="e.g. 250mg twice daily" />
            <FieldInput label="Doctor" value={rxDoc} onChangeText={setRxDoc} placeholder="Dr. Smith" />
            <FieldInput label="Pharmacy" value={rxPharm} onChangeText={setRxPharm} placeholder="e.g. CVS, Walgreens" />
            <FieldInput label="Refill Date (optional)" value={rxRefill} onChangeText={setRxRefill} placeholder="2026-08-01" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowRxForm(false); setRxMed(""); setRxDose(""); setRxDoc(""); setRxPharm(""); setRxRefill(""); setEditRxId(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={saveRx}>
                <Text style={styles.saveModalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Tab: Other ───────────────────────────────────────────────────────────────
function OtherTab() {
  const { state, dispatch } = useData();
  const docs = state.documentVault?.other ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [docType, setDocType] = useState<OtherDocType>("vehicle_title");
  const [docTitle, setDocTitle] = useState("");
  const [details, setDetails] = useState("");
  const [attorney, setAttorney] = useState("");
  const [physLoc, setPhysLoc] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [shared, setShared] = useState(true);

  function reset() {
    setDocType("vehicle_title"); setDocTitle(""); setDetails(""); setAttorney("");
    setPhysLoc(""); setPinLocked(false); setShared(true); setEditId(null);
  }

  function openEdit(d: OtherDocument) {
    setDocType(d.type); setDocTitle(d.title); setDetails(d.details);
    setAttorney(d.attorneyContact ?? ""); setPhysLoc(d.physicalLocation ?? "");
    setPinLocked(d.pinLocked); setShared(d.sharedWithCoParent); setEditId(d.id); setShowForm(true);
  }

  function save() {
    if (!docTitle.trim()) { alertMessage("Title is required."); return; }
    if (editId) {
      dispatch({ type: "VAULT_OTHER_UPDATE", docId: editId, payload: {
        type: docType, title: docTitle.trim(), details: details.trim(),
        // Only save will/trust-specific fields when doc type is will_trust
        attorneyContact: docType === "will_trust" ? (attorney.trim() || undefined) : undefined,
        physicalLocation: docType === "will_trust" ? (physLoc.trim() || undefined) : undefined,
        pinLocked, sharedWithCoParent: shared,
      }});
    } else {
      const doc: OtherDocument = {
        id: uid(), type: docType, title: docTitle.trim(), details: details.trim(),
        photos: [], pinLocked, sharedWithCoParent: shared,
        attorneyContact: docType === "will_trust" ? (attorney.trim() || undefined) : undefined,
        physicalLocation: docType === "will_trust" ? (physLoc.trim() || undefined) : undefined,
      };
      dispatch({ type: "VAULT_OTHER_ADD", doc });
    }
    setShowForm(false); reset();
  }

  function remove(id: string) {
    confirmDestructive("Delete document?", "", () => dispatch({ type: "VAULT_OTHER_DELETE", docId: id }));
  }

  return (
    <>
      <TouchableOpacity style={styles.addBtn} onPress={() => { reset(); setShowForm(true); }}>
        <Text style={styles.addBtnText}>+ Add Document</Text>
      </TouchableOpacity>

      {docs.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📂</Text>
          <Text style={styles.emptyText}>No other documents yet.</Text>
          <Text style={styles.emptySub}>Store vehicle titles, property deeds, wills, and trusts.</Text>
        </View>
      )}

      {docs.map(d => {
        const info = OTHER_TYPES.find(t => t.type === d.type);
        return (
          <View key={d.id} style={styles.docCard}>
            <View style={styles.docCardHeader}>
              <Text style={styles.docEmoji}>{info?.emoji ?? "📄"}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.docTitle}>{d.title}</Text>
                  {d.pinLocked && <Text style={styles.pinIcon}>🔐</Text>}
                  {d.sharedWithCoParent && <Text style={styles.sharedIcon}>🤝</Text>}
                </View>
                <Text style={styles.docMeta}>{info?.label ?? d.type}</Text>
              </View>
            </View>
            {d.details ? <Text style={styles.docDetails}>{d.details}</Text> : null}
            {d.attorneyContact && <Text style={styles.docDetails}>Attorney: {d.attorneyContact}</Text>}
            {d.physicalLocation && <Text style={styles.docDetails}>Location: {d.physicalLocation}</Text>}
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editCardBtn} onPress={() => openEdit(d)}>
                <Text style={styles.editCardText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteCardBtn} onPress={() => remove(d.id)}>
                <Text style={styles.deleteCardText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => { setShowForm(false); reset(); }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalCard} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{editId ? "✏️ Edit Document" : "📂 Add Document"}</Text>

            <Text style={styles.fieldLabel}>Document Type</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {OTHER_TYPES.map(t => (
                <TouchableOpacity key={t.type}
                  style={[styles.typeChip, docType === t.type && styles.typeChipActive]}
                  onPress={() => setDocType(t.type)}>
                  <Text style={docType === t.type ? { color: "#fff" } : {}}>{t.emoji} {t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FieldInput label="Title / Description" value={docTitle} onChangeText={setDocTitle} placeholder="e.g. 2023 Honda Accord Title" />
            <FieldInput label="Details" value={details} onChangeText={setDetails} placeholder="Relevant details, account numbers, etc." multiline />

            {docType === "will_trust" && (
              <>
                <FieldInput label="Attorney Contact" value={attorney} onChangeText={setAttorney} placeholder="Name & phone of attorney" />
                <FieldInput label="Physical Location" value={physLoc} onChangeText={setPhysLoc} placeholder="e.g. Safe deposit box at Chase Bank" />
              </>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🔐 PIN lock this document</Text>
              <Switch value={pinLocked} onValueChange={setPinLocked} trackColor={{ true: Colors.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🤝 Shared with co-parent</Text>
              <Switch value={shared} onValueChange={setShared} trackColor={{ true: Colors.primary }} />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); reset(); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={save}>
                <Text style={styles.saveModalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ImportantInfoParentScreen() {
  const { state } = useData();
  const [tab, setTab] = useState<Tab>("Emergency");
  const [search, setSearch] = useState("");

  const vault = state.documentVault;
  const allExpiring = useMemo(() => {
    const items: { label: string; emoji: string; date: string }[] = [];
    (vault?.insurance ?? []).forEach(d => {
      if (d.expiryDate) {
        const info = INSURANCE_TYPES.find(t => t.type === d.type);
        items.push({ label: info?.label ?? d.type, emoji: info?.emoji ?? "📄", date: d.expiryDate });
      }
    });
    (vault?.identity ?? []).forEach(d => {
      if (d.expiryDate) {
        const info = IDENTITY_TYPES.find(t => t.type === d.type);
        items.push({ label: `${info?.label ?? d.type} — ${d.holderName}`, emoji: info?.emoji ?? "📄", date: d.expiryDate });
      }
    });
    return items.filter(i => daysUntilExpiry(i.date) <= 60).sort((a, b) => a.date.localeCompare(b.date));
  }, [vault]);

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📋 Important Docs & Info</Text>
      <Text style={styles.sub}>Emergency info, insurance, identity, medical records, and vital documents — all in one place.</Text>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
          placeholder="Search documents…" placeholderTextColor={Colors.textSecondary} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Expiry warnings */}
      {allExpiring.length > 0 && search.length === 0 && (
        <View style={styles.expiryAlert}>
          <Text style={styles.expiryAlertTitle}>⚠️ Expiring Soon</Text>
          {allExpiring.map((item, i) => (
            <Text key={i} style={styles.expiryAlertItem}>{item.emoji} {item.label} — {item.date}</Text>
          ))}
        </View>
      )}

      {/* Tab bar */}
      {search.length === 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginBottom: Spacing.md, flexGrow: 0 }}
          contentContainerStyle={{ alignItems: "center" }}>
          {TABS.map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Search results mode */}
      {search.length > 0 && <SearchResults query={search} />}

      {/* Tab content */}
      {search.length === 0 && tab === "Emergency"  && <EmergencyTab />}
      {search.length === 0 && tab === "Insurance"  && <InsuranceTab />}
      {search.length === 0 && tab === "Identity"   && <IdentityTab />}
      {search.length === 0 && tab === "Medical"    && <MedicalTab />}
      {search.length === 0 && tab === "Other"      && <OtherTab />}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

function SearchResults({ query }: { query: string }) {
  const { state } = useData();
  const q = query.toLowerCase();
  const vault = state.documentVault;
  const info  = state.importantInfo;

  const results: { section: string; label: string; meta: string; emoji: string }[] = [];

  (info.emergencyContacts ?? []).filter(c =>
    c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.relation.toLowerCase().includes(q)
  ).forEach(c => results.push({ section: "Emergency Contacts", label: c.name, meta: `${c.relation} · ${c.phone}`, emoji: "📞" }));

  (vault?.insurance ?? []).filter(d =>
    d.provider.toLowerCase().includes(q) || d.policyNumber.toLowerCase().includes(q) || d.details.toLowerCase().includes(q)
  ).forEach(d => {
    const t = INSURANCE_TYPES.find(i => i.type === d.type);
    results.push({ section: "Insurance", label: t?.label ?? d.type, meta: `${d.provider} · ${d.policyNumber}`, emoji: t?.emoji ?? "📄" });
  });

  (vault?.identity ?? []).filter(d =>
    d.holderName.toLowerCase().includes(q) || (d.notes ?? "").toLowerCase().includes(q)
  ).forEach(d => {
    const t = IDENTITY_TYPES.find(i => i.type === d.type);
    results.push({ section: "Identity", label: t?.label ?? d.type, meta: d.holderName, emoji: t?.emoji ?? "📄" });
  });

  // Search medical text fields (allergies, conditions, preferred hospital)
  if ((vault?.medical?.allergies ?? "").toLowerCase().includes(q) && vault?.medical?.allergies) {
    results.push({ section: "Medical", label: "Allergies", meta: vault.medical.allergies, emoji: "🩸" });
  }
  if ((vault?.medical?.conditions ?? "").toLowerCase().includes(q) && vault?.medical?.conditions) {
    results.push({ section: "Medical", label: "Conditions", meta: vault.medical.conditions, emoji: "🩸" });
  }
  if ((vault?.medical?.preferredHospital ?? "").toLowerCase().includes(q) && vault?.medical?.preferredHospital) {
    results.push({ section: "Medical", label: "Preferred Hospital / ER", meta: vault.medical.preferredHospital, emoji: "🏥" });
  }

  (vault?.medical?.vaccinations ?? []).filter(v =>
    v.vaccine.toLowerCase().includes(q)
  ).forEach(v => results.push({ section: "Vaccinations", label: v.vaccine, meta: `Given: ${v.date}`, emoji: "💉" }));

  (vault?.medical?.prescriptions ?? []).filter(rx =>
    rx.medication.toLowerCase().includes(q) || rx.doctor.toLowerCase().includes(q)
  ).forEach(rx => results.push({ section: "Prescriptions", label: rx.medication, meta: `Dr. ${rx.doctor} · ${rx.dosage}`, emoji: "💊" }));

  (vault?.other ?? []).filter(d =>
    d.title.toLowerCase().includes(q) || d.details.toLowerCase().includes(q)
  ).forEach(d => {
    const t = OTHER_TYPES.find(i => i.type === d.type);
    results.push({ section: "Documents", label: d.title, meta: t?.label ?? d.type, emoji: t?.emoji ?? "📄" });
  });

  if (results.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🔍</Text>
        <Text style={styles.emptyText}>No results for "{query}"</Text>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.searchResultsLabel}>{results.length} result{results.length !== 1 ? "s" : ""}</Text>
      {results.map((r, i) => (
        <View key={i} style={[styles.docCard, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
          <Text style={styles.docEmoji}>{r.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.docTitle}>{r.label}</Text>
            <Text style={styles.docMeta}>{r.section} · {r.meta}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },

  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.cardLight, borderRadius: Radius.xl, paddingHorizontal: 12, paddingVertical: 8, marginBottom: Spacing.md, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  searchClear: { fontSize: 14, color: Colors.textSecondary, padding: 4 },
  searchResultsLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },

  expiryAlert: { backgroundColor: "#FFF3CD", borderRadius: Radius.lg, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#FBBF24" },
  expiryAlertTitle: { fontSize: FontSize.sm, fontWeight: "800", color: "#92400E", marginBottom: 6 },
  expiryAlertItem: { fontSize: FontSize.sm, color: "#78350F", lineHeight: 20 },

  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8, borderWidth: 1.5, borderColor: "transparent", alignSelf: "flex-start" },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 10 },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },

  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 13, marginBottom: Spacing.md, ...Shadow.md },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  dashedAddBtn: { borderWidth: 2, borderColor: Colors.primary, borderStyle: "dashed", borderRadius: Radius.lg, alignItems: "center", padding: 12, marginBottom: Spacing.md },
  dashedAddBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },

  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  input: { borderWidth: 2, borderColor: "#E5E0FF", borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight },

  docCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 14, marginBottom: 10, ...Shadow.sm },
  docCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  docEmoji: { fontSize: 22, marginTop: 2 },
  docTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  docMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  docDetails: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
  docExpiry: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  pinIcon: { fontSize: 14 },
  sharedIcon: { fontSize: 14 },

  expiryBadge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  expiryBadgeText: { fontSize: FontSize.xs, fontWeight: "700" },

  cardActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  editCardBtn: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primary + "15" },
  editCardText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },
  deleteCardBtn: { borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.error + "15" },
  deleteCardText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.error },
  deleteCardBtnText: { color: Colors.textSecondary, fontSize: 16 },

  securityNote: { backgroundColor: "#FEF3C7", borderRadius: Radius.lg, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#FBBF24" },
  securityNoteText: { fontSize: FontSize.sm, color: "#78350F", lineHeight: 20 },

  emergencyBanner: { backgroundColor: Colors.error + "15", borderRadius: Radius.lg, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.error + "44" },
  emergencyBannerText: { fontSize: FontSize.sm, color: Colors.error, lineHeight: 20, fontWeight: "600" },

  savedBanner: { backgroundColor: Colors.success + "22", borderRadius: Radius.lg, padding: 10, marginBottom: 10, alignItems: "center" },
  savedBannerText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success },

  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0EAF8" },
  switchLabel: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: "500" },

  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: "#E5E0FF", marginRight: 8, backgroundColor: Colors.cardLight },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: Colors.surfaceLight, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: 10, paddingBottom: 40 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: 8 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: "#E5E0FF", borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  saveModalBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, ...Shadow.md },
  saveModalBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
