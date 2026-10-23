import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.card}><Text accessibilityLiveRegion="assertive" style={styles.text}>{message}</Text><Button label="Tekrar Dene" onPress={onRetry} /></View>;
}
const styles = StyleSheet.create({ card: { padding: 20, gap: 12, backgroundColor: "#FEF2F2", borderWidth: 2, borderColor: "#B91C1C", borderRadius: 16, marginTop: 18 }, text: { color: "#7F1D1D", fontSize: 20, lineHeight: 29, fontWeight: "600" } });
