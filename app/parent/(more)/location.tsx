import React, { useState, useCallback, useEffect } from "react";
import * as Location from "expo-location";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, Switch, Linking, Platform,
} from "react-native";

// Open the coordinates in Google Maps (falls back to the web map URL).
function openInMaps(lat: number, lng: number, label?: string) {
  const q = label ? `${lat},${lng}(${encodeURIComponent(label)})` : `${lat},${lng}`;
  const url = Platform.select({
    ios: `comgooglemaps://?q=${q}`,
    default: `geo:${lat},${lng}?q=${q}`,
  })!;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {}),
  );
}
import { useRouter } from "expo-router";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import type { LocationReminder, SpeedAlertSettings } from "../../../lib/data/types";

type Tab = "zones" | "reminders" | "speed" | "gpsoff" | "reports";

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── TAB: Safe Zones ─────────────────────────────────────────────────────────
function SafeZonesTab({ selectedKidId }: { selectedKidId: string }) {
  const { state, dispatch } = useData();
  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const [showAdd, setShowAdd] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneEmoji, setZoneEmoji] = useState("🏠");
  const [zoneLat, setZoneLat] = useState("");
  const [zoneLng, setZoneLng] = useState("");
  const [zoneRadius, setZoneRadius] = useState("200");
  const [address, setAddress] = useState<string | null>(null);

  const lat = kid?.lastLocation?.lat;
  const lng = kid?.lastLocation?.lng;

  // Reverse-geocode the last known coordinates into a readable street address.
  useEffect(() => {
    let cancelled = false;
    setAddress(null);
    if (lat == null || lng == null) return;
    (async () => {
      try {
        const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (cancelled || !res?.[0]) return;
        const a = res[0];
        const parts = [
          [a.streetNumber, a.street].filter(Boolean).join(" "),
          a.city || a.subregion,
          a.region,
          a.postalCode,
        ].filter(Boolean);
        setAddress(parts.join(", ") || a.name || null);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);

  const EMOJI_OPTIONS = ["🏠","🏫","🏃","⛪","🏟️","🌳","🏪","🏋️","🎾","🏊","📍","❤️"];

  function addZone() {
    const lat = parseFloat(zoneLat), lng = parseFloat(zoneLng), radius = parseInt(zoneRadius) || 200;
    if (!zoneName.trim() || isNaN(lat) || isNaN(lng)) {
      Alert.alert("Missing info", "Enter a zone name and valid lat/lng."); return;
    }
    dispatch({ type: "SAFE_ZONE_ADD", kidId: selectedKidId, zone: { id: uid(), name: zoneName.trim(), emoji: zoneEmoji, lat, lng, radiusMeters: radius, createdAt: nowIso() } });
    setZoneName(""); setZoneLat(""); setZoneLng(""); setZoneRadius("200"); setZoneEmoji("🏠"); setShowAdd(false);
  }

  if (!kid) return null;

  return (
    <View style={{ gap: 12 }}>
      {/* Last known location */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📡 Last Known Location</Text>
        {kid.lastLocation ? (
          <>
            {address && (
              <View style={styles.addressBox}>
                <Text style={styles.addressIcon}>📍</Text>
                <Text style={styles.addressText}>{address}</Text>
              </View>
            )}
            <View style={styles.coordRow}>
              <View style={styles.coordBox}><Text style={styles.coordLabel}>Latitude</Text><Text style={styles.coordValue}>{kid.lastLocation.lat.toFixed(5)}</Text></View>
              <View style={styles.coordBox}><Text style={styles.coordLabel}>Longitude</Text><Text style={styles.coordValue}>{kid.lastLocation.lng.toFixed(5)}</Text></View>
            </View>
            {kid.lastLocation.accuracy !== undefined && <Text style={styles.accuracy}>± {Math.round(kid.lastLocation.accuracy)}m accuracy</Text>}
            <Text style={styles.timestamp}>🕐 {fmt(kid.lastLocation.timestamp)}</Text>
            <TouchableOpacity
              style={styles.mapsBtn}
              onPress={() => openInMaps(kid.lastLocation!.lat, kid.lastLocation!.lng, `${kid.profile.name}'s location`)}
            >
              <Text style={styles.mapsBtnText}>🗺️ Open in Google Maps</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.noLocationBox}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={styles.noLocationText}>No location data yet</Text>
            <Text style={styles.noLocationSub}>Location updates when {kid.profile.name}'s device is active.</Text>
          </View>
        )}
      </View>

      {/* Safe zones */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🛡️ Safe Zones ({kid.safeZones.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(v => !v)}>
          <Text style={styles.addBtnText}>{showAdd ? "✕ Cancel" : "+ Add Zone"}</Text>
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={styles.form}>
          <Text style={styles.formLabel}>Zone name</Text>
          <TextInput style={styles.input} value={zoneName} onChangeText={setZoneName} placeholder="e.g. Home, School…" />
          <Text style={styles.formLabel}>Emoji</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {EMOJI_OPTIONS.map(e => (
              <TouchableOpacity key={e} style={[styles.emojiBtn, zoneEmoji === e && styles.emojiBtnActive]} onPress={() => setZoneEmoji(e)}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Latitude</Text>
              <TextInput style={styles.input} value={zoneLat} onChangeText={setZoneLat} placeholder="37.7749" keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Longitude</Text>
              <TextInput style={styles.input} value={zoneLng} onChangeText={setZoneLng} placeholder="-122.419" keyboardType="decimal-pad" />
            </View>
          </View>
          {kid.lastLocation && (
            <TouchableOpacity style={styles.prefillBtn} onPress={() => { setZoneLat(kid.lastLocation!.lat.toFixed(5)); setZoneLng(kid.lastLocation!.lng.toFixed(5)); }}>
              <Text style={styles.prefillBtnText}>📍 Use {kid.profile.name}'s current location</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.formLabel}>Radius</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[100,200,500,1000].map(r => (
              <TouchableOpacity key={r} style={[styles.radiusBtn, zoneRadius === String(r) && styles.radiusBtnActive]} onPress={() => setZoneRadius(String(r))}>
                <Text style={[styles.radiusBtnText, zoneRadius === String(r) && styles.radiusBtnTextActive]}>{r >= 1000 ? `${r/1000}km` : `${r}m`}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.saveBtn, (!zoneName.trim()||!zoneLat||!zoneLng) && { opacity: 0.4 }]} onPress={addZone} disabled={!zoneName.trim()||!zoneLat||!zoneLng}>
            <Text style={styles.saveBtnText}>Save Zone ✓</Text>
          </TouchableOpacity>
        </View>
      )}

      {kid.safeZones.length === 0 ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>No safe zones yet. Add Home, School, etc. and get alerts when {kid.profile.name} leaves.</Text></View>
      ) : (
        kid.safeZones.map(zone => {
          const last = kid.lastLocation;
          const dist = last ? haversineM(last.lat, last.lng, zone.lat, zone.lng) : null;
          const inside = dist !== null && dist <= zone.radiusMeters;
          return (
            <View key={zone.id} style={styles.zoneCard}>
              <Text style={{ fontSize: 32 }}>{zone.emoji ?? "📍"}</Text>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7} onPress={() => openInMaps(zone.lat, zone.lng, zone.name)}>
                <Text style={styles.zoneName}>{zone.name} 🗺️</Text>
                <Text style={styles.zoneMeta}>{zone.lat.toFixed(4)}, {zone.lng.toFixed(4)} · r={zone.radiusMeters}m</Text>
                {dist !== null && <Text style={[styles.zoneStatus, { color: inside ? Colors.success : Colors.error }]}>{inside ? `✅ Inside (${Math.round(dist)}m)` : `⚠️ Outside — ${Math.round(dist)}m away`}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("Delete", "Remove this zone?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "SAFE_ZONE_REMOVE", kidId: selectedKidId, zoneId: zone.id }) }])}>
                <Text style={{ color: Colors.textSecondary, fontSize: 18, fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {(kid.locationHistory?.length ?? 0) > 0 && (
        <View style={styles.historyNote}>
          <Text style={styles.historyNoteText}>📊 {kid.locationHistory!.length} location points recorded — view in Reports.</Text>
        </View>
      )}
    </View>
  );
}

// ─── TAB: Location Reminders ──────────────────────────────────────────────────
function LocationRemindersTab() {
  const { state, dispatch } = useData();
  const reminders = state.locationReminders ?? [];
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [reminder, setReminder] = useState("");
  const [emoji, setEmoji] = useState("📍");
  const [radius, setRadius] = useState("200");
  const [trigger, setTrigger] = useState<"enter"|"exit"|"both">("enter");
  const [appliesTo, setAppliesTo] = useState<string[]>([]); // empty = all

  const EMOJIS = ["📍","🏠","🏫","⛪","🏪","🌳","🍕","🏋️","🎯","🎪","❤️","⚠️"];

  function save() {
    if (!name.trim() || !address.trim() || !reminder.trim()) {
      Alert.alert("Missing info", "Fill in name, address and reminder text."); return;
    }
    const rem: LocationReminder = {
      id: uid(), name: name.trim(), address: address.trim(),
      reminderText: reminder.trim(), emoji,
      radiusMeters: parseInt(radius) || 200, triggerOn: trigger,
      appliesTo, enabled: true, createdAt: nowIso(),
    };
    dispatch({ type: "LOCATION_REMINDER_ADD", reminder: rem });
    setName(""); setAddress(""); setReminder(""); setEmoji("📍"); setRadius("200"); setTrigger("enter"); setAppliesTo([]); setShowAdd(false);
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>📍 Location Reminders ({reminders.length})</Text>
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>Alert when family enters/exits an area</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(v => !v)}>
          <Text style={styles.addBtnText}>{showAdd ? "✕ Cancel" : "+ Add"}</Text>
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={styles.form}>
          <Text style={styles.formLabel}>Reminder Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. School drop-off, Grandma's house" />
          <Text style={styles.formLabel}>Address / Location</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. 123 Main St, Springfield" />
          <Text style={styles.formLabel}>Reminder Message</Text>
          <TextInput style={[styles.input, { height: 70 }]} value={reminder} onChangeText={setReminder} placeholder="e.g. Don't forget your bag! 🎒" multiline />
          <Text style={styles.formLabel}>Emoji</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {EMOJIS.map(e => (
              <TouchableOpacity key={e} style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]} onPress={() => setEmoji(e)}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.formLabel}>Trigger when</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
            {(["enter","exit","both"] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.radiusBtn, trigger === t && styles.radiusBtnActive, { flex: 1 }]} onPress={() => setTrigger(t)}>
                <Text style={[styles.radiusBtnText, trigger === t && styles.radiusBtnTextActive]}>
                  {t === "enter" ? "🚶 Arrive" : t === "exit" ? "🚪 Leave" : "↕️ Both"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.formLabel}>Notify zone radius</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[100,200,500,1000].map(r => (
              <TouchableOpacity key={r} style={[styles.radiusBtn, radius === String(r) && styles.radiusBtnActive]} onPress={() => setRadius(String(r))}>
                <Text style={[styles.radiusBtnText, radius === String(r) && styles.radiusBtnTextActive]}>{r >= 1000 ? `${r/1000}km` : `${r}m`}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {state.kids.length > 0 && (
            <>
              <Text style={styles.formLabel}>Applies to (empty = everyone)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {state.kids.map(k => (
                  <TouchableOpacity
                    key={k.profile.id}
                    style={[styles.radiusBtn, appliesTo.includes(k.profile.id) && styles.radiusBtnActive]}
                    onPress={() => setAppliesTo(p => p.includes(k.profile.id) ? p.filter(x => x !== k.profile.id) : [...p, k.profile.id])}
                  >
                    <Text style={[styles.radiusBtnText, appliesTo.includes(k.profile.id) && styles.radiusBtnTextActive]}>{k.profile.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <TouchableOpacity style={[styles.saveBtn, (!name.trim()||!address.trim()||!reminder.trim()) && { opacity: 0.4 }]} onPress={save} disabled={!name.trim()||!address.trim()||!reminder.trim()}>
            <Text style={styles.saveBtnText}>Save Reminder ✓</Text>
          </TouchableOpacity>
        </View>
      )}

      {reminders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 40, textAlign: "center" }}>📍</Text>
          <Text style={styles.emptyText}>No location reminders yet. Add one to get notified when your child arrives or leaves a location!</Text>
          <Text style={[styles.emptyText, { marginTop: 8, fontStyle: "italic" }]}>💡 Examples: "Arrived at School — Text your teacher!" or "Leaving Grandma's — Say goodbye!"</Text>
        </View>
      ) : (
        reminders.map(rem => (
          <View key={rem.id} style={styles.zoneCard}>
            <Text style={{ fontSize: 28 }}>{rem.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.zoneName}>{rem.name}</Text>
              <Text style={styles.zoneMeta}>{rem.address}</Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{rem.reminderText}</Text>
              <Text style={styles.zoneMeta}>
                {rem.triggerOn === "enter" ? "🚶 On arrive" : rem.triggerOn === "exit" ? "🚪 On leave" : "↕️ Arrive & leave"} · r={rem.radiusMeters}m
                {rem.lastTriggeredAt ? ` · Last: ${fmt(rem.lastTriggeredAt)}` : ""}
              </Text>
            </View>
            <View style={{ gap: 6, alignItems: "flex-end" }}>
              <Switch
                value={rem.enabled}
                onValueChange={v => dispatch({ type: "LOCATION_REMINDER_UPDATE", reminderId: rem.id, payload: { enabled: v } })}
                trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
                thumbColor={rem.enabled ? Colors.primary : Colors.textMuted}
              />
              <TouchableOpacity onPress={() => Alert.alert("Delete", "Remove this reminder?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "LOCATION_REMINDER_DELETE", reminderId: rem.id }) }])}>
                <Text style={{ color: Colors.error, fontSize: 12, fontWeight: "700" }}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ─── TAB: Speed Alerts ────────────────────────────────────────────────────────
function SpeedAlertsTab({ selectedKidId }: { selectedKidId: string }) {
  const { state, dispatch } = useData();
  const settings: SpeedAlertSettings = state.speedAlertSettings ?? { enabled: false, limitKmh: 80, aggressiveDeltaKmh: 20, pointsPerViolation: 10, alertParent: true };
  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const speedEvents = (kid?.speedEvents ?? []);
  const unackedCount = speedEvents.filter(e => !e.acknowledged).length;

  function update(payload: Partial<SpeedAlertSettings>) {
    dispatch({ type: "SPEED_ALERT_SETTINGS_UPDATE", payload });
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Settings card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚗 Speed Alert Settings</Text>
        <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 10 }}>
          Get alerted when your teen is driving aggressively or over the speed limit. Points are automatically deducted.
        </Text>

        <View style={sp.settingRow}>
          <View>
            <Text style={sp.settingLabel}>Enable Speed Monitoring</Text>
            <Text style={sp.settingHint}>Track driving speed via GPS</Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={v => update({ enabled: v })}
            trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
            thumbColor={settings.enabled ? Colors.primary : Colors.textMuted}
          />
        </View>

        {settings.enabled && (
          <>
            <View style={sp.settingRow}>
              <Text style={sp.settingLabel}>Speed Limit</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[60,80,100,110,120].map(s => (
                  <TouchableOpacity key={s} style={[styles.radiusBtn, settings.limitKmh === s && styles.radiusBtnActive]} onPress={() => update({ limitKmh: s })}>
                    <Text style={[styles.radiusBtnText, settings.limitKmh === s && styles.radiusBtnTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={sp.settingRow}>
              <View>
                <Text style={sp.settingLabel}>Alert above limit by</Text>
                <Text style={sp.settingHint}>How many km/h over limit triggers an alert</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[10,15,20,30].map(d => (
                  <TouchableOpacity key={d} style={[styles.radiusBtn, settings.aggressiveDeltaKmh === d && styles.radiusBtnActive]} onPress={() => update({ aggressiveDeltaKmh: d })}>
                    <Text style={[styles.radiusBtnText, settings.aggressiveDeltaKmh === d && styles.radiusBtnTextActive]}>+{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={sp.settingRow}>
              <View>
                <Text style={sp.settingLabel}>Points deducted per violation</Text>
                <Text style={sp.settingHint}>Screen time points removed per alert</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[5,10,15,20].map(p => (
                  <TouchableOpacity key={p} style={[styles.radiusBtn, settings.pointsPerViolation === p && styles.radiusBtnActive]} onPress={() => update({ pointsPerViolation: p })}>
                    <Text style={[styles.radiusBtnText, settings.pointsPerViolation === p && styles.radiusBtnTextActive]}>{p}pts</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={sp.settingRow}>
              <View>
                <Text style={sp.settingLabel}>Notify parent immediately</Text>
                <Text style={sp.settingHint}>Push alert on your phone</Text>
              </View>
              <Switch
                value={settings.alertParent}
                onValueChange={v => update({ alertParent: v })}
                trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
                thumbColor={settings.alertParent ? Colors.primary : Colors.textMuted}
              />
            </View>

            <View style={sp.infoBox}>
              <Text style={sp.infoText}>
                🚨 Alert triggers when speed exceeds {settings.limitKmh + settings.aggressiveDeltaKmh} km/h · {settings.pointsPerViolation} points deducted · {settings.alertParent ? "Parent notified" : "Silent record"}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Speed event log */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📊 Speed Log {unackedCount > 0 ? `(${unackedCount} new)` : ""}</Text>
        {speedEvents.length > 0 && (
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.error + "20" }]}
            onPress={() => Alert.alert("Clear Log", "Clear all speed events for this kid?", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => dispatch({ type: "SPEED_EVENTS_CLEAR", kidId: selectedKidId }) }])}>
            <Text style={[styles.addBtnText, { color: Colors.error }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {speedEvents.length === 0 ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>No speed events recorded yet. {settings.enabled ? "Events will appear here when detected." : "Enable speed monitoring above to start."}</Text></View>
      ) : (
        speedEvents.map(ev => (
          <View key={ev.id} style={[styles.zoneCard, !ev.acknowledged && { borderLeftWidth: 3, borderLeftColor: Colors.error }]}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.error + "15", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: Colors.error }}>{ev.detectedSpeedKmh}</Text>
              <Text style={{ fontSize: 8, color: Colors.error }}>km/h</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.zoneName}>🚗 {ev.detectedSpeedKmh} km/h detected</Text>
              <Text style={styles.zoneMeta}>Limit: {ev.limitKmh} km/h · {ev.pointsDeducted} pts deducted</Text>
              <Text style={styles.zoneMeta}>{fmt(ev.recordedAt)}</Text>
            </View>
            {!ev.acknowledged && (
              <TouchableOpacity style={sp.ackBtn} onPress={() => dispatch({ type: "SPEED_EVENT_ACK", kidId: selectedKidId, eventId: ev.id })}>
                <Text style={sp.ackBtnText}>✓ Seen</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </View>
  );
}

// ─── TAB: GPS / Phone Off ─────────────────────────────────────────────────────
function GpsOffTab({ selectedKidId }: { selectedKidId: string }) {
  const { state, dispatch } = useData();
  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const events = (kid?.phoneOffEvents ?? []);
  const unacked = events.filter(e => !e.acknowledged).length;

  const typeLabel: Record<string, { emoji: string; label: string; color: string }> = {
    phone_off: { emoji: "📵", label: "Phone Turned Off", color: Colors.error },
    gps_off:   { emoji: "📡", label: "GPS Disabled",     color: "#F59E0B" },
    app_closed: { emoji: "📱", label: "App Closed",      color: Colors.primary },
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📡 GPS & Phone Off Alerts</Text>
        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
          Automatically logged whenever {kid?.profile.name ?? "your child"}'s phone is turned off, GPS is disabled, or the family app is force-closed. These events are recorded and you are notified.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📋 Event Log {unacked > 0 ? `(${unacked} new)` : ""}</Text>
        {events.length > 0 && (
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.error + "20" }]}
            onPress={() => Alert.alert("Clear Log", "Clear all events?", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => dispatch({ type: "PHONE_OFF_EVENTS_CLEAR", kidId: selectedKidId }) }])}>
            <Text style={[styles.addBtnText, { color: Colors.error }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 40, textAlign: "center" }}>✅</Text>
          <Text style={styles.emptyText}>No GPS or phone-off events recorded. You'll see alerts here if the phone is turned off or GPS is disabled.</Text>
        </View>
      ) : (
        events.map(ev => {
          const info = typeLabel[ev.eventType] ?? { emoji: "⚠️", label: ev.eventType, color: Colors.warning };
          const duration = ev.resolvedAt
            ? Math.round((new Date(ev.resolvedAt).getTime() - new Date(ev.detectedAt).getTime()) / 60000)
            : null;
          return (
            <View key={ev.id} style={[styles.zoneCard, !ev.acknowledged && { borderLeftWidth: 3, borderLeftColor: info.color }]}>
              <Text style={{ fontSize: 28 }}>{info.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.zoneName, { color: info.color }]}>{info.label}</Text>
                <Text style={styles.zoneMeta}>Detected: {fmt(ev.detectedAt)}</Text>
                {ev.resolvedAt && <Text style={styles.zoneMeta}>Resolved: {fmt(ev.resolvedAt)} · {duration}m offline</Text>}
                {!ev.resolvedAt && <Text style={[styles.zoneMeta, { color: Colors.error }]}>⚠️ Still offline</Text>}
              </View>
              {!ev.acknowledged && (
                <TouchableOpacity style={sp.ackBtn} onPress={() => dispatch({ type: "PHONE_OFF_EVENT_ACK", kidId: selectedKidId, eventId: ev.id })}>
                  <Text style={sp.ackBtnText}>✓ Seen</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

// ─── Helpers for Reports ─────────────────────────────────────────────────────

interface PlaceVisit {
  label: string;
  emoji: string;
  arrivedAt: string;
  leftAt: string | null;
  durationMin: number;
  lat: number;
  lng: number;
}

function buildDailyVisits(
  history: { lat: number; lng: number; timestamp: string }[],
  safeZones: { name: string; emoji?: string; lat: number; lng: number; radiusMeters: number }[],
  dayIso: string, // "YYYY-MM-DD"
): PlaceVisit[] {
  // Filter to this day in local time
  const daySnaps = history
    .filter(s => new Date(s.timestamp).toLocaleDateString("en-CA") === dayIso)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (daySnaps.length === 0) return [];

  // Group consecutive snaps that are within the same zone (or unknown)
  function labelOf(lat: number, lng: number) {
    for (const z of safeZones) {
      if (haversineM(lat, lng, z.lat, z.lng) <= z.radiusMeters)
        return { label: z.name, emoji: z.emoji ?? "📍" };
    }
    return { label: "On the move", emoji: "🚗" };
  }

  const visits: PlaceVisit[] = [];
  let curLabel = labelOf(daySnaps[0].lat, daySnaps[0].lng);
  let startSnap = daySnaps[0];
  let lastSnap = daySnaps[0];

  for (let i = 1; i < daySnaps.length; i++) {
    const snap = daySnaps[i];
    const nl = labelOf(snap.lat, snap.lng);
    if (nl.label !== curLabel.label) {
      const dur = Math.round((new Date(lastSnap.timestamp).getTime() - new Date(startSnap.timestamp).getTime()) / 60000);
      visits.push({ label: curLabel.label, emoji: curLabel.emoji, arrivedAt: startSnap.timestamp, leftAt: lastSnap.timestamp, durationMin: dur, lat: startSnap.lat, lng: startSnap.lng });
      curLabel = nl;
      startSnap = snap;
    }
    lastSnap = snap;
  }
  // last segment
  const dur = Math.round((new Date(lastSnap.timestamp).getTime() - new Date(startSnap.timestamp).getTime()) / 60000);
  visits.push({ label: curLabel.label, emoji: curLabel.emoji, arrivedAt: startSnap.timestamp, leftAt: null, durationMin: dur, lat: startSnap.lat, lng: startSnap.lng });

  return visits;
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDur(min: number) {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function fmtDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date().toLocaleDateString("en-CA");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// ─── TAB: Reports ─────────────────────────────────────────────────────────────
function ReportsTab({ selectedKidId }: { selectedKidId: string }) {
  const { state } = useData();
  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const history = kid?.locationHistory ?? [];
  const safeZones = kid?.safeZones ?? [];

  const [view, setView] = useState<"daily" | "weekly">("daily");

  // Compute available days from history
  const allDays = Array.from(
    new Set(history.map(s => new Date(s.timestamp).toLocaleDateString("en-CA")))
  ).sort((a, b) => b.localeCompare(a)); // newest first

  const [selectedDay, setSelectedDay] = useState<string>(
    allDays[0] ?? new Date().toLocaleDateString("en-CA")
  );

  // Daily visits for selected day
  const dailyVisits = buildDailyVisits(history, safeZones, selectedDay);

  // Weekly data: last 7 days
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toLocaleDateString("en-CA");
  });

  const weeklyData = weekDays.map(day => {
    const visits = buildDailyVisits(history, safeZones, day);
    const totalMin = visits.reduce((s, v) => s + v.durationMin, 0);
    const places = new Set(visits.map(v => v.label)).size;
    const homeMin = visits.filter(v => v.label.toLowerCase().includes("home")).reduce((s, v) => s + v.durationMin, 0);
    const awayMin = totalMin - homeMin;
    return { day, visits, totalMin, places, homeMin, awayMin };
  });

  // Top places across the week
  const placeCounts: Record<string, { emoji: string; totalMin: number; visits: number }> = {};
  weeklyData.forEach(wd =>
    wd.visits.forEach(v => {
      if (!placeCounts[v.label]) placeCounts[v.label] = { emoji: v.emoji, totalMin: 0, visits: 0 };
      placeCounts[v.label].totalMin += v.durationMin;
      placeCounts[v.label].visits += 1;
    })
  );
  const topPlaces = Object.entries(placeCounts)
    .sort((a, b) => b[1].totalMin - a[1].totalMin)
    .slice(0, 5);

  if (!kid) return null;

  return (
    <View style={{ gap: 12 }}>
      {/* View toggle */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["daily", "weekly"] as const).map(v => (
          <TouchableOpacity
            key={v}
            style={[rp.viewBtn, view === v && rp.viewBtnActive]}
            onPress={() => setView(v)}
          >
            <Text style={[rp.viewBtnText, view === v && rp.viewBtnTextActive]}>
              {v === "daily" ? "📅 Daily Log" : "📊 Weekly Summary"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── DAILY VIEW ── */}
      {view === "daily" && (
        <>
          {/* Day picker */}
          {allDays.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 4, gap: 8 }}>
              {allDays.slice(0, 14).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[rp.dayChip, selectedDay === d && rp.dayChipActive]}
                  onPress={() => setSelectedDay(d)}
                >
                  <Text style={[rp.dayChipText, selectedDay === d && rp.dayChipTextActive]}>{fmtDay(d)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 40, textAlign: "center" }}>📍</Text>
              <Text style={styles.emptyText}>No location history yet. Location points are recorded as {kid.profile.name} moves around.</Text>
            </View>
          )}

          {/* Day summary bar */}
          {dailyVisits.length > 0 && (
            <View style={rp.summaryBar}>
              <View style={rp.summaryItem}>
                <Text style={rp.summaryVal}>{dailyVisits.length}</Text>
                <Text style={rp.summaryLbl}>Places</Text>
              </View>
              <View style={rp.summaryDivider} />
              <View style={rp.summaryItem}>
                <Text style={rp.summaryVal}>{fmtDur(dailyVisits.reduce((s, v) => s + v.durationMin, 0))}</Text>
                <Text style={rp.summaryLbl}>Tracked</Text>
              </View>
              <View style={rp.summaryDivider} />
              <View style={rp.summaryItem}>
                <Text style={rp.summaryVal}>{history.filter(s => new Date(s.timestamp).toLocaleDateString("en-CA") === selectedDay).length}</Text>
                <Text style={rp.summaryLbl}>Points</Text>
              </View>
            </View>
          )}

          {/* Timeline */}
          {dailyVisits.length === 0 && allDays.length > 0 && (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>No location data for {fmtDay(selectedDay)}.</Text></View>
          )}
          {dailyVisits.map((v, i) => (
            <View key={i} style={rp.visitCard}>
              {/* Timeline line */}
              <View style={rp.timelineCol}>
                <View style={rp.timelineDot} />
                {i < dailyVisits.length - 1 && <View style={rp.timelineLine} />}
              </View>
              <View style={{ flex: 1, paddingBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 22 }}>{v.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={rp.visitLabel}>{v.label}</Text>
                    <Text style={rp.visitMeta}>
                      {fmtTime(v.arrivedAt)}
                      {v.leftAt ? ` → ${fmtTime(v.leftAt)}` : " → now"}
                      {"  ·  "}{fmtDur(v.durationMin)}
                    </Text>
                  </View>
                  <View style={[rp.durBadge, v.label === "On the move" && { backgroundColor: "#F59E0B20" }]}>
                    <Text style={[rp.durBadgeText, v.label === "On the move" && { color: "#B45309" }]}>{fmtDur(v.durationMin)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── WEEKLY VIEW ── */}
      {view === "weekly" && (
        <>
          {/* Top places */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 Top Places This Week</Text>
            {topPlaces.length === 0 ? (
              <Text style={styles.emptyText}>No data yet.</Text>
            ) : (
              topPlaces.map(([name, info], i) => (
                <View key={name} style={rp.topPlaceRow}>
                  <Text style={rp.topPlaceRank}>#{i + 1}</Text>
                  <Text style={{ fontSize: 20 }}>{info.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={rp.visitLabel}>{name}</Text>
                    <Text style={rp.visitMeta}>{info.visits} visit{info.visits !== 1 ? "s" : ""}</Text>
                  </View>
                  <Text style={rp.durBadgeText}>{fmtDur(info.totalMin)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Per-day breakdown */}
          <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>📅 Day-by-Day</Text>
          {weeklyData.map(wd => {
            const hasData = wd.visits.length > 0;
            return (
              <View key={wd.day} style={[styles.card, !hasData && { opacity: 0.5 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: hasData ? 8 : 0 }}>
                  <Text style={rp.weekDayLabel}>{fmtDay(wd.day)}</Text>
                  {hasData && (
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <Text style={rp.visitMeta}>🏠 {fmtDur(wd.homeMin)}</Text>
                      <Text style={rp.visitMeta}>🚗 {fmtDur(wd.awayMin)}</Text>
                      <Text style={rp.visitMeta}>📍 {wd.places}</Text>
                    </View>
                  )}
                  {!hasData && <Text style={rp.visitMeta}>No data</Text>}
                </View>
                {hasData && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {Array.from(new Set(wd.visits.map(v => v.label))).map(lbl => {
                      const ev = wd.visits.find(v => v.label === lbl)!;
                      return (
                        <View key={lbl} style={rp.placePill}>
                          <Text style={{ fontSize: 12 }}>{ev.emoji}</Text>
                          <Text style={rp.placePillText}>{lbl}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          {/* Check-in requests */}
          {(kid.checkInRequests?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 4 }]}>✋ Check-in Requests</Text>
              {kid.checkInRequests.map(ci => (
                <View key={ci.id} style={[styles.zoneCard, { borderLeftWidth: 3, borderLeftColor: ci.status === "safe" ? Colors.success : ci.status === "help_needed" ? Colors.error : Colors.warning }]}>
                  <Text style={{ fontSize: 28 }}>{ci.status === "safe" ? "✅" : ci.status === "help_needed" ? "🆘" : "⏳"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zoneName}>{ci.status === "safe" ? "All good" : ci.status === "help_needed" ? "Help needed!" : "Pending response"}</Text>
                    <Text style={styles.zoneMeta}>{fmt(ci.requestedAt)}</Text>
                    {ci.respondedAt && <Text style={styles.zoneMeta}>Responded: {fmt(ci.respondedAt)}</Text>}
                    {(ci.kidLat != null && ci.kidLng != null) && <Text style={styles.zoneMeta}>📍 {ci.kidLat.toFixed(4)}, {ci.kidLng.toFixed(4)}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LocationScreen() {
  const { state } = useData();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("zones");
  const [selectedKidId, setSelectedKidId] = useState(state.kids[0]?.profile.id ?? "");

  const TABS: { id: Tab; label: string }[] = [
    { id: "zones",     label: "🛡️ Zones" },
    { id: "reminders", label: "📍 Reminders" },
    { id: "speed",     label: "🚗 Speed" },
    { id: "gpsoff",   label: "📡 GPS Off" },
    { id: "reports",   label: "📊 Reports" },
  ];

  return (
    <ScreenContainer scroll showBack={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📍 Location</Text>
        <View style={{ width: 40 }} />
      </View>

      {state.kids.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>👨‍👩‍👧</Text>
          <Text style={styles.emptyTitle}>No kids added yet</Text>
          <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" }}>Add a kid profile to use location features.</Text>
        </View>
      ) : (
        <>
          {/* Kid selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {state.kids.map(k => (
              <TouchableOpacity key={k.profile.id} style={[styles.kidTab, selectedKidId === k.profile.id && styles.kidTabActive]} onPress={() => setSelectedKidId(k.profile.id)}>
                <Text style={[styles.kidTabText, selectedKidId === k.profile.id && styles.kidTabTextActive]}>{k.profile.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tab bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {TABS.map(tab => (
              <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tab content */}
          {activeTab === "zones"     && <SafeZonesTab selectedKidId={selectedKidId} />}
          {activeTab === "reminders" && <LocationRemindersTab />}
          {activeTab === "speed"     && <SpeedAlertsTab selectedKidId={selectedKidId} />}
          {activeTab === "gpsoff"    && <GpsOffTab selectedKidId={selectedKidId} />}
          {activeTab === "reports"   && <ReportsTab selectedKidId={selectedKidId} />}
        </>
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 28, fontWeight: "300", color: Colors.primary, marginTop: -2 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  kidTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidTabActive: { backgroundColor: Colors.primary },
  kidTabText: { fontWeight: "600", color: Colors.textSecondary },
  kidTabTextActive: { color: "#fff" },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8, borderWidth: 1.5, borderColor: "transparent" },
  tabActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 4, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.sm },
  mapsBtn: { marginTop: 10, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 12, alignItems: "center", ...Shadow.sm },
  mapsBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  addressBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.success + "15", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: 10, borderWidth: 1, borderColor: Colors.success + "33" },
  addressIcon: { fontSize: 18 },
  addressText: { flex: 1, fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, lineHeight: 19 },
  coordRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  coordBox: { flex: 1, backgroundColor: Colors.primary + "10", borderRadius: Radius.md, padding: Spacing.sm },
  coordLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", marginBottom: 2 },
  coordValue: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  accuracy: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  timestamp: { fontSize: FontSize.sm, color: Colors.textSecondary },
  noLocationBox: { alignItems: "center", gap: 8, paddingVertical: Spacing.sm },
  noLocationText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  noLocationSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  form: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, gap: 8 },
  formLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 2 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary },
  emojiBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 8, backgroundColor: Colors.cardLight },
  emojiBtnActive: { backgroundColor: Colors.primary + "20", borderWidth: 2, borderColor: Colors.primary },
  prefillBtn: { backgroundColor: Colors.primary + "12", borderRadius: Radius.md, padding: Spacing.sm, alignItems: "center" },
  prefillBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  radiusBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: Colors.border },
  radiusBtnActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  radiusBtnText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  radiusBtnTextActive: { color: Colors.primary },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 13 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  emptyBox: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, textAlign: "center" },
  zoneCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  zoneName: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  zoneMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  zoneStatus: { fontSize: FontSize.sm, fontWeight: "600", marginTop: 4 },
  historyNote: { backgroundColor: Colors.primary + "10", borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.primary + "25" },
  historyNoteText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", textAlign: "center" },
});

const rp = StyleSheet.create({
  viewBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: Colors.border },
  viewBtnActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  viewBtnText: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  viewBtnTextActive: { color: Colors.primary },
  dayChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8, borderWidth: 1.5, borderColor: "transparent" },
  dayChipActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  dayChipText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  dayChipTextActive: { color: Colors.primary },
  summaryBar: { flexDirection: "row", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryVal: { fontSize: 20, fontWeight: "800", color: Colors.primary },
  summaryLbl: { fontSize: 11, color: Colors.textSecondary, fontWeight: "600", marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  visitCard: { flexDirection: "row", gap: 0 },
  timelineCol: { width: 28, alignItems: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, marginTop: 6 },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  visitLabel: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  visitMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  durBadge: { backgroundColor: Colors.primary + "15", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  durBadgeText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  weekDayLabel: { fontSize: 14, fontWeight: "800", color: Colors.textPrimary },
  topPlaceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: Colors.border + "40" },
  topPlaceRank: { fontSize: 13, fontWeight: "800", color: Colors.textMuted, width: 24 },
  placePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary + "12", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  placePillText: { fontSize: 11, fontWeight: "600", color: Colors.primary },
});

const sp = StyleSheet.create({
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderColor: Colors.border + "60", gap: 12 },
  settingLabel: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  settingHint: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  infoBox: { backgroundColor: Colors.warning + "15", borderRadius: 12, padding: 10, marginTop: 4 },
  infoText: { fontSize: 12, color: "#92400E", fontWeight: "600", lineHeight: 18 },
  ackBtn: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  ackBtnText: { fontSize: 11, fontWeight: "700", color: Colors.success },
});
