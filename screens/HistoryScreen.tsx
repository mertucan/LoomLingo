import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { clearCache, getHistoryItems, removeCached } from "../services/cache";
import { TranslationResult } from "../types";
export function HistoryScreen({ onOpen, onBack }: { onOpen: (item: TranslationResult) => void; onBack: () => void }) {
  const [items, setItems] = useState<TranslationResult[]>([]); const load = useCallback(() => void getHistoryItems().then(setItems), []); useEffect(load, [load]);
  const erase = (id: string) => Alert.alert("Geçmişten silinsin mi?", "Bu çeviri telefondan kaldırılacak.", [{ text: "Vazgeç", style: "cancel" }, { text: "Sil", style: "destructive", onPress: () => void removeCached(id).then(load) }]);
  return <View style={styles.page}><Text style={styles.title}>Geçmiş</Text><FlatList data={items} keyExtractor={x => x.videoId} ListEmptyComponent={<Text style={styles.empty}>Henüz çevrilmiş video yok.</Text>} renderItem={({ item }) => <View style={styles.item}><Text onPress={() => onOpen(item)} style={styles.itemTitle}>{item.title}</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString("tr-TR")}</Text><Button label="Sil" kind="danger" onPress={() => erase(item.videoId)} /></View>} /><Button label="Tüm Geçmişi Sil" kind="danger" onPress={() => Alert.alert("Tüm geçmiş silinsin mi?", "Tüm kayıtlı çeviriler telefondan kaldırılır.", [{ text: "Vazgeç", style: "cancel" }, { text: "Tümünü Sil", style: "destructive", onPress: () => void clearCache().then(load) }])} /><Button label="Geri" onPress={onBack} /></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 20, backgroundColor: "#F8FAFC" }, title: { fontSize: 30, fontWeight: "800", color: "#082F49", marginBottom: 18 }, item: { backgroundColor: "white", padding: 16, borderRadius: 14, marginBottom: 12 }, itemTitle: { fontSize: 20, fontWeight: "700", color: "#075985" }, date: { fontSize: 16, color: "#475569", marginTop: 6 }, empty: { fontSize: 19, color: "#475569", marginTop: 30, textAlign: "center" } });
