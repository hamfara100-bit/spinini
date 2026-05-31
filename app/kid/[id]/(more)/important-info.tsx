import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { useData } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{emoji} {title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, phone }: { label: string; value: string; phone?: boolean }) {
  if (!value.trim()) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {phone ? (
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${value.replace(/\D/g, "")}`)}>
          <Text style={[styles.infoValue, styles.phoneValue]}>{value} 📞</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.infoValue}>{value}</Text>
      )}
    </View>
  );
}

export default function ImportantInfoKidScreen() {
  const { state } = useData();
  const info = state.importantInfo;

  const hasAny = info.emergencyContacts.length > 0 || info.healthInsurance || info.lifeInsurance ||
    info.doctorName || info.emergencyPlan || info.emergencyLocation || info.additionalNotes;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🆘 Important Info</Text>
      <Text style={styles.sub}>Emergency contacts and important family information — here when you need it!</Text>

      {!hasAny ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52 }}>📋</Text>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptySub}>Your parent will add emergency contacts and important info here.</Text>
        </View>
      ) : (
        <>
          {/* Emergency - most prominent */}
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerTitle}>🆘 In an emergency — call 911 first!</Text>
            <Text style={styles.emergencyBannerText}>Then check below for family contacts and instructions.</Text>
          </View>

          {info.emergencyContacts.length > 0 && (
            <Section title="Emergency Contacts" emoji="📞">
              {info.emergencyContacts.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.contactCard}
                  onPress={() => Linking.openURL(`tel:${c.phone.replace(/\D/g, "")}`)}
                >
                  <View style={styles.contactAvatar}>
                    <Text style={{ fontSize: 24 }}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactRelation}>{c.relation}</Text>
                    <Text style={styles.contactPhone}>{c.phone}</Text>
                  </View>
                  <View style={styles.callBadge}>
                    <Text style={styles.callBadgeText}>📞 Tap to call</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Section>
          )}

          {info.emergencyPlan && (
            <Section title="What to Do in Emergency" emoji="📋">
              <Text style={styles.planText}>{info.emergencyPlan}</Text>
            </Section>
          )}

          {info.emergencyLocation && (
            <Section title="Where to Go" emoji="📍">
              <Text style={styles.planText}>{info.emergencyLocation}</Text>
            </Section>
          )}

          {(info.doctorName || info.doctorPhone) && (
            <Section title="Our Doctor" emoji="🏥">
              <InfoRow label="Name" value={info.doctorName} />
              <InfoRow label="Phone" value={info.doctorPhone} phone />
            </Section>
          )}

          {info.healthInsurance && (
            <Section title="Health Insurance" emoji="💊">
              <Text style={styles.planText}>{info.healthInsurance}</Text>
            </Section>
          )}

          {info.lifeInsurance && (
            <Section title="Life Insurance" emoji="📄">
              <Text style={styles.planText}>{info.lifeInsurance}</Text>
            </Section>
          )}

          {info.additionalNotes && (
            <Section title="Other Important Notes" emoji="📝">
              <Text style={styles.planText}>{info.additionalNotes}</Text>
            </Section>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.error, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 10 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  emergencyBanner: { backgroundColor: Colors.error, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg },
  emergencyBannerTitle: { color: "#fff", fontWeight: "800", fontSize: FontSize.base, marginBottom: 4 },
  emergencyBannerText: { color: "#fff", fontSize: FontSize.sm, opacity: 0.9 },
  section: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, marginBottom: 12, overflow: "hidden", ...Shadow.sm },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, backgroundColor: Colors.primary + "10", padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionBody: { padding: Spacing.md },
  contactCard: { flexDirection: "row", alignItems: "center", marginBottom: 8, padding: 10, backgroundColor: Colors.cardLight, borderRadius: Radius.md },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center", marginRight: 10 },
  contactName: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  contactRelation: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  contactPhone: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", marginTop: 1 },
  callBadge: { backgroundColor: Colors.success + "20", borderRadius: Radius.md, padding: 6 },
  callBadgeText: { fontSize: 11, color: Colors.success, fontWeight: "700" },
  planText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },
  infoRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600", width: 80 },
  infoValue: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  phoneValue: { color: Colors.primary, fontWeight: "700" },
});
