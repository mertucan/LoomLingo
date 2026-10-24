import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { card, colors, font, radius } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
type Kind = "primary" | "secondary" | "danger";
type Props = { label: string; onPress: () => void; icon?: IconName; kind?: Kind; size?: "large" | "normal"; disabled?: boolean; flex?: boolean };
const TEXT: Record<Kind, string> = { primary: colors.onPrimary, secondary: colors.primary, danger: colors.danger };

export function Button({ label, onPress, icon, kind = "primary", size = "normal", disabled = false, flex = false }: Props) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.base, size === "large" && styles.large, styles[kind], flex && styles.flex, disabled && styles.disabled, pressed && styles.pressed]}>
    {icon && <Ionicons name={icon} size={size === "large" ? 28 : 24} color={TEXT[kind]} />}
    <Text style={[styles.text, size === "large" && styles.largeText, { color: TEXT[kind] }]}>{label}</Text>
  </Pressable>;
}

/** Square action with the icon above a short label; used in rows of two or three. */
export function Tile({ label, icon, onPress, active = false }: { label: string; icon: IconName; onPress: () => void; active?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress}
    style={({ pressed }) => [styles.tile, active && styles.tileActive, pressed && styles.pressed]}>
    <Ionicons name={icon} size={30} color={active ? colors.onPrimary : colors.primary} />
    <Text style={[styles.tileText, active && { color: colors.onPrimary }]} numberOfLines={2}>{label}</Text>
  </Pressable>;
}

export function Row({ children }: { children: React.ReactNode }) { return <View style={styles.row}>{children}</View>; }

const styles = StyleSheet.create({
  base: { minHeight: 60, borderRadius: radius, paddingHorizontal: 18, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", marginVertical: 6 },
  large: { minHeight: 76 },
  flex: { flex: 1 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  danger: { backgroundColor: colors.dangerSoft },
  disabled: { opacity: 0.4 }, pressed: { opacity: 0.7 },
  text: { fontSize: font.body, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  largeText: { fontSize: 22 },
  tile: { ...card, flex: 1, minHeight: 92, alignItems: "center", justifyContent: "center", gap: 6, padding: 10 },
  tileActive: { backgroundColor: colors.primary },
  tileText: { fontSize: font.small, fontWeight: "700", color: colors.primary, textAlign: "center" },
  row: { flexDirection: "row", gap: 12, marginVertical: 6 },
});
