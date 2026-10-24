import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, font, radius } from "./theme";
export function ErrorCard({ message, onRetry, retryLabel = "Tekrar Dene", tone = "error" }: { message: string; onRetry?: () => void; retryLabel?: string; tone?: "error" | "warning" }) {
  const color = tone === "error" ? colors.danger : colors.warning;
  return <View style={[styles.card, { backgroundColor: tone === "error" ? colors.dangerSoft : colors.warningSoft, borderColor: color }]}>
    <View style={styles.row}><Ionicons name={tone === "error" ? "alert-circle" : "time-outline"} size={28} color={color} /><Text accessibilityLiveRegion="assertive" style={[styles.text, { color }]}>{message}</Text></View>
    {onRetry && <Button icon="refresh" label={retryLabel} onPress={onRetry} />}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 16, gap: 8, borderRadius: radius, borderWidth: 1.5, marginVertical: 10 }, row: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, text: { flex: 1, fontSize: font.body, lineHeight: 28, fontWeight: "600" } });
