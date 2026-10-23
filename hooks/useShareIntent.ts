import { useEffect, useRef } from "react";
import { AppState } from "react-native";

type SharingModule = typeof import("expo-sharing");

/**
 * Android receive-share support supplied by Expo Sharing (requires the APK;
 * Expo Go has no receive-share activity). The text is read on start and each
 * time the app comes back to the foreground, then cleared so it is handled
 * only once.
 */
export function useShareIntent(onText: (text: string) => void): void {
  const handler = useRef(onText); handler.current = onText;
  useEffect(() => {
    let sharing: SharingModule | null = null; let alive = true;
    const check = () => {
      try {
        const text = sharing?.getSharedPayloads().map(p => p.value).find(Boolean);
        if (text) { sharing?.clearSharedPayloads(); handler.current(text); }
      } catch { /* Sharing is optional; normal paste keeps working. */ }
    };
    // Loaded lazily so a missing native module cannot crash the app at start.
    import("expo-sharing").then(module => { if (alive) { sharing = module; check(); } }).catch(() => undefined);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") check(); });
    return () => { alive = false; subscription.remove(); };
  }, []);
}
