import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, font } from "./theme";
export function ProgressCard({ message }: { message: string }) {
  return <View style={styles.card}><ActivityIndicator size="large" color={colors.primary} /><Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text><Text style={styles.hint}>Lütfen bekleyin, uygulamayı kapatmayın.</Text></View>;
}
const styles = StyleSheet.create({ card: { padding: 24, gap: 14, alignItems: "center", backgroundColor: colors.secondary, borderRadius: 18, marginTop: 18 }, text: { color: "#0C4A6E", fontSize: font.body, lineHeight: 30, fontWeight: "700", textAlign: "center" }, hint: { color: colors.muted, fontSize: font.small, textAlign: "center" } });
