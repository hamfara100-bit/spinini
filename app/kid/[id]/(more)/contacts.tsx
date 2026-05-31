import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";

export default function ContactsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);

  const contacts = kid?.contacts ?? [];

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📞 My Contacts</Text>
      {contacts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>👨‍👩‍👧</Text>
          <Text style={styles.emptyText}>Your parents will add emergency contacts here.</Text>
        </View>
      ) : (
        contacts.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={{ fontSize: 28 }}>{c.isEmergency ? "🆘" : "👤"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.relation}>{c.relation}</Text>
            </View>
            <View style={styles.actions}>
              {c.canCall && (
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                  <Text style={{ fontSize: 18 }}>📞</Text>
                </TouchableOpacity>
              )}
              {c.canText && (
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`sms:${c.phone}`)}>
                  <Text style={{ fontSize: 18 }}>💬</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  empty: { alignItems: "center", padding: Spacing.xl, gap: 12 },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm },
  name: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  relation: { fontSize: FontSize.sm, color: Colors.textSecondary },
  actions: { flexDirection: "row", gap: 8 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
});
