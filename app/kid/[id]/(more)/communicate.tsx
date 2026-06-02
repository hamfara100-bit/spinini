import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, FlatList, Linking, Alert, Dimensions,
  KeyboardAvoidingView, Platform,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useLocalSearchParams, useGlobalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import { uploadMedia } from "../../../../lib/media-upload";
import { useKeyboardHeight } from "../../../../hooks/use-keyboard-height";
import { createCommsTransport, type CommsTransport } from "../../../../lib/comms/transport";
import type { CallContact, MascotType } from "../../../../lib/data/types";

// Stable room id for the family chat — shared with the parent Call & Chat screen
// so kid-sent and parent-sent messages land in the same thread.
const FAMILY_ROOM = "family-main";

const MASCOT_EMOJI: Record<MascotType, string> = {
  fox: "🦊", panda: "🐼", bunny: "🐰", dino: "🦕",
  owl: "🦉", cat: "🐱", bear: "🐻", frog: "🐸",
};

const { width: W } = Dimensions.get("window");

// ─── Tab bar ─────────────────────────────────────────────────────────────────

type Tab = "call" | "chat" | "contacts";

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: "call",     emoji: "📞", label: "Call & Text" },
  { id: "chat",     emoji: "💬", label: "Chat"        },
  { id: "contacts", emoji: "📇", label: "Contacts"    },
];

// ─── Call / Text action picker ─────────────────────────────────────────────────
// Tap a person → choose HOW to reach them:
//   • In this app  → free video / voice call (Jitsi room) or in-app chat. Always
//                    available, no phone number required.
//   • On your phone → hands off to the native dialer / SMS app. Only shown when a
//                     phone number is saved for the contact.

function ActionPicker({
  contact, onInApp, onNative, onClose,
}: {
  contact: CallContact;
  onInApp: (action: "video" | "voice" | "chat") => void;
  onNative: (action: "call" | "text") => void;
  onClose: () => void;
}) {
  const hasPhone = !!contact.phone;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <ScrollView
          style={{ width: "100%", flexGrow: 0 }}
          contentContainerStyle={s.pickerSheet}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[s.pickerAvatar, { backgroundColor: contact.color }]}>
            <Text style={{ fontSize: 52 }}>{contact.emoji}</Text>
          </View>
          <Text style={s.pickerName}>{contact.name}</Text>
          <Text style={s.pickerRole}>{contact.role}</Text>

          {/* In-app options — always available, no phone number needed */}
          <Text style={s.pickerSection}>📲  In this app</Text>
          <TouchableOpacity style={[s.pickerBtn, { backgroundColor: "#4ADE80" }]} onPress={() => onInApp("video")}>
            <Text style={s.pickerBtnEmoji}>📹</Text>
            <View>
              <Text style={s.pickerBtnLabel}>Video call</Text>
              <Text style={s.pickerBtnSub}>Free call right here in the app</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pickerBtn, { backgroundColor: "#60A5FA" }]} onPress={() => onInApp("voice")}>
            <Text style={s.pickerBtnEmoji}>📞</Text>
            <View>
              <Text style={s.pickerBtnLabel}>Voice call</Text>
              <Text style={s.pickerBtnSub}>Free call right here in the app</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pickerBtn, { backgroundColor: "#A78BFA" }]} onPress={() => onInApp("chat")}>
            <Text style={s.pickerBtnEmoji}>💬</Text>
            <View>
              <Text style={s.pickerBtnLabel}>Chat</Text>
              <Text style={s.pickerBtnSub}>Send a message in the app</Text>
            </View>
          </TouchableOpacity>

          {/* Native phone options — only when a phone number is saved */}
          {hasPhone ? (
            <>
              <Text style={s.pickerSection}>📱  On your phone</Text>
              <TouchableOpacity style={[s.pickerBtn, s.pickerBtnOutline]} onPress={() => onNative("call")}>
                <Text style={s.pickerBtnEmoji}>📱</Text>
                <View>
                  <Text style={s.pickerBtnLabel}>Call on phone</Text>
                  <Text style={s.pickerBtnSub}>Opens your phone dialer</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pickerBtn, s.pickerBtnOutline]} onPress={() => onNative("text")}>
                <Text style={s.pickerBtnEmoji}>✉️</Text>
                <View>
                  <Text style={s.pickerBtnLabel}>Text on phone</Text>
                  <Text style={s.pickerBtnSub}>Opens your messages app</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={s.pickerHint}>
              No phone number saved for {contact.name} — use the in-app options above to call or message them. (A parent can add a number in the Contacts tab for phone calls.)
            </Text>
          )}

          <TouchableOpacity style={s.pickerCancel} onPress={onClose}>
            <Text style={s.pickerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── "More contacts" modal ────────────────────────────────────────────────────

function MoreContactsModal({
  contacts, onSelect, onClose,
}: {
  contacts: CallContact[]; onSelect: (c: CallContact) => void; onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[s.pickerSheet, { paddingBottom: 32 }]}>
          <Text style={s.moreTitle}>More people</Text>
          <ScrollView style={{ width: "100%", maxHeight: 400 }}>
            {contacts.map(c => (
              <TouchableOpacity key={c.id} style={s.moreRow} onPress={() => { onClose(); onSelect(c); }}>
                <View style={[s.moreAvatar, { backgroundColor: c.color }]}>
                  <Text style={{ fontSize: 32 }}>{c.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.moreName}>{c.name}</Text>
                  <Text style={s.moreRole}>{c.role}</Text>
                </View>
                <Text style={{ fontSize: 22, color: Colors.textMuted }}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.pickerCancel} onPress={onClose}>
            <Text style={s.pickerCancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Call & Text tab ────────────────────────────────────────────────────────────

function CallTab({ kidId, onOpenChat }: { kidId: string; onOpenChat: () => void }) {
  const { state, dispatch } = useData();
  const kid = useKid(kidId);
  const [picker, setPicker] = useState<CallContact | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Build contact list: main parent + co-parents + siblings + custom call contacts
  const siblings: CallContact[] = state.kids
    .filter(k => k.profile.id !== kidId)
    .map(k => ({
      id: `__kid__${k.profile.id}`,
      name: k.profile.name,
      role: "Sibling 🧡",
      emoji: MASCOT_EMOJI[k.profile.mascot] ?? "🧒",
      color: "#FFF0DB",
      phone: undefined,
    }));

  const contacts: CallContact[] = [
    {
      id: "__parent__",
      name: state.parentSettings.name || "Mom & Dad",
      role: "Parent",
      emoji: state.parentSettings.emoji || "👩",
      color: "#E8D5FF",
      phone: state.parentSettings.phone,
    },
    ...(state.coParents ?? []).map(cp => ({
      id: cp.id,
      name: cp.name,
      role: cp.role === "admin" ? "Parent" : "Family",
      emoji: cp.emoji,
      color: "#D4E8FF",
      phone: undefined, // co-parents have no stored number → in-app calling only
    })),
    ...siblings,
    ...(state.kids.find(k => k.profile.id === kidId)?.callContacts ?? []),
  ];

  const mainContacts = contacts.slice(0, 4);
  const moreContacts = contacts.slice(4);

  // Native handoff — only reachable when the contact has a saved phone number.
  function nativeLaunch(contact: CallContact, action: "call" | "text") {
    setPicker(null);
    if (!contact.phone) return; // button is hidden without a phone; guard anyway
    const url = action === "call" ? `tel:${contact.phone}` : `sms:${contact.phone}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Can't open", "Your phone couldn't open that app.");
    });
  }

  // In-app calling — no phone number required. Opens a Jitsi room (serverless,
  // works over the internet) and rings the contact via an incoming-call record
  // so the parent's Call & Chat → Calls tab shows it. Chat hands off to the
  // in-app Chat tab.
  function inAppLaunch(contact: CallContact, action: "video" | "voice" | "chat") {
    setPicker(null);
    if (action === "chat") { onOpenChat(); return; }
    const video = action === "video";
    // Match the parent's room scheme (`spinini-<kidId>`) so both sides meet here.
    const room = `spinini-${kidId}`.replace(/[^a-zA-Z0-9_-]/g, "");
    const base = `https://meet.jit.si/${room}`;
    const url = video ? base : `${base}#config.startWithVideoMuted=true`;

    dispatch({
      type: "CALL_REQUEST",
      call: {
        id: uid(),
        kidId,
        kidName: kid?.profile.name ?? "Kid",
        contactId: contact.id,
        contactName: contact.name,
        callType: video ? "video" : "audio",
        timestamp: nowIso(),
        status: "ringing",
        roomId: room,
      },
    });
    Notifications.scheduleNotificationAsync({
      content: { title: `📞 Calling ${contact.name}…`, body: "Ringing them in the app", sound: true },
      trigger: null,
    }).catch(() => {});

    Linking.openURL(url).catch(() =>
      Alert.alert("Couldn't start the call", "Unable to open the call screen on this device."));
  }

  const CARD_SIZE = (W - Spacing.lg * 2 - 12) / 2;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.callGrid}>
      <Text style={s.callHint}>Who do you want to reach? 👇</Text>

      {/* 2×2 main grid */}
      <View style={s.grid2x2}>
        {mainContacts.map(contact => (
          <TouchableOpacity
            key={contact.id}
            style={[s.bigContactBtn, { width: CARD_SIZE, height: CARD_SIZE + 24, backgroundColor: contact.color }]}
            onPress={() => setPicker(contact)}
            activeOpacity={0.8}
          >
            <Text style={s.bigEmoji}>{contact.emoji}</Text>
            <Text style={s.bigName} numberOfLines={1}>{contact.name}</Text>
            <Text style={s.bigRole} numberOfLines={1}>{contact.role}</Text>
            <View style={s.bigCallPill}>
              <Text style={s.bigCallPillText}>Call or text</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* More button */}
      {moreContacts.length > 0 && (
        <TouchableOpacity style={s.moreBtn} onPress={() => setShowMore(true)}>
          <Text style={s.moreBtnText}>👥  {moreContacts.length} more people →</Text>
        </TouchableOpacity>
      )}

      {contacts.length === 0 && (
        <View style={s.noContacts}>
          <Text style={{ fontSize: 48 }}>👨‍👩‍👧</Text>
          <Text style={s.noContactsText}>No call contacts set up yet.</Text>
          <Text style={s.noContactsSub}>Ask a parent to set up your call contacts!</Text>
        </View>
      )}

      {/* Call / Text action picker */}
      {picker && (
        <ActionPicker
          contact={picker}
          onInApp={action => inAppLaunch(picker, action)}
          onNative={action => nativeLaunch(picker, action)}
          onClose={() => setPicker(null)}
        />
      )}

      {/* More contacts modal */}
      {showMore && (
        <MoreContactsModal
          contacts={moreContacts}
          onSelect={c => setPicker(c)}
          onClose={() => setShowMore(false)}
        />
      )}
    </ScrollView>
  );
}

// ─── Contacts tab ────────────────────────────────────────────────────────────

function ContactsTab({ kidId }: { kidId: string }) {
  const kid = useKid(kidId);
  const contacts = kid?.contacts ?? [];

  if (contacts.length === 0) {
    return (
      <View style={s.noContacts}>
        <Text style={{ fontSize: 48 }}>📇</Text>
        <Text style={s.noContactsText}>No contacts yet.</Text>
        <Text style={s.noContactsSub}>Ask a parent to add emergency contacts for you!</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 10 }}>
      {contacts.map(c => (
        <View key={c.id} style={s.contactCard}>
          <View style={s.contactAvatar}>
            <Text style={{ fontSize: 28 }}>{c.isEmergency ? "🆘" : "👤"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.contactName}>{c.name}</Text>
            <Text style={s.contactRelation}>{c.relation}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {c.canCall && (
              <TouchableOpacity
                style={s.contactActionBtn}
                onPress={() => Linking.openURL(`tel:${c.phone}`).catch(() => {})}
              >
                <Text style={{ fontSize: 18 }}>📞</Text>
              </TouchableOpacity>
            )}
            {c.canText && (
              <TouchableOpacity
                style={s.contactActionBtn}
                onPress={() => Linking.openURL(`sms:${c.phone}`).catch(() => {})}
              >
                <Text style={{ fontSize: 18 }}>💬</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Chat tab (in-app family chat) ─────────────────────────────────────────────
// Mirrors the parent Chat tab: messages go through the comms transport (loopback
// today, Trystero once native deps land) and into the shared family thread. The
// kid is the author; they see broadcast messages plus anything addressed to them.

function KidChatTab({ kidId }: { kidId: string }) {
  const { state, dispatch } = useData();
  const kid = useKid(kidId);
  const [text, setText] = useState("");
  const [peerCount, setPeerCount] = useState(0);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const kbHeight = useKeyboardHeight();

  const authorId   = kidId;
  const authorName = kid?.profile.name ?? "Me";

  const messages = (state.familyMessages ?? []).filter(m =>
    (m.recipients?.length ?? 0) === 0 || m.recipients.includes(kidId) || m.authorId === kidId
  );

  const transportRef = useRef<CommsTransport | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  // Mark chat read for this kid whenever the screen is open / new messages land
  // — clears the Call & Chat tab badge.
  useEffect(() => {
    dispatch({ type: "FAMILY_CHAT_MARK_READ", viewerId: kidId });
  }, [(state.familyMessages ?? []).length]);

  useEffect(() => {
    (state.familyMessages ?? []).forEach(m => seenIds.current.add(m.id));
    const t = createCommsTransport("trystero");
    transportRef.current = t;
    t.connect(FAMILY_ROOM, authorId).catch(e =>
      console.warn("[comms] connect failed:", String(e)));
    const offMsg = t.onMessage(m => {
      if (seenIds.current.has(m.id)) return;
      seenIds.current.add(m.id);
      dispatch({
        type: "FAMILY_CHAT_PUSH",
        message: {
          id: m.id, text: m.text, imageUri: (m as any).imageUri, audioUri: (m as any).audioUri,
          authorId: m.authorId, authorName: m.authorName,
          recipients: m.recipients ?? [], sentAt: m.sentAt, readBy: [m.authorId],
        },
      });
    });
    const offPeers = t.onPeers(setPeerCount);
    return () => { offMsg(); offPeers(); t.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send() {
    if (!text.trim()) return;
    const id = uid();
    const sentAt = nowIso();
    seenIds.current.add(id);
    dispatch({
      type: "FAMILY_CHAT_PUSH",
      message: { id, text: text.trim(), authorId, authorName, recipients: [], sentAt, readBy: [authorId] },
    });
    transportRef.current?.send({ id, text: text.trim(), authorId, authorName, sentAt, recipients: [] });
    setText("");
  }

  async function sendPhoto() {
    if (sendingPhoto) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Allow photos", "Photo access is needed to send a picture."); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (r.canceled || !r.assets?.[0]) return;
      setSendingPhoto(true);
      const shared = (await uploadMedia(r.assets[0].uri, { folder: "chat" })) ?? r.assets[0].uri;
      const id = uid();
      const sentAt = nowIso();
      seenIds.current.add(id);
      const msg = { id, text: text.trim(), imageUri: shared, authorId, authorName, recipients: [] as string[], sentAt };
      dispatch({ type: "FAMILY_CHAT_PUSH", message: { ...msg, readBy: [authorId] } });
      transportRef.current?.send(msg as any);
      setText("");
    } catch {
      Alert.alert("Couldn't send", "The photo could not be sent. Try again.");
    } finally {
      setSendingPhoto(false);
    }
  }

  return (
    <View style={{ flex: 1, paddingBottom: kbHeight }}>
      {peerCount > 1 && (
        <View style={s.liveBanner}>
          <Text style={s.liveBannerText}>🟢 Live — {peerCount - 1} other {peerCount - 1 === 1 ? "device" : "devices"} connected</Text>
        </View>
      )}
      <FlatList
        data={[...messages].reverse()}
        keyExtractor={m => m.id}
        inverted
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.sm }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.chatEmpty}>No messages yet. Say hi to your family! 👋</Text>}
        renderItem={({ item }) => {
          const isMe = item.authorId === kidId;
          return (
            <View style={[s.chatBubble, isMe ? s.chatBubbleMe : s.chatBubbleThem]}>
              {!isMe && <Text style={s.chatAuthor}>{item.authorName}</Text>}
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={s.chatImage} contentFit="cover" />
              ) : null}
              {item.text ? <Text style={[s.chatMsg, isMe ? s.chatMsgMe : s.chatMsgThem]}>{item.text}</Text> : null}
              <Text style={s.chatTime}>{item.sentAt.slice(11, 16)}</Text>
            </View>
          );
        }}
      />
      <View style={s.chatInputRow}>
        <TouchableOpacity style={s.chatPhotoBtn} onPress={sendPhoto} disabled={sendingPhoto}>
          <Text style={{ fontSize: 22 }}>{sendingPhoto ? "⏳" : "📷"}</Text>
        </TouchableOpacity>
        <TextInput
          style={s.chatInput}
          value={text}
          onChangeText={setText}
          placeholder="Message your family…"
          returnKeyType="send"
          onSubmitEditing={send}
          multiline
        />
        <TouchableOpacity style={[s.chatSendBtn, !text.trim() && s.chatSendDim]} onPress={send} disabled={!text.trim()}>
          <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CommunicateScreen() {
  const local  = useLocalSearchParams<{ id?: string }>();
  const global = useGlobalSearchParams<{ id?: string }>();
  const id = (local.id ?? global.id) as string;
  const kid = useKid(id);
  const [activeTab, setActiveTab] = useState<Tab>("call");

  if (!kid) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#FAF7FF" }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>📞 Call & Text</Text>
        <Text style={s.subtitle}>Reach your family on the phone</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={s.tabEmoji}>{tab.emoji}</Text>
            <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>{tab.label}</Text>
            {activeTab === tab.id && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === "call"     && <CallTab kidId={id} onOpenChat={() => setActiveTab("chat")} />}
        {activeTab === "chat"     && <KidChatTab kidId={id} />}
        {activeTab === "contacts" && <ContactsTab kidId={id} />}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    paddingTop: 52, paddingBottom: Spacing.sm, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
  },
  title:    { fontSize: FontSize.xl, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  tabBar:   { flexDirection: "row", backgroundColor: Colors.primary, paddingHorizontal: Spacing.md },
  tab:      { flex: 1, alignItems: "center", paddingVertical: 10, position: "relative" },
  tabActive:{},
  tabEmoji: { fontSize: 22 },
  tabLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginTop: 2 },
  tabLabelActive: { color: "#fff" },
  tabIndicator: {
    position: "absolute", bottom: 0, left: "20%", right: "20%",
    height: 3, backgroundColor: Colors.secondary, borderRadius: 2,
  },

  // Call grid
  callGrid:   { padding: Spacing.lg, gap: 12 },
  callHint:   { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, textAlign: "center", marginBottom: 4 },
  grid2x2:    { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  bigContactBtn: {
    borderRadius: 24, alignItems: "center", justifyContent: "center",
    gap: 4, padding: 12, ...Shadow.md,
  },
  bigEmoji:   { fontSize: 64 },
  bigName:    { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  bigRole:    { fontSize: FontSize.sm, color: Colors.textSecondary },
  bigCallPill:{ backgroundColor: "rgba(0,0,0,0.12)", borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 },
  bigCallPillText: { fontSize: 11, fontWeight: "700", color: Colors.textPrimary },

  moreBtn:     { backgroundColor: Colors.primary + "15", borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", marginTop: 4 },
  moreBtnText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },

  noContacts:    { alignItems: "center", gap: 8, paddingTop: 40 },
  noContactsText:{ fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  noContactsSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },

  // Call / Text picker
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  pickerSheet:   { backgroundColor: Colors.bgLight, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.lg, alignItems: "center", gap: 12 },
  pickerAvatar:  { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pickerName:    { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  pickerRole:    { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: -8 },
  pickerBtn:     { flexDirection: "row", alignItems: "center", gap: 14, width: "100%", borderRadius: Radius.xl, padding: Spacing.md, ...Shadow.sm },
  pickerBtnEmoji:{ fontSize: 36 },
  pickerBtnLabel:{ fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  pickerBtnSub:  { fontSize: FontSize.sm, color: Colors.textSecondary },
  pickerCancel:  { paddingVertical: 10, paddingHorizontal: 24 },
  pickerCancelText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: "600" },
  noPhoneBox:    { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, width: "100%" },
  noPhoneText:   { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  pickerSection: { alignSelf: "flex-start", fontSize: FontSize.xs, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 0.6, marginTop: 6, marginBottom: 2 },
  pickerBtnOutline: { backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: Colors.border },
  pickerHint:    { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, marginTop: 4 },

  // In-app chat
  liveBanner:     { backgroundColor: "#DCFCE7", paddingHorizontal: Spacing.md, paddingVertical: 6 },
  liveBannerText: { fontSize: FontSize.xs, color: "#166534", fontWeight: "700" },
  chatBubble:     { maxWidth: "78%", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8 },
  chatBubbleMe:   { backgroundColor: Colors.primary, alignSelf: "flex-end" },
  chatBubbleThem: { backgroundColor: Colors.surfaceLight, alignSelf: "flex-start", ...Shadow.sm },
  chatAuthor:     { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  chatMsg:        { fontSize: FontSize.base },
  chatMsgMe:      { color: "#fff" },
  chatMsgThem:    { color: Colors.textPrimary },
  chatTime:       { fontSize: 9, opacity: 0.55, marginTop: 3, alignSelf: "flex-end" },
  chatInputRow:   { flexDirection: "row", gap: 8, padding: Spacing.sm, backgroundColor: Colors.surfaceLight, borderTopWidth: 1, borderTopColor: Colors.border },
  chatInput:      { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: "#fff", fontSize: FontSize.base, maxHeight: 100 },
  chatSendBtn:    { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  chatPhotoBtn:   { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  chatImage:      { width: 200, height: 200, borderRadius: Radius.md, marginBottom: 6, backgroundColor: Colors.cardLight },
  chatSendDim:    { backgroundColor: Colors.primary + "60" },
  chatEmpty:      { textAlign: "center", color: Colors.textSecondary, padding: Spacing.xl },

  // More contacts modal
  moreTitle:     { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  moreRow:       { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  moreAvatar:    { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  moreName:      { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  moreRole:      { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Contacts tab
  contactCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  contactAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center",
  },
  contactName:     { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  contactRelation: { fontSize: FontSize.sm, color: Colors.textSecondary },
  contactActionBtn:{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
});
