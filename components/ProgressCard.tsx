import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
export function ProgressCard({ message }: { message: string }) { return <View style={styles.card}><ActivityIndicator size="large" color="#075985" /><Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text></View>; }
const styles = StyleSheet.create({ card: { padding: 24, gap: 16, alignItems: "center", backgroundColor: "#E0F2FE", borderRadius: 16, marginTop: 18 }, text: { color: "#0C4A6E", fontSize: 19, textAlign: "center" } });
