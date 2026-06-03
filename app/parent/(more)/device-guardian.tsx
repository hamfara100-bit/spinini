import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Alert, Platform, TextInput, RefreshControl,
} from "react-native";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import {
  getGuardianStatus, requestUsageStatsPermission, requestAccessibilityPermission,
  requestDeviceAdminPermission, getUsageStats, getBlockedAttempts,
  startVpn, stopVpn, openMdmEnrollment,
} from "../../../modules/expo-device-guardian/src/index";
import type {
  GuardianStatus, UsageStats, BlockedAttempt, VpnConfig,
} from "../../../modules/expo-device-guardian/src/types";
import { useData } from "../../../lib/data/store";

type Tab = "status" | "vpn" | "mdm" | "monitor";

const TABS: { id: Tab; emoji: string; label: string; color: string }[] = [
  { id: "status",  emoji: "🛡️", label: "OS Controls", color: "#7C5CFF" },
  { id: "vpn",     emoji: "🌐", label: "VPN / DNS",   color: "#10B981" },
  { id: "mdm",     emoji: "🏢", label: "MDM",         color: "#F59E0B" },
  { id: "monitor", emoji: "📊", label: "Monitor",     color: "#3B82F6" },
];

const IS_ANDROID = Platform.OS === "android";
const IS_IOS = Platform.OS === "ios";

const MDM_PROVIDERS = [
  { name: "Jamf School",       url: "https://school.jamfcloud.com", emoji: "🏫", desc: "Best for K-12 schools" },
  { name: "Microsoft Intune",  url: "https://intune.microsoft.com", emoji: "🔷", desc: "Enterprise-grade MDM" },
  { name: "Apple School Mgr", url: "https://school.apple.com",     emoji: "🍎", desc: "iOS/iPadOS only" },
  { name: "VMware Workspace",  url: "https://ws1.vmware.com",       emoji: "☁️", desc: "Cross-platform MDM" },
];

const FAMILY_DNS = [
  { label: "Cloudflare Family",  dns: "1.1.1.3",          desc: "Blocks malware + adult content" },
  { label: "CleanBrowsing",      dns: "185.228.168.9",    desc: "Strict family filter" },
  { label: "OpenDNS Family",     dns: "208.67.222.123",   desc: "Customizable blocklists" },
  { label: "Google Safe DNS",    dns: "8.8.4.4",           desc: "Standard safe DNS" },
];

export default function DeviceGuardianScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<Tab>("status");
  const [status, setStatus] = useState<GuardianStatus | null>(null);
  const [usage, setUsage] = useState<UsageStats[]>([]);
  const [blocked, setBlocked] = useState<BlockedAttempt[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [vpnConfig, setVpnConfig] = useState<VpnConfig>({
    enabled: false,
    blocklistCategories: ["explicit", "violence", "gambling"],
    customBlockedDomains: [],
    customAllowedDomains: [],
    dnsServer: "1.1.1.3",
  });
  const [customDomain, setCustomDomain] = useState("");
  const [mdmUrl, setMdmUrl] = useState("");
  const [notifAccess, setNotifAccess] = useState(false);

  const isNativeAvailable = Platform.OS !== "web";

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, u, b] = await Promise.all([
        getGuardianStatus(),
        getUsageStats(Date.now() - 86400000), // last 24h
        getBlockedAttempts(),
      ]);
      setStatus(s);
      setUsage(u.sort((a, b2) => b2.totalMinutes - a.totalMinutes));
      setBlocked(b.sort((a, b2) => new Date(b2.blockedAt).getTime() - new Date(a.blockedAt).getTime()));
      try {
        const { AppMonitor } = await import("expo-app-monitor");
        setNotifAccess(AppMonitor.isNotificationAccessEnabled());
      } catch {}
    } catch {
      // no-op on Expo Go
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function toggleCategory(cat: string) {
    const cats = vpnConfig.blocklistCategories.includes(cat)
      ? vpnConfig.blocklistCategories.filter(c => c !== cat)
      : [...vpnConfig.blocklistCategories, cat];
    setVpnConfig(v => ({ ...v, blocklistCategories: cats }));
  }

  async function toggleVpn() {
    if (vpnConfig.enabled) {
      await stopVpn();
      setVpnConfig(v => ({ ...v, enabled: false }));
      setStatus(s => s ? { ...s, vpnActive: false } : s);
    } else {
      const ok = await startVpn({ ...vpnConfig, enabled: true });
      if (ok) {
        setVpnConfig(v => ({ ...v, enabled: true }));
        setStatus(s => s ? { ...s, vpnActive: true } : s);
      } else {
        Alert.alert("VPN Error", "Could not start VPN. Make sure VPN permission has been granted.");
      }
    }
  }

  function addBlockedDomain() {
    const d = customDomain.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "");
    if (!d || vpnConfig.customBlockedDomains.includes(d)) return;
    setVpnConfig(v => ({ ...v, customBlockedDomains: [...v.customBlockedDomains, d] }));
    setCustomDomain("");
  }

  function removeBlockedDomain(d: string) {
    setVpnConfig(v => ({ ...v, customBlockedDomains: v.customBlockedDomains.filter(x => x !== d) }));
  }

  const activeCount = status ? [
    status.usageStatsGranted || status.screenTimeAuthorized,
    status.accessibilityEnabled || status.contentFilterEnabled,
    status.vpnActive,
    status.deviceAdminActive,
  ].filter(Boolean).length : 0;

  const protectionLevel = activeCount >= 3 ? "Strong" : activeCount >= 2 ? "Moderate" : activeCount >= 1 ? "Basic" : "None";
  const protectionColor = activeCount >= 3 ? Colors.success : activeCount >= 2 ? Colors.warning : Colors.error;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🛡️ Device Guardian</Text>
          <Text style={styles.subtitle}>OS-level controls when not in kiosk mode</Text>
        </View>
        {status && (
          <View style={[styles.levelBadge, { backgroundColor: protectionColor + "20" }]}>
            <Text style={[styles.levelText, { color: protectionColor }]}>{protectionLevel}</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >

        {/* ─── OS CONTROLS ────────────────────────────── */}
        {tab === "status" && (
          <>
            {!isNativeAvailable && (
              <InfoBox
                emoji="ℹ️"
                color="#3B82F6"
                text="Native OS controls require a custom build — they are unavailable in Expo Go. The UI and settings are fully functional; permissions will activate when built with EAS Build."
              />
            )}

            {IS_ANDROID && (
              <>
                <SectionHeader emoji="🤖" title="Android Controls" color="#34D399" />

                <PermRow
                  emoji="📊"
                  label="Usage Stats Access"
                  sub="Read per-app screen time (required for monitoring)"
                  active={status?.usageStatsGranted ?? false}
                  onEnable={async () => {
                    await requestUsageStatsPermission();
                    refresh();
                  }}
                  howTo="Settings → Apps → Special App Access → Usage Access → enable this app"
                />

                <PermRow
                  emoji="♿"
                  label="Accessibility Service"
                  sub="Detect & block foreground apps in real time"
                  active={status?.accessibilityEnabled ?? false}
                  onEnable={async () => {
                    await requestAccessibilityPermission();
                    refresh();
                  }}
                  howTo="Settings → Accessibility → Downloaded Apps → FamilyGuard → enable"
                />

                <PermRow
                  emoji="🔔"
                  label="Notification Access (bad-word alarm)"
                  sub="Scan incoming notifications for bad words & alarm the parent"
                  active={notifAccess}
                  onEnable={async () => {
                    try {
                      const { AppMonitor } = await import("expo-app-monitor");
                      AppMonitor.openNotificationAccessSettings();
                    } catch {}
                  }}
                  howTo="Settings → Notifications → Notification access / Device & app notifications → enable Spinini"
                />

                <PermRow
                  emoji="👑"
                  label="Device Administrator"
                  sub="Enforce lock screen, disable cameras, wipe device"
                  active={status?.deviceAdminActive ?? false}
                  onEnable={async () => {
                    const ok = await requestDeviceAdminPermission();
                    if (!ok) Alert.alert("Denied", "Device admin permission was not granted.");
                    else refresh();
                  }}
                  howTo="Tap Enable → Activate Device Administrator in the system dialog"
                />

                <Card>
                  <Text style={styles.cardTitle}>📋 What each permission does</Text>
                  <BulletList items={[
                    "Usage Stats → see which apps are used and for how long",
                    "Accessibility → detect when a blocked app opens and redirect to home screen",
                    "Device Admin → remotely lock, set password policy, wipe if needed",
                    "VPN (see VPN tab) → filter DNS traffic to block harmful websites",
                  ]} />
                </Card>

                {/* Feature 20: Offline Mode note */}
                <Card>
                  <Text style={styles.cardTitle}>📶 Offline Mode — Works Without Internet</Text>
                  <Text style={[styles.cardSub, { marginTop: 4, lineHeight: 18 }]}>
                    Screen time limits and app blocks enforced via the Accessibility Service work
                    <Text style={{ fontWeight: "700" }}> entirely on-device</Text> — no internet
                    connection needed.{"\n\n"}
                    • Daily limits, bedtime locks, and blocked apps all continue to work when Wi-Fi
                    or mobile data is unavailable.{"\n"}
                    • DNS web filtering requires network connectivity (it intercepts DNS lookups),
                    but app-level blocks remain active offline.{"\n"}
                    • Usage stats are synced to the parent app the next time the kid's device comes
                    online.{"\n\n"}
                    <Text style={{ fontStyle: "italic", color: Colors.textMuted }}>
                      Tip: Kids cannot bypass limits by simply turning off Wi-Fi.
                    </Text>
                  </Text>
                </Card>
              </>
            )}

            {IS_IOS && (
              <>
                <SectionHeader emoji="🍎" title="iOS Screen Time API" color="#007AFF" />

                <PermRow
                  emoji="⏱️"
                  label="Screen Time Authorization"
                  sub="Access Apple's Family Controls framework (iOS 16+)"
                  active={status?.screenTimeAuthorized ?? false}
                  onEnable={async () => {
                    await requestUsageStatsPermission(); // triggers FamilyControls auth on iOS
                    refresh();
                  }}
                  howTo="A system dialog will appear asking for Screen Time permission"
                />

                <PermRow
                  emoji="🚫"
                  label="Content Filter (NetworkExtension)"
                  sub="OS-level URL filtering — blocks sites before they load"
                  active={status?.contentFilterEnabled ?? false}
                  onEnable={async () => {
                    await startVpn(vpnConfig);
                    refresh();
                  }}
                  howTo="Tap Enable — the system will prompt to allow the Network Extension"
                />

                {status?.screenTimeAuthorized && (
                  <>
                    <SectionHeader emoji="🚫" title="App Category Blocking" color="#007AFF" />
                    <Card>
                      <Text style={styles.cardSub} numberOfLines={2}>
                        Block entire app categories using ManagedSettings. Tap a category to toggle.
                      </Text>
                      {(["games","social","entertainment","education","utilities"] as const).map(cat => {
                        const active = (state.parentSettings as any).blockedCategories?.includes(cat);
                        return (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.rowBetween, { marginTop: 10 }]}
                            onPress={async () => {
                              const current: string[] = (state.parentSettings as any).blockedCategories ?? [];
                              const next = active ? current.filter(c => c !== cat) : [...current, cat];
                              dispatch({ type: "SET_PARENT_SETTINGS", payload: { blockedCategories: next } as any });
                              const { setAppCategoryBlocks } = await import("../../../modules/expo-device-guardian/src/index");
                              await setAppCategoryBlocks(next).catch(() => {});
                            }}
                          >
                            <Text style={styles.cardTitle}>{
                              { games: "🎮 Games", social: "💬 Social Media", entertainment: "🎬 Entertainment", education: "📚 Education", utilities: "🔧 Utilities" }[cat]
                            }</Text>
                            <Switch
                              value={active}
                              onValueChange={() => {}}
                              trackColor={{ true: "#007AFF" }}
                              thumbColor="#fff"
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </Card>

                    <SectionHeader emoji="🌙" title="Downtime Schedule" color="#007AFF" />
                    <Card>
                      <Text style={styles.cardSub}>
                        Block all apps during scheduled downtime (e.g. bedtime, school hours). Configured per-kid in Rules → Downtime.
                      </Text>
                      <TouchableOpacity
                        style={[styles.vpnToggle, { backgroundColor: "#007AFF", marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 20 }]}
                        onPress={async () => {
                          const { setDowntimeSchedule } = await import("../../../modules/expo-device-guardian/src/index");
                          // Default: 9pm–7am downtime — parent configures per-kid in Rules
                          await setDowntimeSchedule(21, 0, 7, 0).catch(() => {});
                          Alert.alert("Downtime Scheduled", "Downtime set for 9:00 PM – 7:00 AM daily. Configure per-kid times in Rules → Downtime.");
                        }}
                      >
                        <Text style={styles.vpnToggleText}>Apply Downtime Schedule</Text>
                      </TouchableOpacity>
                    </Card>
                  </>
                )}

                <Card>
                  <Text style={styles.cardTitle}>📋 iOS capability summary</Text>
                  <BulletList items={[
                    "Screen Time API → block specific apps by Bundle ID without kiosk mode",
                    "ManagedSettings → restrict app categories (e.g. all social media)",
                    "DeviceActivity → schedule downtime windows (e.g. bedtime 9pm–7am)",
                    "NetworkExtension → intercept and filter all network traffic on-device",
                    status?.screenTimeAuthorized
                      ? "✅ FamilyControls authorized — all controls active"
                      : "⏳ Pending entitlement approval from Apple",
                  ]} />
                </Card>
              </>
            )}

            {!IS_ANDROID && !IS_IOS && (
              <Card>
                <Text style={[styles.cardTitle, { textAlign: "center", marginBottom: 8 }]}>
                  Running on Expo Go / Simulator
                </Text>
                <Text style={[styles.cardSub, { textAlign: "center" }]}>
                  Build with EAS Build to enable native OS controls. All settings saved here will apply automatically in the production build.
                </Text>
              </Card>
            )}
          </>
        )}

        {/* ─── VPN / DNS ──────────────────────────────── */}
        {tab === "vpn" && (
          <>
            <InfoBox
              emoji="🌐"
              color="#10B981"
              text="The on-device VPN acts as a local DNS proxy. It intercepts DNS queries and returns NXDOMAIN (not found) for blocked domains — no traffic leaves the device. No account or server needed."
            />

            <SectionHeader emoji="⚡" title="VPN Status" color="#10B981" />
            <Card>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>FamilyGuard VPN</Text>
                  <Text style={styles.cardSub}>
                    {status?.vpnActive ? "🟢 Active — DNS filtering is on" : "⚫ Inactive — no DNS filtering"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.vpnToggle, { backgroundColor: status?.vpnActive ? Colors.error : Colors.success }]}
                  onPress={toggleVpn}
                >
                  <Text style={styles.vpnToggleText}>{status?.vpnActive ? "Stop" : "Start"}</Text>
                </TouchableOpacity>
              </View>
            </Card>

            <SectionHeader emoji="🧱" title="Block Categories" color="#EF4444" />
            <Card>
              {[
                { id: "explicit",  emoji: "🔞", label: "Explicit / Adult",  sub: "Pornography and adult content" },
                { id: "violence",  emoji: "💢", label: "Violence & Gore",   sub: "Graphic violence websites" },
                { id: "gambling",  emoji: "🎰", label: "Gambling",          sub: "Online betting and casinos" },
                { id: "ads",       emoji: "📢", label: "Ads & Trackers",    sub: "Ad networks and tracking pixels" },
              ].map((cat, i, arr) => (
                <React.Fragment key={cat.id}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{cat.emoji} {cat.label}</Text>
                      <Text style={styles.cardSub}>{cat.sub}</Text>
                    </View>
                    <Switch
                      value={vpnConfig.blocklistCategories.includes(cat.id)}
                      onValueChange={() => toggleCategory(cat.id)}
                      trackColor={{ true: "#EF4444" }}
                      thumbColor="#fff"
                    />
                  </View>
                  {i < arr.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </Card>

            <SectionHeader emoji="🔗" title="Family DNS Server" color="#10B981" />
            <Card>
              <Text style={styles.cardSub}>Choose an upstream DNS that already filters harmful content:</Text>
              {FAMILY_DNS.map((d, i, arr) => (
                <React.Fragment key={d.dns}>
                  <TouchableOpacity
                    style={styles.rowBetween}
                    onPress={() => setVpnConfig(v => ({ ...v, dnsServer: d.dns }))}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{d.label}</Text>
                      <Text style={styles.cardSub}>{d.desc} — {d.dns}</Text>
                    </View>
                    <View style={[styles.radio, vpnConfig.dnsServer === d.dns && styles.radioActive]} />
                  </TouchableOpacity>
                  {i < arr.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </Card>

            <SectionHeader emoji="🚫" title="Custom Blocked Domains" color="#EF4444" />
            <Card>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="domain.com"
                  value={customDomain}
                  onChangeText={setCustomDomain}
                  onSubmitEditing={addBlockedDomain}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity style={styles.addBtn} onPress={addBlockedDomain}>
                  <Text style={styles.addBtnText}>+ Block</Text>
                </TouchableOpacity>
              </View>
              {vpnConfig.customBlockedDomains.length === 0 ? (
                <Text style={[styles.cardSub, { marginTop: 8, textAlign: "center" }]}>No custom domains blocked yet</Text>
              ) : (
                vpnConfig.customBlockedDomains.map(d => (
                  <View key={d} style={styles.domainRow}>
                    <Text style={styles.domainText}>🚫 {d}</Text>
                    <TouchableOpacity onPress={() => removeBlockedDomain(d)}>
                      <Text style={{ color: Colors.error, fontWeight: "700", fontSize: 16 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        {/* ─── MDM ───────────────────────────────────── */}
        {tab === "mdm" && (
          <>
            <InfoBox
              emoji="🏢"
              color="#F59E0B"
              text="Mobile Device Management (MDM) lets a server remotely enforce policies, install/remove apps, wipe devices, and monitor compliance — even when this app isn't running."
            />

            <SectionHeader emoji="🔑" title="MDM Capabilities" color="#F59E0B" />
            <Card>
              <BulletList items={[
                "📲 Remotely install or remove any app",
                "🔒 Enforce password complexity and lock screen",
                "📍 Track device location from a web dashboard",
                "🧹 Remote wipe if device is lost or stolen",
                "🌐 Push VPN profiles and Wi-Fi configs",
                "📋 Enforce app allowlists (only approved apps can be installed)",
                "⏱️ Set screen time policies across all enrolled devices",
                "🔐 Prevent settings changes (e.g. disable factory reset)",
              ]} />
            </Card>

            <SectionHeader emoji="🏫" title="MDM Providers" color="#F59E0B" />
            {MDM_PROVIDERS.map(p => (
              <Card key={p.name}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{p.emoji} {p.name}</Text>
                    <Text style={styles.cardSub}>{p.desc}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.enrollBtn}
                    onPress={() => openMdmEnrollment(p.url)}
                  >
                    <Text style={styles.enrollBtnText}>Open</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}

            <SectionHeader emoji="🔗" title="Custom MDM Server" color="#F59E0B" />
            <Card>
              <Text style={styles.cardSub}>Enter your MDM enrollment URL:</Text>
              <View style={[styles.inputRow, { marginTop: 10 }]}>
                <TextInput
                  style={styles.input}
                  placeholder="https://mdm.yourcompany.com/enroll"
                  value={mdmUrl}
                  onChangeText={setMdmUrl}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={styles.enrollBtn}
                  onPress={() => mdmUrl ? openMdmEnrollment(mdmUrl) : Alert.alert("Enter a URL first")}
                >
                  <Text style={styles.enrollBtnText}>Enroll</Text>
                </TouchableOpacity>
              </View>
            </Card>

            <SectionHeader emoji="📱" title="Platform Setup Guide" color="#6B7280" />
            <Card>
              <Text style={styles.cardTitle}>Android (Work Profile / Device Owner)</Text>
              <BulletList items={[
                "Factory reset the device for full Device Owner mode, OR",
                "Use Android Enterprise to create a Managed Profile (doesn't require reset)",
                "Scan MDM QR code during device setup, or use NFC tap-to-enroll",
                "Recommended: Samsung Knox (built-in MDM on Samsung devices)",
              ]} />
            </Card>
            <Card>
              <Text style={styles.cardTitle}>iOS (Supervised Mode)</Text>
              <BulletList items={[
                "Use Apple Configurator 2 (Mac) to put device in Supervised Mode",
                "Or enroll via Apple Business Manager / Apple School Manager",
                "Supervised mode required for strongest restrictions (disable Siri, lock Wi-Fi, etc.)",
                "Install MDM profile: Settings → General → VPN & Device Management",
              ]} />
            </Card>
          </>
        )}

        {/* ─── MONITOR ───────────────────────────────── */}
        {tab === "monitor" && (
          <>
            <SectionHeader emoji="📊" title="App Usage — Last 24h" color="#3B82F6" />
            {usage.length === 0 ? (
              <Card>
                <Text style={[styles.cardSub, { textAlign: "center", paddingVertical: 16 }]}>
                  {status?.usageStatsGranted || status?.screenTimeAuthorized
                    ? "No usage data yet for today."
                    : "Enable Usage Stats / Screen Time permission to see app usage."}
                </Text>
              </Card>
            ) : (
              usage.slice(0, 10).map(u => (
                <Card key={u.appId}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{u.appName}</Text>
                    <Text style={[styles.usageTime, { color: u.totalMinutes > 60 ? Colors.error : Colors.success }]}>
                      {u.totalMinutes}m
                    </Text>
                  </View>
                  <View style={styles.usageBar}>
                    <View style={[
                      styles.usageBarFill,
                      { width: `${Math.min(100, (u.totalMinutes / 120) * 100)}%` as any,
                        backgroundColor: u.totalMinutes > 60 ? Colors.error : Colors.primary }
                    ]} />
                  </View>
                  <Text style={styles.cardSub}>Last used: {new Date(u.lastUsed).toLocaleTimeString()}</Text>
                </Card>
              ))
            )}

            <SectionHeader emoji="🚫" title="Blocked Attempts" color="#EF4444" />
            {blocked.length === 0 ? (
              <Card>
                <Text style={[styles.cardSub, { textAlign: "center", paddingVertical: 16 }]}>
                  No blocked attempts recorded yet.
                </Text>
              </Card>
            ) : (
              blocked.slice(0, 20).map((b, i) => (
                <Card key={i}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>🚫 {b.appName}</Text>
                      <Text style={styles.cardSub}>{b.reason}</Text>
                    </View>
                    <Text style={styles.blockedTime}>
                      {new Date(b.blockedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </Card>
              ))
            )}

            {/* Protection summary */}
            <SectionHeader emoji="🔍" title="Protection Summary" color="#7C5CFF" />
            <Card>
              {[
                { label: IS_IOS ? "Screen Time API" : "Usage Stats",    active: status?.usageStatsGranted || status?.screenTimeAuthorized },
                { label: IS_IOS ? "Content Filter" : "App Blocker",     active: status?.accessibilityEnabled || status?.contentFilterEnabled },
                { label: "VPN / DNS Filter",                             active: status?.vpnActive },
                { label: IS_IOS ? "—" : "Device Admin",                 active: status?.deviceAdminActive },
                { label: "Kiosk Mode",                                   active: status?.kioskMode },
              ].filter(x => x.label !== "—").map((item, i, arr) => (
                <React.Fragment key={item.label}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{item.label}</Text>
                    <View style={[styles.statusDot, { backgroundColor: item.active ? Colors.success : Colors.error }]} />
                  </View>
                  {i < arr.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </Card>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

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
    <View style={[styles.infoBox, { borderColor: color + "40", backgroundColor: color + "12" }]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={[styles.infoText, { color }]}>{text}</Text>
    </View>
  );
}
function BulletList({ items }: { items: string[] }) {
  return (
    <View style={{ marginTop: 6, gap: 6 }}>
      {items.map((item, i) => (
        <Text key={i} style={styles.bullet}>{item}</Text>
      ))}
    </View>
  );
}

function PermRow({ emoji, label, sub, active, onEnable, howTo }: {
  emoji: string; label: string; sub: string;
  active: boolean; onEnable: () => void; howTo: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{label}</Text>
              <Text style={styles.cardSub}>{sub}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: active ? Colors.success + "20" : Colors.error + "15" }]}>
          <Text style={[styles.statusBadgeText, { color: active ? Colors.success : Colors.error }]}>
            {active ? "✓ On" : "✗ Off"}
          </Text>
        </View>
      </View>

      {!active && (
        <>
          <TouchableOpacity style={styles.enableBtn} onPress={onEnable}>
            <Text style={styles.enableBtnText}>Enable →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setExpanded(e => !e)} style={{ marginTop: 6 }}>
            <Text style={[styles.cardSub, { color: Colors.primary }]}>
              {expanded ? "▲ Hide instructions" : "▼ How to enable"}
            </Text>
          </TouchableOpacity>
          {expanded && (
            <View style={styles.howToBox}>
              <Text style={styles.howToText}>{howTo}</Text>
            </View>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  levelBadge: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  levelText: { fontWeight: "800", fontSize: FontSize.sm },
  tabBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg,
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
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  enableBtn: { marginTop: 10, backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 10, alignItems: "center" },
  enableBtnText: { color: "#fff", fontWeight: "700" },
  howToBox: { marginTop: 8, backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.sm },
  howToText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  vpnToggle: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.md },
  vpnToggleText: { color: "#fff", fontWeight: "700" },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: 10, fontSize: FontSize.sm, color: Colors.textPrimary },
  addBtn: { backgroundColor: Colors.error, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  domainRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingHorizontal: 4 },
  domainText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border },
  radioActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  enrollBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md },
  enrollBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  bullet: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  usageTime: { fontSize: FontSize.md, fontWeight: "800" },
  usageBar: { height: 6, backgroundColor: Colors.cardLight, borderRadius: 3, marginTop: 8, overflow: "hidden" },
  usageBarFill: { height: "100%", borderRadius: 3 },
  blockedTime: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
});
