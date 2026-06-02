import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ScrollView, Modal, Alert, Linking,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { MicButton } from "../../../components/voice-text-input";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useData } from "../../../lib/data/store";
import { Mascot } from "../../../components/mascot";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { PASTEL_COLORS } from "../../../lib/data/types";
import { uid, nowIso } from "../../../lib/utils";
import { uploadMedia } from "../../../lib/media-upload";
import { createCommsTransport, type CommsTransport } from "../../../lib/comms/transport";
import type { CallContact, CallMode, IncomingCall } from "../../../lib/data/types";

// Stable room id for the family chat. (Local loopback today; Trystero later.)
const FAMILY_ROOM = "family-main";

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = "calls" | "chat" | "contacts" | "ping";

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: "calls",    emoji: "📥", label: "Calls"    },
  { id: "chat",     emoji: "💬", label: "Chat"     },
  { id: "contacts", emoji: "👥", label: "Contacts" },
  { id: "ping",     emoji: "🔔", label: "Ping"     },
];

const AUTHOR_ID   = "__parent__";
const AUTHOR_NAME = "Parent";

// ─── Funny "I'll call you back" presets ──────────────────────────────────────

const CALLBACK_PRESETS = [
  { id: "cb1", emoji: "🐻", label: "Beary Soon!",    text: "Grrr! 🐻 BRR-BRRR! Mama Bear will call you back beary soon!" },
  { id: "cb2", emoji: "🦆", label: "Quack Attack!",  text: "QUACK QUACK! 🦆 The Duck Parent will ring you back shortly!" },
  { id: "cb3", emoji: "🤖", label: "Robot Reply",    text: "BEEP BOOP! 🤖 Robot Parent is processing... will return your call!" },
  { id: "cb4", emoji: "🦁", label: "Lion Roar!",     text: "ROAR! 🦁 The Lion Dad is on the way — expect a call soon!" },
  { id: "cb5", emoji: "🚀", label: "Rocket Speed!",  text: "📡 3…2…1… Launching a call your way very soon, astronaut! 🚀" },
  { id: "cb6", emoji: "🧙", label: "Magic Wizard",   text: "✨ Abracadabra! Your magical parent will appear on your screen soon!" },
];

// ─── Chat Tab ─────────────────────────────────────────────────────────────────

function ChatTab() {
  const { state, dispatch } = useData();
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [peerCount, setPeerCount] = useState(0);
  const [sendingPhoto, setSendingPhoto] = useState(false);

  const coParents = state.coParents ?? [];

  const messages = state.familyMessages.filter(m => {
    if (filter === "all") return true;
    // DM thread: messages sent to or from this person
    return m.authorId === filter || (m.recipients ?? []).includes(filter);
  });

  // ── Comms transport seam ──────────────────────────────────────────────────
  // Chat goes through the transport so remote peers can be added later (Trystero)
  // without changing this screen. Today it's an in-process loopback (no network).
  const transportRef = useRef<CommsTransport | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  // Mark all chat read for the parent whenever this screen is mounted or new
  // messages arrive while it's open — clears the Call & Chat tab badge.
  useEffect(() => {
    dispatch({ type: "FAMILY_CHAT_MARK_READ", viewerId: AUTHOR_ID });
  }, [state.familyMessages.length]);

  useEffect(() => {
    // Seed dedup set with messages already in the store.
    state.familyMessages.forEach(m => seenIds.current.add(m.id));
    const t = createCommsTransport("trystero");
    transportRef.current = t;
    t.connect(FAMILY_ROOM, AUTHOR_ID).catch(e =>
      console.warn("[comms] connect failed:", String(e)));
    const offMsg = t.onMessage(m => {
      if (seenIds.current.has(m.id)) return; // ignore echoes / duplicates
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
  }, []);

  function send() {
    if (!text.trim()) return;
    const id = uid();
    const sentAt = nowIso();
    const recipients = filter === "all" ? [] : [filter];
    seenIds.current.add(id); // our own message — don't re-ingest if it echoes back
    dispatch({
      type: "FAMILY_CHAT_PUSH",
      message: {
        id, text: text.trim(),
        authorId: AUTHOR_ID, authorName: AUTHOR_NAME,
        recipients,
        sentAt, readBy: [AUTHOR_ID],
      },
    });
    // Broadcast to any connected peers (no-op with the local loopback backend).
    transportRef.current?.send({
      id, text: text.trim(), authorId: AUTHOR_ID, authorName: AUTHOR_NAME, sentAt, recipients,
    });
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
      const recipients = filter === "all" ? [] : [filter];
      seenIds.current.add(id);
      const msg = { id, text: text.trim(), imageUri: shared, authorId: AUTHOR_ID, authorName: AUTHOR_NAME, sentAt, recipients };
      dispatch({ type: "FAMILY_CHAT_PUSH", message: { ...msg, readBy: [AUTHOR_ID] } });
      transportRef.current?.send(msg as any);
      setText("");
    } catch {
      Alert.alert("Couldn't send", "The photo could not be sent. Try again.");
    } finally {
      setSendingPhoto(false);
    }
  }

  const isCoParentDM = coParents.some(cp => cp.id === filter);
  const selectedCoParent = coParents.find(cp => cp.id === filter);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}>
        <TouchableOpacity style={[s.filterChip, filter === "all" && s.filterChipActive]} onPress={() => setFilter("all")}>
          <Text style={[s.filterText, filter === "all" && s.filterTextActive]}>👨‍👩‍👧 Everyone</Text>
        </TouchableOpacity>
        {state.kids.map(k => (
          <TouchableOpacity
            key={k.profile.id}
            style={[s.filterChip, filter === k.profile.id && s.filterChipActive]}
            onPress={() => setFilter(k.profile.id)}
          >
            <Text style={[s.filterText, filter === k.profile.id && s.filterTextActive]}>
              {k.profile.mascot} {k.profile.name}
            </Text>
          </TouchableOpacity>
        ))}
        {coParents.length > 0 && (
          <View style={s.filterDivider} />
        )}
        {coParents.map(cp => (
          <TouchableOpacity
            key={cp.id}
            style={[s.filterChip, s.filterChipCoParent, filter === cp.id && s.filterChipCoParentActive]}
            onPress={() => setFilter(cp.id)}
          >
            <Text style={[s.filterText, filter === cp.id && s.filterTextActive]}>
              {cp.emoji} {cp.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isCoParentDM && (
        <View style={s.coParentDMBanner}>
          <Text style={s.coParentDMText}>🔒 Private thread with {selectedCoParent?.emoji} {selectedCoParent?.name} — only visible to parents</Text>
        </View>
      )}

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
        ListEmptyComponent={<Text style={s.empty}>No messages yet. Say hi!</Text>}
        renderItem={({ item }) => {
          const isMe = item.authorId === AUTHOR_ID;
          return (
            <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
              {!isMe && <Text style={s.author}>{item.authorName}</Text>}
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={s.chatImage} contentFit="cover" />
              ) : null}
              {item.text ? <Text style={[s.msgText, isMe ? s.msgMe : s.msgThem]}>{item.text}</Text> : null}
              <Text style={s.time}>{item.sentAt.slice(11,16)}</Text>
            </View>
          );
        }}
      />
      <View style={s.inputRow}>
        <TouchableOpacity style={s.photoBtn} onPress={sendPhoto} disabled={sendingPhoto}>
          <Text style={{ fontSize: 22 }}>{sendingPhoto ? "⏳" : "📷"}</Text>
        </TouchableOpacity>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder={`Message… or tap 🎙️ to speak`}
          returnKeyType="send"
          onSubmitEditing={send}
          multiline
        />
        <MicButton appendTo={text} onAppend={setText} onResult={setText} size={36} />
        <TouchableOpacity style={[s.sendBtn, !text.trim() && s.sendBtnDim]} onPress={send} disabled={!text.trim()}>
          <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Incoming Calls Tab ───────────────────────────────────────────────────────

function CallbackPicker({ call, onClose }: { call: IncomingCall; onClose: () => void }) {
  const { dispatch } = useData();

  async function sendCallback(preset: typeof CALLBACK_PRESETS[0]) {
    dispatch({
      type: "ADD_FUNNY_SOUND",
      kidId: call.kidId,
      msg: {
        id: uid(),
        kidId: call.kidId,
        fromName: AUTHOR_NAME,
        presetId: undefined,
        message: preset.text,
        soundUri: undefined,
        videoUri: undefined,
        played: false,
        sentAt: nowIso(),
      },
    });
    dispatch({ type: "CALL_RESPOND", callId: call.id, status: "callback" });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${preset.emoji} Message from Parent!`,
        body: preset.text.slice(0, 80),
        sound: true,
      },
      trigger: null,
    }).catch(() => {});
    onClose();
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={s.callbackOverlay}>
        <View style={s.callbackSheet}>
          <Text style={s.callbackTitle}>😄 Choose a funny reply</Text>
          <Text style={s.callbackSub}>A popup will appear on {call.kidName}'s screen!</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {CALLBACK_PRESETS.map(preset => (
              <TouchableOpacity key={preset.id} style={s.callbackRow} onPress={() => sendCallback(preset)}>
                <Text style={{ fontSize: 32 }}>{preset.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.callbackLabel}>{preset.label}</Text>
                  <Text style={s.callbackText} numberOfLines={2}>{preset.text}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function IncomingCallsTab() {
  const { state, dispatch } = useData();
  const [callbackFor, setCallbackFor] = useState<IncomingCall | null>(null);

  // Start a new outgoing call (video or voice) from the Calls tab.
  // Posts a tappable join link to the family chat and pings all kids.
  function startCall(video: boolean) {
    const room = "spinini-family";
    const base = `https://meet.jit.si/${room}`;
    const url = video ? base : `${base}#config.startWithVideoMuted=true`;
    const kind = video ? "📹 Video call" : "📞 Voice call";

    state.kids.forEach(kid => {
      dispatch({
        type: "NOTIFICATION_ADD",
        kidId: kid.profile.id,
        notification: {
          id: uid(), kidId: kid.profile.id, kind: "ping",
          title: `${kind} from Parent`,
          body: "Open Call & Chat and tap the call link to join!",
          read: false, createdAt: nowIso(),
        },
      });
    });
    Notifications.scheduleNotificationAsync({
      content: { title: `${kind} started`, body: "Tap to join the call.", sound: true },
      trigger: null,
    }).catch(() => {});
    dispatch({
      type: "FAMILY_CHAT_PUSH",
      message: {
        id: uid(), text: `${kind} started — tap to join: ${url}`,
        authorId: AUTHOR_ID, authorName: AUTHOR_NAME,
        recipients: [], sentAt: nowIso(), readBy: [AUTHOR_ID],
      },
    });
    Linking.openURL(url).catch(() =>
      Alert.alert("Couldn't start the call", "Unable to open the call screen on this device."));
  }

  const calls = (state.incomingCalls ?? []);
  const ringing = calls.filter(c => c.status === "ringing");
  const recent  = calls.filter(c => c.status !== "ringing").slice(0, 20);

  function acceptVideo(call: IncomingCall) {
    dispatch({ type: "CALL_RESPOND", callId: call.id, status: "accepted" });
    const url = `https://meet.jit.si/${call.roomId}`;
    const deep = `jitsi-meet://${call.roomId}`;
    Linking.canOpenURL(deep)
      .then(can => Linking.openURL(can ? deep : url))
      .catch(() => Linking.openURL(url));
  }

  function acceptAudio(call: IncomingCall) {
    dispatch({ type: "CALL_RESPOND", callId: call.id, status: "accepted" });
    const kid = state.kids.find(k => k.profile.id === call.kidId);
    const contact = kid?.callContacts.find(c => c.id === call.contactId);
    if (contact?.phone) {
      Linking.openURL(`tel:${contact.phone}`).catch(() => {});
    } else {
      // No phone number saved — fall back to the in-app voice call (the Jitsi
      // room the call already carries) so it connects without a phone number.
      const url = `https://meet.jit.si/${call.roomId}#config.startWithVideoMuted=true`;
      Linking.openURL(url).catch(() =>
        Alert.alert("Couldn't answer", "Unable to open the call screen on this device."));
    }
  }

  function decline(call: IncomingCall) {
    dispatch({ type: "CALL_RESPOND", callId: call.id, status: "declined" });
  }

  const statusEmoji: Record<string, string> = {
    ringing: "📞", accepted: "✅", declined: "❌", callback: "😄", missed: "📵",
  };
  const statusLabel: Record<string, string> = {
    ringing: "Ringing", accepted: "Answered", declined: "Declined", callback: "Sent callback", missed: "Missed",
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>

      {/* ── Start a call ── */}
      <View style={s.callActionRow}>
        <TouchableOpacity style={[s.callActionBtn, s.callVideoBtn]} onPress={() => startCall(true)}>
          <Text style={s.callActionText}>📹  Video call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.callActionBtn, s.callVoiceBtn]} onPress={() => startCall(false)}>
          <Text style={s.callActionText}>📞  Voice call</Text>
        </TouchableOpacity>
      </View>

      {ringing.length === 0 && recent.length === 0 && (
        <View style={s.emptySection}>
          <Text style={{ fontSize: 56, textAlign: "center" }}>📭</Text>
          <Text style={s.emptyTitle}>No calls yet</Text>
          <Text style={s.emptySub}>When your child calls you, it will appear here.</Text>
        </View>
      )}

      {/* Active calls */}
      {ringing.length > 0 && (
        <>
          <Text style={s.sectionLabel}>INCOMING</Text>
          {ringing.map(call => {
            const kid = state.kids.find(k => k.profile.id === call.kidId);
            return (
              <View key={call.id} style={s.incomingCard}>
                <View style={s.incomingHeader}>
                  {kid && <Mascot type={kid.profile.mascot} size={48} animate />}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.incomingName}>{call.kidName}</Text>
                    <View style={s.incomingBadgeRow}>
                      <View style={[s.badge, { backgroundColor: call.callType === "video" ? "#DBEAFE" : "#D1FAE5" }]}>
                        <Text style={s.badgeText}>{call.callType === "video" ? "📹 Video" : "📞 Voice"}</Text>
                      </View>
                      <Text style={s.incomingTime}>{new Date(call.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                    </View>
                  </View>
                </View>

                <View style={s.actionRow}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#4ADE80" }]} onPress={() => acceptVideo(call)}>
                    <Text style={s.actionBtnEmoji}>📹</Text>
                    <Text style={s.actionBtnLabel}>Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#60A5FA" }]} onPress={() => acceptAudio(call)}>
                    <Text style={s.actionBtnEmoji}>📞</Text>
                    <Text style={s.actionBtnLabel}>Audio</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#FBBF24" }]} onPress={() => setCallbackFor(call)}>
                    <Text style={s.actionBtnEmoji}>😄</Text>
                    <Text style={s.actionBtnLabel}>Call back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: Colors.error + "30" }]} onPress={() => decline(call)}>
                    <Text style={s.actionBtnEmoji}>📵</Text>
                    <Text style={s.actionBtnLabel}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Recent call history */}
      {recent.length > 0 && (
        <>
          <Text style={[s.sectionLabel, { marginTop: 16 }]}>RECENT</Text>
          {recent.map(call => (
            <View key={call.id} style={s.historyRow}>
              <Text style={{ fontSize: 22 }}>{statusEmoji[call.status] ?? "📞"}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.historyName}>{call.kidName}</Text>
                <Text style={s.historyMeta}>{call.callType === "video" ? "Video" : "Voice"} · {statusLabel[call.status]}</Text>
              </View>
              <Text style={s.historyTime}>{new Date(call.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          ))}
        </>
      )}

      {callbackFor && (
        <CallbackPicker call={callbackFor} onClose={() => setCallbackFor(null)} />
      )}
    </ScrollView>
  );
}

// ─── Call Contacts Tab ────────────────────────────────────────────────────────

const CONTACT_COLORS = ["#E8D5FF","#D4E8FF","#D4F0E8","#FFF3D4","#FFD4D4","#D4FFE8"];
const CONTACT_EMOJIS = ["👩","👨","👴","👵","👱‍♀️","👱","🧑","👧","👦","🧓","👩‍🦰","👨‍🦰"];

const CALL_MODE_OPTIONS: { mode: CallMode; emoji: string; label: string; sub: string }[] = [
  { mode: "app",    emoji: "🎯", label: "App Only",   sub: "Always use Spinini" },
  { mode: "native", emoji: "📱", label: "Phone Only", sub: "Use device dialer" },
  { mode: "smart",  emoji: "🤝", label: "Smart",      sub: "App → phone fallback" },
];

function AddContactModal({
  onAdd, onClose,
}: {
  onAdd: (c: Omit<CallContact, "id">) => void;
  onClose: () => void;
}) {
  const [name, setName]       = useState("");
  const [role, setRole]       = useState("");
  const [phone, setPhone]     = useState("");
  const [emoji, setEmoji]     = useState("👩");
  const [color, setColor]     = useState(CONTACT_COLORS[0]);
  const [callMode, setCallMode] = useState<CallMode | undefined>(undefined); // undefined = use global

  function save() {
    if (!name.trim() || !role.trim()) {
      Alert.alert("Required", "Please enter a name and role (e.g. 'Mom', 'Grandpa').");
      return;
    }
    onAdd({ name: name.trim(), role: role.trim(), phone: phone.trim() || undefined, emoji, color, callMode });
    onClose();
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={s.callbackOverlay}>
        <ScrollView contentContainerStyle={s.callbackSheet} keyboardShouldPersistTaps="handled">
          <Text style={s.callbackTitle}>👥 Add Call Contact</Text>

          {/* Emoji picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: "100%" }}>
            {CONTACT_EMOJIS.map(e => (
              <TouchableOpacity key={e} style={[s.emojiOption, emoji === e && s.emojiOptionActive]} onPress={() => setEmoji(e)}>
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Color picker */}
          <View style={s.colorRow}>
            {CONTACT_COLORS.map(c => (
              <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotActive]} onPress={() => setColor(c)} />
            ))}
          </View>

          <TextInput style={s.fieldInput} placeholder="Name (e.g. Mom, Grandpa)" value={name} onChangeText={setName} />
          <TextInput style={s.fieldInput} placeholder="Role shown to kid (e.g. Mom, Dad)" value={role} onChangeText={setRole} />
          <TextInput style={s.fieldInput} placeholder="Phone number (for voice & smart calls)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          {/* Per-contact call mode override */}
          <Text style={s.modeLabel}>📞 Call Mode for this contact</Text>
          <View style={s.modePicker}>
            <TouchableOpacity
              style={[s.modeBtn, callMode === undefined && s.modeBtnActive]}
              onPress={() => setCallMode(undefined)}
            >
              <Text style={s.modeBtnEmoji}>🌐</Text>
              <Text style={s.modeBtnText}>Use Global</Text>
            </TouchableOpacity>
            {CALL_MODE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.mode}
                style={[s.modeBtn, callMode === opt.mode && s.modeBtnActive]}
                onPress={() => setCallMode(opt.mode)}
              >
                <Text style={s.modeBtnEmoji}>{opt.emoji}</Text>
                <Text style={s.modeBtnText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.saveBtn} onPress={save}>
            <Text style={s.saveBtnText}>Add Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ContactsTab() {
  const { state, dispatch } = useData();
  const [showAdd, setShowAdd] = useState<string | null>(null); // kidId

  const globalMode: CallMode = state.parentSettings.callMode ?? "smart";

  function setGlobalCallMode(mode: CallMode) {
    dispatch({ type: "SET_PARENT_SETTINGS", payload: { callMode: mode } });
  }

  function addContact(kidId: string, contact: Omit<CallContact, "id">) {
    const kid = state.kids.find(k => k.profile.id === kidId);
    if (!kid) return;
    const existing = kid.callContacts ?? [];
    dispatch({
      type: "SET_CALL_CONTACTS",
      kidId,
      contacts: [...existing, { ...contact, id: uid() }],
    });
  }

  function removeContact(kidId: string, contactId: string) {
    const kid = state.kids.find(k => k.profile.id === kidId);
    if (!kid) return;
    Alert.alert("Remove Contact", "Remove this contact from the kid's call screen?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => dispatch({
          type: "SET_CALL_CONTACTS",
          kidId,
          contacts: (kid.callContacts ?? []).filter(c => c.id !== contactId),
        }),
      },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>

      {/* Global call mode selector */}
      <View style={s.globalModeCard}>
        <Text style={s.globalModeTitle}>📞 Default Call Mode</Text>
        <Text style={s.globalModeSub}>How quick-call buttons work for all contacts (can override per contact)</Text>
        <View style={s.globalModeRow}>
          {CALL_MODE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.mode}
              style={[s.globalModeBtn, globalMode === opt.mode && s.globalModeBtnActive]}
              onPress={() => setGlobalCallMode(opt.mode)}
            >
              <Text style={s.globalModeBtnEmoji}>{opt.emoji}</Text>
              <Text style={[s.globalModeBtnLabel, globalMode === opt.mode && s.globalModeBtnLabelActive]}>{opt.label}</Text>
              <Text style={s.globalModeBtnSub}>{opt.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.contactsInfo}>
        <Text style={s.contactsInfoText}>
          👇 The first 4 contacts appear as big buttons on your child's call screen. Add more and they'll be in a "More" list.
        </Text>
      </View>

      {state.kids.map(kid => {
        const contacts: CallContact[] = kid.callContacts ?? [];
        const allContacts: CallContact[] = [
          { id: "__parent__", name: state.parentSettings.name || "You", role: "Parent", emoji: state.parentSettings.emoji || "👩", color: "#E8D5FF" },
          ...(state.coParents ?? []).map(cp => ({
            id: cp.id, name: cp.name, role: cp.role === "admin" ? "Parent" : "Family",
            emoji: cp.emoji, color: "#D4E8FF",
          })),
          ...contacts,
        ];

        return (
          <View key={kid.profile.id} style={s.kidSection}>
            <View style={[s.kidSectionHeader, { backgroundColor: PASTEL_COLORS[kid.profile.color] }]}>
              <Mascot type={kid.profile.mascot} size={36} animate={false} />
              <Text style={s.kidSectionName}>{kid.profile.name}</Text>
              <View style={s.kidCountBadge}>
                <Text style={s.kidCountText}>{allContacts.length} contacts</Text>
              </View>
            </View>

            {/* Built-in contacts (parent + co-parents) */}
            <View style={s.builtInRow}>
              <Text style={s.builtInLabel}>Always available (from parent accounts):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {allContacts.filter(c => c.id === "__parent__" || (state.coParents ?? []).some(cp => cp.id === c.id)).map(c => (
                  <View key={c.id} style={[s.builtInChip, { backgroundColor: c.color }]}>
                    <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                    <Text style={s.builtInChipName}>{c.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Custom contacts */}
            {contacts.map((c, i) => (
              <View key={c.id} style={s.contactRow}>
                <View style={[s.contactAvatar, { backgroundColor: c.color }]}>
                  <Text style={{ fontSize: 26 }}>{c.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.contactName}>{c.name}</Text>
                  <Text style={s.contactMeta}>{c.role}{c.phone ? ` · ${c.phone}` : ""}</Text>
                  {i < 4 - (state.coParents ?? []).length - 1 ? (
                    <Text style={s.contactSlot}>Slot {i + 2} of 4 (main screen)</Text>
                  ) : (
                    <Text style={[s.contactSlot, { color: Colors.textMuted }]}>In "More" list</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => removeContact(kid.profile.id, c.id)} style={{ padding: 8 }}>
                  <Text style={{ fontSize: 18, color: Colors.error }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={s.addContactBtn} onPress={() => setShowAdd(kid.profile.id)}>
              <Text style={s.addContactBtnText}>+ Add Custom Contact for {kid.profile.name}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {showAdd && (
        <AddContactModal
          onAdd={c => addContact(showAdd, c)}
          onClose={() => setShowAdd(null)}
        />
      )}
    </ScrollView>
  );
}

// ─── Ping Tab ─────────────────────────────────────────────────────────────────

const PING_PRESETS = [
  "Dinner's ready! 🍕",
  "Time to come home! 🏠",
  "Bed time! 🌙",
  "I love you! ❤️",
  "Good morning! ☀️",
  "How are you doing? 😊",
];

const CO_PARENT_PING_PRESETS = [
  "Can you pick up the kids? 🚗",
  "Running late — can you cover? ⏰",
  "Check the app when you can 📲",
  "Kids are ready! 👧👦",
  "Let's sync on schedules 📅",
  "Important — call me when free 📞",
];

function PingTab() {
  const { state, dispatch } = useData();
  const coParents = state.coParents ?? [];
  // "all" selection targets are kidIds or coParent ids prefixed with "cp:"
  const [selectedTarget, setSelectedTarget] = useState(state.kids[0]?.profile.id ?? "");
  const [msg, setMsg] = useState("");

  const isCoParentTarget = coParents.some(cp => cp.id === selectedTarget);
  const selectedCoParent = coParents.find(cp => cp.id === selectedTarget);
  const selectedKid = state.kids.find(k => k.profile.id === selectedTarget);

  function sendPing(text: string) {
    if (!selectedTarget) return;

    if (isCoParentTarget && selectedCoParent) {
      // Co-parent ping — send as a private DM in family chat
      dispatch({
        type: "FAMILY_CHAT_PUSH",
        message: {
          id: uid(),
          text: `📣 ${text}`,
          authorId: AUTHOR_ID, authorName: AUTHOR_NAME,
          recipients: [selectedCoParent.id],
          sentAt: nowIso(), readBy: [AUTHOR_ID],
        },
      });
      Notifications.scheduleNotificationAsync({
        content: { title: `📣 Ping from ${AUTHOR_NAME}`, body: text, sound: true },
        trigger: null,
      }).catch(() => {});
    } else if (selectedKid) {
      dispatch({
        type: "NOTIFICATION_ADD",
        kidId: selectedTarget,
        notification: {
          id: uid(), kidId: selectedTarget, kind: "ping",
          title: "📣 Parent",
          body: text,
          read: false, createdAt: nowIso(),
        },
      });
      Notifications.scheduleNotificationAsync({
        content: { title: `📣 Message for ${selectedKid.profile.name}`, body: text, sound: true },
        trigger: null,
      }).catch(() => {});
    }
    setMsg("");
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
      {/* Unified selector — kids + co-parents */}
      <Text style={s.sectionLabel}>PING WHO?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        {state.kids.map(k => (
          <TouchableOpacity
            key={k.profile.id}
            style={[s.kidChip, selectedTarget === k.profile.id && s.kidChipActive]}
            onPress={() => setSelectedTarget(k.profile.id)}
          >
            <Mascot type={k.profile.mascot} size={28} animate={false} />
            <Text style={[s.kidChipText, selectedTarget === k.profile.id && s.kidChipTextActive]}>{k.profile.name}</Text>
          </TouchableOpacity>
        ))}
        {coParents.map(cp => (
          <TouchableOpacity
            key={cp.id}
            style={[s.kidChip, s.kidChipCoParent, selectedTarget === cp.id && s.kidChipCoParentActive]}
            onPress={() => setSelectedTarget(cp.id)}
          >
            <Text style={{ fontSize: 22 }}>{cp.emoji}</Text>
            <Text style={[s.kidChipText, selectedTarget === cp.id && { color: "#fff" }]}>{cp.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Co-parent context banner */}
      {isCoParentTarget && (
        <View style={s.coParentPingBanner}>
          <Text style={s.coParentPingBannerText}>
            🤝 Pinging {selectedCoParent?.emoji} {selectedCoParent?.name} — they'll see it in the Chat tab as a private message
          </Text>
        </View>
      )}

      <Text style={s.sectionLabel}>QUICK PINGS</Text>
      <View style={s.presetGrid}>
        {(isCoParentTarget ? CO_PARENT_PING_PRESETS : PING_PRESETS).map(p => (
          <TouchableOpacity key={p} style={[s.presetChip, isCoParentTarget && s.presetChipCoParent]} onPress={() => sendPing(p)}>
            <Text style={[s.presetText, isCoParentTarget && s.presetTextCoParent]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.sectionLabel, { marginTop: 16 }]}>CUSTOM MESSAGE</Text>
      <View style={s.customRow}>
        <TextInput
          style={s.customInput}
          value={msg}
          onChangeText={setMsg}
          placeholder={isCoParentTarget ? `Message to ${selectedCoParent?.name}…` : "Type a message… or tap 🎙️"}
          multiline
        />
        <MicButton appendTo={msg} onAppend={setMsg} onResult={setMsg} size={34} />
        <TouchableOpacity style={[s.sendBtn, !msg.trim() && s.sendBtnDim]} onPress={() => sendPing(msg)} disabled={!msg.trim()}>
          <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ParentCommunicateScreen() {
  const { state } = useData();
  const [activeTab, setActiveTab] = useState<Tab>("calls");
  const coParents = state.coParents ?? [];

  const ringingCount = (state.incomingCalls ?? []).filter(c => c.status === "ringing").length;

  return (
    <View style={{ flex: 1, backgroundColor: "#FAF7FF" }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>📡 Call & Chat</Text>
        <Text style={s.headerSub}>
          {coParents.length > 0
            ? `Connect with your kids & ${coParents.map(cp => cp.name).join(", ")}`
            : "Connect with your kids"}
        </Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <View>
              <Text style={s.tabEmoji}>{tab.emoji}</Text>
              {tab.id === "calls" && ringingCount > 0 && (
                <View style={s.tabBadge}><Text style={s.tabBadgeText}>{ringingCount}</Text></View>
              )}
            </View>
            <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>{tab.label}</Text>
            {activeTab === tab.id && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Co-parent tip — shown when at least one co-parent is registered */}
      {coParents.length > 0 && (
        <View style={s.coParentTip}>
          <Text style={s.coParentTipText}>
            🤝 You can also ping or message {coParents.length === 1 ? coParents[0].name : "your co-parent"} privately — tap their name in <Text style={{ fontWeight: "800" }}>Chat</Text> or <Text style={{ fontWeight: "800" }}>Ping</Text>!
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {activeTab === "calls"    && <IncomingCallsTab />}
        {activeTab === "chat"     && <ChatTab />}
        {activeTab === "contacts" && <ContactsTab />}
        {activeTab === "ping"     && <PingTab />}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header:      { paddingTop: 52, paddingBottom: Spacing.sm, paddingHorizontal: Spacing.lg, backgroundColor: Colors.primary },
  headerTitle: { fontSize: FontSize.xl, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: FontSize.sm, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  tabBar: { flexDirection: "row", backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm },
  tab:    { flex: 1, alignItems: "center", paddingVertical: 10, position: "relative" },
  tabActive: {},
  tabEmoji:  { fontSize: 20 },
  tabLabel:  { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginTop: 1 },
  tabLabelActive: { color: "#fff" },
  tabIndicator: { position: "absolute", bottom: 0, left: "15%", right: "15%", height: 3, backgroundColor: Colors.secondary, borderRadius: 2 },
  tabBadge: { position: "absolute", top: -4, right: -8, backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  tabBadgeText: { fontSize: 9, color: "#fff", fontWeight: "800" },

  // Chat
  filterBar: { maxHeight: 44, paddingHorizontal: Spacing.sm, paddingVertical: 6, backgroundColor: Colors.surfaceLight },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  filterChipActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  filterTextActive: { color: "#fff" },
  bubble:     { maxWidth: "78%", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8 },
  bubbleMe:   { backgroundColor: Colors.primary, alignSelf: "flex-end" },
  bubbleThem: { backgroundColor: Colors.surfaceLight, alignSelf: "flex-start", ...Shadow.sm },
  author:     { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  msgText:    { fontSize: FontSize.base },
  msgMe:      { color: "#fff" },
  msgThem:    { color: Colors.textPrimary },
  time:       { fontSize: 9, opacity: 0.55, marginTop: 3, alignSelf: "flex-end" },
  inputRow:   { flexDirection: "row", gap: 8, padding: Spacing.sm, backgroundColor: Colors.surfaceLight, borderTopWidth: 1, borderTopColor: Colors.border },
  input:      { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: "#fff", fontSize: FontSize.base, maxHeight: 100 },
  sendBtn:    { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  photoBtn:   { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  chatImage:  { width: 200, height: 200, borderRadius: Radius.md, marginBottom: 6, backgroundColor: Colors.cardLight },
  sendBtnDim: { backgroundColor: Colors.primary + "60" },
  empty:      { textAlign: "center", color: Colors.textSecondary, padding: Spacing.xl },

  // Incoming calls
  sectionLabel: { fontSize: 11, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 8 },
  incomingCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 12, borderWidth: 2, borderColor: Colors.success + "60", ...Shadow.md },
  incomingHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  incomingName:   { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  incomingBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  badge:    { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:{ fontSize: FontSize.xs, fontWeight: "700", color: Colors.textPrimary },
  incomingTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, borderRadius: Radius.lg, paddingVertical: 12, alignItems: "center", gap: 4 },
  actionBtnEmoji: { fontSize: 22 },
  actionBtnLabel: { fontSize: 10, fontWeight: "700", color: Colors.textPrimary },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  historyName:{ fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  historyMeta:{ fontSize: FontSize.sm, color: Colors.textSecondary },
  historyTime:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  emptySection: { paddingTop: 60, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptySub:   { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },

  // Callback picker
  callbackOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  callbackSheet:   { backgroundColor: Colors.bgLight, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.lg, gap: 12, alignItems: "center", maxHeight: "85%" },
  callbackTitle:   { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  callbackSub:     { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginTop: -8 },
  callbackRow:     { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, width: "100%" },
  callbackLabel:   { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  callbackText:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cancelBtn:       { paddingVertical: 12, paddingHorizontal: 24 },
  cancelBtnText:   { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: "600" },

  // Contacts tab
  contactsInfo:     { backgroundColor: Colors.primary + "10", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 16 },
  contactsInfoText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", lineHeight: 20 },
  kidSection:       { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 16, overflow: "hidden", ...Shadow.sm },
  kidSectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: Spacing.md },
  kidSectionName:   { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, flex: 1 },
  kidCountBadge:    { backgroundColor: "rgba(0,0,0,0.12)", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  kidCountText:     { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textPrimary },
  builtInRow:       { padding: Spacing.sm },
  builtInLabel:     { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 8, fontWeight: "600" },
  builtInChip:      { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  builtInChipName:  { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  contactRow:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: Spacing.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  contactAvatar:    { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  contactName:      { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  contactMeta:      { fontSize: FontSize.xs, color: Colors.textSecondary },
  contactSlot:      { fontSize: 10, color: Colors.success, fontWeight: "700", marginTop: 2 },
  addContactBtn:    { margin: Spacing.md, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.primary, borderStyle: "dashed", padding: Spacing.md, alignItems: "center" },
  addContactBtnText:{ fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },

  // Global call mode card
  globalModeCard:       { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 16, ...Shadow.sm },
  globalModeTitle:      { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  globalModeSub:        { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 12 },
  globalModeRow:        { flexDirection: "row", gap: 8 },
  globalModeBtn:        { flex: 1, alignItems: "center", gap: 4, borderRadius: Radius.lg, padding: 10, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: "transparent" },
  globalModeBtnActive:  { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  globalModeBtnEmoji:   { fontSize: 24 },
  globalModeBtnLabel:   { fontSize: 11, fontWeight: "800", color: Colors.textSecondary, textAlign: "center" },
  globalModeBtnLabelActive: { color: Colors.primary },
  globalModeBtnSub:     { fontSize: 9, color: Colors.textSecondary, textAlign: "center", lineHeight: 12 },

  // Add contact modal
  emojiOption:      { padding: 8, borderRadius: 12, marginRight: 4 },
  emojiOptionActive:{ backgroundColor: Colors.primary + "30" },
  colorRow:         { flexDirection: "row", gap: 10, marginVertical: 4, flexWrap: "wrap", justifyContent: "center" },
  colorDot:         { width: 32, height: 32, borderRadius: 16 },
  colorDotActive:   { borderWidth: 3, borderColor: Colors.primary },
  fieldInput:       { width: "100%", borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, backgroundColor: "#fff" },
  modeLabel:        { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, alignSelf: "flex-start", marginTop: 4 },
  modePicker:       { flexDirection: "row", gap: 6, width: "100%", flexWrap: "wrap" },
  modeBtn:          { flex: 1, minWidth: 72, alignItems: "center", gap: 2, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 4, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: "transparent" },
  modeBtnActive:    { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  modeBtnEmoji:     { fontSize: 20 },
  modeBtnText:      { fontSize: 9, fontWeight: "700", color: Colors.textSecondary, textAlign: "center" },
  saveBtn:          { width: "100%", backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center" },
  saveBtnText:      { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // Ping
  presetGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetChip:    { backgroundColor: Colors.primary + "15", borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 10 },
  presetText:    { fontSize: FontSize.sm, fontWeight: "600", color: Colors.primary },
  presetChipCoParent:  { backgroundColor: "#7C3AED" + "15" },
  presetTextCoParent:  { color: "#7C3AED" },
  customRow:     { flexDirection: "row", gap: 8, marginTop: 8 },
  customInput:   { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, fontSize: FontSize.base, maxHeight: 100, backgroundColor: "#fff" },
  kidChip:            { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  kidChipActive:      { backgroundColor: Colors.primary },
  kidChipCoParent:    { backgroundColor: "#EDE9FE", borderWidth: 1.5, borderColor: "#7C3AED44" },
  kidChipCoParentActive: { backgroundColor: "#7C3AED" },
  kidChipText:        { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive:  { color: "#fff" },

  // Co-parent tip banner (below tab bar)
  coParentTip:     { backgroundColor: "#EDE9FE", paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#7C3AED33" },
  coParentTipText: { fontSize: FontSize.xs, color: "#5B21B6", lineHeight: 18 },

  // Chat filter extras
  filterDivider:            { width: 1, height: 24, backgroundColor: Colors.border, marginHorizontal: 4, alignSelf: "center" },
  filterChipCoParent:       { backgroundColor: "#EDE9FE", borderWidth: 1.5, borderColor: "#7C3AED33" },
  filterChipCoParentActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },

  // Co-parent DM banner (inside chat)
  coParentDMBanner: { backgroundColor: "#EDE9FE", paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#7C3AED22" },
  coParentDMText:   { fontSize: FontSize.xs, color: "#5B21B6", fontWeight: "600" },

  // Live P2P presence banner
  liveBanner:     { backgroundColor: "#DCFCE7", paddingHorizontal: Spacing.md, paddingVertical: 6 },
  liveBannerText: { fontSize: FontSize.xs, color: "#166534", fontWeight: "700" },

  // Co-parent ping info banner (inside ping tab)
  coParentPingBanner:     { backgroundColor: "#EDE9FE", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 12, borderWidth: 1, borderColor: "#7C3AED33" },
  coParentPingBannerText: { fontSize: FontSize.xs, color: "#5B21B6", lineHeight: 18 },

  // Start-call action row (inside chat tab)
  callActionRow:  { flexDirection: "row", gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  callActionBtn:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: Radius.lg },
  callVideoBtn:   { backgroundColor: "#4ADE80" },
  callVoiceBtn:   { backgroundColor: "#60A5FA" },
  callActionText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
});
