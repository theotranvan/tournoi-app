import { isNative } from "./capacitor";

type HapticStyle = "light" | "medium" | "heavy";

const VIBRATION_MS: Record<HapticStyle, number> = {
  light: 10,
  medium: 20,
  heavy: 40,
};

export async function triggerHaptic(style: HapticStyle = "medium") {
  try {
    if (isNative()) {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      const map = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      } as const;
      await Haptics.impact({ style: map[style] });
    } else if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(VIBRATION_MS[style]);
    }
  } catch {
    // Silently ignore — haptics are a nice-to-have
  }
}
