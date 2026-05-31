import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Alert, Modal, FlatList,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso, pointsToMoney } from "../../../lib/utils";
import { PointsInput } from "../../../components/points-input";
import { RewardShopItem, RewardItemKind, RewardRedemption } from "../../../lib/data/types";

const KIND_META: Record<RewardItemKind, { label: string; emoji: string; color: string }> = {
  screen_time: { label: "Screen Time",  emoji: "⏱️",  color: "#7C5CFF" },
  real_world:  { label: "Real World",   emoji: "🎁",  color: "#10B981" },
  digital:     { label: "Digital Item", emoji: "🎮",  color: "#F59E0B" },
};

const EMOJI_PRESETS = ["🎮","🍕","🍦","🎬","🛒","📚","🎨","🏆","⭐","🎁","🎯","🚀","🦸","🌟","💎","🎤"];

type Tab = "shop" | "requests";

export default function RewardShopScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<Tab>("shop");
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<RewardShopItem | null>(null);

  // Collect all pending redemptions across all kids
  const allPending: (RewardRedemption & { kidName: string })[] = [];
  for (const kid of state.kids) {
    for (const r of kid.rewardRedemptions ?? []) {
      if (r.status === "pending") {
        allPending.push({ ...r, kidName: kid.profile.name });
      }
    }
  }

  function handleDecide(kidId: string, redemptionId: string, status: "fulfilled" | "denied") {
    Alert.alert(
      status === "fulfilled" ? "Fulfill Request?" : "Deny Request?",
      status === "fulfilled"
        ? "This marks the reward as delivered to the kid."
        : "This will refund the kid's points.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: status === "fulfilled" ? "Fulfill" : "Deny",
          style: status === "denied" ? "destructive" : "default",
          onPress: () => dispatch({ type: "REWARD_DECIDE", kidId, redemptionId, status }),
        },
      ]
    );
  }

  function handleRemove(itemId: string) {
    Alert.alert("Remove Item?", "This will remove the item from the shop.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "REWARD_SHOP_REMOVE", itemId }) },
    ]);
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>🛍️ Reward Shop</Text>
      <Text style={styles.subtitle}>Create rewards kids can redeem with their behavior points</Text>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["shop", "requests"] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "shop" ? "🏪 Shop Items" : `📋 Requests${allPending.length > 0 ? ` (${allPending.length})` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "shop" ? (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditItem(null); setShowAdd(true); }}>
            <Text style={styles.addBtnText}>+ Add Shop Item</Text>
          </TouchableOpacity>

          {state.rewardShop.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🛍️</Text>
              <Text style={styles.emptyTitle}>No items yet</Text>
              <Text style={styles.emptyDesc}>Add rewards your kids can work toward and redeem with behavior points.</Text>
            </View>
          ) : (
            state.rewardShop.map(item => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemEmoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                    <View style={styles.itemMeta}>
                      <View style={[styles.kindPill, { backgroundColor: KIND_META[item.kind].color + "20" }]}>
                        <Text style={[styles.kindPillText, { color: KIND_META[item.kind].color }]}>
                          {KIND_META[item.kind].emoji} {KIND_META[item.kind].label}
                        </Text>
                      </View>
                      <Text style={styles.itemCost}>⭐ {item.pointCost} pts ({pointsToMoney(item.pointCost)})</Text>
                      {item.kind === "screen_time" && item.minutesGranted ? (
                        <Text style={styles.itemMinutes}>+{item.minutesGranted}m</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <Switch
                    value={item.available}
                    onValueChange={v => dispatch({ type: "REWARD_SHOP_UPDATE", itemId: item.id, payload: { available: v } })}
                    trackColor={{ true: Colors.success }}
                    thumbColor="#fff"
                  />
                  <TouchableOpacity onPress={() => { setEditItem(item); setShowAdd(true); }}>
                    <Text style={styles.editBtn}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemove(item.id)}>
                    <Text style={styles.deleteBtn}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {allPending.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptyDesc}>When kids redeem shop items, their requests appear here.</Text>
            </View>
          ) : (
            allPending.map(r => {
              const item = state.rewardShop.find(i => i.id === r.itemId);
              return (
                <View key={r.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestEmoji}>{item?.emoji ?? "🎁"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestTitle}>{r.itemTitle}</Text>
                      <Text style={styles.requestMeta}>
                        {r.kidName} · ⭐ {r.pointsSpent} pts · {new Date(r.requestedAt).toLocaleDateString()}
                      </Text>
                      {r.minutesGranted ? (
                        <Text style={styles.requestMinutes}>Screen time: +{r.minutesGranted}m</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.decideBtn, styles.fulfillBtn]}
                      onPress={() => handleDecide(r.kidId, r.id, "fulfilled")}
                    >
                      <Text style={styles.decideBtnText}>✓ Fulfill</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.decideBtn, styles.denyBtn]}
                      onPress={() => handleDecide(r.kidId, r.id, "denied")}
                    >
                      <Text style={styles.decideBtnText}>✗ Deny</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* Show recent fulfilled/denied */}
          {(() => {
            const recent: (RewardRedemption & { kidName: string })[] = [];
            for (const kid of state.kids) {
              for (const r of kid.rewardRedemptions ?? []) {
                if (r.status !== "pending") recent.push({ ...r, kidName: kid.profile.name });
              }
            }
            recent.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
            if (!recent.length) return null;
            return (
              <>
                <Text style={styles.histSection}>Recent Decisions</Text>
                {recent.slice(0, 10).map(r => (
                  <View key={r.id} style={styles.histRow}>
                    <Text style={styles.histEmoji}>{r.status === "fulfilled" ? "✅" : "❌"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histTitle}>{r.itemTitle}</Text>
                      <Text style={styles.histMeta}>{r.kidName} · ⭐ {r.pointsSpent} pts</Text>
                    </View>
                    <Text style={[styles.histStatus, { color: r.status === "fulfilled" ? Colors.success : Colors.error }]}>
                      {r.status}
                    </Text>
                  </View>
                ))}
              </>
            );
          })()}
        </ScrollView>
      )}

      <AddItemModal
        visible={showAdd}
        initial={editItem}
        onClose={() => setShowAdd(false)}
        onSave={item => {
          if (editItem) {
            dispatch({ type: "REWARD_SHOP_UPDATE", itemId: editItem.id, payload: item });
          } else {
            dispatch({ type: "REWARD_SHOP_ADD", item: { ...item, id: uid(), createdAt: nowIso() } as RewardShopItem });
          }
          setShowAdd(false);
        }}
      />
    </ScreenContainer>
  );
}

interface AddItemModalProps {
  visible: boolean;
  initial: RewardShopItem | null;
  onClose: () => void;
  onSave: (item: Partial<RewardShopItem>) => void;
}

function AddItemModal({ visible, initial, onClose, onSave }: AddItemModalProps) {
  const [title, setTitle]           = useState(initial?.title ?? "");
  const [description, setDesc]      = useState(initial?.description ?? "");
  const [emoji, setEmoji]           = useState(initial?.emoji ?? "🎁");
  const [kind, setKind]             = useState<RewardItemKind>(initial?.kind ?? "real_world");
  const [pointCost, setPointCost]   = useState(String(initial?.pointCost ?? 50));
  const [minutes, setMinutes]       = useState(String(initial?.minutesGranted ?? 30));
  const [available, setAvailable]   = useState(initial?.available ?? true);

  React.useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? "");
      setDesc(initial?.description ?? "");
      setEmoji(initial?.emoji ?? "🎁");
      setKind(initial?.kind ?? "real_world");
      setPointCost(String(initial?.pointCost ?? 50));
      setMinutes(String(initial?.minutesGranted ?? 30));
      setAvailable(initial?.available ?? true);
    }
  }, [visible, initial]);

  function submit() {
    if (!title.trim()) { Alert.alert("Title required"); return; }
    const cost = parseInt(pointCost) || 0;
    if (cost <= 0) { Alert.alert("Point cost must be > 0"); return; }
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      emoji,
      kind,
      pointCost: cost,
      minutesGranted: kind === "screen_time" ? (parseInt(minutes) || 30) : undefined,
      available,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.header}>
            <Text style={modal.headerTitle}>{initial ? "Edit Item" : "New Shop Item"}</Text>
            <TouchableOpacity onPress={onClose}><Text style={modal.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Emoji picker */}
            <Text style={modal.label}>Icon</Text>
            <View style={modal.emojiRow}>
              {EMOJI_PRESETS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[modal.emojiCell, emoji === e && modal.emojiCellActive]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modal.label}>Title *</Text>
            <TextInput
              style={modal.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Movie Night, Extra Hour..."
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={modal.label}>Description (optional)</Text>
            <TextInput
              style={[modal.input, { height: 72, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDesc}
              placeholder="What does the kid get exactly?"
              placeholderTextColor={Colors.textSecondary}
              multiline
            />

            <Text style={modal.label}>Type</Text>
            <View style={modal.kindRow}>
              {(Object.keys(KIND_META) as RewardItemKind[]).map(k => (
                <TouchableOpacity
                  key={k}
                  style={[modal.kindBtn, kind === k && { backgroundColor: KIND_META[k].color }]}
                  onPress={() => setKind(k)}
                >
                  <Text style={[modal.kindBtnText, kind === k && { color: "#fff" }]}>
                    {KIND_META[k].emoji} {KIND_META[k].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modal.label}>Point Cost ⭐</Text>
            <PointsInput
              inputStyle={modal.input}
              value={pointCost}
              onChangeText={setPointCost}
              placeholder="50"
              placeholderTextColor={Colors.textSecondary}
            />

            {kind === "screen_time" && (
              <>
                <Text style={modal.label}>Screen Time Granted (minutes)</Text>
                <TextInput
                  style={modal.input}
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={Colors.textSecondary}
                />
              </>
            )}

            <View style={modal.switchRow}>
              <Text style={modal.label}>Available in Shop</Text>
              <Switch
                value={available}
                onValueChange={setAvailable}
                trackColor={{ true: Colors.success }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity style={modal.saveBtn} onPress={submit}>
              <Text style={modal.saveBtnText}>{initial ? "Save Changes" : "Add to Shop"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title:           { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  subtitle:        { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  tabRow:          { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  tab:             { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.surfaceLight, alignItems: "center", ...Shadow.sm },
  tabActive:       { backgroundColor: Colors.primary },
  tabText:         { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive:   { color: "#fff" },
  addBtn:          { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center", marginBottom: Spacing.md },
  addBtnText:      { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  emptyState:      { alignItems: "center", paddingVertical: 60 },
  emptyEmoji:      { fontSize: 56, marginBottom: Spacing.md },
  emptyTitle:      { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary, marginBottom: 8 },
  emptyDesc:       { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 260 },
  itemCard:        { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  itemLeft:        { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  itemEmoji:       { fontSize: 36 },
  itemTitle:       { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  itemDesc:        { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  itemMeta:        { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  kindPill:        { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  kindPillText:    { fontSize: 11, fontWeight: "600" },
  itemCost:        { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  itemMinutes:     { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  itemActions:     { flexDirection: "column", alignItems: "center", gap: 8 },
  editBtn:         { fontSize: 20 },
  deleteBtn:       { fontSize: 20 },
  requestCard:     { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  requestHeader:   { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: Spacing.sm },
  requestEmoji:    { fontSize: 36 },
  requestTitle:    { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  requestMeta:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  requestMinutes:  { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", marginTop: 2 },
  requestActions:  { flexDirection: "row", gap: 10 },
  decideBtn:       { flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: "center" },
  fulfillBtn:      { backgroundColor: Colors.success },
  denyBtn:         { backgroundColor: Colors.error },
  decideBtnText:   { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  histSection:     { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  histRow:         { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histEmoji:       { fontSize: 20 },
  histTitle:       { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  histMeta:        { fontSize: 11, color: Colors.textSecondary },
  histStatus:      { fontSize: FontSize.sm, fontWeight: "700", textTransform: "capitalize" },
});

const modal = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: "92%" },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  headerTitle:   { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  close:         { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  label:         { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input:         { backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  emojiRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  emojiCell:     { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.surfaceLight, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  emojiCellActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "15" },
  kindRow:       { flexDirection: "column", gap: 8, marginBottom: 4 },
  kindBtn:       { padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  kindBtnText:   { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  switchRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md },
  saveBtn:       { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center", marginTop: Spacing.lg, marginBottom: Spacing.xl },
  saveBtnText:   { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
