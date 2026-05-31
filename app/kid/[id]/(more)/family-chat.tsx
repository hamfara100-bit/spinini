import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from "react-native";
import { MicButton } from "../../../../components/voice-text-input";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";

export default function FamilyChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();
  const kid = useKid(id);
  const [text, setText] = useState("");

  function send() {
    if (!text.trim()) return;
    dispatch({ type: "FAMILY_CHAT_PUSH", message: { id: uid(), text: text.trim(), authorId: id, authorName: kid?.profile.name ?? "Kid", recipients: [], sentAt: nowIso(), readBy: [] } });
    setText("");
  }

  const messages = state.familyMessages;

  return (
    <ScreenContainer>
      <Text style={styles.title}>💬 Family Chat</Text>
      <FlatList
        data={messages}
        keyExtractor={m => m.id}
        style={{ flex: 1 }}
        inverted
        contentContainerStyle={{ paddingVertical: Spacing.sm }}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No messages yet. Say hi! 👋</Text></View>}
        renderItem={({ item }) => {
          const isMe = item.authorId === id;
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {!isMe && <Text style={styles.author}>{item.authorName}</Text>}
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>{item.text}</Text>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Say something…" returnKeyType="send" onSubmitEditing={send} />
        <MicButton appendTo={text} onAppend={setText} onResult={setText} size={36} />
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={!text.trim()}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>↑</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  empty: { alignItems: "center", padding: Spacing.xl },
  emptyText: { color: Colors.textSecondary },
  bubble: { maxWidth: "78%", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8 },
  bubbleMe: { backgroundColor: Colors.primary, alignSelf: "flex-end" },
  bubbleThem: { backgroundColor: Colors.surfaceLight, alignSelf: "flex-start", ...Shadow.sm },
  author: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  msgText: { fontSize: FontSize.base },
  msgTextMe: { color: "#fff" },
  msgTextThem: { color: Colors.textPrimary },
  inputRow: { flexDirection: "row", gap: 8, paddingTop: Spacing.sm },
  input: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.md, height: 44, backgroundColor: Colors.surfaceLight },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
});
