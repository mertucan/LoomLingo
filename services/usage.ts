import AsyncStorage from "@react-native-async-storage/async-storage";
const key = () => { const d = new Date(); return `loom-lingo/usage/${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export async function incrementUsage(): Promise<number> { const value = Number(await AsyncStorage.getItem(key()) ?? "0") + 1; await AsyncStorage.setItem(key(), String(value)); return value; }
export async function getUsage(): Promise<number> { return Number(await AsyncStorage.getItem(key()) ?? "0"); }
