import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { colors, font } from "../components/theme";
import { clearCache, getHistoryItems, removeCached } from "../services/cache";
import { TranslationResult } from "../types";
export function HistoryScreen({ onOpen, onBack }: { onOpen: (item: TranslationResult) => void; onBack: () => void }) {
  const [items, setItems] = useState<TranslationResult[]>([]); const load = useCallback(() => void getHistoryItems().then(setItems), []); useEffect(load, [load]);
  const erase = (id: string) => Alert.alert("Geçmişten silinsin mi?", "Bu çeviri telefondan kaldırılacak.", [{ text: "Vazgeç", style: "cancel" }, { text: "Sil", style: "destructive", onPress: () => void removeCached(id).then(load) }]);
  return <View style={styles.page}><Text style={styles.title}>🕘 Geçmiş</Text><Text style={styles.help}>Buradaki videolar internetsiz ve hak harcamadan tekrar açılır.</Text>
    <FlatList data={items} keyExtractor={x => x.videoId} ListEmptyComponent={<Text style={styles.empty}>Henüz çevrilmiş video yok.</Text>}
      renderItem={({ item }) => <View style={styles.item}><Text style={styles.itemTitle} numberOfLines={3}>{item.title}</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString("tr-TR")} · {item.sourceLanguage}</Text>
        <View style={styles.row}><View style={styles.wide}><Button icon="▶️" label="Aç" onPress={() => onOpen(item)} /></View><Button flex icon="🗑️" label="Sil" kind="danger" onPress={() => erase(item.videoId)} /></View></View>}
      ListFooterComponent={items.length ? <Button icon="🗑️" label="Tüm Geçmişi Sil" kind="danger" onPress={() => Alert.alert("Tüm geçmiş silinsin mi?", "Tüm kayıtlı çeviriler telefondan kaldırılır.", [{ text: "Vazgeç", style: "cancel" }, { text: "Tümünü Sil", style: "destructive", onPress: () => void clearCache().then(load) }])} /> : null} />
    <Button icon="🏠" label="Ana Sayfa" onPress={onBack} /></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 20, backgroundColor: colors.background }, title: { fontSize: font.title, fontWeight: "900", color: "#082F49" }, help: { fontSize: font.small, lineHeight: 26, color: colors.muted, marginVertical: 10 }, item: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, padding: 16, borderRadius: 16, marginBottom: 12 }, itemTitle: { fontSize: font.body, lineHeight: 29, fontWeight: "800", color: colors.text }, date: { fontSize: 17, color: colors.muted, marginTop: 6 }, row: { flexDirection: "row", gap: 10 }, wide: { flex: 2 }, empty: { fontSize: font.body, color: colors.muted, marginTop: 30, textAlign: "center" } });
