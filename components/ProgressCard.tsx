import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { card, colors, font } from "./theme";
export function ProgressCard({ message }: { message: string }) {
  return <View style={styles.card}><ActivityIndicator size="large" color={colors.primary} /><Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text></View>;
}
const styles = StyleSheet.create({ card: { ...card, padding: 22, gap: 14, alignItems: "center", marginVertical: 10 }, text: { color: colors.text, fontSize: font.body, lineHeight: 28, fontWeight: "600", textAlign: "center" } });
