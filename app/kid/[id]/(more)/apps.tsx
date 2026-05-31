import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Modal, Alert, Dimensions, Image,
} from "react-native";
import { useLocalSearchParams, useGlobalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso, pointsToMoney } from "../../../../lib/utils";
import { AppRule, AppRewardRule, AppUnlockSession } from "../../../../lib/data/types";
import { computeScheduledMode, nextWindowLabel } from "../../../../lib/app-scheduler";

// ─── Grid sizing (4-column Android launcher style) ────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 12;   // tighter padding for launcher look
const COL_GAP = 8;
const NUM_COLS = 4;
const CARD_W = Math.floor((SCREEN_W - H_PAD * 2 - COL_GAP * (NUM_COLS - 1)) / NUM_COLS);
const ICON_SIZE = Math.min(Math.floor(CARD_W * 0.72), 64);

// ─── App catalog — with real icon URLs ───────────────────────────────────────
// iconUrl: fetched at runtime; emoji shown while loading or if offline

type AppEntry = { name: string; emoji: string; color: string; iconUrl?: string };

// Helper — Google's high-res favicon CDN (256 px, very reliable)
const gIcon = (domain: string) =>
  `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`;

const APP_CATALOG: Record<string, AppEntry> = {
  duolingo:     { name: "Duolingo",        emoji: "🦜", color: "#58CC02", iconUrl: gIcon("duolingo.com") },
  khan:         { name: "Khan Academy",    emoji: "📐", color: "#14BF96", iconUrl: gIcon("khanacademy.org") },
  prodigy:      { name: "Prodigy Math",    emoji: "🔢", color: "#7C5CFF", iconUrl: gIcon("prodigygame.com") },
  epic:         { name: "Epic! Books",     emoji: "📚", color: "#FF6B6B", iconUrl: gIcon("getepic.com") },
  scratch:      { name: "Scratch",         emoji: "🐱", color: "#FF8C00", iconUrl: gIcon("scratch.mit.edu") },
  tinkercad:    { name: "Tinkercad",       emoji: "🖨️", color: "#2196F3", iconUrl: gIcon("tinkercad.com") },
  youtube_kids: { name: "YouTube Kids",    emoji: "📺", color: "#FF0000", iconUrl: "https://www.gstatic.com/youtube/img/branding/youtubelogo/svg/youtubelogo.svg" },
  minecraft:    { name: "Minecraft",       emoji: "⛏️", color: "#4CAF50", iconUrl: gIcon("minecraft.net") },
  roblox:       { name: "Roblox",          emoji: "🎮", color: "#E53935", iconUrl: gIcon("roblox.com") },
  tiktok:       { name: "TikTok",          emoji: "🎵", color: "#010101", iconUrl: gIcon("tiktok.com") },
  spotify:      { name: "Spotify Kids",    emoji: "🎧", color: "#1DB954", iconUrl: gIcon("spotify.com") },
  pbs_kids:     { name: "PBS Kids",        emoji: "🌟", color: "#F5A623", iconUrl: gIcon("pbskids.org") },
  coolmath:     { name: "Cool Math Games", emoji: "🧮", color: "#FF5722", iconUrl: gIcon("coolmathgames.com") },
  natgeo_kids:  { name: "Nat Geo Kids",    emoji: "🦁", color: "#FFC107", iconUrl: gIcon("nationalgeographic.com") },
  abc_mouse:    { name: "ABCmouse",        emoji: "🐭", color: "#E91E63", iconUrl: gIcon("abcmouse.com") },
  google_maps:  { name: "Google Maps",     emoji: "🗺️", color: "#4285F4", iconUrl: gIcon("maps.google.com") },
  calculator:   { name: "Calculator",      emoji: "🔢", color: "#607D8B" },   // built-in — no URL
  camera:       { name: "Camera",          emoji: "📷", color: "#9C27B0" },   // built-in — no URL
};

// ─── Reusable app icon image (real icon → emoji fallback) ─────────────────────

function AppIconImage({
  app, size, opacity = 1,
}: { app: AppEntry; size: number; opacity?: number }) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.22);

  if (app.iconUrl && !failed) {
    return (
      <Image
        source={{ uri: app.iconUrl }}
        style={{
          width: size, height: size,
          borderRadius: radius,
          opacity,
          backgroundColor: app.color + "22",
        }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  // Fallback: coloured bubble + emoji
  return (
    <View style={{
      width: size, height: size,
      borderRadius: radius,
      backgroundColor: app.color + "28",
      alignItems: "center", justifyContent: "center",
      opacity,
    }}>
      <Text style={{ fontSize: Math.floor(size * 0.48) }}>{app.emoji}</Text>
    </View>
  );
}

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ─── Unlock Confirm Modal ─────────────────────────────────────────────────────

function UnlockModal({ rule, points, visible, onClose, onConfirm }: {
  rule: AppRewardRule; points: number;
  visible: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const canAfford = points >= rule.pointCost;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={ms.iconWrap}>
            <Text style={ms.icon}>🔓</Text>
          </View>
          <Text style={ms.title}>{rule.label}</Text>
          <Text style={ms.sub}>Spend your points to unlock</Text>

          <View style={ms.costRow}>
            <View style={ms.costBox}>
              <Text style={ms.costNum}>{rule.pointCost}</Text>
              <Text style={ms.costLabel}>Points</Text>
              <Text style={ms.costMoney}>{pointsToMoney(rule.pointCost)}</Text>
            </View>
            <Text style={ms.arrow}>→</Text>
            <View style={ms.costBox}>
              <Text style={ms.costNum}>{rule.minutesGranted}</Text>
              <Text style={ms.costLabel}>Minutes</Text>
            </View>
          </View>

          <View style={ms.balanceRow}>
            <Text style={ms.balanceLabel}>Your balance:</Text>
            <Text style={[ms.balanceNum, !canAfford && { color: Colors.error }]}>{points} pts ({pointsToMoney(points)})</Text>
          </View>

          {!canAfford && (
            <View style={ms.notEnough}>
              <Text style={ms.notEnoughText}>
                You need {rule.pointCost - points} more points. Keep earning! 💪
              </Text>
            </View>
          )}

          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ms.confirmBtn, !canAfford && ms.confirmBtnDisabled]}
              onPress={canAfford ? onConfirm : undefined}
            >
              <Text style={ms.confirmText}>🔓 Unlock Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Active Session Banner ────────────────────────────────────────────────────

function SessionBanner({ session, kidId }: { session: AppUnlockSession; kidId: string }) {
  const { dispatch } = useData();
  const [secs, setSecs] = useState(session.secondsRemaining);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setSecs(session.secondsRemaining); }, [session.secondsRemaining]);

  useEffect(() => {
    if (!session.active) return;
    timerRef.current = setInterval(() => {
      setSecs(s => {
        const next = s - 1;
        if (next <= 0) {
          clearInterval(timerRef.current!);
          dispatch({ type: "APP_UNLOCK_END", kidId, sessionId: session.id });
          return 0;
        }
        if (next % 30 === 0) {
          dispatch({ type: "APP_UNLOCK_TICK", kidId, sessionId: session.id, secondsDelta: 30 });
        }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session.id, session.active]);

  if (!session.active) return null;
  const pct = secs / (session.minutesGranted * 60);

  return (
    <View style={sb.banner}>
      <View style={sb.bannerLeft}>
        <View style={sb.bannerIconRow}>
          <Text style={sb.bannerIcon}>🔓</Text>
          <Text style={sb.bannerApps}>
            {session.appIds.map(id => APP_CATALOG[id]?.emoji).filter(Boolean).join(" ")}
          </Text>
        </View>
        <Text style={sb.bannerName}>{session.ruleName}</Text>
        <View style={sb.bar}>
          <View style={[sb.barFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        </View>
      </View>
      <View style={sb.bannerRight}>
        <Text style={[sb.bannerTime, secs < 60 && { color: Colors.error }]}>{fmtSecs(secs)}</Text>
        <Text style={sb.bannerTimeLabel}>remaining</Text>
        <TouchableOpacity
          style={sb.endBtn}
          onPress={() => Alert.alert("End session?", "Stop using the unlocked time now?", [
            { text: "Keep playing", style: "cancel" },
            { text: "End", style: "destructive", onPress: () => dispatch({ type: "APP_UNLOCK_END", kidId, sessionId: session.id }) },
          ])}
        >
          <Text style={sb.endBtnText}>⏹ End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── App Icon (Android launcher style) ───────────────────────────────────────

function AppCard({ appId, rule, rewardRules, activeSessions, usedMinutes = 0 }: {
  appId: string; rule: AppRule;
  rewardRules: AppRewardRule[]; activeSessions: AppUnlockSession[];
  usedMinutes?: number;
}) {
  const app = APP_CATALOG[appId];
  if (!app) return null;

  const [, setTick] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;

  const effectiveMode    = computeScheduledMode(rule) ?? rule.mode;
  const activeSession    = activeSessions.find(s => s.active && s.appIds.includes(appId));
  const isRewardUnlocked = !!activeSession;
  const matchingRules    = rewardRules.filter(r => r.active && r.appIds.includes(appId));
  const timeLimitExceeded = effectiveMode === "limit" && rule.limitMinutes != null &&
    usedMinutes >= rule.limitMinutes && !isRewardUnlocked;
  const displayBlocked   = (effectiveMode === "block" || timeLimitExceeded) && !isRewardUnlocked;

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isRewardUnlocked) { pulse.setValue(1); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [isRewardUnlocked]);

  // Status dot colour
  let dotColor = "#22C55E"; // green = open
  let dotVisible = true;
  if (isRewardUnlocked) {
    dotColor = "#22C55E"; // green with timer
  } else if (displayBlocked) {
    dotColor = Colors.error; // red = locked
  } else if (effectiveMode === "limit" && rule.limitMinutes) {
    const remainMins = Math.max(0, rule.limitMinutes - usedMinutes);
    dotColor = remainMins <= 0 ? Colors.error : "#F59E0B"; // orange = limited
  } else if (effectiveMode === "allow") {
    dotVisible = false; // fully open = no badge needed
  }

  const iconBg = displayBlocked
    ? "#CBD5E1"
    : isRewardUnlocked
      ? Colors.success + "30"
      : app.color + "22";

  const iconBorder = isRewardUnlocked
    ? `${Colors.success}70`
    : displayBlocked
      ? "#D1D5DB"
      : `${app.color}55`;

  // Timer label on icon when session is active
  const timerLabel = isRewardUnlocked && activeSession
    ? fmtSecs(activeSession.secondsRemaining)
    : null;

  return (
    <Animated.View style={[c.wrap, { width: CARD_W, transform: [{ scale: pulse }] }]}>
      {/* App icon wrapper — positions overlays on top of real icon */}
      <View style={[c.iconWrap, {
        width: ICON_SIZE, height: ICON_SIZE,
        borderRadius: Math.round(ICON_SIZE * 0.22),
        borderWidth: isRewardUnlocked ? 2 : displayBlocked ? 1 : 0,
        borderColor: isRewardUnlocked ? Colors.success + "90" : "#D1D5DB",
      }]}>
        {/* Real app icon or emoji fallback */}
        <AppIconImage app={app} size={ICON_SIZE} opacity={displayBlocked ? 0.45 : 1} />

        {/* Status dot badge (top-right) */}
        {dotVisible && (
          <View style={[c.dot, { backgroundColor: dotColor }]} />
        )}

        {/* Lock / points overlay */}
        {displayBlocked && !isRewardUnlocked && (
          <View style={c.lockOverlay}>
            <Text style={c.lockIcon}>
              {matchingRules.length > 0 ? "⭐" : "🔒"}
            </Text>
          </View>
        )}

        {/* Active-session timer strip */}
        {timerLabel && (
          <View style={c.timerBadge}>
            <Text style={c.timerText}>{timerLabel}</Text>
          </View>
        )}
      </View>

      {/* App name */}
      <Text style={c.name} numberOfLines={2}>{app.name}</Text>

      {/* Mini time-limit bar under name */}
      {effectiveMode === "limit" && rule.limitMinutes && !isRewardUnlocked && (
        <View style={c.limitBar}>
          <View style={[c.limitBarFill, {
            width: `${Math.min(100, Math.round((usedMinutes / rule.limitMinutes) * 100))}%` as any,
            backgroundColor: timeLimitExceeded ? Colors.error : "#F59E0B",
          }]} />
        </View>
      )}
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AppsScreen() {
  const local  = useLocalSearchParams<{ id?: string }>();
  const global = useGlobalSearchParams<{ id?: string }>();
  const id = (local.id ?? global.id) as string;
  const { dispatch } = useData();
  const kid = useKid(id);
  const [selectedRule, setSelectedRule] = useState<AppRewardRule | null>(null);

  if (!kid) return null;

  const installed      = kid.rules.installedApps ?? [];
  const appRules       = kid.rules.appRules ?? [];
  const rewardRules    = (kid.rules.appRewardRules ?? []).filter(r => r.active);
  const sessions       = kid.appUnlockSessions ?? [];
  const activeSessions = sessions.filter(s => s.active);
  const points         = kid.behavior.totalPoints;

  // #5 Compute today's minutes used per app
  const today = new Date().toISOString().split("T")[0];
  const todayUsage = kid.usage.find(u => u.date === today);
  const appUsageToday: Record<string, number> = {};
  (todayUsage?.byApp ?? []).forEach(a => {
    appUsageToday[a.appId] = (appUsageToday[a.appId] ?? 0) + a.minutes;
  });

  const sorted = [...installed].sort((a, b) => {
    const ra = appRules.find(r => r.appId === a);
    const rb = appRules.find(r => r.appId === b);
    const modeA = ra ? (computeScheduledMode(ra) ?? ra.mode) : "allow";
    const modeB = rb ? (computeScheduledMode(rb) ?? rb.mode) : "allow";
    if (activeSessions.some(s => s.appIds.includes(a)) !== activeSessions.some(s => s.appIds.includes(b)))
      return activeSessions.some(s => s.appIds.includes(a)) ? -1 : 1;
    const rankA = modeA === "allow" ? 0 : ra?.scheduleEnabled ? 1 : 2;
    const rankB = modeB === "allow" ? 0 : rb?.scheduleEnabled ? 1 : 2;
    return rankA - rankB;
  });

  const openCount   = sorted.filter(appId => {
    const r = appRules.find(r => r.appId === appId);
    const mode = r ? (computeScheduledMode(r) ?? r.mode) : "allow";
    return mode === "allow" || activeSessions.some(s => s.active && s.appIds.includes(appId));
  }).length;
  const lockedCount = sorted.length - openCount;

  function spendPoints(rule: AppRewardRule) {
    const session: AppUnlockSession = {
      id: uid(), ruleId: rule.id, ruleName: rule.label,
      appIds: rule.appIds, pointsSpent: rule.pointCost,
      minutesGranted: rule.minutesGranted,
      secondsRemaining: rule.minutesGranted * 60,
      startedAt: nowIso(), active: true,
    };
    dispatch({ type: "BEHAVIOR_ADD_EVENT", kidId: id, event: {
      id: uid(), points: -rule.pointCost,
      reason: `🔓 Spent ${rule.pointCost} pts on "${rule.label}"`,
      date: new Date().toISOString().slice(0, 10),
    }});
    dispatch({ type: "APP_UNLOCK_START", kidId: id, session });
    setSelectedRule(null);
  }

  if (installed.length === 0) {
    return (
      <ScreenContainer>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIllo}>📭</Text>
          <Text style={styles.emptyTitle}>No apps yet</Text>
          <Text style={styles.emptySub}>Ask a parent to add apps for you.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentStyle={{ paddingHorizontal: H_PAD, paddingVertical: 12, paddingBottom: 40 }}>

      {/* ── Header card ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📱 My Apps</Text>
          <View style={styles.headerStats}>
            <Text style={styles.headerStat}>✅ {openCount} open</Text>
            {lockedCount > 0 && <Text style={[styles.headerStat, { color: Colors.error }]}>🔒 {lockedCount} locked</Text>}
          </View>
        </View>
        <View style={styles.pointsPill}>
          <Text style={styles.pointsStar}>⭐</Text>
          <Text style={styles.pointsNum}>{points}</Text>
          <Text style={styles.pointsPts}>pts</Text>
          <Text style={styles.pointsMoney}>({pointsToMoney(points)})</Text>
        </View>
      </View>

      {/* ── Active sessions ── */}
      {activeSessions.map(s => (
        <SessionBanner key={s.id} session={s} kidId={id} />
      ))}

      {/* ── Reward unlock chips ── */}
      {rewardRules.length > 0 && (
        <View style={styles.rewardSection}>
          <Text style={styles.sectionLabel}>🔓 UNLOCK WITH POINTS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rewardScroll}>
            {rewardRules.map(rule => {
              const alreadyActive = activeSessions.some(s => s.active && s.ruleId === rule.id);
              const canAfford = points >= rule.pointCost;
              return (
                <TouchableOpacity
                  key={rule.id}
                  style={[
                    styles.rewardChip,
                    alreadyActive && styles.rewardChipActive,
                    !canAfford && !alreadyActive && styles.rewardChipDim,
                  ]}
                  onPress={() => !alreadyActive && setSelectedRule(rule)}
                  disabled={alreadyActive}
                >
                  <Text style={styles.rewardEmojis}>
                    {rule.appIds.map(aid => APP_CATALOG[aid]?.emoji).filter(Boolean).slice(0, 3).join("")}
                  </Text>
                  <Text style={styles.rewardName} numberOfLines={1}>{rule.label}</Text>
                  <View style={[styles.rewardPill, alreadyActive && { backgroundColor: Colors.success + "30" }]}>
                    <Text style={[styles.rewardPillText, alreadyActive && { color: Colors.success }, !canAfford && !alreadyActive && { color: Colors.error }]}>
                      {alreadyActive ? "✅ Active" : `${rule.pointCost}⭐ → ${rule.minutesGranted}m`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Section label ── */}
      <Text style={styles.sectionLabel}>ALL APPS</Text>

      {/* ── 4-column launcher-style App grid ── */}
      <View style={styles.grid}>
        {sorted.map(appId => {
          const rule = appRules.find(r => r.appId === appId) ?? {
            appId, appName: appId, mode: "allow" as const,
            scheduleEnabled: false, schedules: [],
          };
          return (
            <AppCard
              key={appId}
              appId={appId}
              rule={rule}
              rewardRules={rewardRules}
              activeSessions={activeSessions}
              usedMinutes={appUsageToday[appId] ?? 0}
            />
          );
        })}
      </View>

      {/* ── Footer tip ── */}
      <View style={styles.tip}>
        <Text style={styles.tipText}>💡 Earn points from chores &amp; good behavior to unlock apps!</Text>
      </View>

      {/* ── Unlock modal ── */}
      {selectedRule && (
        <UnlockModal
          rule={selectedRule} points={points} visible
          onClose={() => setSelectedRule(null)}
          onConfirm={() => spendPoints(selectedRule)}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.primary + "12", borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.primary + "25",
    marginBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  headerStats: { flexDirection: "row", gap: 10 },
  headerStat: { fontSize: 12, fontWeight: "700", color: Colors.success },
  pointsPill: {
    flexDirection: "row", alignItems: "baseline", gap: 3,
    backgroundColor: Colors.secondary + "30",
    borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: Colors.secondary + "60",
  },
  pointsStar: { fontSize: 18 },
  pointsNum: { fontSize: 22, fontWeight: "900", color: "#B45309" },
  pointsPts: { fontSize: 11, fontWeight: "700", color: "#B45309" },
  pointsMoney: { fontSize: 10, fontWeight: "600", color: "#B45309", marginLeft: 2 },

  // Section label
  sectionLabel: {
    fontSize: 10, fontWeight: "800", color: Colors.textMuted,
    letterSpacing: 1.2, marginBottom: 10, marginTop: 4,
  },

  // Reward chips
  rewardSection: { marginBottom: 16 },
  rewardScroll: { gap: 8, paddingBottom: 2 },
  rewardChip: {
    alignItems: "center", gap: 4,
    backgroundColor: Colors.primary + "12",
    borderRadius: 16, padding: 12, minWidth: 90,
    borderWidth: 1.5, borderColor: Colors.primary + "30",
  },
  rewardChipActive: { backgroundColor: Colors.success + "15", borderColor: Colors.success + "60" },
  rewardChipDim: { opacity: 0.55 },
  rewardEmojis: { fontSize: 22 },
  rewardName: { fontSize: 11, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  rewardPill: { backgroundColor: Colors.primary + "20", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  rewardPillText: { fontSize: 10, fontWeight: "800", color: Colors.primary },

  // Grid — launcher style, tight gaps
  grid: { flexDirection: "row", flexWrap: "wrap", gap: COL_GAP, rowGap: 16 },

  // Empty
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  emptyIllo: { fontSize: 72 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },

  // Footer
  tip: {
    marginTop: 20, marginBottom: 8,
    backgroundColor: Colors.primary + "0D", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.primary + "20",
  },
  tipText: { fontSize: 11, color: Colors.primary, fontWeight: "600", textAlign: "center", lineHeight: 16 },
});

// ─── App Icon styles (Android launcher) ───────────────────────────────────────

const c = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 6,
  },
  // Outer wrapper — positions status overlays relative to the icon
  iconWrap: {
    ...Shadow.sm,
    position: "relative",
    overflow: "hidden",
  },
  // Small status dot badge (top-right corner of the icon)
  dot: {
    position: "absolute", top: 5, right: 5,
    width: 9, height: 9, borderRadius: 5,
    borderWidth: 1.5, borderColor: "#fff",
  },
  // Dim overlay for blocked apps
  lockOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  lockIcon: { fontSize: 18 },
  // Active session timer strip (bottom of icon)
  timerBadge: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(16,185,129,0.90)",
    paddingVertical: 2, alignItems: "center",
  },
  timerText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  // App name
  name: {
    fontSize: 10, fontWeight: "600", color: Colors.textPrimary,
    textAlign: "center", lineHeight: 14,
    width: CARD_W - 4,
  },
  // Time-limit bar (thin, under name)
  limitBar: {
    width: CARD_W - 8, height: 3,
    backgroundColor: "#E2E8F0", borderRadius: 2, overflow: "hidden", marginTop: -2,
  },
  limitBarFill: { height: 3, borderRadius: 2 },
});

// ─── Session Banner styles ────────────────────────────────────────────────────

const sb = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F0FDF4", borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: Colors.success + "60", ...Shadow.sm,
  },
  bannerLeft: { flex: 1, gap: 4 },
  bannerIconRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bannerIcon: { fontSize: 18 },
  bannerApps: { fontSize: 18 },
  bannerName: { fontSize: 13, fontWeight: "800", color: Colors.textPrimary },
  bar: { width: "80%", height: 5, backgroundColor: "#D1FAE5", borderRadius: 3, overflow: "hidden", marginTop: 2 },
  barFill: { height: 5, backgroundColor: Colors.success, borderRadius: 3 },
  bannerRight: { alignItems: "center", gap: 4, minWidth: 70 },
  bannerTime: { fontSize: 20, fontWeight: "900", color: Colors.success, fontVariant: ["tabular-nums"] },
  bannerTimeLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: "600", marginTop: -4 },
  endBtn: { backgroundColor: Colors.error + "18", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: Colors.error + "40" },
  endBtnText: { fontSize: 11, fontWeight: "700", color: Colors.error },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: {
    backgroundColor: Colors.surfaceLight, borderRadius: 28,
    padding: 28, width: "100%", alignItems: "center", gap: 10, ...Shadow.md,
  },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primary + "18", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  icon: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  costRow: {
    flexDirection: "row", alignItems: "center", gap: 20,
    backgroundColor: Colors.primary + "10", borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 14,
    marginVertical: 6, width: "100%", justifyContent: "center",
  },
  costBox: { alignItems: "center" },
  costNum: { fontSize: 38, fontWeight: "900", color: Colors.primary },
  costLabel: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  costMoney: { fontSize: 10, fontWeight: "600", color: Colors.success, marginTop: 2 },
  arrow: { fontSize: 28, color: Colors.textMuted },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 4 },
  balanceLabel: { fontSize: 13, color: Colors.textSecondary },
  balanceNum: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  notEnough: { backgroundColor: Colors.error + "12", borderRadius: 12, padding: 10, width: "100%" },
  notEnoughText: { fontSize: 13, color: Colors.error, fontWeight: "600", textAlign: "center" },
  btnRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 6 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary, fontSize: 14 },
  confirmBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 50, alignItems: "center", paddingVertical: 14, ...Shadow.sm },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
