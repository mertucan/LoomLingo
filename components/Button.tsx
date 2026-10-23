import { Pressable, StyleSheet, Text } from "react-native";
export function Button({ label, onPress, kind = "primary", disabled = false }: { label: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.base, styles[kind], disabled && styles.disabled]}><Text style={[styles.text, kind === "secondary" && styles.secondaryText]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ base: { minHeight: 56, borderRadius: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", marginVertical: 5 }, primary: { backgroundColor: "#075985" }, secondary: { backgroundColor: "#E0F2FE", borderWidth: 1, borderColor: "#075985" }, danger: { backgroundColor: "#B91C1C" }, disabled: { opacity: .5 }, text: { color: "white", fontSize: 19, fontWeight: "700" }, secondaryText: { color: "#083344" } });
