import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, font } from "./theme";
export function ErrorCard({ message, onRetry, retryLabel = "Tekrar Dene" }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return <View style={styles.card}><Text accessibilityLiveRegion="assertive" style={styles.text}>⚠️  {message}</Text>{onRetry && <Button icon="🔄" label={retryLabel} onPress={onRetry} />}</View>;
}
const styles = StyleSheet.create({ card: { padding: 20, gap: 12, backgroundColor: "#FEF2F2", borderWidth: 3, borderColor: colors.danger, borderRadius: 18, marginTop: 18 }, text: { color: "#7F1D1D", fontSize: font.body, lineHeight: 31, fontWeight: "700" } });
