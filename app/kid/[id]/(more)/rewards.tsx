import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { getBankBalance, formatMinutes } from "../../../../lib/data/logic";
import { uid, nowIso, pointsToMoney } from "../../../../lib/utils";
import { RewardShopItem } from "../../../../lib/data/types";

type Tab = "chores" | "shop" | "history";

const KIND_COLORS: Record<string, string> = {
  screen_time: "#7C5CFF",
  real_world:  "#10B981",
  digital:     "#F59E0B",
};

export default function RewardsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();
  const kid = useKid(id);
  const [tab, setTab] = useState<Tab>("chores");

  if (!kid) return null;

  const balance = getBankBalance(kid.bank);
  const pendingChores = kid.chores.filter(c => c.status === "open" && c.assignedKids.includes(id));
  const shopItems = (state.rewardShop ?? []).filter(i => i.available);
  const myRedemptions = kid.rewardRedemptions ?? [];
  const pendingRedemptions = myRedemptions.filter(r => r.status === "pending");

  function redeemMinutes(mins: number) {
    if (balance < mins) return;
    dispatch({
      type: "BANK_DELTA",
      kidId: id,
      delta: -mins,
      reason: `Redeemed ${formatMinutes(mins)} extra screen time`,
    });
  }

  function redeemShopItem(item: RewardShopItem) {
    if (kid!.behavior.totalPoints < item.pointCost) {
      Alert.alert("Not enough points", `You need ${item.pointCost} ⭐ pts but only have ${kid!.behavior.totalPoints}.`);
      return;
    }
    Alert.alert(
      `Redeem ${item.emoji} ${item.title}?`,
      `This costs ${item.pointCost} ⭐ pts. Your parent will need to approve it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request It!",
          onPress: () => {
            dispatch({
              type: "REWARD_REDEEM",
              kidId: id,
              redemption: {
                id: uid(),
                kidId: id,
                itemId: item.id,
                itemTitle: item.title,
                pointsSpent: item.pointCost,
                minutesGranted: item.minutesGranted,
                status: "pending",
                requestedAt: nowIso(),
              },
            });
            Alert.alert("Request Sent! 🎉", "Your parent will see your request soon.");
          },
        },
      ]
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>⭐ Rewards</Text>

      {/* Balance header */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceCol}>
          <Text style={styles.balanceEmoji}>🏦</Text>
          <Text style={styles.balanceAmount}>{formatMinutes(balance)}</Text>
          <Text style={styles.balanceLabel}>Time Bank</Text>
          <View style={styles.redeemRow}>
            {[15, 30, 60].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.redeemBtn, balance < m && styles.redeemBtnDisabled]}
                onPress={() => redeemMinutes(m)}
                disabled={balance < m}
                accessibilityLabel={`Redeem ${m} minutes of screen time`}
                accessibilityRole="button"
                accessibilityState={{ disabled: balance < m }}
              >
                <Text style={styles.redeemBtnText}>+{m}m</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceCol}>
          <Text style={styles.balanceEmoji}>⭐</Text>
          <Text style={styles.balanceAmount}>{kid.behavior.totalPoints}</Text>
          <Text style={styles.balanceLabel}>Behavior Pts</Text>
          <Text style={styles.balanceValue}>{pointsToMoney(kid.behavior.totalPoints)}</Text>
          {pendingRedemptions.length > 0 && (
            <View style={styles.pendingPill}>
              <Text style={styles.pendingPillText}>{pendingRedemptions.length} pending</Text>
            </View>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["chores", "shop", "history"] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "chores" ? "🧹 Chores" : t === "shop" ? "🛍️ Shop" : "📋 History"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "chores" && (
        <FlatList
          data={pendingChores}
          keyExtractor={c => c.id}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySub}>No chores assigned right now. Enjoy your free time!</Text>
            </View>
          }
          renderItem={({ item: chore }) => (
            <View style={styles.choreCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.choreTitle}>{chore.title}</Text>
                {chore.description ? <Text style={styles.choreDesc}>{chore.description}</Text> : null}
                <Text style={styles.chorePoints}>+{chore.points} pts ⭐ ({pointsToMoney(chore.points)})</Text>
              </View>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => dispatch({
                  type: "CHORE_SUBMIT_PROOF",
                  choreId: chore.id,
                  proof: { kidId: id, note: "Done!", submittedAt: nowIso() },
                })}
                accessibilityLabel={`Mark "${chore.title}" as done`}
                accessibilityRole="button"
              >
                <Text style={styles.submitBtnText}>Done ✓</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {tab === "shop" && (
        <FlatList
          data={shopItems}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            pendingRedemptions.length > 0 ? (
              <>
                <Text style={styles.section}>My Requests ⏳</Text>
                {pendingRedemptions.map(r => (
                  <View key={r.id} style={styles.pendingCard}>
                    <Text style={styles.pendingTitle}>{r.itemTitle}</Text>
                    <Text style={styles.pendingMeta}>Waiting for parent · ⭐ {r.pointsSpent} pts</Text>
                  </View>
                ))}
                <Text style={styles.section}>Available Rewards 🛍️</Text>
              </>
            ) : <Text style={styles.section}>Available Rewards 🛍️</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🛍️</Text>
              <Text style={styles.emptyTitle}>Shop is empty</Text>
              <Text style={styles.emptySub}>Ask your parent to add rewards here that you can earn with your behavior points!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const canAfford = kid.behavior.totalPoints >= item.pointCost;
            const alreadyRequested = pendingRedemptions.some(r => r.itemId === item.id);
            return (
              <TouchableOpacity
                style={[styles.shopCard, !canAfford && styles.shopCardDim]}
                onPress={() => !alreadyRequested && redeemShopItem(item)}
                disabled={alreadyRequested}
                activeOpacity={0.8}
                accessibilityLabel={`${item.title}, costs ${item.pointCost} points${alreadyRequested ? ", already requested" : canAfford ? "" : `, need ${item.pointCost - kid.behavior.totalPoints} more points`}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: alreadyRequested }}
              >
                <Text style={styles.shopEmoji}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopTitle}>{item.title}</Text>
                  {item.description ? <Text style={styles.shopDesc}>{item.description}</Text> : null}
                  <View style={styles.shopMeta}>
                    <View style={[styles.kindDot, { backgroundColor: KIND_COLORS[item.kind] ?? Colors.primary }]} />
                    <Text style={styles.shopKind}>
                      {item.kind === "screen_time" ? "Screen Time" : item.kind === "real_world" ? "Real World" : "Digital"}
                      {item.minutesGranted ? ` (+${item.minutesGranted}m)` : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.shopRight}>
                  <Text style={[styles.shopCost, !canAfford && { color: Colors.error }]}>
                    ⭐ {item.pointCost}
                  </Text>
                  <Text style={styles.shopCostValue}>{pointsToMoney(item.pointCost)}</Text>
                  {alreadyRequested ? (
                    <Text style={styles.requestedBadge}>Requested</Text>
                  ) : canAfford ? (
                    <Text style={styles.getBtn}>Get →</Text>
                  ) : (
                    <Text style={styles.cantAfford}>Need {item.pointCost - kid.behavior.totalPoints} more</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {tab === "history" && (() => {
        const bankEntries = kid.bank.slice().reverse().slice(0, 50);
        const redeemEntries = [...myRedemptions].reverse();
        type HistItem =
          | { kind: "header"; label: string; key: string }
          | { kind: "redeem"; data: typeof redeemEntries[0] }
          | { kind: "bank"; data: typeof bankEntries[0] }
          | { kind: "empty"; label: string };

        const items: HistItem[] = [];
        if (redeemEntries.length > 0) {
          items.push({ kind: "header", label: "Reward Requests", key: "h-redeem" });
          redeemEntries.forEach(r => items.push({ kind: "redeem", data: r }));
        }
        items.push({ kind: "header", label: "Time Bank History 🏦", key: "h-bank" });
        if (bankEntries.length === 0) {
          items.push({ kind: "empty", label: "No time bank activity yet." });
        } else {
          bankEntries.forEach(e => items.push({ kind: "bank", data: e }));
        }

        return (
          <FlatList
            data={items}
            keyExtractor={(item, i) => {
              if (item.kind === "header") return item.key;
              if (item.kind === "empty") return "empty";
              if (item.kind === "redeem") return "redeem-" + item.data.id;
              return "bank-" + item.data.id;
            }}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>No history yet</Text>
                <Text style={styles.emptySub}>Complete chores and redeem rewards to see your history here.</Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.kind === "header") return <Text style={styles.section}>{item.label}</Text>;
              if (item.kind === "empty") return <Text style={styles.emptyInline}>{item.label}</Text>;
              if (item.kind === "redeem") {
                const r = item.data;
                return (
                  <View style={styles.histRow}>
                    <Text style={styles.histEmoji}>
                      {r.status === "fulfilled" ? "✅" : r.status === "denied" ? "❌" : "⏳"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histTitle}>{r.itemTitle}</Text>
                      <Text style={styles.histDate}>{new Date(r.requestedAt).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[styles.histStatus, {
                      color: r.status === "fulfilled" ? Colors.success : r.status === "denied" ? Colors.error : Colors.warning,
                    }]}>{r.status}</Text>
                  </View>
                );
              }
              const e = item.data;
              return (
                <View style={styles.bankRow}>
                  <Text style={styles.bankReason} numberOfLines={2}>{e.reason}</Text>
                  <Text style={[styles.bankDelta, { color: e.delta > 0 ? Colors.success : Colors.error }]}>
                    {e.delta > 0 ? "+" : ""}{formatMinutes(e.delta)}
                  </Text>
                </View>
              );
            }}
          />
        );
      })()}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:           { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  balanceCard:     { flexDirection: "row", backgroundColor: Colors.secondary + "25", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md },
  balanceCol:      { flex: 1, alignItems: "center" },
  balanceDivider:  { width: 1, backgroundColor: Colors.border, marginHorizontal: 8 },
  balanceEmoji:    { fontSize: 36 },
  balanceAmount:   { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, marginTop: 4 },
  balanceLabel:    { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: 2 },
  balanceValue:    { fontSize: FontSize.xs, color: Colors.success, fontWeight: "700", marginBottom: 8 },
  redeemRow:       { flexDirection: "row", gap: 6 },
  redeemBtn:       { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  redeemBtnDisabled: { opacity: 0.35 },
  redeemBtnText:   { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  pendingPill:     { backgroundColor: Colors.warning + "30", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  pendingPillText: { fontSize: 11, color: Colors.warning, fontWeight: "700" },
  tabRow:          { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  tab:             { flex: 1, paddingVertical: 9, borderRadius: Radius.lg, backgroundColor: Colors.surfaceLight, alignItems: "center", ...Shadow.sm },
  tabActive:       { backgroundColor: Colors.primary },
  tabText:         { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive:   { color: "#fff" },
  section:         { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  emptyState:      { alignItems: "center", paddingTop: 48, paddingBottom: 24, gap: 10 },
  emptyEmoji:      { fontSize: 56 },
  emptyTitle:      { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptySub:        { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: Spacing.lg },
  emptyInline:     { color: Colors.textSecondary, textAlign: "center", marginVertical: Spacing.lg },
  choreCard:       { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  choreTitle:      { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  choreDesc:       { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  chorePoints:     { fontSize: FontSize.sm, color: Colors.success, fontWeight: "600", marginTop: 4 },
  submitBtn:       { backgroundColor: Colors.success, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md },
  submitBtnText:   { color: "#fff", fontWeight: "700" },
  pendingCard:     { backgroundColor: Colors.warning + "20", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: Colors.warning },
  pendingTitle:    { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  pendingMeta:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  shopCard:        { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm, gap: 12 },
  shopCardDim:     { opacity: 0.7 },
  shopEmoji:       { fontSize: 36 },
  shopTitle:       { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  shopDesc:        { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  shopMeta:        { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  kindDot:         { width: 8, height: 8, borderRadius: 4 },
  shopKind:        { fontSize: 11, color: Colors.textSecondary, fontWeight: "500" },
  shopRight:       { alignItems: "flex-end", gap: 4 },
  shopCost:        { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  shopCostValue:   { fontSize: 10, color: Colors.textSecondary, fontWeight: "600" },
  getBtn:          { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "700" },
  cantAfford:      { fontSize: 10, color: Colors.error, fontWeight: "600", textAlign: "right" },
  requestedBadge:  { fontSize: 10, color: Colors.warning, fontWeight: "700", backgroundColor: Colors.warning + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  histRow:         { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histEmoji:       { fontSize: 20 },
  histTitle:       { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  histDate:        { fontSize: 11, color: Colors.textSecondary },
  histStatus:      { fontSize: FontSize.sm, fontWeight: "700", textTransform: "capitalize" },
  bankRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  bankReason:      { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1, marginRight: 8 },
  bankDelta:       { fontSize: FontSize.sm, fontWeight: "700" },
});
