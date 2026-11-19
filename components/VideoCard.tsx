import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { TranslationResult } from "../types";
import { card, colors, font } from "./theme";

/** A translated video: YouTube thumbnail, title and a short detail line. `progress` (0-1) is how much was watched. */
export function VideoCard({ item, detail, progress, onPress, onDelete }: { item: TranslationResult; detail?: string; progress?: number; onPress: () => void; onDelete?: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.title} videosunu aç`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
    <View>
      <Image source={{ uri: `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` }} style={styles.thumb} />
      <View style={styles.play}><Ionicons name="play" size={22} color="#fff" /></View>
      {!!progress && progress > 0.02 && <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, progress * 100)}%` }]} /></View>}
    </View>
    <View style={styles.body}>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      {detail && <Text style={styles.detail} numberOfLines={1}>{detail}</Text>}
    </View>
    {onDelete && <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sil" style={styles.delete}><Ionicons name="trash-outline" size={26} color={colors.danger} /></Pressable>}
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { ...card, flexDirection: "row", alignItems: "center", gap: 12, padding: 10, marginVertical: 6 },
  thumb: { width: 128, height: 72, borderRadius: 10, backgroundColor: colors.line },
  play: { position: "absolute", left: 46, top: 18, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 5, backgroundColor: "rgba(255,255,255,0.5)", borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: "#E30A17" },
  body: { flex: 1, gap: 4 },
  title: { fontSize: font.small, lineHeight: 23, fontWeight: "700", color: colors.text },
  detail: { fontSize: font.caption, color: colors.muted },
  delete: { padding: 8 },
});
