/**
 * Family Tree Screen
 *
 * Visual 4-generation ancestor tree:
 *   Row 1 (top):    Great-Grandparents  (8 slots)
 *   Row 2:          Grandparents        (4 slots)
 *   Row 3:          Parents             (2 slots)
 *   Row 4 (bottom): You / Child         (1 slot)
 *
 * Tap any filled node  → view full details + call
 * Tap any empty slot   → open "Add member" form
 * Edit / Delete from the detail modal
 */

import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Image, Linking, Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso, confirmDestructive, alertMessage } from "../../../lib/utils";
import type { FamilyTreeMember } from "../../../lib/data/types";

// ─── Layout constants ─────────────────────────────────────────────────────────
const NODE_W   = 64;   // node card width
const NODE_H   = 88;   // node card height
const H_GAP    = 8;    // horizontal gap between sibling branches
const CONN_H   = 34;   // connector height
const MAX_GEN  = 3;    // 0=self, 1=parents, 2=grandparents, 3=great-grandparents
const LINE_CLR = Colors.primary;
const LINE_W   = 2;
const AVATAR   = 34;   // avatar circle diameter

// Generation colour accents
const GEN_COLORS: Record<number, string> = {
  0: "#10B981", // emerald — self
  1: Colors.primary, // purple — parents
  2: "#F97316", // orange — grandparents
  3: "#EC4899", // pink  — great-grandparents
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Build an O(1) lookup map keyed by "generation-positionIndex". */
function buildMemberMap(members: FamilyTreeMember[]): Record<string, FamilyTreeMember> {
  const map: Record<string, FamilyTreeMember> = {};
  for (const m of members) {
    map[`${m.generation}-${m.positionIndex}`] = m;
  }
  return map;
}

function getMemberFromMap(
  map: Record<string, FamilyTreeMember>,
  gen: number,
  pos: number,
): FamilyTreeMember | undefined {
  return map[`${gen}-${pos}`];
}

function defaultRelation(gen: number, pos: number): string {
  if (gen === 0) return "You";
  if (gen === 1) return pos === 0 ? "Father" : "Mother";
  if (gen === 2) {
    const r = ["Paternal Grandfather", "Paternal Grandmother", "Maternal Grandfather", "Maternal Grandmother"];
    return r[pos] ?? "Grandparent";
  }
  // gen 3
  const side = Math.floor(pos / 2);
  const even = pos % 2 === 0;
  const sides = ["Paternal-Paternal", "Paternal-Maternal", "Maternal-Paternal", "Maternal-Maternal"];
  return `Great-Grand${even ? "father" : "mother"} (${sides[side]})`;
}

// ─── YConnector ───────────────────────────────────────────────────────────────
// Draws the bracket ─┤├─ connecting two children above to one parent below.
// Works because each child branch has equal width (balanced binary tree),
// so child centres land at ~25% and ~75% of the connector's total width.
function YConnector() {
  return (
    <View style={{ width: "100%", height: CONN_H }}>
      {/* Left vertical stub — from left-child centre downward */}
      <View style={[s.cLine, { position: "absolute", left: "25%", marginLeft: -LINE_W / 2, top: 0, height: "55%", width: LINE_W }]} />
      {/* Right vertical stub — from right-child centre downward */}
      <View style={[s.cLine, { position: "absolute", right: "25%", marginRight: -LINE_W / 2, top: 0, height: "55%", width: LINE_W }]} />
      {/* Horizontal bar joining the two stubs */}
      <View style={[s.cLine, { position: "absolute", left: "25%", right: "25%", top: "55%", marginTop: -LINE_W / 2, height: LINE_W }]} />
      {/* Centre stem going down to the parent node */}
      <View style={[s.cLine, { position: "absolute", left: "50%", marginLeft: -LINE_W / 2, top: "55%", height: "45%", width: LINE_W }]} />
    </View>
  );
}

// ─── Node card ────────────────────────────────────────────────────────────────
interface NodeCardProps {
  member?: FamilyTreeMember;
  generation: number;
  onPress: () => void;
}
function NodeCard({ member, generation, onPress }: NodeCardProps) {
  const accent = GEN_COLORS[generation] ?? Colors.primary;

  if (!member) {
    return (
      <TouchableOpacity
        style={[s.emptyNode, { borderColor: accent + "55", width: NODE_W, height: NODE_H }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[s.emptyPlus, { color: accent + "99" }]}>+</Text>
      </TouchableOpacity>
    );
  }

  const initial = member.name.trim()[0]?.toUpperCase() ?? "?";

  return (
    <TouchableOpacity
      style={[s.nodeCard, { borderColor: accent + "55", width: NODE_W, height: NODE_H }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {member.photoUri ? (
        <Image source={{ uri: member.photoUri }} style={[s.nodeAvatar, { borderColor: accent }]} />
      ) : (
        <View style={[s.nodeInitial, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
          <Text style={[s.nodeInitialTxt, { color: accent }]}>{initial}</Text>
        </View>
      )}
      <Text style={s.nodeName} numberOfLines={1}>{member.name}</Text>
      <Text style={s.nodeRel} numberOfLines={1}>{member.relation}</Text>
    </TouchableOpacity>
  );
}

// ─── Recursive tree branch ────────────────────────────────────────────────────
interface BranchProps {
  generation: number;
  positionIndex: number;
  memberMap: Record<string, FamilyTreeMember>;
  onNodePress: (gen: number, pos: number) => void;
}
function TreeBranch({ generation, positionIndex, memberMap, onNodePress }: BranchProps) {
  const member = getMemberFromMap(memberMap, generation, positionIndex);
  const press  = () => onNodePress(generation, positionIndex);

  // Leaf — great-grandparents have no ancestors to show
  if (generation >= MAX_GEN) {
    return <NodeCard member={member} generation={generation} onPress={press} />;
  }

  const leftPos  = positionIndex * 2;
  const rightPos = positionIndex * 2 + 1;

  return (
    <View style={{ alignItems: "center" }}>
      {/* Two children side-by-side */}
      <View style={{ flexDirection: "row" }}>
        <TreeBranch generation={generation + 1} positionIndex={leftPos}  memberMap={memberMap} onNodePress={onNodePress} />
        <View style={{ width: H_GAP }} />
        <TreeBranch generation={generation + 1} positionIndex={rightPos} memberMap={memberMap} onNodePress={onNodePress} />
      </View>
      {/* Connecting lines */}
      <View style={{ alignSelf: "stretch" }}>
        <YConnector />
      </View>
      {/* This generation's node */}
      <NodeCard member={member} generation={generation} onPress={press} />
    </View>
  );
}

// ─── Detail modal (view + call) ───────────────────────────────────────────────
function DetailModal({
  member, onClose, onEdit, onDelete,
}: {
  member: FamilyTreeMember;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = GEN_COLORS[member.generation] ?? Colors.primary;
  const initial = member.name.trim()[0]?.toUpperCase() ?? "?";

  function callMember() {
    if (!member.phone) return;
    Linking.openURL(`tel:${member.phone}`).catch(() => alertMessage("Could not open dialer"));
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.detailSheet}>
          {/* Avatar + name */}
          <View style={s.detailTop}>
            {member.photoUri ? (
              <Image source={{ uri: member.photoUri }} style={[s.detailAvatar, { borderColor: accent }]} />
            ) : (
              <View style={[s.detailInitial, { backgroundColor: accent + "22", borderColor: accent }]}>
                <Text style={[s.detailInitialTxt, { color: accent }]}>{initial}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.detailName}>{member.name}</Text>
              <View style={[s.relBadge, { backgroundColor: accent + "18", borderColor: accent + "44" }]}>
                <Text style={[s.relBadgeTxt, { color: accent }]}>{member.relation}</Text>
              </View>
              {(member.city || member.state) && (
                <Text style={s.detailLoc}>📍 {[member.city, member.state].filter(Boolean).join(", ")}</Text>
              )}
            </View>
          </View>

          {/* Phone — tap to call */}
          {member.phone ? (
            <TouchableOpacity style={[s.phoneRow, { borderColor: accent + "44" }]} onPress={callMember} activeOpacity={0.8}>
              <Text style={s.phoneIcon}>📞</Text>
              <Text style={[s.phoneTxt, { color: accent }]}>{member.phone}</Text>
              <View style={[s.callBadge, { backgroundColor: accent }]}>
                <Text style={s.callBadgeTxt}>Call</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Notes */}
          {member.notes ? (
            <View style={s.notesBox}>
              <Text style={s.notesTxt}>{member.notes}</Text>
            </View>
          ) : null}

          {/* Action row */}
          <View style={s.detailActions}>
            <TouchableOpacity style={[s.dActionBtn, { borderColor: Colors.primary + "55", backgroundColor: Colors.primary + "12" }]} onPress={onEdit}>
              <Text style={[s.dActionTxt, { color: Colors.primary }]}>✏️  Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.dActionBtn, { borderColor: Colors.error + "55", backgroundColor: Colors.error + "12" }]} onPress={onDelete}>
              <Text style={[s.dActionTxt, { color: Colors.error }]}>🗑️  Remove</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────
function EditModal({
  generation, positionIndex, member, onSave, onClose,
}: {
  generation: number;
  positionIndex: number;
  member?: FamilyTreeMember;
  onSave: (data: Partial<FamilyTreeMember> & { existingId?: string }) => void;
  onClose: () => void;
}) {
  const [name,     setName]     = useState(member?.name ?? "");
  const [relation, setRelation] = useState(member?.relation ?? defaultRelation(generation, positionIndex));
  const [phone,    setPhone]    = useState(member?.phone ?? "");
  const [city,     setCity]     = useState(member?.city ?? "");
  const [stateVal, setStateVal] = useState(member?.state ?? "");
  const [notes,    setNotes]    = useState(member?.notes ?? "");
  const [photoUri, setPhotoUri] = useState(member?.photoUri ?? "");

  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } catch { alertMessage("Could not open photo library"); }
  }

  function save() {
    if (!name.trim()) { alertMessage("Name is required"); return; }
    onSave({
      existingId:   member?.id,
      name:         name.trim(),
      relation:     relation.trim() || defaultRelation(generation, positionIndex),
      phone:        phone.trim()    || undefined,
      city:         city.trim()     || undefined,
      state:        stateVal.trim() || undefined,
      notes:        notes.trim()    || undefined,
      photoUri:     photoUri        || undefined,
      generation,
      positionIndex,
    });
  }

  const accent = GEN_COLORS[generation] ?? Colors.primary;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView
          contentContainerStyle={s.editSheet}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.editTitle}>{member ? "✏️ Edit Family Member" : "➕ Add to Family Tree"}</Text>

          {/* Photo picker */}
          <TouchableOpacity style={[s.photoPicker, { borderColor: accent + "66" }]} onPress={pickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.photoPickerImg} />
            ) : (
              <>
                <Text style={s.photoPickerIcon}>📷</Text>
                <Text style={[s.photoPickerLbl, { color: accent }]}>Add Photo (optional)</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.lbl}>Full Name *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Robert Smith" autoFocus />

          <Text style={s.lbl}>Relation</Text>
          <TextInput style={s.input} value={relation} onChangeText={setRelation} placeholder="e.g. Father, Grandma Rose" />

          <Text style={s.lbl}>Phone Number</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+1 (555) 000-0000" keyboardType="phone-pad" />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>City</Text>
              <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="New York" />
            </View>
            <View style={{ width: 80 }}>
              <Text style={s.lbl}>State</Text>
              <TextInput style={s.input} value={stateVal} onChangeText={setStateVal} placeholder="NY" autoCapitalize="characters" maxLength={2} />
            </View>
          </View>

          <Text style={s.lbl}>Notes (optional)</Text>
          <TextInput
            style={[s.input, { minHeight: 64, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Birthday, anniversary, memories…"
          />

          <View style={s.editBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: accent }]} onPress={save}>
              <Text style={s.saveTxt}>{member ? "Save Changes" : "Add to Tree"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FamilyTreeScreen() {
  const { state, dispatch } = useData();
  const members = state.familyTree ?? [];

  // O(1) lookup map — rebuilt only when the familyTree array changes
  const memberMap = useMemo(() => buildMemberMap(members), [members]);

  const [selGen, setSelGen] = useState<number | null>(null);
  const [selPos, setSelPos] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);

  const selMember = selGen !== null && selPos !== null
    ? getMemberFromMap(memberMap, selGen, selPos)
    : undefined;

  function openNode(gen: number, pos: number) {
    setSelGen(gen);
    setSelPos(pos);
    const m = getMemberFromMap(memberMap, gen, pos);
    if (m) setShowDetail(true);
    else   setShowEdit(true);
  }

  function handleSave(data: Partial<FamilyTreeMember> & { existingId?: string }) {
    if (data.existingId) {
      const { existingId, ...payload } = data;
      dispatch({ type: "FAMILY_TREE_UPDATE", memberId: existingId, payload });
    } else {
      const newMember: FamilyTreeMember = {
        id:            uid(),
        name:          data.name!,
        relation:      data.relation!,
        generation:    data.generation!,
        positionIndex: data.positionIndex!,
        phone:         data.phone,
        city:          data.city,
        state:         data.state,
        photoUri:      data.photoUri,
        notes:         data.notes,
        addedAt:       nowIso(),
      };
      dispatch({ type: "FAMILY_TREE_ADD", member: newMember });
    }
    setShowEdit(false);
    setShowDetail(false);
  }

  function handleDelete() {
    if (!selMember) return;
    confirmDestructive(
      "Remove from tree?",
      `Remove ${selMember.name}?`,
      () => {
        dispatch({ type: "FAMILY_TREE_DELETE", memberId: selMember.id });
        setShowDetail(false);
      },
      "Remove",
    );
  }

  const filled = members.length;
  const total  = 1 + 2 + 4 + 8; // 15

  return (
    <ScreenContainer scroll>
      {/* Header */}
      <Text style={s.title}>🌳 Family Tree</Text>
      <Text style={s.sub}>
        {filled} of {total} family members added
        {filled === 0 ? " — tap any + to begin" : ""}
      </Text>

      {/* Tip bar */}
      <View style={s.tipBar}>
        <Text style={s.tipTxt}>📌 Tap a node to view  ·  Tap + to add  ·  Scroll sideways for full tree</Text>
      </View>

      {/* ── TREE ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        bounces
        style={s.treeScroll}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
        nestedScrollEnabled
      >
        <TreeBranch
          generation={0}
          positionIndex={0}
          memberMap={memberMap}
          onNodePress={openNode}
        />
      </ScrollView>

      {/* Generation legend */}
      <View style={s.legend}>
        {([3, 2, 1, 0] as const).map(gen => (
          <View key={gen} style={[s.legendRow, { borderLeftColor: GEN_COLORS[gen] }]}>
            <Text style={[s.legendDot, { color: GEN_COLORS[gen] }]}>●</Text>
            <Text style={s.legendTxt}>
              {gen === 3 ? "Great-Grandparents  (8 slots)" :
               gen === 2 ? "Grandparents  (4 slots)" :
               gen === 1 ? "Parents  (2 slots)" :
                           "You / Child  (1 slot)"}
            </Text>
          </View>
        ))}
      </View>

      {/* Stats */}
      {filled > 0 && (
        <View style={s.statsBox}>
          <Text style={s.statsTxt}>
            🌳 {filled} member{filled !== 1 ? "s" : ""} across {new Set(members.map(m => m.generation)).size} generation{new Set(members.map(m => m.generation)).size !== 1 ? "s" : ""}
            {members.some(m => m.phone) ? `  ·  📞 ${members.filter(m => m.phone).length} with phone` : ""}
            {members.some(m => m.photoUri) ? `  ·  📷 ${members.filter(m => m.photoUri).length} with photo` : ""}
          </Text>
        </View>
      )}

      <View style={{ height: 32 }} />

      {/* Detail modal */}
      {showDetail && selMember && (
        <DetailModal
          member={selMember}
          onClose={() => setShowDetail(false)}
          onEdit={() => { setShowDetail(false); setShowEdit(true); }}
          onDelete={handleDelete}
        />
      )}

      {/* Edit / Add modal */}
      {showEdit && selGen !== null && selPos !== null && (
        <EditModal
          generation={selGen}
          positionIndex={selPos}
          member={selMember}
          onSave={handleSave}
          onClose={() => setShowEdit(false)}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Screen
  title: { fontSize: FontSize.xl, fontWeight: "900", color: Colors.primary, marginBottom: 2 },
  sub:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 10 },

  tipBar: {
    backgroundColor: Colors.primary + "12",
    borderRadius: Radius.lg,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.primary + "2A",
  },
  tipTxt: { fontSize: FontSize.xs, color: Colors.primary, textAlign: "center", fontWeight: "600" },

  // Tree
  treeScroll: {
    marginHorizontal: -16,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    minHeight: NODE_H * 4 + CONN_H * 3 + 32,
  },

  // Connector lines
  cLine: { backgroundColor: LINE_CLR },

  // Node
  nodeCard: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    ...Shadow.sm,
  },
  emptyNode: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderStyle: "dashed",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPlus: { fontSize: 22, fontWeight: "300" },

  nodeAvatar: {
    width: AVATAR, height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    marginBottom: 4,
  },
  nodeInitial: {
    width: AVATAR, height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  nodeInitialTxt: { fontSize: 14, fontWeight: "800" },
  nodeName: { fontSize: 8, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  nodeRel:  { fontSize: 7, color: Colors.textSecondary, textAlign: "center", marginTop: 1 },

  // Legend
  legend: { marginTop: 14, gap: 6 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
  },
  legendDot: { fontSize: 10 },
  legendTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600" },

  statsBox: {
    marginTop: 12,
    backgroundColor: Colors.primary + "10",
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "2A",
  },
  statsTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "700", lineHeight: 20 },

  // Overlay / Modals
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "flex-end" },

  // Detail sheet
  detailSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 40,
    gap: 12,
  },
  detailTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  detailAvatar: {
    width: 68, height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
  },
  detailInitial: {
    width: 68, height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  detailInitialTxt: { fontSize: 26, fontWeight: "900" },
  detailName: { fontSize: FontSize.lg, fontWeight: "900", color: Colors.textPrimary, marginBottom: 4 },
  relBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: 6,
  },
  relBadgeTxt: { fontSize: FontSize.xs, fontWeight: "800" },
  detailLoc: { fontSize: FontSize.sm, color: Colors.textSecondary },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    backgroundColor: "#F8FAFC",
  },
  phoneIcon: { fontSize: 20 },
  phoneTxt:  { flex: 1, fontSize: FontSize.md, fontWeight: "700" },
  callBadge: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  callBadgeTxt: { fontSize: FontSize.sm, fontWeight: "800", color: "#fff" },

  notesBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: Radius.lg,
    padding: 12,
  },
  notesTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  detailActions: { flexDirection: "row", gap: 10 },
  dActionBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 11,
    alignItems: "center",
  },
  dActionTxt: { fontSize: FontSize.sm, fontWeight: "800" },

  closeBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: Radius.full,
    paddingVertical: 13,
    alignItems: "center",
  },
  closeTxt: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textSecondary },

  // Edit / Add sheet
  editSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 48,
    gap: 10,
  },
  editTitle: { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary, marginBottom: 6 },

  photoPicker: {
    alignSelf: "center",
    width: 90, height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    marginBottom: 4,
    overflow: "hidden",
  },
  photoPickerImg: { width: 90, height: 90, borderRadius: 45 },
  photoPickerIcon: { fontSize: 28 },
  photoPickerLbl:  { fontSize: 10, fontWeight: "700", marginTop: 2 },

  lbl: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    borderWidth: 2,
    borderColor: "#E5E0FF",
    borderRadius: Radius.lg,
    padding: 12,
    fontSize: FontSize.base,
    backgroundColor: "#fff",
    color: Colors.textPrimary,
  },

  editBtns: { flexDirection: "row", gap: 10, marginTop: 6 },
  cancelBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#E5E0FF",
    borderRadius: Radius.full,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelTxt: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: {
    flex: 2,
    borderRadius: Radius.full,
    paddingVertical: 13,
    alignItems: "center",
    ...Shadow.md,
  },
  saveTxt: { color: "#fff", fontWeight: "900", fontSize: FontSize.base },
});
