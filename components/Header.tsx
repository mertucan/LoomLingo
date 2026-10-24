import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font } from "./theme";

/** Screen title with a large back arrow. */
export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={styles.bar}>
    <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Geri" hitSlop={12} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
      <Ionicons name="chevron-back" size={30} color={colors.primary} />
    </Pressable>
    <Text style={styles.title} numberOfLines={1}>{title}</Text>
  </View>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: colors.background },
  back: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26 },
  title: { flex: 1, fontSize: font.heading + 2, fontWeight: "800", color: colors.text },
});
