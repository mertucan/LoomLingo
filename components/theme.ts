import { Platform } from "react-native";

/** Calm, high-contrast styling for an older, farsighted user. Navy matches the app icon. */
export const colors = {
  background: "#F3F5F8", surface: "#FFFFFF", text: "#0F172A", muted: "#475569", line: "#E2E8F0",
  primary: "#0B3B60", primarySoft: "#E7EEF6", onPrimary: "#FFFFFF",
  danger: "#B42318", dangerSoft: "#FEF3F2", success: "#067647", warning: "#B54708", warningSoft: "#FFFAEB",
  subtitleBackground: "#0B1220", subtitleText: "#FFFFFF",
};
export const font = { title: 30, heading: 22, body: 20, small: 17, caption: 15 };
export const radius = 16;
export const shadow = Platform.select({
  android: { elevation: 2 },
  default: { shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
});
export const card = { backgroundColor: colors.surface, borderRadius: radius, ...shadow };
