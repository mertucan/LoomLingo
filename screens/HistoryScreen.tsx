import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { colors, font } from "../components/theme";
import { VideoCard } from "../components/VideoCard";
import { clearCache, getHistoryItems, removeCached } from "../services/cache";
import { TranslationResult } from "../types";

export function HistoryScreen({ onOpen, onBack }: { onOpen: (item: TranslationResult) => void; onBack: () => void }) {
  const [items, setItems] = useState<TranslationResult[]>([]); const load = useCallback(() => void getHistoryItems().then(setItems), []); useEffect(load, [load]);
  const erase = (id: string) => Alert.alert("Silinsin mi?", "Bu video geçmişten kaldırılır.", [{ text: "Vazgeç", style: "cancel" }, { text: "Sil", style: "destructive", onPress: () => void removeCached(id).then(load) }]);
  const eraseAll = () => Alert.alert("Tümü silinsin mi?", "Bütün çeviriler telefondan kaldırılır.", [{ text: "Vazgeç", style: "cancel" }, { text: "Tümünü Sil", style: "destructive", onPress: () => void clearCache().then(load) }]);
  return <View style={styles.page}>
    <Header title="Geçmiş" onBack={onBack} />
    <FlatList contentContainerStyle={styles.list} data={items} keyExtractor={x => x.videoId}
      ListHeaderComponent={items.length ? <Text style={styles.help}>İnternetsiz ve hak harcamadan izlenir.</Text> : null}
      ListEmptyComponent={<Text style={styles.empty}>Henüz çevrilmiş video yok.</Text>}
      renderItem={({ item }) => <VideoCard item={item} detail={`${new Date(item.createdAt).toLocaleDateString("tr-TR")} · ${item.sourceLanguage}`} onPress={() => onOpen(item)} onDelete={() => erase(item.videoId)} />}
      ListFooterComponent={items.length > 1 ? <Button icon="trash-outline" label="Tümünü Sil" kind="danger" onPress={eraseAll} /> : null} />
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, list: { paddingHorizontal: 16, paddingBottom: 30 },
  help: { fontSize: font.caption, color: colors.muted, marginBottom: 6, marginLeft: 4 },
  empty: { fontSize: font.body, color: colors.muted, marginTop: 40, textAlign: "center" },
});
