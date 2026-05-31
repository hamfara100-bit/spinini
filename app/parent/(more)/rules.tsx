import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, TextInput, Modal,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { formatMinutes } from "../../../lib/data/logic";
import { uid, nowIso } from "../../../lib/utils";
import { PointsInput } from "../../../components/points-input";
import type { ContentFilterSettings, SafeSearchSettings, ScreenTimeSchedule, AppRewardRule } from "../../../lib/data/types";

type Tab = "screentime" | "content" | "purchases" | "safesearch" | "apprewards" | "studymode";

const TABS: { id: Tab; label: string; emoji: string; color: string }[] = [
  { id: "screentime",  label: "Screen Time",    emoji: "⏱️",  color: "#7C5CFF" },
  { id: "studymode",   label: "Study Mode",     emoji: "📚",  color: "#2563EB" },
  { id: "content",     label: "Content Filter", emoji: "🛡️",  color: "#EF4444" },
  { id: "purchases",   label: "Approvals",      emoji: "🔐",  color: "#F59E0B" },
  { id: "safesearch",  label: "Safe Search",    emoji: "🔍",  color: "#10B981" },
  { id: "apprewards",  label: "App Rewards",    emoji: "⭐",  color: "#F59E0B" },
];

const APP_CATALOG: Record<string, { name: string; emoji: string }> = {
  duolingo:     { name: "Duolingo",        emoji: "🦜" },
  khan:         { name: "Khan Academy",    emoji: "📐" },
  prodigy:      { name: "Prodigy Math",    emoji: "🔢" },
  epic:         { name: "Epic! Books",     emoji: "📚" },
  scratch:      { name: "Scratch",         emoji: "🐱" },
  tinkercad:    { name: "Tinkercad",       emoji: "🖨️" },
  youtube_kids: { name: "YouTube Kids",    emoji: "📺" },
  minecraft:    { name: "Minecraft",       emoji: "⛏️" },
  roblox:       { name: "Roblox",          emoji: "🎮" },
  tiktok:       { name: "TikTok",          emoji: "🎵" },
  spotify:      { name: "Spotify Kids",    emoji: "🎧" },
  pbs_kids:     { name: "PBS Kids",        emoji: "🌟" },
  coolmath:     { name: "Cool Math Games", emoji: "🧮" },
  natgeo_kids:  { name: "Nat Geo Kids",    emoji: "🦁" },
  abc_mouse:    { name: "ABCmouse",        emoji: "🐭" },
  google_maps:  { name: "Google Maps",     emoji: "🗺️" },
  calculator:   { name: "Calculator",      emoji: "🔢" },
  camera:       { name: "Camera",          emoji: "📷" },
};

const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export default function RulesScreen() {
  const { state, dispatch } = useData();
  const [kidId, setKidId] = useState(state.kids[0]?.profile.id ?? "");
  const [tab, setTab] = useState<Tab>("screentime");

  const kid = state.kids.find(k => k.profile.id === kidId);
  const rules = kid?.rules;

  function updateRules(payload: object) {
    if (!kidId) return;
    dispatch({ type: "UPDATE_RULES", kidId, payload: payload as any });
  }

  function updateContentFilter(key: keyof ContentFilterSettings, value: boolean) {
    if (!rules) return;
    updateRules({ contentFilter: { ...rules.contentFilter, [key]: value } });
  }

  function updateSafeSearch(key: keyof SafeSearchSettings, value: boolean) {
    if (!rules) return;
    updateRules({ safeSearch: { ...rules.safeSearch, [key]: value } });
  }

  function updateSchedule(key: keyof ScreenTimeSchedule, value: any) {
    if (!rules) return;
    updateRules({ screenTimeSchedule: { ...rules.screenTimeSchedule, [key]: value } });
  }

  function adjustLimit(key: "dailyLimitMinutes" | "entertainmentLimitMinutes" | "weekendLimitMinutes", delta: number) {
    if (!rules) return;
    const cur = rules.screenTimeSchedule[key] as number;
    updateSchedule(key, Math.max(0, Math.min(600, cur + delta)));
  }

  function toggleBedtimeDay(day: number) {
    if (!rules) return;
    const days = rules.screenTimeSchedule.bedtimeDays;
    updateSchedule("bedtimeDays", days.includes(day) ? days.filter(d => d !== day) : [...days, day]);
  }

  if (state.kids.length === 0) {
    return <ScreenContainer><Text style={styles.empty}>No kids added yet.</Text></ScreenContainer>;
  }

  const sched = rules?.screenTimeSchedule;
  const cf = rules?.contentFilter;
  const ss = rules?.safeSearch;

  return (
    <ScreenContainer>
      <Text style={styles.title}>🛡️ Parental Controls</Text>

      {/* Kid selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        {state.kids.map(k => (
          <TouchableOpacity
            key={k.profile.id}
            style={[styles.kidTab, kidId === k.profile.id && styles.kidTabActive]}
            onPress={() => setKidId(k.profile.id)}
          >
            <Text style={[styles.kidTabText, kidId === k.profile.id && styles.kidTabTextActive]}>
              {k.profile.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Free Mode banner */}
      {kid && (
        <View style={[styles.freeModeCard, kid.rules.freeMode && styles.freeModeCardOn]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.freeModeTitle}>
              {kid.rules.freeMode ? "🔓 Free Mode ON" : "🔒 Free Mode OFF"}
            </Text>
            <Text style={styles.freeModeSub}>
              {kid.rules.freeMode
                ? `${kid.profile.name} can use everything freely — all restrictions lifted. Usage is still tracked in Reports.`
                : "All rules and limits are active. Toggle to give full access while still monitoring usage."}
            </Text>
          </View>
          <Switch
            value={kid.rules.freeMode}
            onValueChange={v => dispatch({ type: "SET_FREE_MODE", kidId: kid.profile.id, enabled: v })}
            trackColor={{ false: "#D1D5DB", true: "#34D399" }}
            thumbColor="#fff"
          />
        </View>
      )}

      {/* Tab bar — hidden when free mode is on */}
      {!kid?.rules.freeMode && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, tab === t.id && { backgroundColor: t.color + "18", borderColor: t.color }]}
            onPress={() => setTab(t.id)}
          >
            <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, tab === t.id && { color: t.color }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      )}

      {kid?.rules.freeMode && (
        <View style={styles.freeModeMessage}>
          <Text style={styles.freeModeMessageText}>
            All rules are suspended while Free Mode is on.{"\n"}Toggle it off above to manage controls.
          </Text>
        </View>
      )}

      {!kid?.rules.freeMode && (!rules ? (
        <Text style={styles.empty}>Select a kid above.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

          {/* ─── SCREEN TIME ─────────────────────────────────── */}
          {tab === "screentime" && sched && (
            <>
              <SectionHeader emoji="⏱️" title="Daily Screen Time" color="#7C5CFF" />

              <Card>
                <Row label="Total Daily Limit" sub={formatMinutes(sched.dailyLimitMinutes)} />
                <BtnRow onAdjust={(d) => adjustLimit("dailyLimitMinutes", d)} />
              </Card>

              <Card>
                <Row label="🎮 Entertainment Limit" sub={`${formatMinutes(sched.entertainmentLimitMinutes)} — games, social, video`} />
                <BtnRow onAdjust={(d) => adjustLimit("entertainmentLimitMinutes", d)} />
                <Divider />
                <SwitchRow
                  label="📚 Educational Apps Exempt"
                  sub="Learning apps don't count toward the daily limit"
                  value={sched.educationalAppsExempt}
                  onChange={v => updateSchedule("educationalAppsExempt", v)}
                  color="#10B981"
                />
              </Card>

              <Card>
                <SwitchRow
                  label="🗓 Weekend Override"
                  sub={`Weekends: ${formatMinutes(sched.weekendLimitMinutes)}`}
                  value={sched.weekendOverrideEnabled}
                  onChange={v => updateSchedule("weekendOverrideEnabled", v)}
                  color="#7C5CFF"
                />
                {sched.weekendOverrideEnabled && (
                  <BtnRow onAdjust={(d) => adjustLimit("weekendLimitMinutes", d)} />
                )}
              </Card>

              <SectionHeader emoji="🧹" title="Screen Time Earned from Chores" color="#10B981" />

              <Card>
                <Row
                  label="Minutes per Chore"
                  sub={rules.screenTimePerChoreMinutes ? `+${rules.screenTimePerChoreMinutes} min added when a chore is approved` : "Disabled — chores don't grant screen time"}
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  {[0, 5, 10, 15, 20, 30].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor: (rules.screenTimePerChoreMinutes ?? 0) === val ? "#10B981" : Colors.surfaceLight,
                        borderWidth: 1,
                        borderColor: (rules.screenTimePerChoreMinutes ?? 0) === val ? "#10B981" : Colors.border,
                      }}
                      onPress={() => updateRules({ screenTimePerChoreMinutes: val })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: (rules.screenTimePerChoreMinutes ?? 0) === val ? "#fff" : Colors.textPrimary }}>
                        {val === 0 ? "Off" : `+${val}m`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 8 }}>
                  Kids earn bonus screen time automatically when a chore is marked approved.
                </Text>
              </Card>

              <SectionHeader emoji="🌙" title="Bedtime Lock" color="#4F46E5" />

              <Card>
                <SwitchRow
                  label="Bedtime Lock"
                  sub={`Device locks at ${sched.bedtimeStart} until ${sched.bedtimeEnd}`}
                  value={sched.bedtimeEnabled}
                  onChange={v => updateSchedule("bedtimeEnabled", v)}
                  color="#4F46E5"
                />
                {sched.bedtimeEnabled && (
                  <>
                    <Divider />
                    <TimeRow
                      label="Locks at"
                      value={sched.bedtimeStart}
                      onEarlier={() => shiftTime(sched.bedtimeStart, -30, t => updateSchedule("bedtimeStart", t))}
                      onLater={() => shiftTime(sched.bedtimeStart, 30, t => updateSchedule("bedtimeStart", t))}
                    />
                    <TimeRow
                      label="Unlocks at"
                      value={sched.bedtimeEnd}
                      onEarlier={() => shiftTime(sched.bedtimeEnd, -30, t => updateSchedule("bedtimeEnd", t))}
                      onLater={() => shiftTime(sched.bedtimeEnd, 30, t => updateSchedule("bedtimeEnd", t))}
                    />
                    <Divider />
                    <Text style={styles.dayLabel}>Active days:</Text>
                    <View style={styles.dayRow}>
                      {DAYS.map((d, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[styles.dayBtn, sched.bedtimeDays.includes(i) && styles.dayBtnActive]}
                          onPress={() => toggleBedtimeDay(i)}
                        >
                          <Text style={[styles.dayBtnText, sched.bedtimeDays.includes(i) && { color: "#fff" }]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </Card>

              {/* Downtime Windows */}
              <SectionHeader emoji="🚫" title="Custom Downtime" color="#EF4444" />
              {rules.downtimeWindows.map(w => (
                <Card key={w.id}>
                  <SwitchRow
                    label={w.label}
                    sub={`${w.startTime} – ${w.endTime}`}
                    value={w.enabled}
                    onChange={v => dispatch({ type: "UPDATE_DOWNTIME", kidId, windowId: w.id, payload: { enabled: v } })}
                    color="#EF4444"
                  />
                </Card>
              ))}

              {/* Instant lock */}
              <Card>
                <SwitchRow
                  label="🔒 Instant Lock"
                  sub="Lock the device right now"
                  value={rules.instantLocked}
                  onChange={v => {
                    const kid = state.kids.find(k => k.profile.id === kidId);
                    dispatch({
                      type: "SET_INSTANT_LOCK",
                      kidId,
                      locked: v,
                      // Preserve existing timed-lock settings when toggling on; clear when turning off
                      message: v ? (kid?.rules.lockMessage ?? undefined) : undefined,
                      until:   v ? (kid?.rules.lockUntil   ?? undefined) : undefined,
                    });
                  }}
                  color="#EF4444"
                />
              </Card>
            </>
          )}

          {/* ─── CONTENT FILTER ──────────────────────────────── */}
          {tab === "content" && cf && (
            <>
              <InfoBox
                emoji="🛡️"
                text="Content filtering automatically blocks websites and content matching these categories. Blocked requests are logged for your review."
                color="#EF4444"
              />

              <SectionHeader emoji="🔞" title="Block Categories" color="#EF4444" />

              <Card>
                <SwitchRow label="🔞 Explicit / Adult Content" sub="Pornography and sexually explicit material" value={cf.blockExplicit} onChange={v => updateContentFilter("blockExplicit", v)} color="#EF4444" />
                <Divider />
                <SwitchRow label="💢 Violence & Gore" sub="Graphic violence, gore, self-harm content" value={cf.blockViolence} onChange={v => updateContentFilter("blockViolence", v)} color="#F59E0B" />
                <Divider />
                <SwitchRow label="😡 Hate Speech" sub="Racism, extremism, and discrimination" value={cf.blockHateSpeech} onChange={v => updateContentFilter("blockHateSpeech", v)} color="#8B5CF6" />
                <Divider />
                <SwitchRow label="🎰 Gambling" sub="Online gambling, betting, and casinos" value={cf.blockGambling} onChange={v => updateContentFilter("blockGambling", v)} color="#F59E0B" />
                <Divider />
                <SwitchRow label="🍺 Drugs & Alcohol" sub="Drug use, alcohol, and tobacco content" value={cf.blockDrugsAlcohol} onChange={v => updateContentFilter("blockDrugsAlcohol", v)} color="#6B7280" />
              </Card>

              <SectionHeader emoji="🌐" title="Web Filter Level" color="#EF4444" />
              <Card>
                <Text style={styles.cardSub}>Controls the overall strictness of URL filtering</Text>
                <View style={styles.filterRow}>
                  {(["auto","strict","off"] as const).map(level => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.filterBtn, rules.webFilterLevel === level && styles.filterBtnActive]}
                      onPress={() => updateRules({ webFilterLevel: level })}
                    >
                      <Text style={{ fontSize: 18 }}>
                        {level === "auto" ? "🤖" : level === "strict" ? "🔒" : "🔓"}
                      </Text>
                      <Text style={[styles.filterBtnText, rules.webFilterLevel === level && styles.filterBtnTextActive]}>
                        {level === "auto" ? "Auto" : level === "strict" ? "Strict" : "Off"}
                      </Text>
                      <Text style={[styles.filterBtnSub, rules.webFilterLevel === level && { color: "#fff" }]}>
                        {level === "auto" ? "AI-powered" : level === "strict" ? "Allowlist only" : "No filtering"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>

              <SectionHeader emoji="🕵️" title="Privacy & Browser" color="#7C5CFF" />
              <Card>
                <SwitchRow
                  label="🕵️ Block Private / Incognito Browsing"
                  sub="Prevents kids from opening private tabs to bypass web filtering"
                  value={rules.blockPrivateBrowsing ?? false}
                  onChange={v => updateRules({ blockPrivateBrowsing: v })}
                  color="#7C5CFF"
                />
              </Card>

              <SectionHeader emoji="🚗" title="Driving Safety" color="#F59E0B" />
              <Card>
                <SwitchRow
                  label="🚗 Driving Mode"
                  sub="Restricts phone use when moving faster than the speed threshold"
                  value={rules.drivingModeEnabled ?? false}
                  onChange={v => updateRules({ drivingModeEnabled: v })}
                  color="#F59E0B"
                />
                {(rules.drivingModeEnabled ?? false) && (
                  <>
                    <Divider />
                    <SwitchRow
                      label="📵 Block Non-Essential Apps While Driving"
                      sub="Only phone calls and emergency features available"
                      value={rules.drivingBlockApps ?? true}
                      onChange={v => updateRules({ drivingBlockApps: v })}
                      color="#F59E0B"
                    />
                    <Divider />
                    <View style={styles.tipBox}>
                      <Text style={styles.tipTitle}>⚡ Speed Threshold: {rules.drivingSpeedThresholdKmh ?? 25} km/h</Text>
                      <Text style={styles.tipText}>Driving mode activates when GPS speed exceeds this limit. The companion app detects speed via device GPS.</Text>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {[20, 25, 30, 40].map(spd => (
                          <TouchableOpacity
                            key={spd}
                            style={[styles.filterBtn, { flex: 0, paddingHorizontal: 16 }, (rules.drivingSpeedThresholdKmh ?? 25) === spd && styles.filterBtnActive]}
                            onPress={() => updateRules({ drivingSpeedThresholdKmh: spd })}
                          >
                            <Text style={[(rules.drivingSpeedThresholdKmh ?? 25) === spd && { color: "#fff" }]}>{spd} km/h</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </>
                )}
              </Card>
            </>
          )}

          {/* ─── APP & PURCHASE APPROVALS ─────────────────────── */}
          {tab === "purchases" && (
            <>
              <InfoBox
                emoji="🔐"
                text="When enabled, your PIN is required before any new app can be downloaded or any in-app purchase can be made on this device."
                color="#F59E0B"
              />

              <SectionHeader emoji="📲" title="Download & Purchase Controls" color="#F59E0B" />

              <Card>
                <SwitchRow
                  label="📲 Require Approval to Download Apps"
                  sub="Parent PIN required before installing any new app from the store"
                  value={rules.downloadApprovalRequired}
                  onChange={v => updateRules({ downloadApprovalRequired: v })}
                  color="#F59E0B"
                />
                <Divider />
                <SwitchRow
                  label="💳 Require Approval for Purchases"
                  sub="Parent PIN required for all in-app purchases and subscriptions"
                  value={rules.purchaseApprovalRequired}
                  onChange={v => updateRules({ purchaseApprovalRequired: v })}
                  color="#EF4444"
                />
              </Card>

              <Card>
                <View style={styles.tipBox}>
                  <Text style={styles.tipTitle}>💡 How it works</Text>
                  <Text style={styles.tipText}>• On iOS: Set Screen Time passcode in iPhone Settings → Screen Time → Content & Privacy Restrictions</Text>
                  <Text style={styles.tipText}>• On Android: Set up Google Play parental controls in Play Store → Settings → Family → Parental Controls</Text>
                  <Text style={styles.tipText}>• This app records your preference and reminds you to set it up on the device.</Text>
                </View>
                {(!rules.purchaseApprovalRequired && !rules.downloadApprovalRequired) && (
                  <TouchableOpacity
                    style={[styles.warnBtn]}
                    onPress={() => {
                      updateRules({ purchaseApprovalRequired: true, downloadApprovalRequired: true });
                      Alert.alert("✅ Enabled", "Both approval requirements have been turned on.");
                    }}
                  >
                    <Text style={styles.warnBtnText}>⚠️ Enable All Protections</Text>
                  </TouchableOpacity>
                )}
              </Card>
            </>
          )}

          {/* ─── SAFE SEARCH ─────────────────────────────────── */}
          {tab === "safesearch" && ss && (
            <>
              <InfoBox
                emoji="🔍"
                text="Safe Search filters explicit images and content from search results. YouTube Restricted Mode hides videos flagged as inappropriate for children."
                color="#10B981"
              />

              <SectionHeader emoji="🔍" title="Search Engines" color="#10B981" />

              <Card>
                <SwitchRow
                  label="🔵 Google Safe Search"
                  sub="Filters explicit images and web results on Google"
                  value={ss.googleSafeSearch}
                  onChange={v => updateSafeSearch("googleSafeSearch", v)}
                  color="#10B981"
                />
                <Divider />
                <SwitchRow
                  label="🟢 Bing Safe Search"
                  sub="Locks Bing to Strict mode to hide adult content"
                  value={ss.bingSafeSearch}
                  onChange={v => updateSafeSearch("bingSafeSearch", v)}
                  color="#10B981"
                />
              </Card>

              <SectionHeader emoji="📺" title="Video Platforms" color="#EF4444" />

              <Card>
                <SwitchRow
                  label="▶️ YouTube Restricted Mode"
                  sub="Hides videos flagged as inappropriate for children"
                  value={ss.youtubeRestricted}
                  onChange={v => updateSafeSearch("youtubeRestricted", v)}
                  color="#EF4444"
                />
                <Divider />
                <SwitchRow
                  label="🔍 YouTube Safe Search"
                  sub="Filters explicit content from YouTube search results"
                  value={ss.youtubeSafeSearch}
                  onChange={v => updateSafeSearch("youtubeSafeSearch", v)}
                  color="#EF4444"
                />
              </Card>

              <Card>
                <View style={styles.tipBox}>
                  <Text style={styles.tipTitle}>💡 Setup instructions</Text>
                  <Text style={styles.tipText}>• <Text style={{ fontWeight: "700" }}>Google:</Text> Sign in → Search Settings → Turn on SafeSearch → Lock SafeSearch</Text>
                  <Text style={styles.tipText}>• <Text style={{ fontWeight: "700" }}>Bing:</Text> Settings → Safe Search → Strict → Save</Text>
                  <Text style={styles.tipText}>• <Text style={{ fontWeight: "700" }}>YouTube:</Text> Account icon → Restricted Mode → Turn on</Text>
                  <Text style={styles.tipText}>• Use a parent account to lock these settings so kids can't change them.</Text>
                </View>
              </Card>
            </>
          )}

          {/* ── Study Mode tab ── */}
          {tab === "studymode" && rules && (
            <StudyModePanel kidId={kidId} rules={rules} updateRules={updateRules} />
          )}

          {/* ── App Rewards tab ── */}
          {tab === "apprewards" && (
            <AppRewardsPanel kidId={kidId} installedApps={rules?.installedApps ?? []} />
          )}

        </ScrollView>
      ))}
    </ScreenContainer>
  );
}

// ─── Study Mode Panel ─────────────────────────────────────────────────────────

const ENTERTAINMENT_PACKAGES = [
  { id: "com.google.android.youtube", name: "YouTube" },
  { id: "com.zhiliaoapp.musically", name: "TikTok" },
  { id: "com.mojang.minecraftpe", name: "Minecraft" },
  { id: "com.roblox.client", name: "Roblox" },
  { id: "com.spotify.music", name: "Spotify" },
  { id: "com.netflix.mediaclient", name: "Netflix" },
  { id: "com.instagram.android", name: "Instagram" },
  { id: "com.snapchat.android", name: "Snapchat" },
  { id: "com.facebook.katana", name: "Facebook" },
  { id: "com.king.candycrushsaga", name: "Candy Crush" },
  { id: "com.supercell.clashofclans", name: "Clash of Clans" },
  { id: "com.activision.callofduty.shooter", name: "Call of Duty" },
];

const BREAK_DURATIONS = [
  { label: "5 min",  minutes: 5 },
  { label: "10 min", minutes: 10 },
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
];

function StudyModePanel({ kidId, rules, updateRules }: { kidId: string; rules: any; updateRules: (p: object) => void }) {
  const { dispatch } = useData();
  const studyBlocked: string[] = rules.studyBlockedPackages ?? [];

  // Break timer state
  const breakUntil: string | undefined = rules.studyModeBreakUntil;
  const breakActive = !!breakUntil && new Date(breakUntil) > new Date();
  const breakMinsLeft = breakActive
    ? Math.ceil((new Date(breakUntil!).getTime() - Date.now()) / 60_000)
    : 0;

  function giveBreak(minutes: number) {
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    dispatch({ type: "SET_STUDY_MODE_BREAK", kidId, until });
  }

  function endBreak() {
    dispatch({ type: "SET_STUDY_MODE_BREAK", kidId, until: undefined });
  }

  function togglePkg(pkg: string) {
    const next = studyBlocked.includes(pkg)
      ? studyBlocked.filter(p => p !== pkg)
      : [...studyBlocked, pkg];
    dispatch({ type: "SET_STUDY_BLOCKED_PACKAGES", kidId, packages: next });
  }

  return (
    <>
      <SectionHeader emoji="📚" title="Study Mode" color="#2563EB" />
      <Card>
        <SwitchRow
          label="📚 Study Mode"
          sub="Blocks entertainment apps. School and educational features stay open."
          value={rules.studyMode ?? false}
          onChange={v => dispatch({ type: "SET_STUDY_MODE", kidId, enabled: v })}
          color="#2563EB"
        />
      </Card>

      {/* Break Time — only visible when Study Mode is on */}
      {(rules.studyMode ?? false) && (
        <>
          <SectionHeader emoji="🏃" title="Give a Break" color="#10B981" />
          {breakActive ? (
            <Card>
              <View style={sm.breakBanner}>
                <Text style={sm.breakEmoji}>⏸️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={sm.breakTitle}>Break in progress — {breakMinsLeft} min left</Text>
                  <Text style={sm.breakSub}>All Study Mode restrictions are lifted until the break ends.</Text>
                </View>
              </View>
              <TouchableOpacity style={sm.endBreakBtn} onPress={endBreak}>
                <Text style={sm.endBreakText}>✕ End Break Now</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <Card>
              <Text style={sm.breakHint}>
                Give your child a short break (e.g. recess) where all Study Mode restrictions are temporarily lifted.
              </Text>
              <View style={sm.breakBtns}>
                {BREAK_DURATIONS.map(b => (
                  <TouchableOpacity key={b.minutes} style={sm.breakDurationBtn} onPress={() => giveBreak(b.minutes)}>
                    <Text style={sm.breakDurationText}>{b.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          )}
        </>
      )}

      <SectionHeader emoji="🚫" title="Blocked During Study Mode" color="#EF4444" />
      <Card>
        {ENTERTAINMENT_PACKAGES.map(pkg => (
          <SwitchRow
            key={pkg.id}
            label={pkg.name}
            sub={pkg.id}
            value={studyBlocked.includes(pkg.id)}
            onChange={() => togglePkg(pkg.id)}
            color="#EF4444"
          />
        ))}
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>💡 How it works</Text>
          <Text style={styles.tipText}>When Study Mode is on, these apps are detected and blocked via the Accessibility Service. Go to Settings → Accessibility → Spinini Monitor to enable.</Text>
        </View>
      </Card>
    </>
  );
}

// ─── App Rewards Panel ────────────────────────────────────────────────────────

function AppRewardsPanel({ kidId, installedApps }: { kidId: string; installedApps: string[] }) {
  const { state, dispatch } = useData();
  const kid = state.kids.find(k => k.profile.id === kidId);
  const rules = (kid?.rules.appRewardRules ?? []);

  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [pointCost, setPointCost] = useState("10");
  const [minutesGranted, setMinutesGranted] = useState("30");

  function toggleApp(appId: string) {
    setSelectedApps(prev => prev.includes(appId) ? prev.filter(a => a !== appId) : [...prev, appId]);
  }

  function addRule() {
    if (!label.trim()) { Alert.alert("Name required", "Give this reward rule a name."); return; }
    if (selectedApps.length === 0) { Alert.alert("Select apps", "Choose at least one app to unlock."); return; }
    const cost = parseInt(pointCost) || 0;
    const mins = parseInt(minutesGranted) || 0;
    if (cost <= 0) { Alert.alert("Points", "Set a point cost greater than 0."); return; }
    if (mins <= 0) { Alert.alert("Minutes", "Set minutes granted greater than 0."); return; }
    const rule: AppRewardRule = {
      id: uid(),
      label: label.trim(),
      appIds: selectedApps,
      pointCost: cost,
      minutesGranted: mins,
      active: true,
      createdAt: nowIso(),
    };
    dispatch({ type: "APP_REWARD_RULE_ADD", kidId, rule });
    setLabel(""); setSelectedApps([]); setPointCost("10"); setMinutesGranted("30");
    setShowAdd(false);
  }

  // Show active sessions for this kid
  const activeSessions = (kid?.appUnlockSessions ?? []).filter(s => s.active);

  return (
    <View>
      <View style={rw.intro}>
        <Text style={rw.introTitle}>⭐ App Rewards</Text>
        <Text style={rw.introText}>
          Let your child spend their behavior points to unlock apps for a set time.
          You choose which apps, how many points it costs, and how long they get.
        </Text>
      </View>

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <View style={rw.sessionBox}>
          <Text style={rw.sessionTitle}>🔓 Currently Active</Text>
          {activeSessions.map(s => (
            <View key={s.id} style={rw.sessionRow}>
              <Text style={rw.sessionName}>{s.ruleName}</Text>
              <Text style={rw.sessionTime}>{Math.ceil(s.secondsRemaining / 60)}m left</Text>
            </View>
          ))}
        </View>
      )}

      {/* Existing rules */}
      {rules.length === 0 && !showAdd ? (
        <View style={rw.empty}>
          <Text style={{ fontSize: 48 }}>⭐</Text>
          <Text style={rw.emptyText}>No reward rules yet</Text>
          <Text style={rw.emptySub}>Create rules so kids can spend points to unlock apps.</Text>
        </View>
      ) : (
        rules.map(rule => (
          <View key={rule.id} style={rw.ruleCard}>
            <View style={rw.ruleHeader}>
              <Text style={rw.ruleLabel}>{rule.label}</Text>
              <Switch
                value={rule.active}
                onValueChange={v => dispatch({ type: "APP_REWARD_RULE_UPDATE", kidId, ruleId: rule.id, payload: { active: v } })}
                trackColor={{ true: Colors.primary }}
              />
            </View>
            <Text style={rw.ruleApps}>
              {rule.appIds.map(id => `${APP_CATALOG[id]?.emoji ?? "📱"} ${APP_CATALOG[id]?.name ?? id}`).join(", ")}
            </Text>
            <View style={rw.ruleStats}>
              <View style={rw.statPill}>
                <Text style={rw.statNum}>{rule.pointCost}</Text>
                <Text style={rw.statLabel}>pts</Text>
              </View>
              <Text style={rw.arrow}>→</Text>
              <View style={rw.statPill}>
                <Text style={rw.statNum}>{rule.minutesGranted}</Text>
                <Text style={rw.statLabel}>min</Text>
              </View>
              <Text style={rw.rate}>({(rule.pointCost / rule.minutesGranted).toFixed(1)} pts/min)</Text>
            </View>
            <TouchableOpacity
              style={rw.deleteBtn}
              onPress={() => Alert.alert("Delete rule?", `Remove "${rule.label}"?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "APP_REWARD_RULE_REMOVE", kidId, ruleId: rule.id }) },
              ])}
            >
              <Text style={rw.deleteBtnText}>🗑 Remove</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity style={rw.addBtn} onPress={() => setShowAdd(true)}>
        <Text style={rw.addBtnText}>+ Add Reward Rule</Text>
      </TouchableOpacity>

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={rw.modalOverlay}>
          <ScrollView style={rw.modalSheet} keyboardShouldPersistTaps="handled">
            <Text style={rw.modalTitle}>⭐ New Reward Rule</Text>

            <Text style={rw.fieldLabel}>Rule Name</Text>
            <TextInput
              style={rw.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Gaming Time, YouTube Break"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={rw.fieldLabel}>Apps to Unlock</Text>
            <Text style={rw.fieldSub}>Choose from {kid?.profile.name ?? "kid"}'s installed apps</Text>
            {installedApps.length === 0 ? (
              <Text style={rw.noAppsHint}>No apps installed. Add apps in the Apps section first.</Text>
            ) : (
              <View style={rw.appGrid}>
                {installedApps.map(appId => {
                  const app = APP_CATALOG[appId];
                  if (!app) return null;
                  const sel = selectedApps.includes(appId);
                  return (
                    <TouchableOpacity
                      key={appId}
                      style={[rw.appChip, sel && rw.appChipSel]}
                      onPress={() => toggleApp(appId)}
                    >
                      <Text style={{ fontSize: 20 }}>{app.emoji}</Text>
                      <Text style={[rw.appChipText, sel && { color: "#fff" }]} numberOfLines={1}>{app.name}</Text>
                      {sel && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={rw.fieldLabel}>Point Cost (per unlock)</Text>
            <View style={rw.numRow}>
              {[5, 10, 20, 50].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[rw.numBtn, pointCost === String(n) && rw.numBtnActive]}
                  onPress={() => setPointCost(String(n))}
                >
                  <Text style={[rw.numBtnText, pointCost === String(n) && { color: "#fff" }]}>{n}</Text>
                </TouchableOpacity>
              ))}
              <PointsInput
                inputStyle={rw.numInput}
                value={pointCost}
                onChangeText={setPointCost}
                placeholder="pts"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <Text style={rw.fieldLabel}>Minutes Granted (per unlock)</Text>
            <View style={rw.numRow}>
              {[15, 30, 45, 60].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[rw.numBtn, minutesGranted === String(n) && rw.numBtnActive]}
                  onPress={() => setMinutesGranted(String(n))}
                >
                  <Text style={[rw.numBtnText, minutesGranted === String(n) && { color: "#fff" }]}>{n}m</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={rw.numInput}
                value={minutesGranted}
                onChangeText={setMinutesGranted}
                keyboardType="number-pad"
                placeholder="min"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Preview */}
            {parseInt(pointCost) > 0 && parseInt(minutesGranted) > 0 && (
              <View style={rw.preview}>
                <Text style={rw.previewText}>
                  Child spends <Text style={{ fontWeight: "800", color: Colors.primary }}>{pointCost} pts</Text>
                  {" → "}gets <Text style={{ fontWeight: "800", color: Colors.success }}>{minutesGranted} min</Text>
                  {" "}of{selectedApps.length > 0 ? " " + selectedApps.map(a => APP_CATALOG[a]?.name ?? a).join(", ") : " selected apps"}
                </Text>
              </View>
            )}

            <View style={rw.modalBtns}>
              <TouchableOpacity style={rw.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={rw.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={rw.saveBtn} onPress={addRule}>
                <Text style={rw.saveText}>Create Rule ✓</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Study Mode Break Styles ──────────────────────────────────────────────────
const sm = StyleSheet.create({
  breakHint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  breakBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  breakDurationBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.full,
    backgroundColor: "#10B981" + "18", borderWidth: 1.5, borderColor: "#10B981",
  },
  breakDurationText: { fontSize: FontSize.sm, fontWeight: "700", color: "#10B981" },
  breakBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: Spacing.sm },
  breakEmoji: { fontSize: 32 },
  breakTitle: { fontSize: FontSize.base, fontWeight: "800", color: "#10B981" },
  breakSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  endBreakBtn: {
    alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.error,
  },
  endBreakText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.error },
});

const rw = StyleSheet.create({
  intro: { backgroundColor: Colors.secondary + "20", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: 6 },
  introTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  introText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  sessionBox: { backgroundColor: Colors.success + "15", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: 6 },
  sessionTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success, marginBottom: 4 },
  sessionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionName: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  sessionTime: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyText: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  ruleCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm, gap: 8,
  },
  ruleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ruleLabel: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  ruleApps: { fontSize: FontSize.sm, color: Colors.textSecondary },
  ruleStats: { flexDirection: "row", alignItems: "center", gap: 8 },
  statPill: { backgroundColor: Colors.primary + "15", borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  statNum: { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary },
  statLabel: { fontSize: 10, color: Colors.textSecondary, textTransform: "uppercase" },
  arrow: { fontSize: 20, color: Colors.textMuted },
  rate: { fontSize: FontSize.xs, color: Colors.textMuted },
  deleteBtn: { backgroundColor: Colors.error + "15", borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  deleteBtnText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.error },
  addBtn: { alignSelf: "center", backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 28, paddingVertical: 12, ...Shadow.sm, marginTop: 8 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: Colors.surfaceLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: "92%" },
  modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md, textAlign: "center" },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  fieldSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 8, marginTop: -4 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: FontSize.base, color: Colors.textPrimary },
  noAppsHint: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: "italic", marginBottom: 8 },
  appGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  appChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: "transparent" },
  appChipSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  appChipText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textPrimary },
  numRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  numBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  numBtnActive: { backgroundColor: Colors.primary },
  numBtnText: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.sm },
  numInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: FontSize.sm, width: 70, color: Colors.textPrimary },
  preview: { backgroundColor: Colors.primary + "10", borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  previewText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22, textAlign: "center" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.sm },
  saveText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});

// ─── Sub-components ──────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function SectionHeader({ emoji, title, color }: { emoji: string; title: string; color: string }) {
  return (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
  );
}

function InfoBox({ emoji, text, color }: { emoji: string; text: string; color: string }) {
  return (
    <View style={[styles.infoBox, { borderColor: color + "40", backgroundColor: color + "10" }]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={[styles.infoText, { color }]}>{text}</Text>
    </View>
  );
}

function Row({ label, sub }: { label: string; sub?: string }) {
  return (
    <View>
      <Text style={styles.cardTitle}>{label}</Text>
      {sub && <Text style={[styles.cardSub, { fontSize: 20, fontWeight: "800", color: Colors.primary, marginTop: 4 }]}>{sub}</Text>}
    </View>
  );
}

function BtnRow({ onAdjust }: { onAdjust: (delta: number) => void }) {
  return (
    <View style={styles.btnRow}>
      {[-60, -30, -15].map(d => (
        <TouchableOpacity
          key={d}
          style={styles.adjustBtn}
          onPress={() => onAdjust(d)}
          accessibilityLabel={`Subtract ${Math.abs(d)} minutes`}
          accessibilityRole="button"
        >
          <Text style={styles.adjustBtnText}>{d}m</Text>
        </TouchableOpacity>
      ))}
      {[15, 30, 60].map(d => (
        <TouchableOpacity
          key={d}
          style={[styles.adjustBtn, { backgroundColor: Colors.primary + "15" }]}
          onPress={() => onAdjust(d)}
          accessibilityLabel={`Add ${d} minutes`}
          accessibilityRole="button"
        >
          <Text style={[styles.adjustBtnText, { color: Colors.primary }]}>+{d}m</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SwitchRow({ label, sub, value, onChange, color }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; color?: string;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{label}</Text>
        {sub && <Text style={styles.cardSub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: color ?? Colors.primary, false: Colors.cardLight }}
        thumbColor="#fff"
      />
    </View>
  );
}

function TimeRow({ label, value, onEarlier, onLater }: {
  label: string; value: string; onEarlier: () => void; onLater: () => void;
}) {
  return (
    <View style={styles.timeRow}>
      <Text style={styles.cardSub}>{label}</Text>
      <View style={styles.timeControls}>
        <TouchableOpacity style={styles.timeBtn} onPress={onEarlier}>
          <Text style={styles.timeBtnText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.timeValue}>{value}</Text>
        <TouchableOpacity style={styles.timeBtn} onPress={onLater}>
          <Text style={styles.timeBtnText}>▶</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function shiftTime(time: string, deltaMin: number, onResult: (t: string) => void) {
  const [h, m] = time.split(":").map(Number);
  const total = ((h * 60 + m + deltaMin) % (24 * 60) + 24 * 60) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  onResult(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`);
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  kidTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidTabActive: { backgroundColor: Colors.primary },
  kidTabText: { fontWeight: "600", color: Colors.textSecondary },
  kidTabTextActive: { color: "#fff" },
  tabBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.lg,
    backgroundColor: Colors.cardLight, marginRight: 8, alignItems: "center",
    borderWidth: 1.5, borderColor: "transparent", gap: 2,
  },
  tabLabel: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4, borderLeftWidth: 3, paddingLeft: 10 },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: "800" },
  infoBox: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, marginBottom: 14 },
  infoText: { flex: 1, fontSize: FontSize.sm, fontWeight: "500", lineHeight: 20 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  filterBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.cardLight, gap: 2 },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterBtnText: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.sm },
  filterBtnTextActive: { color: "#fff" },
  filterBtnSub: { fontSize: 10, color: Colors.textMuted },
  btnRow: { flexDirection: "row", gap: 6, marginTop: 10, justifyContent: "center" },
  adjustBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  adjustBtnText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  timeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 4 },
  timeControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  timeBtnText: { color: Colors.primary, fontWeight: "700" },
  timeValue: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary, minWidth: 52, textAlign: "center" },
  dayLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8 },
  dayRow: { flexDirection: "row", gap: 6 },
  dayBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  dayBtnActive: { backgroundColor: Colors.primary },
  dayBtnText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  tipBox: { backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.sm, gap: 6 },
  tipTitle: { fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  tipText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  warnBtn: { marginTop: 12, backgroundColor: Colors.warning + "20", borderRadius: Radius.md, padding: 12, alignItems: "center" },
  warnBtnText: { fontWeight: "700", color: Colors.warning },
  empty: { textAlign: "center", color: Colors.textSecondary, marginTop: Spacing.xl },
  freeModeCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.cardLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: 14,
    borderWidth: 2, borderColor: "transparent",
  },
  freeModeCardOn: { backgroundColor: "#D1FAE5", borderColor: "#34D399" },
  freeModeTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: 2 },
  freeModeSub: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  freeModeMessage: { backgroundColor: "#FEF3C7", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 16, alignItems: "center" },
  freeModeMessageText: { fontSize: FontSize.sm, color: "#92400E", textAlign: "center", lineHeight: 20 },
});
