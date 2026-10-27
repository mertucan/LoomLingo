import { Ionicons } from "@expo/vector-icons";
import { Alert, StyleSheet, Text, View } from "react-native";
import { canReport, sendReport } from "../services/log";
import { Button } from "./Button";
import { colors, font, radius } from "./theme";
export function ErrorCard({ message, onRetry, retryLabel = "Tekrar Dene", tone = "error", reportable = false }: { message: string; onRetry?: () => void; retryLabel?: string; tone?: "error" | "warning"; reportable?: boolean }) {
  const color = tone === "error" ? colors.danger : colors.warning;
  return <View style={[styles.card, { backgroundColor: tone === "error" ? colors.dangerSoft : colors.warningSoft, borderColor: color }]}>
    <View style={styles.row}><Ionicons name={tone === "error" ? "alert-circle" : "time-outline"} size={28} color={color} /><Text accessibilityLiveRegion="assertive" style={[styles.text, { color }]}>{message}</Text></View>
    {onRetry && <Button icon="refresh" label={retryLabel} onPress={onRetry} />}
    {reportable && canReport() && <Text style={[styles.report, { color }]} accessibilityRole="button" onPress={() => void sendReport().then(ok => { if (!ok) Alert.alert("E-posta uygulaması bulunamadı"); })}>Sorun devam ederse bildirin</Text>}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 16, gap: 8, borderRadius: radius, borderWidth: 1.5, marginVertical: 10 }, row: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, text: { flex: 1, fontSize: font.body, lineHeight: 28, fontWeight: "600" }, report: { fontSize: font.small, fontWeight: "700", textDecorationLine: "underline", textAlign: "center", paddingVertical: 8 } });
