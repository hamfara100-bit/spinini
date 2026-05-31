/**
 * DNS/Web Filter — parent configuration screen.
 * Controls the per-kid VPN-based DNS filter that blocks domains
 * by category and enforces Safe Search on Google, Bing, and YouTube.
 */

import React, { useState } from "react";
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, TextInput, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Spacing } from "../../../lib/theme";
import type { KidState, WebFilterConfig } from "../../../lib/data/types";

type CategoryKey = keyof Pick<WebFilterConfig,
  "blockAdult" | "blockGambling" | "blockViolence" | "blockDrugs" | "blockSocialMedia" | "blockGaming">;

const CATEGORIES: { key: CategoryKey; emoji: string; label: string; desc: string }[] = [
  { key: "blockAdult",       emoji: "🔞", label: "Adult / Explicit",  desc: "Pornography, adult dating, explicit images" },
  { key: "blockGambling",    emoji: "🎰", label: "Gambling",          desc: "Online casinos, betting sites" },
  { key: "blockViolence",    emoji: "🩸", label: "Violence / Gore",   desc: "Shock sites, graphic violence" },
  { key: "blockDrugs",       emoji: "💊", label: "Drugs & Alcohol",   desc: "Drug purchase sites, pro-drug content" },
  { key: "blockSocialMedia", emoji: "📱", label: "Social Media",      desc: "Instagram, TikTok, Snapchat, X (Twitter)" },
  { key: "blockGaming",      emoji: "🎮", label: "Gaming Sites",      desc: "Online game portals, gaming news" },
];

function KidFilterCard({ kid }: { kid: KidState }) {
  const { dispatch } = useData();
  const filter = kid.rules.webFilter ?? {
    enabled: false, blockAdult: true, blockGambling: true, blockViolence: false,
    blockDrugs: true, blockSocialMedia: false, blockGaming: false,
    customBlocklist: [], customAllowlist: [], safeModeSearch: true, vpnStarted: false,
  };

  const [newBlock, setNewBlock] = useState("");
  const [newAllow, setNewAllow] = useState("");

  function update(patch: Partial<WebFilterConfig>) {
    dispatch({ type: "WEB_FILTER_UPDATE", kidId: kid.profile.id, payload: patch });
  }

  function addDomain(list: "customBlocklist" | "customAllowlist", domain: string) {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (!clean) return;
    const current = filter[list] ?? [];
    if (current.includes(clean)) return;
    update({ [list]: [...current, clean] });
  }

  function removeDomain(list: "customBlocklist" | "customAllowlist", domain: string) {
    update({ [list]: (filter[list] ?? []).filter(d => d !== domain) });
  }

  return (
    <View style={s.kidCard}>
      {/* Header with master switch */}
      <View style={s.kidHeader}>
        <View>
          <Text style={s.kidName}>{kid.profile.name}</Text>
          <Text style={s.kidSub}>{filter.enabled ? "DNS filter active" : "Filter off"}</Text>
        </View>
        <Switch
          value={filter.enabled}
          onValueChange={val => update({ enabled: val })}
          trackColor={{ true: Colors.primary }}
        />
      </View>

      {filter.enabled && (
        <>
          {/* Safe Search */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>🔍 Safe Search</Text>
              <Text style={s.rowSub}>Force safe mode on Google, Bing & YouTube</Text>
            </View>
            <Switch
              value={filter.safeModeSearch}
              onValueChange={val => update({ safeModeSearch: val })}
              trackColor={{ true: Colors.primary }}
            />
          </View>

          {/* Category toggles */}
          <Text style={s.sectionLabel}>Block Categories</Text>
          {CATEGORIES.map(cat => (
            <View key={cat.key} style={s.row}>
              <Text style={s.catEmoji}>{cat.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{cat.label}</Text>
                <Text style={s.rowSub}>{cat.desc}</Text>
              </View>
              <Switch
                value={filter[cat.key] as boolean}
                onValueChange={val => update({ [cat.key]: val })}
                trackColor={{ true: Colors.primary }}
              />
            </View>
          ))}

          {/* Custom blocklist */}
          <Text style={s.sectionLabel}>Block Specific Sites</Text>
          {(filter.customBlocklist ?? []).map(d => (
            <View key={d} style={s.domainRow}>
              <Text style={s.domainText}>🚫 {d}</Text>
              <TouchableOpacity onPress={() => removeDomain("customBlocklist", d)}>
                <Text style={s.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={s.addRow}>
            <TextInput
              style={s.domainInput}
              placeholder="example.com"
              value={newBlock}
              onChangeText={setNewBlock}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={s.addBtn} onPress={() => { addDomain("customBlocklist", newBlock); setNewBlock(""); }}>
              <Text style={s.addBtnText}>Block</Text>
            </TouchableOpacity>
          </View>

          {/* Custom allowlist */}
          <Text style={s.sectionLabel}>Always Allow</Text>
          {(filter.customAllowlist ?? []).map(d => (
            <View key={d} style={s.domainRow}>
              <Text style={s.domainText}>✅ {d}</Text>
              <TouchableOpacity onPress={() => removeDomain("customAllowlist", d)}>
                <Text style={s.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={s.addRow}>
            <TextInput
              style={s.domainInput}
              placeholder="school.edu"
              value={newAllow}
              onChangeText={setNewAllow}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={[s.addBtn, { backgroundColor: "#16A34A" }]} onPress={() => { addDomain("customAllowlist", newAllow); setNewAllow(""); }}>
              <Text style={s.addBtnText}>Allow</Text>
            </TouchableOpacity>
          </View>

          <View style={s.vpnNote}>
            <Text style={s.vpnNoteText}>
              ⚠️ DNS filtering requires the kid's device to have the Spinini VPN profile installed. Go to <Text style={{ fontWeight: "700" }}>Kid App → Settings → Web Filter Setup</Text> to activate it.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

export default function DnsFilterScreen() {
  const { state } = useData();
  const router = useRouter();

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🌐 Web Filter</Text>
      <Text style={s.sub}>Block websites by category or domain. Works even in private/incognito mode.</Text>

      {/* Quick link to site allowlist */}
      <TouchableOpacity style={s.allowlistLink} onPress={() => router.push("/parent/(more)/web-allowlist" as any)}>
        <Text style={s.allowlistLinkText}>✅ Manage Allowed Sites (Allowlist) →</Text>
      </TouchableOpacity>

      <HowItWorks />

      {state.kids.length === 0 ? (
        <View style={s.empty}><Text style={s.emptyText}>No kids added yet.</Text></View>
      ) : (
        state.kids.map(kid => <KidFilterCard key={kid.profile.id} kid={kid} />)
      )}
    </ScreenContainer>
  );
}

function HowItWorks() {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity style={s.howBox} onPress={() => setExpanded(e => !e)}>
      <Text style={s.howTitle}>How it works {expanded ? "▲" : "▼"}</Text>
      {expanded && (
        <Text style={s.howText}>
          {`1. A local VPN profile on the kid's device intercepts all DNS lookups.\n`}
          {`2. Blocked domains return no result — the website simply can't load.\n`}
          {`3. Safe Search is enforced by redirecting Google/Bing/YouTube DNS to their restricted variants.\n`}
          {`4. Works in ALL browsers including Chrome incognito.\n`}
          {`5. All filtering happens on-device — no traffic is routed through our servers.`}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  empty: { padding: Spacing.xl, alignItems: "center" },
  emptyText: { color: Colors.textMuted },
  howBox: { backgroundColor: "#EFF6FF", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  howTitle: { fontSize: FontSize.sm, fontWeight: "700", color: "#1E40AF" },
  howText: { fontSize: FontSize.xs, color: "#1E3A5F", marginTop: 8, lineHeight: 20 },
  kidCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  kidHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kidName: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  kidSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  catEmoji: { fontSize: 20 },
  rowLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  rowSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  domainRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.cardLight, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  domainText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  removeBtn: { fontSize: 16, color: Colors.error, fontWeight: "700", padding: 4 },
  addRow: { flexDirection: "row", gap: 8 },
  domainInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 8, fontSize: FontSize.sm, backgroundColor: Colors.surfaceLight },
  addBtn: { backgroundColor: Colors.error, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8, justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  vpnNote: { backgroundColor: "#FFFBEB", borderRadius: Radius.md, padding: Spacing.sm },
  vpnNoteText: { fontSize: FontSize.xs, color: "#92400E", lineHeight: 18 },
  allowlistLink: { backgroundColor: "#ECFDF5", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: "#86EFAC" },
  allowlistLinkText: { fontSize: FontSize.sm, fontWeight: "700", color: "#15803D" },
});
