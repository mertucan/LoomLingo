import { Pressable, StyleSheet, Text } from "react-native";
import { colors, font } from "./theme";
type Props = { label: string; onPress: () => void; icon?: string; kind?: "primary" | "secondary" | "danger"; size?: "large" | "normal"; disabled?: boolean; flex?: boolean };
export function Button({ label, onPress, icon, kind = "primary", size = "normal", disabled = false, flex = false }: Props) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.base, size === "large" && styles.large, styles[kind], flex && styles.flex, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={[styles.text, size === "large" && styles.largeText, kind === "secondary" && styles.secondaryText]}>{icon ? `${icon}  ${label}` : label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  base: { minHeight: 64, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", justifyContent: "center", marginVertical: 6 },
  large: { minHeight: 84, borderRadius: 20 },
  flex: { flex: 1 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary, borderWidth: 2, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.75 },
  text: { color: colors.primaryText, fontSize: font.button, fontWeight: "800", textAlign: "center" },
  largeText: { fontSize: 25 },
  secondaryText: { color: colors.secondaryText },
});
