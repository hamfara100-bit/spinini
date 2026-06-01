import React, { useState } from "react";
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, TextInput,
  Alert, Modal, ScrollView, Share, Platform, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AI_KEY_STORAGE } from "../../../lib/ai";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid } from "../../../lib/utils";
import { getRecoveryCode, saveRecoveryCode, deleteRecoveryCode } from "../../../lib/secure-tokens";
import { CoParent, CoParentRole } from "../../../lib/data/types";

const ROLE_META: Record<CoParentRole, { label: string; desc: string; color: string }> = {
  admin:    { label: "Admin",   desc: "Full access — same as primary parent", color: Colors.primary },
  coparent: { label: "Co-Parent", desc: "Can manage kids, approve chores, view reports", color: "#10B981" },
  viewer:   { label: "Viewer",  desc: "Read-only access to reports and activity", color: "#F59E0B" },
};

function generateRecoveryCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 12 }, (_, i) =>
    (i > 0 && i % 4 === 0 ? "-" : "") + chars[Math.floor(Math.random() * chars.length)]
  ).join("").replace(/-\s*/g, (m, o) => (o > 0 ? "-" : ""));
}

export default function SettingsScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const [name, setName]               = useState(state.parentSettings.name);
  const [aiKey, setAiKey]             = useState("");
  const [aiKeySaved, setAiKeySaved]   = useState(false);
  const [showPinModal, setShowPinModal]     = useState(false);

  // Load stored AI key on mount
  React.useEffect(() => {
    AsyncStorage.getItem(AI_KEY_STORAGE).then(k => {
      if (k) setAiKey(k);
    }).catch(() => {});
  }, []);
  const [showCoParentModal, setShowCoParentModal] = useState(false);
  const [editCoParent, setEditCoParent] = useState<CoParent | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep]     = useState<"confirm" | "pin" | "deleting">("confirm");
  const [deletePin, setDeletePin]       = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  // Load recovery code from SecureStore on mount
  React.useEffect(() => {
    getRecoveryCode().then(setRecoveryCode).catch(() => {});
  }, []);

  async function generateNewRecoveryCode() {
    const code = generateRecoveryCode();
    await saveRecoveryCode(code);
    setRecoveryCode(code);
    Alert.alert(
      "Recovery Code Generated",
      `Your new recovery code is:\n\n${code}\n\nSave this somewhere safe. You can use it to reset your PIN if you forget it.`,
      [
        { text: "Copy & Close", onPress: () => Share.share({ message: `Spinini PIN Recovery Code: ${code}` }) },
        { text: "OK" },
      ]
    );
  }

  function showRecoveryCode() {
    if (!recoveryCode) { generateNewRecoveryCode(); return; }
    Alert.alert("Your Recovery Code", `${recoveryCode}\n\nKeep this safe — it lets you reset your parent PIN.`, [
      { text: "Share", onPress: () => Share.share({ message: `Spinini PIN Recovery Code: ${recoveryCode}` }) },
      { text: "Regenerate", onPress: generateNewRecoveryCode },
      { text: "OK" },
    ]);
  }

  function removeCoParent(id: string, name: string) {
    Alert.alert("Remove Co-Parent?", `Remove ${name}? They will lose access to Spinini.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "CO_PARENT_REMOVE", id }) },
    ]);
  }

  async function confirmDeleteAccount() {
    if (deletePin !== state.parentSettings.pin) {
      Alert.alert("Wrong PIN", "The PIN you entered is incorrect.");
      return;
    }
    setDeleteStep("deleting");
    try {
      // Wipe all AsyncStorage keys belonging to this app
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys as string[]);
    } catch (_) { /* best-effort */ }
    // Reset in-memory state — go to role chooser so the device can be
    // re-assigned as parent or child after a full reset.
    dispatch({ type: "RESET_APP" });
    setShowDeleteModal(false);
    router.replace("/onboarding");
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>⚙️ Settings</Text>

      {/* Parent Profile */}
      <Text style={styles.section}>Parent Profile</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          onBlur={() => dispatch({ type: "SET_PARENT_SETTINGS", payload: { name } })}
          placeholder="Your name"
          placeholderTextColor={Colors.textSecondary}
        />
      </View>

      {/* PIN & Security */}
      <Text style={styles.section}>PIN & Security</Text>
      <TouchableOpacity style={styles.card} onPress={() => setShowPinModal(true)}>
        <View style={styles.row}>
          <View>
            <Text style={styles.cardTitle}>Change Parent PIN</Text>
            <Text style={styles.cardSub}>Update your 4-digit access code</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={showRecoveryCode}>
        <View style={styles.row}>
          <View>
            <Text style={styles.cardTitle}>PIN Recovery Code</Text>
            <Text style={styles.cardSub}>{recoveryCode ? "Code saved — tap to view or regenerate" : "Generate a backup recovery code"}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: recoveryCode ? Colors.success + "20" : Colors.warning + "20" }]}>
            <Text style={{ color: recoveryCode ? Colors.success : Colors.warning, fontSize: 11, fontWeight: "700" }}>
              {recoveryCode ? "✓ Saved" : "! Set up"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Co-Parents */}
      <Text style={styles.section}>Co-Parents</Text>
      <View style={styles.card}>
        <Text style={[styles.cardSub, { marginBottom: Spacing.sm }]}>
          Add family members who can access Spinini with their own PIN and role.
        </Text>
        {(state.coParents ?? []).map(cp => (
          <View key={cp.id} style={styles.coParentRow}>
            <Text style={styles.coParentEmoji}>{cp.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.coParentName}>{cp.name}</Text>
              <View style={[styles.rolePill, { backgroundColor: ROLE_META[cp.role].color + "20" }]}>
                <Text style={[styles.rolePillText, { color: ROLE_META[cp.role].color }]}>
                  {ROLE_META[cp.role].label}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { setEditCoParent(cp); setShowCoParentModal(true); }}>
              <Text style={styles.editBtn}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeCoParent(cp.id, cp.name)}>
              <Text style={styles.deleteBtn}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={styles.addCoParentBtn}
          onPress={() => { setEditCoParent(null); setShowCoParentModal(true); }}
        >
          <Text style={styles.addCoParentBtnText}>+ Add Co-Parent</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <Text style={styles.section}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View><Text style={styles.cardTitle}>Uninstall Protection</Text><Text style={styles.cardSub}>Prevent kids from uninstalling</Text></View>
          <Switch
            value={state.parentSettings.uninstallProtection}
            onValueChange={v => dispatch({ type: "SET_PARENT_SETTINGS", payload: { uninstallProtection: v } })}
            trackColor={{ true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <View><Text style={styles.cardTitle}>Weekly Email Digest</Text><Text style={styles.cardSub}>Receive weekly usage summary</Text></View>
          <Switch
            value={state.parentSettings.emailDigest}
            onValueChange={v => dispatch({ type: "SET_PARENT_SETTINGS", payload: { emailDigest: v } })}
            trackColor={{ true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Data & Storage */}
      <Text style={styles.section}>Data & Storage</Text>
      <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: "#F59E0B" }]}>
        <Text style={styles.cardTitle}>📱 Data stored on this device only</Text>
        <Text style={[styles.cardSub, { marginTop: 6, lineHeight: 20 }]}>
          All family profiles, chores, journals, screen time history, and settings
          are saved locally on this device using secure device storage.{"\n\n"}
          <Text style={{ fontWeight: "700", color: "#B45309" }}>
            If this device is lost, reset, or the app is uninstalled, your data
            cannot be recovered.
          </Text>{"\n\n"}
          Back up your phone regularly using iCloud or Google One, or use the
          ☁️ Cloud Backup feature to save to your Google Drive.
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            style={[styles.addCoParentBtn, { flex: 1 }]}
            onPress={() => Alert.alert(
              "How to protect your data",
              "1. Enable iCloud Backup (iOS) or Google One Backup (Android) in your phone Settings.\n\n2. Use Spinini Cloud Backup (☁️ Cloud Backup) to sync to your Google Drive.\n\n3. Never uninstall the app without exporting your reports first.",
            )}
          >
            <Text style={styles.addCoParentBtnText}>📖 Learn more →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addCoParentBtn, { flex: 1, backgroundColor: "#10B98115", borderColor: "#10B981" }]}
            onPress={() => {
              dispatch({ type: "CLOUD_BACKUP_UPDATE", payload: { enabled: true, autoBackup: true, provider: "google_drive", lastBackupAt: new Date().toISOString() } });
              dispatch({ type: "SET_LAST_BACKUP", timestamp: new Date().toISOString() });
              Alert.alert("☁️ Sync Triggered", "Family data has been marked for cloud sync. Connect Google Drive in ☁️ Cloud Backup settings for full backup.");
            }}
          >
            <Text style={[styles.addCoParentBtnText, { color: "#10B981" }]}>☁️ Sync Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤖 AI Features</Text>
        <Text style={[styles.cardSub, { marginBottom: 10 }]}>
          Powers AI Buddy chat, bedtime stories, and coloring pages. A free
          OpenRouter key is built in. You can override with your own key below
          for unlimited, faster responses.
        </Text>
        <TextInput
          style={styles.input}
          value={aiKey}
          onChangeText={v => { setAiKey(v); setAiKeySaved(false); }}
          placeholder="sk-or-... (optional — leave blank for built-in)"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={false}
        />
        <TouchableOpacity
          style={[styles.addCoParentBtn, { marginTop: 8 }]}
          onPress={async () => {
            try {
              if (aiKey.trim()) {
                await AsyncStorage.setItem(AI_KEY_STORAGE, aiKey.trim());
              } else {
                await AsyncStorage.removeItem(AI_KEY_STORAGE);
              }
              setAiKeySaved(true);
              Alert.alert("✅ Saved", aiKey.trim() ? "Your AI key has been saved. AI features will use it immediately." : "Using built-in AI key.");
            } catch {
              Alert.alert("Error", "Could not save the key. Please try again.");
            }
          }}
        >
          <Text style={styles.addCoParentBtnText}>
            {aiKeySaved ? "✅ Saved!" : "Save AI Key"}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.cardSub, { marginTop: 8, fontSize: 11 }]}>
          Get a free key at openrouter.ai · No personal data is sent to AI
        </Text>
      </View>

      {/* Subscription */}
      <Text style={styles.section}>Subscription</Text>
      <TouchableOpacity style={styles.card} onPress={() => router.push("/parent/(more)/subscription" as any)}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>💎 {
              state.parentSettings.subscriptionTier === "premium" ? "Premium Plan" :
              state.parentSettings.subscriptionTier === "family"  ? "Family Plan" :
              "Free Plan"
            }</Text>
            <Text style={styles.cardSub}>
              {state.parentSettings.subscriptionTier === "free"
                ? "Upgrade to unlock all features for your family"
                : `Active${state.parentSettings.subscriptionExpiresAt ? ` · renews ${new Date(state.parentSettings.subscriptionExpiresAt).toLocaleDateString()}` : ""}`}
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Sign In with Apple — required when app includes third-party sign-in */}
      {Platform.OS === "ios" && (
        <>
          <Text style={styles.section}>Sign In</Text>
          <View style={styles.card}>
            {state.parentSettings.appleUserId ? (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}> Signed in with Apple</Text>
                  <Text style={styles.cardSub}>
                    {state.parentSettings.appleFullName ?? state.parentSettings.appleEmail ?? "Apple ID linked"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.badge, { backgroundColor: Colors.error + "15" }]}
                  onPress={() => Alert.alert("Unlink Apple ID?", "You can still access the app with your PIN.", [
                    { text: "Cancel" },
                    { text: "Unlink", style: "destructive", onPress: () => dispatch({ type: "CLEAR_PARENT_APPLE" }) },
                  ])}
                >
                  <Text style={{ color: Colors.error, fontSize: 11, fontWeight: "700" }}>Unlink</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.cardTitle}>Sign In with Apple</Text>
                <Text style={[styles.cardSub, { marginBottom: Spacing.sm }]}>
                  Link your Apple ID for quick, secure access. Required for App Store compliance.
                </Text>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={10}
                  style={{ width: "100%", height: 48 }}
                  onPress={async () => {
                    try {
                      const cred = await AppleAuthentication.signInAsync({
                        requestedScopes: [
                          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                          AppleAuthentication.AppleAuthenticationScope.EMAIL,
                        ],
                      });
                      const fullName = cred.fullName
                        ? [cred.fullName.givenName, cred.fullName.familyName].filter(Boolean).join(" ")
                        : undefined;
                      dispatch({ type: "SET_PARENT_APPLE", userId: cred.user, email: cred.email ?? undefined, fullName: fullName || undefined });
                      Alert.alert("✅ Apple ID Linked", "Your Apple ID is now linked to Spinini.");
                    } catch (e: any) {
                      if (e?.code !== "ERR_REQUEST_CANCELED") Alert.alert("Sign In Failed", "Please try again.");
                    }
                  }}
                />
              </>
            )}
          </View>
        </>
      )}

      {/* Legal */}
      <Text style={styles.section}>Privacy & Legal</Text>
      <TouchableOpacity style={styles.card} onPress={() => router.push("/privacy-policy" as any)}>
        <View style={styles.row}>
          <View><Text style={styles.cardTitle}>🛡️ Privacy Policy</Text><Text style={styles.cardSub}>How we handle your family's data</Text></View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>🏛️ COPPA Compliant</Text>
            <Text style={styles.cardSub}>
              Consent given{state.parentSettings.consentDate
                ? ` on ${new Date(state.parentSettings.consentDate).toLocaleDateString()}`
                : ""}. All child data is stored locally on this device.
            </Text>
          </View>
          <Text style={{ fontSize: 20 }}>✅</Text>
        </View>
      </View>
      {Platform.OS === "ios" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🍎 iOS Screen Time API</Text>
          <Text style={styles.cardSub}>
            App blocking & downtime scheduling on iOS uses Apple's Screen Time API (FamilyControls entitlement). This requires separate Apple approval — currently pending.
          </Text>
        </View>
      )}

      {/* Danger Zone — required by Apple for apps that collect user data */}
      <Text style={[styles.section, { color: Colors.error }]}>Danger Zone</Text>
      <TouchableOpacity
        style={[styles.card, { borderLeftWidth: 4, borderLeftColor: Colors.error }]}
        onPress={() => { setDeleteStep("confirm"); setDeletePin(""); setShowDeleteModal(true); }}
      >
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: Colors.error }]}>🗑️ Delete Account & All Data</Text>
            <Text style={styles.cardSub}>
              Permanently erase all profiles, chores, journals, and settings from this device. This cannot be undone.
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>

      {/* About */}
      <Text style={styles.section}>About</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spinini</Text>
        <Text style={styles.cardSub}>Version 1.0.0 · Built with ❤️ for families</Text>
      </View>

      {/* Modals */}
      <ChangePinModal
        visible={showPinModal}
        currentPin={state.parentSettings.pin}
        onClose={() => setShowPinModal(false)}
        onSave={(pin) => {
          dispatch({ type: "SET_PARENT_SETTINGS", payload: { pin } });
          setShowPinModal(false);
          Alert.alert("PIN Updated", "Your new PIN has been saved.");
        }}
      />
      <CoParentModal
        visible={showCoParentModal}
        initial={editCoParent}
        onClose={() => setShowCoParentModal(false)}
        onSave={(cp) => {
          if (editCoParent) {
            dispatch({ type: "CO_PARENT_UPDATE", id: editCoParent.id, payload: cp });
          } else {
            dispatch({ type: "CO_PARENT_ADD", coParent: { ...cp, id: uid() } as CoParent });
          }
          setShowCoParentModal(false);
        }}
      />

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} animationType="slide" transparent onRequestClose={() => setShowDeleteModal(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            {deleteStep === "deleting" ? (
              <View style={{ alignItems: "center", gap: 16, paddingVertical: 32 }}>
                <ActivityIndicator size="large" color={Colors.error} />
                <Text style={[modal.headerTitle, { color: Colors.error }]}>Deleting all data…</Text>
              </View>
            ) : deleteStep === "pin" ? (
              <>
                <View style={modal.header}>
                  <Text style={[modal.headerTitle, { color: Colors.error }]}>Confirm with PIN</Text>
                  <TouchableOpacity onPress={() => setShowDeleteModal(false)}><Text style={modal.close}>✕</Text></TouchableOpacity>
                </View>
                <Text style={[modal.label, { marginBottom: Spacing.md }]}>
                  Enter your parent PIN to permanently delete all Spinini data from this device.
                </Text>
                <TextInput
                  style={modal.input}
                  value={deletePin}
                  onChangeText={setDeletePin}
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="••••"
                  placeholderTextColor={Colors.textSecondary}
                  autoFocus
                />
                <TouchableOpacity
                  style={[modal.saveBtn, { backgroundColor: Colors.error, marginTop: Spacing.lg }]}
                  onPress={confirmDeleteAccount}
                  disabled={deletePin.length !== 4}
                >
                  <Text style={modal.saveBtnText}>Delete Everything Permanently</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={{ alignItems: "center", marginTop: 12 }}>
                  <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={modal.header}>
                  <Text style={[modal.headerTitle, { color: Colors.error }]}>🗑️ Delete All Data?</Text>
                  <TouchableOpacity onPress={() => setShowDeleteModal(false)}><Text style={modal.close}>✕</Text></TouchableOpacity>
                </View>
                <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 22, marginBottom: Spacing.md }}>
                  This will <Text style={{ fontWeight: "800", color: Colors.error }}>permanently erase</Text> from this device:{"\n\n"}
                  • All kid profiles, names, and photos{"\n"}
                  • Screen time history and reports{"\n"}
                  • Chores, journals, drawings, and albums{"\n"}
                  • All parent settings and PIN{"\n"}
                  • AI buddy chat history{"\n\n"}
                  <Text style={{ fontWeight: "700" }}>This cannot be undone.</Text> Cloud backups (if any) will also be unlinked.
                </Text>
                <TouchableOpacity
                  style={[modal.saveBtn, { backgroundColor: Colors.error }]}
                  onPress={() => setDeleteStep("pin")}
                >
                  <Text style={modal.saveBtnText}>Yes, Delete Everything →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={{ alignItems: "center", marginTop: 12 }}>
                  <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>Cancel — Keep My Data</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function ChangePinModal({ visible, currentPin, onClose, onSave }: {
  visible: boolean; currentPin: string;
  onClose: () => void; onSave: (pin: string) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext]       = useState("");
  const [confirm, setConfirm] = useState("");

  function submit() {
    if (current !== currentPin) { Alert.alert("Wrong PIN", "Current PIN is incorrect."); return; }
    if (next.length !== 4 || !/^\d{4}$/.test(next)) { Alert.alert("Invalid PIN", "New PIN must be 4 digits."); return; }
    if (next !== confirm) { Alert.alert("Mismatch", "New PINs don't match."); return; }
    onSave(next);
    setCurrent(""); setNext(""); setConfirm("");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.header}>
            <Text style={modal.headerTitle}>Change PIN</Text>
            <TouchableOpacity onPress={onClose}><Text style={modal.close}>✕</Text></TouchableOpacity>
          </View>
          <Text style={modal.label}>Current PIN</Text>
          <TextInput style={modal.input} value={current} onChangeText={setCurrent} secureTextEntry keyboardType="number-pad" maxLength={4} placeholder="••••" placeholderTextColor={Colors.textSecondary} />
          <Text style={modal.label}>New PIN</Text>
          <TextInput style={modal.input} value={next} onChangeText={setNext} secureTextEntry keyboardType="number-pad" maxLength={4} placeholder="••••" placeholderTextColor={Colors.textSecondary} />
          <Text style={modal.label}>Confirm New PIN</Text>
          <TextInput style={modal.input} value={confirm} onChangeText={setConfirm} secureTextEntry keyboardType="number-pad" maxLength={4} placeholder="••••" placeholderTextColor={Colors.textSecondary} />
          <TouchableOpacity style={modal.saveBtn} onPress={submit}>
            <Text style={modal.saveBtnText}>Update PIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const EMOJIS = ["👩","👨","👴","👵","🧑","👩‍💻","👨‍💻","👩‍🏫","👨‍🏫","🧕","👲","🧔"];

function CoParentModal({ visible, initial, onClose, onSave }: {
  visible: boolean; initial: CoParent | null;
  onClose: () => void; onSave: (cp: Partial<CoParent>) => void;
}) {
  const [nameVal, setNameVal] = useState(initial?.name ?? "");
  const [emoji, setEmoji]     = useState(initial?.emoji ?? "👩");
  const [role, setRole]       = useState<CoParentRole>(initial?.role ?? "coparent");
  const [pin, setPin]         = useState(initial?.pin ?? "");

  React.useEffect(() => {
    if (visible) {
      setNameVal(initial?.name ?? "");
      setEmoji(initial?.emoji ?? "👩");
      setRole(initial?.role ?? "coparent");
      setPin(initial?.pin ?? "");
    }
  }, [visible, initial]);

  function submit() {
    if (!nameVal.trim()) { Alert.alert("Name required"); return; }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { Alert.alert("PIN must be 4 digits"); return; }
    onSave({ name: nameVal.trim(), emoji, role, pin });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.header}>
            <Text style={modal.headerTitle}>{initial ? "Edit Co-Parent" : "Add Co-Parent"}</Text>
            <TouchableOpacity onPress={onClose}><Text style={modal.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={modal.label}>Avatar</Text>
            <View style={modal.emojiRow}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} style={[modal.emojiCell, emoji === e && modal.emojiCellActive]} onPress={() => setEmoji(e)}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modal.label}>Name *</Text>
            <TextInput style={modal.input} value={nameVal} onChangeText={setNameVal} placeholder="e.g. Mom, Dad, Grandma" placeholderTextColor={Colors.textSecondary} />

            <Text style={modal.label}>PIN (4 digits) *</Text>
            <TextInput style={modal.input} value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={4} placeholder="••••" placeholderTextColor={Colors.textSecondary} />

            <Text style={modal.label}>Role</Text>
            {(Object.keys(ROLE_META) as CoParentRole[]).map(r => (
              <TouchableOpacity
                key={r}
                style={[modal.roleCard, role === r && { borderColor: ROLE_META[r].color, borderWidth: 2 }]}
                onPress={() => setRole(r)}
              >
                <View style={[modal.roleDot, { backgroundColor: ROLE_META[r].color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={modal.roleLabel}>{ROLE_META[r].label}</Text>
                  <Text style={modal.roleDesc}>{ROLE_META[r].desc}</Text>
                </View>
                {role === r && <Text style={{ color: ROLE_META[r].color, fontWeight: "700" }}>✓</Text>}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={modal.saveBtn} onPress={submit}>
              <Text style={modal.saveBtnText}>{initial ? "Save Changes" : "Add Co-Parent"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title:          { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  section:        { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.sm },
  card:           { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  cardTitle:      { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardSub:        { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  input:          { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, marginTop: 8 },
  row:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  arrow:          { fontSize: 24, color: Colors.textSecondary },
  badge:          { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  coParentRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  coParentEmoji:  { fontSize: 28 },
  coParentName:   { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  rolePill:       { alignSelf: "flex-start", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  rolePillText:   { fontSize: 11, fontWeight: "600" },
  editBtn:        { fontSize: 20, padding: 4 },
  deleteBtn:      { fontSize: 20, padding: 4 },
  addCoParentBtn: { backgroundColor: Colors.primary + "15", borderRadius: Radius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.sm },
  addCoParentBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
});

const modal = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:           { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: "90%" },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  headerTitle:     { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  close:           { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  label:           { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input:           { backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  emojiRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  emojiCell:       { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.surfaceLight, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  emojiCellActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "15" },
  roleCard:        { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  roleDot:         { width: 12, height: 12, borderRadius: 6 },
  roleLabel:       { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  roleDesc:        { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  saveBtn:         { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center", marginTop: Spacing.lg, marginBottom: Spacing.xl },
  saveBtnText:     { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
