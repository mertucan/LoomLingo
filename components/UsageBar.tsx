import { StyleSheet, Text, View } from "react-native";
import { QuotaStatus } from "../utils/quota";
import { colors, font } from "./theme";

const COLORS = { ok: colors.success, warn: colors.warning, low: colors.danger, empty: colors.danger };
function message(status: QuotaStatus): string {
  if (status.level === "empty") return `Bugünkü hak doldu. ${status.resetText} yenilenir. Çevrilmiş videolar Geçmiş'ten izlenebilir.`;
  if (status.level === "low") return `Hak azaldı: yaklaşık ${status.videosLeft} video daha çevrilebilir.`;
  return `Yaklaşık ${status.videosLeft} video daha çevrilebilir.`;
}

/** "Bugünkü çeviri hakkı" bar: remaining share of today's free Gemini quota. */
export function UsageBar({ status, detailed = false }: { status: QuotaStatus; detailed?: boolean }) {
  const remaining = Math.max(0, 1 - status.fraction);
  return <View style={[styles.card, status.level !== "ok" && { borderColor: COLORS[status.level] }]} accessible accessibilityLabel={`Bugünkü çeviri hakkı yüzde ${Math.round(remaining * 100)}. ${message(status)}`}>
    <View style={styles.row}><Text style={styles.title}>Bugünkü çeviri hakkı</Text><Text style={[styles.percent, { color: COLORS[status.level] }]}>%{Math.round(remaining * 100)}</Text></View>
    <View style={styles.track}><View style={[styles.fill, { width: `${remaining * 100}%`, backgroundColor: COLORS[status.level] }]} /></View>
    <Text style={[styles.text, status.level !== "ok" && { color: COLORS[status.level], fontWeight: "700" }]}>{message(status)}</Text>
    {detailed && <Text style={styles.detail}>Bugün {status.videos} video, yaklaşık {status.minutes} dakika çevrildi. Hak her gün {status.resetText.replace(/^(bugün|yarın) /, "")} yenilenir. Bu sayılar yaklaşıktır; kesin limit Google AI Studio'da görünür.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border, padding: 16, marginVertical: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: font.body, fontWeight: "800", color: colors.text },
  percent: { fontSize: font.heading, fontWeight: "900" },
  track: { height: 26, borderRadius: 13, backgroundColor: "#E2E8F0", overflow: "hidden", marginVertical: 10 },
  fill: { height: "100%", borderRadius: 13 },
  text: { fontSize: font.small, lineHeight: 26, color: colors.muted },
  detail: { fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: 8 },
});
